import { doc, setDoc, updateDoc, getDocs, collection, increment, serverTimestamp } from 'firebase/firestore'
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
