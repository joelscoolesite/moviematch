import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { fetchTrendingWeek } from '../services/tmdb.js'
import { getOrCacheMovies } from '../services/movieCache.js'
import { recordSoloSwipe } from '../services/swipes.js'
import SwipeDeck from '../components/SwipeDeck.jsx'
import Loader from '../components/Loader.jsx'

const ONBOARDING_SIZE = 10

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [queue, setQueue] = useState(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      const trending = await fetchTrendingWeek()
      const ids = trending.slice(0, ONBOARDING_SIZE).map((m) => m.id)
      const movies = await getOrCacheMovies(ids)
      if (active) setQueue(movies)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  async function finish() {
    await updateDoc(doc(db, 'users', user.uid), { onboardingDone: true })
    await refreshProfile()
    navigate('/discover')
  }

  async function handleSwipe(movie, liked) {
    await recordSoloSwipe(user.uid, movie, liked)
    setQueue((q) => q.filter((m) => m.id !== movie.id))
    setCount((c) => c + 1)
  }

  if (!queue) return <Loader label="Films voor je verzamelen…" />

  const done = queue.length === 0

  return (
    <div className="flex h-screen flex-col bg-reel-900 px-4 pb-8 pt-6 safe-top">
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-semibold text-white">Vertel ons je smaak</h1>
        <p className="mt-1 text-sm text-reel-300">
          Like of skip {ONBOARDING_SIZE} films zodat we een startprofiel kunnen maken.
        </p>
        <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-reel-700">
          <div
            className="h-full bg-marquee transition-all duration-300"
            style={{ width: `${(count / ONBOARDING_SIZE) * 100}%` }}
          />
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-sm flex-1">
        {done ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-lg text-white">Top, je startprofiel staat klaar.</p>
            <button
              onClick={finish}
              className="rounded-full bg-marquee px-8 py-3 font-semibold text-reel-950 transition-transform active:scale-95"
            >
              Naar Discover
            </button>
          </div>
        ) : (
          <SwipeDeck queue={queue} onSwipe={handleSwipe} emptyState={null} />
        )}
      </div>

      {!done && (
        <div className="mx-auto mt-4 flex w-full max-w-sm items-center justify-center gap-10">
          <SwipeButton kind="skip" onClick={() => queue[0] && handleSwipe(queue[0], false)} />
          <button onClick={finish} className="text-xs text-reel-400 underline underline-offset-2">
            Overslaan
          </button>
          <SwipeButton kind="like" onClick={() => queue[0] && handleSwipe(queue[0], true)} />
        </div>
      )}
    </div>
  )
}

function SwipeButton({ kind, onClick }) {
  const isLike = kind === 'like'
  return (
    <button
      onClick={onClick}
      aria-label={isLike ? 'Like' : 'Skip'}
      className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl shadow-lg transition-transform active:scale-90 ${
        isLike ? 'border-like text-like bg-reel-800' : 'border-skip text-skip bg-reel-800'
      }`}
    >
      {isLike ? '♥' : '✕'}
    </button>
  )
}
