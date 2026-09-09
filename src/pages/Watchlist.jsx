import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listenToWatchlist, addToWatchlist, removeFromWatchlist } from '../services/watchlist.js'
import { IMG } from '../services/tmdb.js'
import Loader from '../components/Loader.jsx'
import MovieDetailModal from '../components/MovieDetailModal.jsx'

export default function Watchlist() {
  const { user } = useAuth()
  const [items, setItems] = useState(null)
  const [detailsMovie, setDetailsMovie] = useState(null)

  useEffect(() => listenToWatchlist(user.uid, setItems), [user.uid])

  if (items === null) return <Loader label="Watchlist laden…" />

  const watchlistIds = new Set(items.map((item) => String(item.movieId)))

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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="group relative overflow-hidden rounded-card border border-reel-700 bg-reel-800">
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
                  <div className="flex h-full items-center justify-center text-xs text-reel-400">Geen poster</div>
                )}
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                <p className="line-clamp-1 text-xs font-medium text-white">{item.title}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-reel-300">
                  <span>{item.year}</span>
                  {item.voteAverage > 0 && <span className="text-marquee">★ {Number(item.voteAverage).toFixed(1)}</span>}
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
