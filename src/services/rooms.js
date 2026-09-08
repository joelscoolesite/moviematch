import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  runTransaction,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { fetchPopular, fetchTrendingWeek } from './tmdb.js'
import { getOrCacheMovies } from './movieCache.js'
import { generateRoomCode } from '../utils/roomCode.js'
import { buildPreferenceUpdate } from './recommendation.js'

const DECK_SIZE = 30

// Bouwt de gedeelde film-deck voor een nieuwe room: iedereen in de room
// swiped exact dezelfde set films, zodat "samen matchen" betekenis heeft.
async function buildRoomDeck() {
  const [popular, trending] = await Promise.all([fetchPopular(1), fetchTrendingWeek()])
  const merged = [...trending, ...popular]
  const uniqueIds = [...new Set(merged.map((m) => m.id))].slice(0, DECK_SIZE)
  const detailed = await getOrCacheMovies(uniqueIds)
  return detailed.map((m) => m.id)
}

export async function createRoom(uid, displayName, photoURL, name) {
  let code = generateRoomCode()
  // Kleine kans op botsing; probeer opnieuw als de code al bestaat.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getDoc(doc(db, 'rooms', code))
    if (!existing.exists()) break
    code = generateRoomCode()
  }

  const movieIds = await buildRoomDeck()

  await setDoc(doc(db, 'rooms', code), {
    code,
    name: name || `Filmavond van ${displayName}`,
    createdBy: uid,
    memberIds: [uid],
    movieIds,
    createdAt: serverTimestamp()
  })

  await setDoc(doc(db, 'rooms', code, 'members', uid), {
    displayName,
    photoURL: photoURL || null,
    joinedAt: serverTimestamp()
  })

  return code
}

export async function joinRoom(code, uid, displayName, photoURL) {
  const roomRef = doc(db, 'rooms', code.toUpperCase())
  const snap = await getDoc(roomRef)
  if (!snap.exists()) throw new Error('Room niet gevonden. Controleer de code.')

  await updateDoc(roomRef, { memberIds: arrayUnion(uid) })
  await setDoc(doc(db, 'rooms', code.toUpperCase(), 'members', uid), {
    displayName,
    photoURL: photoURL || null,
    joinedAt: serverTimestamp()
  })

  return code.toUpperCase()
}

export function listenToRoom(roomId, callback) {
  return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

export function listenToRoomMembers(roomId, callback) {
  return onSnapshot(collection(db, 'rooms', roomId, 'members'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function listenToUserRooms(uid, callback) {
  const q = query(
    collection(db, 'rooms'),
    where('memberIds', 'array-contains', uid),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function listenToUserRoomProgress(roomId, uid, callback) {
  return onSnapshot(doc(db, 'rooms', roomId, 'userSwipes', uid), (snap) => {
    callback(snap.exists() ? snap.data().swipes || {} : {})
  })
}

export function listenToRoomSwipes(roomId, callback) {
  return onSnapshot(collection(db, 'rooms', roomId, 'swipes'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// Transactioneel: werkt tegelijk de per-gebruiker voortgang en de
// geaggregeerde like/dislike-telling per film bij, zodat matches (>=2
// likes) betrouwbaar zijn ook bij gelijktijdige swipes van meerdere leden.
export async function recordRoomSwipe(roomId, uid, movie, liked) {
  const movieId = String(movie.id)
  const swipeRef = doc(db, 'rooms', roomId, 'swipes', movieId)
  const userSwipeRef = doc(db, 'rooms', roomId, 'userSwipes', uid)

  await runTransaction(db, async (tx) => {
    // Belangrijk: Firestore-transacties vereisen dat ALLE reads gebeuren
    // vóór ALLE writes. Vandaar eerst beide gets, dan pas beide sets.
    const swipeSnap = await tx.get(swipeRef)
    const userSwipeSnap = await tx.get(userSwipeRef)

    const current = swipeSnap.exists()
      ? swipeSnap.data()
      : { likedBy: [], dislikedBy: [], likeCount: 0, movieSnapshot: minimalSnapshot(movie) }

    let likedBy = current.likedBy.filter((id) => id !== uid)
    let dislikedBy = current.dislikedBy.filter((id) => id !== uid)
    if (liked) likedBy.push(uid)
    else dislikedBy.push(uid)

    tx.set(swipeRef, {
      likedBy,
      dislikedBy,
      likeCount: likedBy.length,
      movieSnapshot: current.movieSnapshot || minimalSnapshot(movie),
      updatedAt: serverTimestamp()
    })

    const swipes = userSwipeSnap.exists() ? userSwipeSnap.data().swipes || {} : {}
    swipes[movieId] = liked ? 'like' : 'dislike'
    tx.set(userSwipeRef, { swipes, updatedAt: serverTimestamp() }, { merge: true })
  })

  // Elke room-swipe telt ook mee voor het persoonlijke voorkeursprofiel,
  // zodat het aanbevelingssysteem overal van leert.
  const prefUpdates = buildPreferenceUpdate(movie, liked)
  if (Object.keys(prefUpdates).length > 0) {
    await updateDoc(doc(db, 'users', uid), prefUpdates)
  }
}

function minimalSnapshot(movie) {
  return {
    id: movie.id,
    title: movie.title,
    posterPath: movie.posterPath,
    year: movie.year || null,
    voteAverage: movie.voteAverage || null
  }
}

// Maakt een room-swipe ongedaan: haalt de gebruiker uit likedBy/dislikedBy,
// verwijdert zijn/haar entry uit de voortgang, en trekt de voorkeursupdate
// terug. Laat de swipe-doc met movieSnapshot gewoon staan (die kan door
// andere leden nog gebruikt worden voor de matchweergave).
export async function undoRoomSwipe(roomId, uid, movie, liked) {
  const movieId = String(movie.id)
  const swipeRef = doc(db, 'rooms', roomId, 'swipes', movieId)
  const userSwipeRef = doc(db, 'rooms', roomId, 'userSwipes', uid)

  await runTransaction(db, async (tx) => {
    const swipeSnap = await tx.get(swipeRef)
    if (!swipeSnap.exists()) return
    const current = swipeSnap.data()
    const likedBy = (current.likedBy || []).filter((id) => id !== uid)
    const dislikedBy = (current.dislikedBy || []).filter((id) => id !== uid)
    tx.set(swipeRef, {
      ...current,
      likedBy,
      dislikedBy,
      likeCount: likedBy.length,
      updatedAt: serverTimestamp()
    })
  })

  await updateDoc(userSwipeRef, { [`swipes.${movieId}`]: deleteField() })

  const revertUpdates = buildPreferenceUpdate(movie, !liked)
  if (Object.keys(revertUpdates).length > 0) {
    await updateDoc(doc(db, 'users', uid), revertUpdates)
  }
}
