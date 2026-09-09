import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listenToWatchlist, addToWatchlist, removeFromWatchlist } from '../services/watchlist.js'
import { IMG } from '../services/tmdb.js'
import { GENRE_NAMES } from '../utils/genreNames.js'
import Loader from '../components/Loader.jsx'
import MovieDetailModal from '../components/MovieDetailModal.jsx'

// Sorteer-/filterbalk verschijnt pas zodra de watchlist groter wordt dan
// een paar tientallen films — bij een korte lijst voegt het alleen ruis toe.
const SHOW_CONTROLS_THRESHOLD = 20

const SORT_OPTIONS = [
  { key: 'added', label: 'Toegevoegd (nieuwste eerst)' },
  { key: 'year-desc', label: 'Jaar (nieuw → oud)' },
  { key: 'year-asc', label: 'Jaar (oud → nieuw)' },
  { key: 'score-desc', label: 'Score (hoog → laag)' }
]

function toMillis(timestamp) {
  if (!timestamp) return 0
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis()
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000
  return 0
}

export default function Watchlist() {
  const { user } = useAuth()
  const [items, setItems] = useState(null)
  const [detailsMovie, setDetailsMovie] = useState(null)
  const [sortKey, setSortKey] = useState('added')
  const [genreFilter, setGenreFilter] = useState('all')

  useEffect(() => listenToWatchlist(user.uid, setItems), [user.uid])

  // Genres die daadwerkelijk voorkomen in de watchlist, i.p.v. alle
  // GENRE_NAMES tonen (waarvan de meeste vaak leeg zouden zijn). Films die
  // vóór deze feature bewaard zijn missen `genreIds` en tellen simpelweg
  // niet mee — ze blijven wel gewoon zichtbaar onder "Alle genres".
  const availableGenres = useMemo(() => {
    const found = new Map()
    ;(items || []).forEach((item) => {
      ;(item.genreIds || []).forEach((id) => {
        if (GENRE_NAMES[id]) found.set(id, GENRE_NAMES[id])
      })
    })
    return [...found.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [items])

  const visibleItems = useMemo(() => {
    let list = items || []
    if (genreFilter !== 'all') {
      list = list.filter((item) => (item.genreIds || []).map(String).includes(String(genreFilter)))
    }
    const sorted = [...list]
    if (sortKey === 'year-desc') sorted.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0))
    else if (sortKey === 'year-asc') sorted.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0))
    else if (sortKey === 'score-desc') sorted.sort((a, b) => (Number(b.voteAverage) || 0) - (Number(a.voteAverage) || 0))
    else sorted.sort((a, b) => toMillis(b.addedAt) - toMillis(a.addedAt))
    return sorted
  }, [items, sortKey, genreFilter])

  if (items === null) return <Loader label="Watchlist laden…" />

  const watchlistIds = new Set(items.map((item) => String(item.movieId)))
  const showControls = items.length > SHOW_CONTROLS_THRESHOLD

  async function handleToggleWatchlist(movie) {
    const id = String(movie.id)
    if (watchlistIds.has(id)) await removeFromWatchlist(user.uid, movie.id)
    else await addToWatchlist(user.uid, movie)
  }

  return (
    <div className="h-full overflow-y-auto px-5 pb-6 pt-6 safe-top">
      <h1 className="mb-1 text-2xl font-semibold text-white">Watchlist</h1>
      <p className="mb-5 text-sm text-reel-400">Films die je bewaard hebt om later te kijken.</p>

      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <span className="mb-3 text-4xl">🍿</span>
          <p className="text-sm text-reel-400">
            Nog niks bewaard. Tik op het ☆-icoon op een filmkaart in Discover om 'm hier te bewaren — dat kan
            terwijl je 'm bekijkt, je hoeft niet eerst te liken.
          </p>
        </div>
      ) : (
        <>
          {showControls && (
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                aria-label="Sorteer watchlist"
                className="rounded-full border border-reel-600 bg-reel-800 px-3 py-1.5 text-xs text-reel-100 focus:border-marquee focus:outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
                aria-label="Filter op genre"
                className="rounded-full border border-reel-600 bg-reel-800 px-3 py-1.5 text-xs text-reel-100 focus:border-marquee focus:outline-none"
              >
                <option value="all">Alle genres</option>
                {availableGenres.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {visibleItems.length === 0 ? (
            <p className="mt-8 text-center text-sm text-reel-400">Geen films in dit genre.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleItems.map((item) => (
                <li
                  key={item.id}
                  className="group relative overflow-hidden rounded-card border border-reel-700 bg-reel-800"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setDetailsMovie({
                        id: item.movieId,
                        title: item.title,
                        posterPath: item.posterPath,
                        year: item.year,
                        voteAverage: item.voteAverage
                      })
                    }
                    className="block aspect-[2/3] w-full text-left"
                    aria-label={`Details van ${item.title}`}
                  >
                    {item.posterPath ? (
                      <img
                        src={IMG.poster(item.posterPath, 'w342')}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-reel-400">
                        Geen poster
                      </div>
                    )}
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                    <p className="line-clamp-1 text-xs font-medium text-white">{item.title}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-reel-300">
                      <span>{item.year}</span>
                      {item.voteAverage > 0 && (
                        <span className="text-marquee">★ {Number(item.voteAverage).toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromWatchlist(user.uid, item.movieId)}
                    aria-label="Verwijderen"
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {detailsMovie && (
        <MovieDetailModal
          movie={detailsMovie}
          onClose={() => setDetailsMovie(null)}
          isSaved={watchlistIds.has(String(detailsMovie.id))}
          onToggleWatchlist={handleToggleWatchlist}
        />
      )}
    </div>
  )
}
