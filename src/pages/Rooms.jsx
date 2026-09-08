import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { createRoom, joinRoom, listenToUserRooms } from '../services/rooms.js'
import Loader from '../components/Loader.jsx'

export default function Rooms() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = listenToUserRooms(user.uid, setRooms)
    return unsub
  }, [user.uid])

  async function handleCreate() {
    setBusy(true)
    setError('')
    try {
      const code = await createRoom(user.uid, profile?.displayName || 'Filmfan', profile?.photoURL, null)
      navigate(`/rooms/${code}`)
    } catch (e) {
      setError('Kon geen room aanmaken. Probeer het opnieuw.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setBusy(true)
    setError('')
    try {
      const code = await joinRoom(joinCode.trim(), user.uid, profile?.displayName || 'Filmfan', profile?.photoURL)
      navigate(`/rooms/${code}`)
    } catch (e) {
      setError(e.message || 'Kon niet joinen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-6 pt-6 safe-top">
      <h1 className="mb-5 text-2xl font-semibold text-white">Rooms</h1>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={handleCreate}
          disabled={busy}
          className="rounded-card border border-reel-700 bg-reel-800/60 p-4 text-left transition-colors hover:bg-reel-700/60 disabled:opacity-60"
        >
          <p className="font-semibold text-white">+ Nieuwe room</p>
          <p className="mt-1 text-xs text-reel-300">Maak een room en deel de code met vrienden.</p>
        </button>

        <form
          onSubmit={handleJoin}
          className="rounded-card border border-reel-700 bg-reel-800/60 p-4"
        >
          <p className="mb-2 font-semibold text-white">Join met code</p>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="bv. K7XP2M"
              maxLength={8}
              className="w-full rounded-lg border border-reel-600 bg-reel-900 px-3 py-2 text-sm uppercase tracking-widest text-white outline-none focus:border-marquee"
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded-lg bg-marquee px-3 py-2 text-sm font-semibold text-reel-950 disabled:opacity-60"
            >
              Join
            </button>
          </div>
        </form>
      </div>

      {error && <p className="mb-3 text-sm text-skip">{error}</p>}

      {rooms === null ? (
        <Loader label="Rooms laden…" />
      ) : rooms.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <span className="mb-3 text-4xl">🎬</span>
          <p className="text-sm text-reel-400">
            Nog geen rooms. Maak er één aan of join met een code van een vriend.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <button
                onClick={() => navigate(`/rooms/${room.id}`)}
                className="flex w-full items-center justify-between rounded-card border border-reel-700 bg-reel-800/60 p-4 text-left transition-colors hover:bg-reel-700/60"
              >
                <div>
                  <p className="font-medium text-white">{room.name}</p>
                  <p className="text-xs text-reel-400">{room.memberIds?.length || 1} leden</p>
                </div>
                <span className="rounded-full bg-reel-700 px-3 py-1 text-xs tracking-widest text-marquee">
                  {room.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
