// Eenvoudig, transparant aanbevelingsalgoritme — GEEN AI/ML.
//
// Elke gebruiker heeft een voorkeursprofiel (preferences) met een score per
// genre, regisseur en acteur. Een like verhoogt de score van de kenmerken
// van die film, een dislike verlaagt hem. Nieuwe films krijgen een score op
// basis van hoe goed hun kenmerken matchen met het profiel, plus een kleine
// invloed van de TMDB-rating. Bij het kiezen van de volgende kaart mixen we
// dit met randomness en ~20% "ontdekking" (films buiten de voorkeur), zodat
// de gebruiker niet vastloopt in een bubbel.

export const WEIGHTS = {
  genre: 3,
  director: 4,
  actor: 2,
  rating: 1
}

export const DISCOVERY_RATIO = 0.2 // ~20% van de kaarten is bewust "buiten het profiel"

// --- Score berekenen -------------------------------------------------

export function scoreMovie(movie, preferences) {
  const prefs = preferences || { genres: {}, directors: {}, actors: {} }
  let score = 0

  for (const genre of movie.genres || []) {
    score += WEIGHTS.genre * (prefs.genres?.[genre.id] || 0)
  }
  for (const director of movie.directors || []) {
    score += WEIGHTS.director * (prefs.directors?.[director.id] || 0)
  }
  for (const actor of movie.cast || []) {
    score += WEIGHTS.actor * (prefs.actors?.[actor.id] || 0)
  }

  // Rating normaliseren rond het midden van de TMDB-schaal (0-10), zodat
  // goed beoordeelde films een kleine bonus krijgen en slecht beoordeelde
  // een kleine straf, ongeacht het voorkeursprofiel.
  const ratingSignal = ((movie.voteAverage || 5) - 5.5) / 4.5
  score += WEIGHTS.rating * ratingSignal

  return score
}

// --- Voorkeursprofiel bijwerken na een swipe --------------------------

// Retourneert een object met Firestore dot-path keys, klaar om met
// updateDoc(userRef, updates) + increment() te gebruiken.
export function buildPreferenceUpdate(movie, liked) {
  const sign = liked ? 1 : -1
  const updates = {}

  for (const genre of (movie.genres || []).slice(0, 3)) {
    updates[`preferences.genres.${genre.id}`] = sign * WEIGHTS.genre
  }
  for (const director of movie.directors || []) {
    updates[`preferences.directors.${director.id}`] = sign * WEIGHTS.director
  }
  for (const actor of (movie.cast || []).slice(0, 3)) {
    updates[`preferences.actors.${actor.id}`] = sign * WEIGHTS.actor
  }

  return updates
}

// --- Volgende kaart kiezen ---------------------------------------------

// candidates: array van genormaliseerde movie-objecten (niet eerder geswiped)
// preferences: het voorkeursprofiel van de gebruiker
// Retourneert 1 film, of null als de pool leeg is.
export function pickNextCandidate(candidates, preferences) {
  if (!candidates || candidates.length === 0) return null

  const isDiscoveryPick = Math.random() < DISCOVERY_RATIO
  if (isDiscoveryPick) {
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  const scored = candidates.map((movie) => ({ movie, score: scoreMovie(movie, preferences) }))
  scored.sort((a, b) => b.score - a.score)

  // Gewogen willekeurige keuze uit de best scorende helft, zodat het niet
  // altijd exact dezelfde volgorde is maar wel voorkeur-gestuurd blijft.
  const pool = scored.slice(0, Math.max(1, Math.ceil(scored.length / 2)))
  const minScore = Math.min(...pool.map((p) => p.score))
  const weights = pool.map((p) => p.score - minScore + 1) // altijd > 0
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  let r = Math.random() * totalWeight
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i].movie
  }
  return pool[0].movie
}

// Bepaalt welke genres momenteel het meest voorkeur genieten, gebruikt om
// gerichte TMDB discover-queries te doen i.p.v. alleen "popular".
export function topGenreIds(preferences, count = 3) {
  const genres = preferences?.genres || {}
  return Object.entries(genres)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 0)
    .slice(0, count)
    .map(([id]) => Number(id))
}
