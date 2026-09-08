// Cachet genormaliseerde filmdata in Firestore (collectie "movies"), zodat
// we niet bij elke swipe/render opnieuw TMDB-detail- en credits-calls doen.
// De cache is gedeeld tussen alle gebruikers (movies-collectie is publiek
// leesbaar, zie firestore.rules) en wordt na 30 dagen als verouderd
// beschouwd en verversd.

import { doc, getDoc, setDoc, getDocs, query, where, documentId, collection } from 'firebase/firestore'
import { db } from '../firebase.js'
import { fetchMovieDetails } from './tmdb.js'

const STALE_MS = 30 * 24 * 60 * 60 * 1000 // 30 dagen
const memoryCache = new Map() // extra laag binnen 1 sessie, voorkomt herhaalde Firestore reads

export async function getOrCacheMovie(tmdbId) {
  const idStr = String(tmdbId)
  if (memoryCache.has(idStr)) return memoryCache.get(idStr)

  const ref = doc(db, 'movies', idStr)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    const data = snap.data()
    const isFresh = data.cachedAt && Date.now() - data.cachedAt < STALE_MS
    if (isFresh) {
      memoryCache.set(idStr, data)
      return data
    }
  }

  const fresh = await fetchMovieDetails(tmdbId)
  await setDoc(ref, fresh, { merge: true })
  memoryCache.set(idStr, fresh)
  return fresh
}

// Haalt meerdere films op met zo min mogelijk losse requests:
// eerst een batched Firestore "in"-query (max 30 ids per keer) voor wat al
// gecached is, daarna alleen voor de ontbrekende/verlopen ids een TMDB-call.
export async function getOrCacheMovies(tmdbIds) {
  const ids = [...new Set(tmdbIds.map(String))]
  const missing = []
  const result = new Map()

  for (const id of ids) {
    if (memoryCache.has(id)) result.set(id, memoryCache.get(id))
  }

  const toLookup = ids.filter((id) => !result.has(id))
  const chunks = chunk(toLookup, 30)

  for (const c of chunks) {
    if (c.length === 0) continue
    const q = query(collection(db, 'movies'), where(documentId(), 'in', c))
    const snaps = await getDocs(q)
    snaps.forEach((s) => {
      const data = s.data()
      const isFresh = data.cachedAt && Date.now() - data.cachedAt < STALE_MS
      if (isFresh) {
        result.set(s.id, data)
        memoryCache.set(s.id, data)
      }
    })
  }

  const stillMissing = ids.filter((id) => !result.has(id))
  await Promise.all(
    stillMissing.map(async (id) => {
      const fresh = await getOrCacheMovie(id)
      result.set(id, fresh)
    })
  )

  return ids.map((id) => result.get(id)).filter(Boolean)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
