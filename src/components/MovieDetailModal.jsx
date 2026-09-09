import { useEffect, useState } from 'react'
import { IMG } from '../services/tmdb.js'
import { getOrCacheMovie } from '../services/movieCache.js'
import { getAvailability } from '../services/availability.js'

// Volledig detailscherm voor een film: grote achtergrondfoto, volledige
// beschrijving, score, jaar, genres, cast/regie, en waar je 'm kunt zien
// (streaming via TMDB/JustWatch + een inschatting of hij nog in de
// bioscoop draait). Werkt zowel met een al-volledig filmobject (vanuit
// Discover/Rooms) als met de beperkte data die in de Watchlist/Matches
// wordt opgeslagen — in dat laatste geval haalt de modal de volledige
// details zelf op (movieCache, dus gedeeld/gecached).
export default function MovieDetailModal({ movie, onClose, isSaved, onToggleWatchlist }) {
  const [full, setFull] = useState(movie?.overview !== undefined ? movie : null)
  const [availability, setAvailability] = useState(null)
  const [availabilityFailed, setAvailabilityFailed] = useState(false)

  useEffect(() => {
    let active = true
    if (movie?.overview === undefined) {
      setFull(null)
      getOrCacheMovie(movie.id)
        .then((data) => {
          if (active) setFull({ ...movie, ...data })
        })
        .catch(() => {
          if (active) setFull(movie)
        })
    } else {
      setFull(movie)
    }
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie?.id])

  useEffect(() => {
    let active = true
    setAvailability(null)
    setAvailabilityFailed(false)
    getAvailability(movie.id, movie.title)
      .then((data) => {
        if (active) setAvailability(data)
      })
      .catch(() => {
        if (active) setAvailabilityFailed(true)
      })
    return () => {
      active = false
    }
  }, [movie?.id, movie?.title])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const m = full || movie
  const backdrop = IMG.backdrop(m.backdropPath, 'w1280') || IMG.poster(m.posterPath, 'w780')
  const noAvailabilityInfo =
    availability &&
    !availability.inTheaters &&
    availability.streaming.length === 0 &&
    availability.rent.length === 0 &&
    availability.buy.length === 0

  return (
    <div
      // z-[1000]: hoger dan de zIndex die Framer Motion op de bovenste
      // swipe-kaart zet (100 - stackIndex, dus tot 100). Zonder dit wint de
      // kaart z'n inline z-index van de modal se z-50 en schemert de
      // kaart (incl. zijn eigen ☆/ⓘ-knoppen) er doorheen.
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-reel-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Sluiten"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-lg text-white backdrop-blur"
        >
          ✕
        </button>

        <div className="relative aspect-video w-full bg-reel-800">
          {backdrop ? (
            <img src={backdrop} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-reel-400">Geen afbeelding beschikbaar</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-reel-900 via-reel-900/10 to-transparent" />
        </div>

        <div className="px-5 pb-6 pt-2">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-reel-200">
            {m.voteAverage > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-reel-800 px-2.5 py-1 font-medium text-marquee">
                ★ {Number(m.voteAverage).toFixed(1)}
              </span>
            )}
            {m.year && <span className="rounded-full bg-reel-800 px-2.5 py-1">{m.year}</span>}
            {m.runtime ? (
              <span className="rounded-full bg-reel-800 px-2.5 py-1">
                {Math.floor(m.runtime / 60)}u {m.runtime % 60}m
              </span>
            ) : null}
          </div>

          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-2xl font-semibold leading-tight text-white">{m.title}</h2>
            {onToggleWatchlist && (
              <button
                onClick={() => onToggleWatchlist(m)}
                aria-label={isSaved ? 'Verwijder uit watchlist' : 'Toevoegen aan watchlist'}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-lg transition-colors ${
                  isSaved ? 'border-marquee bg-marquee/20 text-marquee' : 'border-reel-600 bg-reel-800 text-reel-200'
                }`}
              >
                {isSaved ? '★' : '☆'}
              </button>
            )}
          </div>

          {m.genres?.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {m.genres.map((g) => (
                <span key={g.id} className="rounded-full bg-reel-700/70 px-2.5 py-0.5 text-xs text-reel-100">
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {m.overview ? (
            <p className="mb-4 text-sm leading-relaxed text-reel-200">{m.overview}</p>
          ) : full === null ? (
            <p className="mb-4 text-sm text-reel-400">Details laden…</p>
          ) : (
            <p className="mb-4 text-sm text-reel-400">Geen beschrijving beschikbaar.</p>
          )}

          {(m.directors?.length > 0 || m.cast?.length > 0) && (
            <div className="mb-4 space-y-1 text-xs text-reel-400">
              {m.directors?.length > 0 && (
                <p>
                  <span className="text-reel-300">Regie:</span> {m.directors.map((d) => d.name).join(', ')}
                </p>
              )}
              {m.cast?.length > 0 && (
                <p>
                  <span className="text-reel-300">Met:</span> {m.cast.map((c) => c.name).join(', ')}
                </p>
              )}
            </div>
          )}

          <div className="rounded-card border border-reel-700 bg-reel-800/60 p-3.5">
            <p className="mb-2 text-sm font-medium text-reel-200">Waar kun je 'm zien?</p>

            {!availability && !availabilityFailed && (
              <p className="text-xs text-reel-400">Beschikbaarheid laden…</p>
            )}
            {availabilityFailed && (
              <p className="text-xs text-reel-400">Kon beschikbaarheid nu niet ophalen.</p>
            )}

            {availability && (
              <div className="space-y-2 text-xs text-reel-300">
                {availability.inTheaters && (
                  <p className="flex items-center gap-1.5 font-medium text-marquee">
                    🎬 Draait waarschijnlijk nog in de bioscoop
                  </p>
                )}
                {availability.streaming.length > 0 && <ProviderRow label="Streamen" providers={availability.streaming} />}
                {availability.rent.length > 0 && <ProviderRow label="Huren" providers={availability.rent} />}
                {availability.buy.length > 0 && <ProviderRow label="Kopen" providers={availability.buy} />}
                {noAvailabilityInfo && (
                  <p className="text-reel-400">Nog geen streaming- of bioscoopinfo bekend voor Nederland.</p>
                )}
                <a
                  href={availability.cinemaSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-marquee underline underline-offset-2"
                >
                  Zoek bioscooptijden in de buurt →
                </a>
                {availability.justWatchLink && (
                  <p className="pt-1 text-[10px] text-reel-500">Streaming-info via JustWatch, geleverd door TMDB.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProviderRow({ label, providers }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-reel-400">{label}:</span>
      {providers.map((p) => (
        <span key={p.provider_id} className="rounded-full bg-reel-700 px-2 py-0.5 text-[11px] text-reel-100">
          {p.provider_name}
        </span>
      ))}
    </div>
  )
}
