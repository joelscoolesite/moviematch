import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  listenToRoom,
  listenToRoomMembers,
  listenToUserRoomProgress,
  listenToRoomSwipes,
  recordRoomSwipe,
  undoRoomSwipe
} from '../services/rooms.js'
import { getOrCacheMovies } from '../services/movieCache.js'
import { explainRecommendation } from '../services/recommendation.js'
import { listenToWatchlist, addToWatchlist, removeFromWatchlist } from '../services/watchlist.js'
import { GENRE_NAMES } from '../utils/genreNames.js'
import SwipeDeck from '../components/SwipeDeck.jsx'
import Loader from '../components/Loader.jsx'
import MovieDetailModal from '../components/MovieDetailModal.jsx'

export default function RoomDetail() {
  const { roomId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom] = useState(undefined) // undefined = loading, null = niet gevonden
  const [members, setMembers] = useState([])
  const [mySwipes, setMySwipes] = useState({})
  const [roomSwipes, setRoomSwipes] = useState([])
  const [movies, setMovies] = useState(null)
  const [copied, setCopied] = useState(false)
  const [watchlistIds, setWatchlistIds] = useState(new Set())
  const [detailsMovie, setDetailsMovie] = useState(null)
  // Lokale, optimistische set: direct bijgewerkt bij het swipen, zodat de
  // kaart meteen verdwijnt i.p.v. te wachten op de Firestore-round-trip.
  const [optimisticSwiped, setOptimisticSwiped] = useState({})
  const [lastAction, setLastAction] = useState(null) // { movie, liked } | null

  useEffect(() => listenToRoom(roomId, setRoom), [roomId])
  useEffect(() => listenToRoomMembers(roomId, setMembers), [roomId])
  useEffect(() => listenToUserRoomProgress(roomId, user.uid, setMySwipes), [roomId, user.uid])
  useEffect(() => listenToRoomSwipes(roomId, setRoomSwipes), [roomId])
  useEffect(
    () =>
      listenToWatchlist(user.uid, (items) => {
        setWatchlistIds(new Set(items.map((item) => String(item.movieId))))
      }),
    [user.uid]
  )

  useEffect(() => {
    if (!room?.movieIds) return
    let active = true
    getOrCacheMovies(room.movieIds).then((data) => {
      if (active) setMovies(data)
    })
    return () => {
      active = false
    }
  }, [room?.movieIds])

  const deck = useMemo(() => {
    if (!movies || !room?.movieIds) return null
    const orderedMovies = room.movieIds.map((id) => movies.find((m) => String(m.id) === String(id))).filter(Boolean)
    return orderedMovies.filter((m) => !mySwipes[String(m.id)] && !optimisticSwiped[String(m.id)])
  }, [movies, room?.movieIds, mySwipes, optimisticSwiped])

  const matchCount = useMemo(() => roomSwipes.filter((s) => s.likeCount >= 2).length, [roomSwipes])

  async function handleSwipe(movie, liked) {
    setOptimisticSwiped((prev) => ({ ...prev, [String(movie.id)]: liked ? 'like' : 'dislike' }))
    setLastAction({ movie, liked })
    try {
      await recordRoomSwipe(roomId, user.uid, movie, liked)
    } catch (e) {
      console.error('Swipe opslaan mislukt:', e)
      setOptimisticSwiped((prev) => {
        const next = { ...prev }
        delete next[String(movie.id)]
        return next
      })
      setLastAction(null)
    }
  }

  async function handleUndo() {
    if (!lastAction) return
    const { movie, liked } = lastAction
    setLastAction(null)
    setOptimisticSwiped((prev) => {
      const next = { ...prev }
      delete next[String(movie.id)]
      return next
    })
    try {
      await undoRoomSwipe(roomId, user.uid, movie, liked)
    } catch (e) {
      console.error('Undo mislukt:', e)
    }
  }

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

  function copyInvite() {
    const link = `${window.location.origin}/rooms/${roomId}`
    navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (room === undefined || deck === null) return <Loader label="Room laden…" />
  if (room === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center safe-top">
        <p className="text-white">Deze room bestaat niet (meer).</p>
        <button onClick={() => navigate('/rooms')} className="text-marquee underline underline-offset-2">
          Terug naar Rooms
        </button>
      </div>
    )
  }

  const total = room.movieIds?.length || 0
  const swipedCount = total - deck.length

  return (
    <div className="flex h-full flex-col px-4 pb-3 pt-4 safe-top">
      <header className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">{room.name}</h1>
            <p className="text-xs text-reel-400">
              {members.length} leden · {swipedCount}/{total} beoordeeld
            </p>
          </div>
          <button
            onClick={copyInvite}
            className="rounded-full border border-reel-600 bg-reel-800 px-3 py-1.5 text-xs text-reel-100"
          >
            {copied ? 'Gekopieerd!' : `Code: ${room.code}`}
          </button>
        </div>
        <Link
          to={`/matches?room=${room.id}`}
          className="mt-2 inline-block text-xs text-marquee underline underline-offset-2"
        >
          {matchCount > 0 ? `${matchCount} match(es) bekijken →` : 'Nog geen matches — bekijk matchpagina →'}
        </Link>
      </header>

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
              <p className="mb-1 text-lg text-white">Je hebt alle films in deze room beoordeeld!</p>
              <Link to={`/matches?room=${room.id}`} className="text-sm text-marquee underline underline-offset-2">
                Bekijk de matches →
              </Link>
            </div>
          }
        />
      </div>

      {deck.length > 0 && (
        <div className="mx-auto mt-3 flex w-full max-w-sm items-center justify-center gap-6">
          <button
            onClick={() => handleSwipe(deck[0], false)}
            aria-label="Skip"
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-skip bg-reel-800 text-2xl text-skip shadow-lg transition-transform active:scale-90"
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
            onClick={() => handleSwipe(deck[0], true)}
            aria-label="Like"
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-like bg-reel-800 text-2xl text-like shadow-lg transition-transform active:scale-90"
          >
            ♥
          </button>
        </div>
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
