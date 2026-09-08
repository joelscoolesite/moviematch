import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listenToWatchlist, removeFromWatchlist } from '../services/watchlist.js'
import { IMG } from '../services/tmdb.js'
import Loader from '../components/Loader.jsx'

export default function Watchlist() {
  const { user } = useAuth()
  const [items, setItems] = useState(null)

  useEffect(() => listenToWatchlist(user.uid, setItems), [user.uid])

  if (items === null) return <Loader label="Watchlist laden…" />

  return (
    <div className="h-full overflow-y-auto px-5 pb-6 pt-6 safe-top">
      <h1 className="mb-1 text-2xl font-semibold text-white">Watchlist</h1>
      <p className="mb-5 text-sm text-reel-400">Films die je bewaard hebt om later te kijken.</p>

      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-reel-400">
          Nog niks bewaard. Tik op &quot;+ Watchlist&quot; nadat je een film hebt geliket in Discover.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="group relative overflow-hidden rounded-card border border-reel-700 bg-reel-800">
              <div className="aspect-[2/3] w-full">
                {item.posterPath ? (
                  <img
                    src={IMG.poster(item.posterPath, 'w342')}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-reel-400">Geen poster</div>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                <p className="line-clamp-1 text-xs font-medium text-white">{item.title}</p>
                <p className="text-[10px] text-reel-300">{item.year}</p>
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
    </div>
  )
}
