import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { createCandidatePool } from '../services/candidatePool.js'
import { pickNextCandidate, explainRecommendation } from '../services/recommendation.js'
import { getSwipedMovieIds, recordSoloSwipe, undoSoloSwipe } from '../services/swipes.js'
import { listenToWatchlist, addToWatchlist, removeFromWatchlist } from '../services/watchlist.js'
import { GENRE_NAMES } from '../utils/genreNames.js'
import SwipeDeck from '../components/SwipeDeck.jsx'
import Loader from '../components/Loader.jsx'
import MovieDetailModal from '../components/MovieDetailModal.jsx'
import DiscoverFilters, { loadStoredFilters, saveStoredFilters } from '../components/DiscoverFilters.jsx'

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
  const [refilling, setRefilling] = useState(false)
  const [lastAction, setLastAction] = useState(null) // { movie, liked } | null
  const [watchlistIds, setWatchlistIds] = useState(new Set())
  const [detailsMovie, setDetailsMovie] = useState(null)
  const [filters, setFilters] = useState(loadStoredFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const poolRef = useRef(null)
  const swipeCountRef = useRef(0)
  const preferencesRef = useRef(profile?.preferences)
  const initializedRef = useRef(false)

  useEffect(() => {
    preferencesRef.current = profile?.preferences
  }, [profile?.preferences])

  useEffect(() => {
    saveStoredFilters(filters)
  }, [filters])

  useEffect(
    () =>
      listenToWatchlist(user.uid, (items) => {
        setWatchlistIds(new Set(items.map((item) => String(item.movieId))))
      }),
    [user.uid]
  )

  const genreFilterKey = filters.genreIds.join(',')

  useEffect(() => {
    let active = true
    async function init() {
      // Bij het wijzigen van filters ná de allereerste keer laden we de
      // deck ook opnieuw, maar tonen we ondertussen de bestaande kaarten
      // met een overlay i.p.v. het hele scherm te vervangen door een
      // loader (voelt storend aan vlak nadat je een filter aanraakte).
      if (initializedRef.current) setRefilling(true)
      const swipedIds = await getSwipedMovieIds(user.uid)
      poolRef.current = createCandidatePool({
        preferences: preferencesRef.current,
        excludeIds: swipedIds,
        filters
      })
      const cards = await pullCards(poolRef.current, preferencesRef.current, DECK_BUFFER)
      if (!active) return
      setDeck(cards)
      setRefilling(false)
      initializedRef.current = true
    }
    init()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid, genreFilterKey, filters.releaseDateGte, filters.releaseDateLte, filters.excludeMatureContent])

  const activeFilterCount = useMemo(
    () =>
      (filters.genreIds.length > 0 ? 1 : 0) +
      (filters.decadeKey !== 'all' ? 1 : 0) +
      (filters.excludeMatureContent ? 1 : 0),
    [filters]
  )

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

  // Bewaren voor later kan nu al terwijl je de kaart bekijkt (i.p.v. pas
  // nadat je geliket hebt) — optimistisch bijgewerkt, met terugdraaien bij
  // een fout, zoals de rest van de app dat ook doet.
  async function handleToggleWatchlist(movie) {
    const id = String(movie.id)
    const wasSaved = watchlistIds.has(id)
    setWatchlistIds((prev) => {
      const next = new Set(prev)
      if (wasSaved) next.delete(id)
      else next.add(id)
      return next
    })
    try {
      if (wasSaved) await removeFromWatchlist(user.uid, movie.id)
      else await addToWatchlist(user.uid, movie)
    } catch (e) {
      console.error('Watchlist bijwerken mislukt:', e)
      setWatchlistIds((prev) => {
        const next = new Set(prev)
        if (wasSaved) next.add(id)
        else next.delete(id)
        return next
      })
    }
  }

  // Toetsenbord-snelkoppelingen: ← skip, → like, W watchlist, U/Backspace
  // ongedaan maken. Staat uit zolang de detail-modal open is.
  useEffect(() => {
    function onKeyDown(e) {
      if (detailsMovie) return
      const top = deck?.[0]
      if (e.key === 'ArrowRight' && top) handleSwipe(top, true)
      else if (e.key === 'ArrowLeft' && top) handleSwipe(top, false)
      else if ((e.key === 'w' || e.key === 'W') && top) handleToggleWatchlist(top)
      else if ((e.key === 'u' || e.key === 'U' || e.key === 'Backspace') && lastAction) handleUndo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, detailsMovie, lastAction, watchlistIds])

  if (!deck) return <Loader label="Films voor je selecteren…" />

  return (
    <div className="flex h-full flex-col px-4 pb-3 pt-4 safe-top">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Discover</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-reel-400">
            {profile?.swipeCount || 0} films beoordeeld
          </span>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filtersOpen ? 'border-marquee bg-marquee/20 text-marquee' : 'border-reel-600 bg-reel-800 text-reel-200'
            }`}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-marquee px-1 text-[10px] font-semibold text-reel-950">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {filtersOpen && <DiscoverFilters filters={filters} onChange={setFilters} className="mb-3" />}

      <div className="relative mx-auto w-full max-w-sm flex-1">
        <SwipeDeck
          queue={deck}
          onSwipe={handleSwipe}
          getReason={(movie) => explainRecommendation(movie, profile?.preferences, GENRE_NAMES)}
          isSaved={(id) => watchlistIds.has(String(id))}
          onToggleWatchlist={handleToggleWatchlist}
          onOpenDetails={setDetailsMovie}
          emptyState={
            <div className="text-center text-reel-300">
              <p className="mb-1 text-lg text-white">Even geen nieuwe films.</p>
              <p className="text-sm">
                {activeFilterCount > 0
                  ? 'Probeer je filters iets ruimer te zetten, of kom straks terug.'
                  : 'Kom straks terug voor meer aanbevelingen.'}
              </p>
            </div>
          }
        />

        {refilling && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-card bg-reel-950/70 backdrop-blur-sm">
            <p className="text-sm text-reel-200">Filters toepassen…</p>
          </div>
        )}
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

      <p className="mx-auto mt-2 max-w-sm text-center text-[11px] text-reel-500">
        ☆ op de kaart bewaart 'm voor later · ⓘ toont alle details
      </p>

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
