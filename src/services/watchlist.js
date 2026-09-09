import { doc, setDoc, deleteDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'

export function listenToWatchlist(uid, callback) {
  return onSnapshot(collection(db, 'users', uid, 'watchlist'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function addToWatchlist(uid, movie) {
  await setDoc(doc(db, 'users', uid, 'watchlist', String(movie.id)), {
    movieId: movie.id,
    title: movie.title,
    posterPath: movie.posterPath,
    year: movie.year || null,
    voteAverage: movie.voteAverage || null,
    genreIds: (movie.genres || []).map((g) => g.id),
    addedAt: serverTimestamp()
  })
}

export async function removeFromWatchlist(uid, movieId) {
  await deleteDoc(doc(db, 'users', uid, 'watchlist', String(movieId)))
}

// Handig gemakslaagje voor UI's die 1 knop hebben die toevoegt/verwijdert
// afhankelijk van de huidige staat (bv. de ster-knop op een filmkaart).
export async function toggleWatchlist(uid, movie, isSaved) {
  if (isSaved) {
    await removeFromWatchlist(uid, movie.id)
  } else {
    await addToWatchlist(uid, movie)
  }
}
