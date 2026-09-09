import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  listenToUserRooms,
  listenToRoomSwipes,
  listenToRoomMembers,
  listenToRoomReactions,
  setRoomReaction,
  removeRoomReaction
} from '../services/rooms.js'
import { listenToWatchlist, addToWatchlist, removeFromWatchlist } from '../services/watchlist.js'
import { IMG } from '../services/tmdb.js'
import Loader from '../components/Loader.jsx'
import MovieDetailModal from '../components/MovieDetailModal.jsx'

// Korte emoji-reacties die roomleden per film kunnen achterlaten, naast een
// optionele korte opmerking — zie ReactionBar onderaan dit bestand.
const REACTION_EMOJIS = ['❤️', '😂', '🍿', '👍', '👎', '😴']

export default function Matches() {
  const { user } = useAuth()
  const [rooms, setRooms] = useState(null)
  const [watchlistIds, setWatchlistIds] = useState(new Set())
  const [detailsMovie, setDetailsMovie] = useState(null)
  const [params] = useSearchParams()
  const filterRoomId = params.get('room')

  useEffect(() => listenToUserRooms(user.uid, setRooms), [user.uid])
  useEffect(
    () =>
      listenToWatchlist(user.uid, (items) => {
        setWatchlistIds(new Set(items.map((item) => String(item.movieId))))
      }),
    [user.uid]
  )

  async function handleToggleWatchlist(movie) {
    const id = String(movie.id)
    if (watchlistIds.has(id)) await removeFromWatchlist(user.uid, movie.id)
    else await addToWatchlist(user.uid, movie)
  }

  if (rooms === null) return <Loader label="Matches laden…" />

  const visibleRooms = filterRoomId ? rooms.filter((r) => r.id === filterRoomId) : rooms

  return (
    <div className="h-full overflow-y-auto px-5 pb-6 pt-6 safe-top">
      <h1 className="mb-1 text-2xl font-semibold text-white">Matches</h1>
      <p className="mb-5 text-sm text-reel-400">Films waar meerdere mensen in de room op &quot;like&quot; swipeten.</p>

      {visibleRooms.length === 0 ? (
        <p className="mt-8 text-center text-sm text-reel-400">
          Je zit nog in geen enkele room. Maak of join er een via het Rooms-tabblad.
        </p>
      ) : (
        <div className="space-y-8">
          {visibleRooms.map((room) => (
            <RoomMatches key={room.id} room={room} onOpenDetails={setDetailsMovie} />
          ))}
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

function RoomMatches({ room, onOpenDetails }) {
  const { user } = useAuth()
  const [swipes, setSwipes] = useState(null)
  const [members, setMembers] = useState([])
  const [unanimousOnly, setUnanimousOnly] = useState(false)
  const [reactions, setReactions] = useState({})

  useEffect(() => listenToRoomSwipes(room.id, setSwipes), [room.id])
  useEffect(() => listenToRoomMembers(room.id, setMembers), [room.id])
  useEffect(
    () =>
      listenToRoomReactions(room.id, (docs) => {
        const byMovie = {}
        docs.forEach((d) => {
          byMovie[d.id] = d.byUser || {}
        })
        setReactions(byMovie)
      }),
    [room.id]
  )

  const memberCount = room.memberIds?.length || members.length || 1

  const matches = useMemo(() => {
    if (!swipes) return []
    const base = swipes.filter((s) => s.likeCount >= 2)
    const filtered = unanimousOnly ? base.filter((s) => s.likeCount >= memberCount) : base
    return filtered.sort((a, b) => b.likeCount - a.likeCount)
  }, [swipes, unanimousOnly, memberCount])

  const nameOf = (uid) => members.find((m) => m.id === uid)?.displayName || 'Iemand'

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">{room.name}</h2>
        <span className="text-xs text-reel-400">{memberCount} leden</span>
      </div>

      {memberCount > 2 && (
        <div className="mb-3 flex rounded-full bg-reel-700/50 p-1 text-xs">
          <button
            onClick={() => setUnanimousOnly(false)}
            className={`flex-1 rounded-full py-1.5 transition-colors ${
              !unanimousOnly ? 'bg-marquee font-medium text-reel-950' : 'text-reel-300'
            }`}
          >
            Alle matches
          </button>
          <button
            onClick={() => setUnanimousOnly(true)}
            className={`flex-1 rounded-full py-1.5 transition-colors ${
              unanimousOnly ? 'bg-marquee font-medium text-reel-950' : 'text-reel-300'
            }`}
          >
            Alleen unaniem
          </button>
        </div>
      )}

      {swipes === null ? (
        <p className="text-sm text-reel-400">Matches laden…</p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-reel-400">
          {unanimousOnly
            ? 'Nog geen film waar iedereen het over eens is.'
            : 'Nog geen matches in deze room — blijf swipen!'}
        </p>
      ) : (
        <ul className="space-y-3">
          {matches.map((match) => {
            const movie = match.movieSnapshot
            return (
              <li key={match.id} className="rounded-card border border-reel-700 bg-reel-800/60 p-3">
                <button type="button" onClick={() => onOpenDetails(movie)} className="flex w-full gap-3 text-left">
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-reel-700">
                    {movie?.posterPath && (
                      <img
                        src={IMG.poster(movie.posterPath, 'w185')}
                        alt={movie.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <p className="font-medium text-white">{movie?.title}</p>
                    <p className="text-xs text-reel-400">{movie?.year}</p>
                    <p className="mt-1 text-sm font-medium text-marquee">
                      {match.likeCount}/{memberCount} vinden deze film leuk
                    </p>
                    <p className="mt-0.5 text-xs text-reel-400 line-clamp-1">
                      {match.likedBy.map(nameOf).join(', ')}
                    </p>
                  </div>
                </button>

                <ReactionBar
                  roomId={room.id}
                  movieId={match.id}
                  uid={user.uid}
                  byUser={reactions[match.id] || {}}
                  nameOf={nameOf}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// Laat roomleden een korte emoji-reactie en/of opmerking achterlaten per
// film. Eén reactie-document per film (rooms/{roomId}/reactions/{movieId}),
// met een `byUser`-map met één entry per lid — zelfde dot-path-patroon als
// userSwipes in rooms.js, zodat je alleen je eigen entry raakt.
function ReactionBar({ roomId, movieId, uid, byUser, nameOf }) {
  const mine = byUser[uid]
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [commentDraft, setCommentDraft] = useState(mine?.comment || '')

  useEffect(() => {
    setCommentDraft(mine?.comment || '')
  }, [mine?.comment])

  async function persist(next) {
    if (!next.emoji && !next.comment) {
      try {
        await removeRoomReaction(roomId, movieId, uid)
      } catch (e) {
        console.error('Reactie verwijderen mislukt:', e)
      }
      return
    }
    try {
      await setRoomReaction(roomId, movieId, uid, next)
    } catch (e) {
      console.error('Reactie opslaan mislukt:', e)
    }
  }

  function handlePickEmoji(emoji) {
    const nextEmoji = mine?.emoji === emoji ? null : emoji
    persist({ emoji: nextEmoji, comment: mine?.comment || null })
  }

  function handleSubmitComment(e) {
    e.preventDefault()
    const trimmed = commentDraft.trim()
    setShowCommentInput(false)
    persist({ emoji: mine?.emoji || null, comment: trimmed || null })
  }

  const others = Object.entries(byUser).filter(([id, r]) => id !== uid && (r.emoji || r.comment))

  return (
    <div className="mt-2.5 border-t border-reel-700/60 pt-2.5">
      <div className="flex flex-wrap items-center gap-1">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handlePickEmoji(emoji)}
            aria-label={`Reageer met ${emoji}`}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors ${
              mine?.emoji === emoji ? 'bg-marquee' : 'bg-reel-700/60 hover:bg-reel-700'
            }`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCommentInput((v) => !v)}
          className="flex h-7 items-center justify-center rounded-full bg-reel-700/60 px-2.5 text-xs text-reel-200 hover:bg-reel-700"
        >
          💬 {mine?.comment ? 'Bewerken' : 'Reageren'}
        </button>
      </div>

      {showCommentInput && (
        <form onSubmit={handleSubmitComment} className="mt-1.5 flex gap-1.5">
          <input
            autoFocus
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            maxLength={140}
            placeholder="Korte opmerking…"
            className="flex-1 rounded-full border border-reel-600 bg-reel-900 px-3 py-1 text-xs text-white placeholder:text-reel-500 focus:border-marquee focus:outline-none"
          />
          <button type="submit" className="rounded-full bg-marquee px-3 py-1 text-xs font-medium text-reel-950">
            Ok
          </button>
        </form>
      )}

      {(mine?.emoji || mine?.comment || others.length > 0) && (
        <ul className="mt-1.5 space-y-0.5">
          {(mine?.emoji || mine?.comment) && (
            <li className="text-xs text-reel-300">
              <span className="text-reel-400">Jij</span>
              {mine.emoji ? ` ${mine.emoji}` : ''}
              {mine.comment ? ` — "${mine.comment}"` : ''}
            </li>
          )}
          {others.map(([id, r]) => (
            <li key={id} className="text-xs text-reel-300">
              <span className="text-reel-400">{nameOf(id)}</span>
              {r.emoji ? ` ${r.emoji}` : ''}
              {r.comment ? ` — "${r.comment}"` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
