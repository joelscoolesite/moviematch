// Dunne laag rond de TMDB REST API.
// Let op TMDB API-voorwaarden: attributie ("The Movie Database" logo/tekst)
// is verplicht en staat in de Profile-pagina en de footer. Zie
// https://www.themoviedb.org/api-terms-of-use

const API_KEY = import.meta.env.VITE_TMDB_API_KEY
const BASE = 'https://api.themoviedb.org/3'

export const IMG = {
  poster: (path, size = 'w500') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null),
  backdrop: (path, size = 'w780') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null)
}

async function tmdbFetch(path, params = {}) {
  const url = new URL(BASE + path)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('language', 'nl-NL')
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`TMDB-fout (${res.status}) bij ${path}`)
  }
  return res.json()
}

export async function fetchGenreList() {
  const data = await tmdbFetch('/genre/movie/list')
  return data.genres // [{id, name}]
}

export async function fetchPopular(page = 1) {
  const data = await tmdbFetch('/movie/popular', { page })
  return data.results
}

export async function fetchTrendingWeek() {
  const data = await tmdbFetch('/trending/movie/week')
  return data.results
}

export async function fetchDiscoverByGenres(genreIds = [], page = 1) {
  const data = await tmdbFetch('/discover/movie', {
    with_genres: genreIds.join(','),
    sort_by: 'popularity.desc',
    'vote_count.gte': 50,
    page
  })
  return data.results
}

// Generieke discover-call t.b.v. de Discover-filters (genre/decennium/
// leeftijdsclassificatie uitsluiten). Gebruikt door candidatePool.js zodra
// er een filter actief staat. certification.lte volgt de volgorde die TMDB
// voor het opgegeven land aanhoudt (NL: AL, 6, 9, 12, 16, 18) — "12" sluit
// dus 16 en 18 uit. Let op: niet elke film heeft NL-classificatiedata in
// TMDB, dus dit filtert soms iets te streng (films zonder classificatie
// vallen weg) in plaats van te weinig — een bewuste afweging, zie
// PROJECT_CONTEXT.md.
export async function fetchDiscover({
  genreIds = [],
  page = 1,
  releaseDateGte,
  releaseDateLte,
  excludeMatureContent
} = {}) {
  const params = {
    sort_by: 'popularity.desc',
    'vote_count.gte': 50,
    page
  }
  if (genreIds.length > 0) params.with_genres = genreIds.join(',')
  if (releaseDateGte) params['primary_release_date.gte'] = releaseDateGte
  if (releaseDateLte) params['primary_release_date.lte'] = releaseDateLte
  if (excludeMatureContent) {
    params.certification_country = 'NL'
    params['certification.lte'] = '12'
  }
  const data = await tmdbFetch('/discover/movie', params)
  return data.results
}

export async function fetchMovieDetails(tmdbId) {
  const [details, credits] = await Promise.all([
    tmdbFetch(`/movie/${tmdbId}`),
    tmdbFetch(`/movie/${tmdbId}/credits`)
  ])
  return normalizeMovie(details, credits)
}

// Geeft per land aan waar je een film kunt streamen/huren/kopen
// (JustWatch-data, gratis via TMDB). Geen taalparam nodig, deze data is
// niet vertaald.
export async function fetchWatchProviders(tmdbId) {
  return tmdbFetch(`/movie/${tmdbId}/watch/providers`)
}

// Releasedata + type (o.a. bioscoop/theatrical) per land — gebruikt om in
// te schatten of een film nog in de bioscoop draait.
export async function fetchReleaseDates(tmdbId) {
  return tmdbFetch(`/movie/${tmdbId}/release_dates`)
}

export function normalizeMovie(details, credits) {
  const director = (credits?.crew || []).find((c) => c.job === 'Director')
  const cast = (credits?.cast || []).slice(0, 5).map((c) => ({ id: c.id, name: c.name }))
  return {
    id: details.id,
    title: details.title,
    overview: details.overview,
    posterPath: details.poster_path || null,
    backdropPath: details.backdrop_path || null,
    releaseDate: details.release_date || null,
    year: details.release_date ? details.release_date.slice(0, 4) : null,
    runtime: details.runtime || null,
    voteAverage: details.vote_average || 0,
    popularity: details.popularity || 0,
    genres: (details.genres || []).map((g) => ({ id: g.id, name: g.name })),
    directors: director ? [{ id: director.id, name: director.name }] : [],
    cast,
    cachedAt: Date.now()
  }
}
