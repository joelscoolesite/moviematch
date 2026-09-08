import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Profile() {
  const { user, profile, logout } = useAuth()

  const topGenres = useMemo(() => topEntries(profile?.preferences?.genres), [profile])

  return (
    <div className="h-full overflow-y-auto px-5 pb-6 pt-6 safe-top">
      <h1 className="mb-5 text-2xl font-semibold text-white">Profiel</h1>

      <div className="mb-6 flex items-center gap-4 rounded-card border border-reel-700 bg-reel-800/60 p-4">
        {profile?.photoURL ? (
          <img src={profile.photoURL} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-reel-700 text-lg text-marquee">
            {(profile?.displayName || '?')[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-medium text-white">{profile?.displayName}</p>
          <p className="text-xs text-reel-400">{user.email}</p>
        </div>
      </div>

      <div className="mb-6 rounded-card border border-reel-700 bg-reel-800/60 p-4">
        <p className="mb-2 text-sm font-medium text-reel-200">Jouw smaakprofiel</p>
        {topGenres.length === 0 ? (
          <p className="text-sm text-reel-400">Swipe wat meer films om je profiel te vormen.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {topGenres.map(([label, score]) => (
              <span key={label} className="rounded-full bg-reel-700 px-3 py-1 text-xs text-marquee">
                {GENRE_NAMES[label] || `Genre ${label}`} · {score}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-reel-400">{profile?.swipeCount || 0} films in totaal beoordeeld.</p>
      </div>

      <button
        onClick={logout}
        className="mb-8 w-full rounded-lg border border-reel-600 bg-reel-800 py-2.5 text-sm font-medium text-reel-100 transition-colors hover:bg-reel-700"
      >
        Uitloggen
      </button>

      <p className="text-center text-[11px] leading-relaxed text-reel-500">
        Filmdata en posters worden geleverd door TMDB.
        <br />
        Deze app maakt gebruik van de TMDB API, maar wordt niet onderschreven of gecertificeerd door TMDB.
      </p>
    </div>
  )
}

function topEntries(map, count = 6) {
  if (!map) return []
  return Object.entries(map)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
}

// Kleine, veelvoorkomende TMDB-genre-ids voor leesbare labels zonder extra call.
const GENRE_NAMES = {
  28: 'Actie',
  12: 'Avontuur',
  16: 'Animatie',
  35: 'Komedie',
  80: 'Misdaad',
  99: 'Documentaire',
  18: 'Drama',
  10751: 'Familie',
  14: 'Fantasy',
  36: 'Historie',
  27: 'Horror',
  10402: 'Muziek',
  9648: 'Mysterie',
  10749: 'Romantiek',
  878: 'Sciencefiction',
  53: 'Thriller',
  10752: 'Oorlog',
  37: 'Western'
}
