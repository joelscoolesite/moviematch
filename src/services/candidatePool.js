// Beheert de voorraad kandidaat-films voor de solo Discover-pagina.
// Haalt afwisselend "popular" en "discover by top genres" op bij TMDB,
// dedupliceert, filtert al geswipede films eruit en houdt een voorraad aan
// zodat we niet bij elke swipe een nieuwe TMDB-call hoeven te doen.

import { fetchDiscover } from './tmdb.js'
import { getOrCacheMovies } from './movieCache.js'
import { topGenreIds } from './recommendation.js'

const REFILL_THRESHOLD = 5
const PAGES_PER_REFILL = 2
const MAX_TMDB_PAGE = 500 // TMDB accepteert geen paginanummers hoger dan dit

// Voorkomt dat popularPage/genrePage na heel veel refills (lange sessie,
// veel swipes) boven de 500 uitkomen — TMDB geeft daar een fout op, wat
// zonder wrap een permanente dead-end zou zijn: elke mislukte refill
// verhoogt de pagina alleen maar verder, dus hij herstelt zichzelf nooit.
function wrapPage(page) {
  return ((page - 1) % MAX_TMDB_PAGE) + 1
}

export function createCandidatePool({ preferences, excludeIds, filters = {} }) {
  let pool = []
  let popularPage = 1
  let genrePage = 1
  const seen = new Set(excludeIds)

  async function refill() {
    // Bij een actieve genre-filter (Discover-filters) tonen we UITSLUITEND
    // films uit de gekozen genres i.p.v. de gebruikelijke mix van
    // "populair" + "smaakprofiel" — dat is wat je van een filter verwacht.
    // Decennium- en classificatiefilters gelden voor beide takken.
    const filterGenreIds = filters.genreIds || []
    const useFilterGenres = filterGenreIds.length > 0
    const genreIds = useFilterGenres ? filterGenreIds : topGenreIds(preferences, 3)
    const sharedParams = {
      releaseDateGte: filters.releaseDateGte,
      releaseDateLte: filters.releaseDateLte,
      excludeMatureContent: filters.excludeMatureContent
    }
    const requests = []

    for (let i = 0; i < PAGES_PER_REFILL; i++) {
      if (!useFilterGenres) {
        requests.push(fetchDiscover({ ...sharedParams, page: wrapPage(popularPage + i) }))
      }
      if (genreIds.length > 0) {
        requests.push(fetchDiscover({ ...sharedParams, genreIds, page: wrapPage(genrePage + i) }))
      }
    }
    popularPage += PAGES_PER_REFILL
    genrePage += PAGES_PER_REFILL

    const pages = await Promise.all(requests)
    const rawResults = pages.flat()

    const newIds = rawResults.map((m) => m.id).filter((id) => !seen.has(String(id)))
    const uniqueNewIds = [...new Set(newIds)]
    uniqueNewIds.forEach((id) => seen.add(String(id)))

    if (uniqueNewIds.length > 0) {
      const detailed = await getOrCacheMovies(uniqueNewIds)
      pool.push(...detailed)
    }
  }

  return {
    async next() {
      if (pool.length <= REFILL_THRESHOLD) {
        try {
          await refill()
        } catch (e) {
          console.error('Kon kandidaten niet aanvullen:', e)
        }
      }
      return pool
    },
    markConsumed(movieId) {
      pool = pool.filter((m) => String(m.id) !== String(movieId))
      seen.add(String(movieId))
    },
    size() {
      return pool.length
    }
  }
}
