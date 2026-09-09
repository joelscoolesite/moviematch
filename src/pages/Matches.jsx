import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listenToUserRooms, listenToRoomSwipes, listenToRoomMembers } from '../services/rooms.js'
import { listenToWatchlist, addToWatchlist, removeFromWatchlist } from '../services/watchlist.js'
import { IMG } from '../services/tmdb.js'
import Loader from '../components/Loader.jsx'
import MovieDetailModal from '../components/MovieDetailModal.jsx'

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
  const [swipes, setSwipes] = useState(null)
  const [members, setMembers] = useState([])
  const [unanimousOnly, setUnanimousOnly] = useState(false)

  useEffect(() => listenToRoomSwipes(room.id, setSwipes), [room.id])
  useEffect(() => listenToRoomMembers(room.id, setMembers), [room.id])

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
              <li key={match.id}>
                <button
                  type="button"
                  onClick={() => onOpenDetails(movie)}
                  className="flex w-full gap-3 rounded-card border border-reel-700 bg-reel-800/60 p-3 text-left transition-colors hover:bg-reel-700/60"
                >
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-reel-700">
                    {movie?.posterPath && (
                      <img src={IMG.poster(movie.posterPath, 'w185')} alt={movie.title} className="h-full w-full object-cover" />
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
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
