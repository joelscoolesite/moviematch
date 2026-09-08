import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { GENRE_NAMES } from '../utils/genreNames.js'

export default function Profile() {
  const { user, profile, logout } = useAuth()
  const [swipeStats, setSwipeStats] = useState(null) // { liked, disliked }

  const topGenres = useMemo(() => topEntries(profile?.preferences?.genres), [profile])
  const maxGenreScore = topGenres.length > 0 ? topGenres[0][1] : 1

  useEffect(() => {
    let active = true
    async function loadStats() {
      const snaps = await getDocs(collection(db, 'users', user.uid, 'swipes'))
      let liked = 0
      let disliked = 0
      snaps.forEach((d) => (d.data().liked ? liked++ : disliked++))
      if (active) setSwipeStats({ liked, disliked })
    }
    loadStats()
    return () => {
      active = false
    }
  }, [user.uid])

  const total = (swipeStats?.liked || 0) + (swipeStats?.disliked || 0)
  const likeRatio = total > 0 ? Math.round((swipeStats.liked / total) * 100) : null

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

      {total > 0 && (
        <div className="mb-6 rounded-card border border-reel-700 bg-reel-800/60 p-4">
          <p className="mb-2 text-sm font-medium text-reel-200">Jouw swipe-statistieken</p>
          <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-reel-700">
            <div className="bg-like" style={{ width: `${likeRatio}%` }} />
            <div className="bg-skip" style={{ width: `${100 - likeRatio}%` }} />
          </div>
          <div className="flex justify-between text-xs text-reel-400">
            <span>♥ {swipeStats.liked} geliked ({likeRatio}%)</span>
            <span>✕ {swipeStats.disliked} geskipt</span>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-card border border-reel-700 bg-reel-800/60 p-4">
        <p className="mb-3 text-sm font-medium text-reel-200">Jouw smaakprofiel</p>
        {topGenres.length === 0 ? (
          <p className="text-sm text-reel-400">Swipe wat meer films om je profiel te vormen.</p>
        ) : (
          <div className="space-y-2">
            {topGenres.map(([id, score]) => (
              <div key={id}>
                <div className="mb-1 flex items-center justify-between text-xs text-reel-200">
                  <span>{GENRE_NAMES[id] || `Genre ${id}`}</span>
                  <span className="text-reel-400">{score}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-reel-700">
                  <div
                    className="h-full rounded-full bg-marquee"
                    style={{ width: `${Math.max(6, (score / maxGenreScore) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-reel-400">{profile?.swipeCount || 0} films solo beoordeeld in Discover.</p>
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
