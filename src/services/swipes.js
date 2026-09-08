import { doc, setDoc, updateDoc, deleteDoc, getDocs, collection, increment, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import { buildPreferenceUpdate } from './recommendation.js'

// Haalt alle movieIds op die de gebruiker al geswiped heeft in de solo
// Discover-flow (voor het uitsluiten uit nieuwe kandidaten).
export async function getSwipedMovieIds(uid) {
  const snaps = await getDocs(collection(db, 'users', uid, 'swipes'))
  return snaps.docs.map((d) => d.id)
}

// Slaat 1 solo-swipe op én werkt meteen het voorkeursprofiel bij.
export async function recordSoloSwipe(uid, movie, liked) {
  const swipeRef = doc(db, 'users', uid, 'swipes', String(movie.id))
  await setDoc(swipeRef, {
    movieId: movie.id,
    liked,
    title: movie.title,
    posterPath: movie.posterPath,
    swipedAt: serverTimestamp()
  })

  const prefUpdates = buildPreferenceUpdate(movie, liked)
  const userRef = doc(db, 'users', uid)
  await updateDoc(userRef, {
    ...prefUpdates,
    swipeCount: increment(1)
  })
}

// Maakt een solo-swipe ongedaan: verwijdert de swipe en trekt exact de
// eerder toegepaste voorkeurs-aanpassing weer terug.
export async function undoSoloSwipe(uid, movie, liked) {
  const swipeRef = doc(db, 'users', uid, 'swipes', String(movie.id))
  await deleteDoc(swipeRef)

  // buildPreferenceUpdate(movie, !liked) levert precies het omgekeerde teken
  // op van wat recordSoloSwipe(movie, liked) net had toegepast.
  const revertUpdates = buildPreferenceUpdate(movie, !liked)
  const userRef = doc(db, 'users', uid)
  await updateDoc(userRef, {
    ...revertUpdates,
    swipeCount: increment(-1)
  })
}

