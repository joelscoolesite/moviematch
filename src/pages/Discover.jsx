import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { createCandidatePool } from '../services/candidatePool.js'
import { pickNextCandidate, explainRecommendation } from '../services/recommendation.js'
import { getSwipedMovieIds, recordSoloSwipe, undoSoloSwipe } from '../services/swipes.js'
import { addToWatchlist } from '../services/watchlist.js'
import { GENRE_NAMES } from '../utils/genreNames.js'
import SwipeDeck from '../components/SwipeDeck.jsx'
import Loader from '../components/Loader.jsx'

const DECK_BUFFER = 5

async function pullCards(poolInstance, preferences, n, exclude = []) {
  const cards = []
  const excluded = new Set(exclude.map(String))
  for (let i = 0; i < n; i++) {
    const available = await poolInstance.next()
    const remaining = available.filter((m) => !excluded.has(String(m.id)))
    const pick = pickNextCandidate(remaining, preferences)
    if (!pick) break
    poolInstance.markConsumed(pick.id)
    excluded.add(String(pick.id))
    cards.push(pick)
  }
  return cards
}

export default function Discover() {
  const { user, profile, refreshProfile } = useAuth()
  const [deck, setDeck] = useState(null)
  const [lastAction, setLastAction] = useState(null) // { movie, liked } | null
  const poolRef = useRef(null)
  const swipeCountRef = useRef(0)
  const preferencesRef = useRef(profile?.preferences)

  useEffect(() => {
    preferencesRef.current = profile?.preferences
  }, [profile?.preferences])

  useEffect(() => {
    let active = true
    async function init() {
      const swipedIds = await getSwipedMovieIds(user.uid)
      poolRef.current = createCandidatePool({ preferences: profile?.preferences, excludeIds: swipedIds })
      const cards = await pullCards(poolRef.current, profile?.preferences, DECK_BUFFER)
      if (active) setDeck(cards)
    }
    init()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid])

  async function handleSwipe(movie, liked) {
    setDeck((q) => q.filter((m) => m.id !== movie.id))
    setLastAction({ movie, liked })

    await recordSoloSwipe(user.uid, movie, liked)
    swipeCountRef.current += 1

    // Ververs het voorkeursprofiel elke paar swipes zodat de kaartjes
    // binnen dezelfde sessie merkbaar meebewegen met nieuwe likes.
    let preferences = preferencesRef.current
    if (swipeCountRef.current % 3 === 0) {
      const fresh = await refreshProfile()
      if (fresh) preferences = fresh.preferences
    }

    const currentIds = (deck || []).map((m) => m.id)
    const fresh = await pullCards(poolRef.current, preferences, 1, currentIds)
    if (fresh.length > 0) {
      setDeck((q) => [...q, ...fresh])
    }
  }

  async function handleUndo() {
    if (!lastAction) return
    const { movie, liked } = lastAction
    setLastAction(null)
    setDeck((q) => [movie, ...q])
    swipeCountRef.current = Math.max(0, swipeCountRef.current - 1)
    try {
      await undoSoloSwipe(user.uid, movie, liked)
    } catch (e) {
      console.error('Undo mislukt:', e)
    }
  }

  if (!deck) return <Loader label="Films voor je selecteren…" />

  return (
    <div className="flex h-full flex-col px-4 pb-3 pt-4 safe-top">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Discover</h1>
        <span className="text-xs text-reel-400">
          {profile?.swipeCount || 0} films beoordeeld
        </span>
      </header>

      <div className="relative mx-auto w-full max-w-sm flex-1">
        <SwipeDeck
          queue={deck}
          onSwipe={handleSwipe}
          getReason={(movie) => explainRecommendation(movie, profile?.preferences, GENRE_NAMES)}
          emptyState={
            <div className="text-center text-reel-300">
              <p className="mb-1 text-lg text-white">Even geen nieuwe films.</p>
              <p className="text-sm">Kom straks terug voor meer aanbevelingen.</p>
            </div>
          }
        />
      </div>

      <div className="mx-auto mt-3 flex w-full max-w-sm items-center justify-center gap-6">
        <button
          onClick={() => deck[0] && handleSwipe(deck[0], false)}
          disabled={deck.length === 0}
          aria-label="Skip"
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-skip bg-reel-800 text-2xl text-skip shadow-lg transition-transform active:scale-90 disabled:opacity-40"
        >
          ✕
        </button>

        {lastAction ? (
          <button
            onClick={handleUndo}
            aria-label="Ongedaan maken"
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-reel-500 bg-reel-800 text-lg text-reel-200 shadow-lg transition-transform active:scale-90"
            title="Laatste swipe ongedaan maken"
          >
            ↺
          </button>
        ) : (
          <div className="h-11 w-11" />
        )}

        <button
          onClick={() => deck[0] && handleSwipe(deck[0], true)}
          disabled={deck.length === 0}
          aria-label="Like"
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-like bg-reel-800 text-2xl text-like shadow-lg transition-transform active:scale-90 disabled:opacity-40"
        >
          ♥
        </button>
      </div>

      {lastAction?.liked && (
        <div className="mx-auto mt-2 w-full max-w-sm text-center">
          <button
            onClick={() => {
              addToWatchlist(user.uid, lastAction.movie)
              setLastAction(null)
            }}
            className="rounded-full border border-reel-600 bg-reel-800 px-4 py-1.5 text-xs text-reel-200"
          >
            + Watchlist
          </button>
        </div>
      )}
    </div>
  )
}
