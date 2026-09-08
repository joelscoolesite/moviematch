import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Login() {
  const { user, login, register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/discover'

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, displayName)
      }
      navigate(redirectTo)
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      await loginWithGoogle()
      navigate(redirectTo)
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-reel-900 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-semibold text-white">
            Movie<span className="text-marquee">Match</span>
          </h1>
          <p className="mt-2 text-sm text-reel-300">Swipe films. Vind een match met je vrienden.</p>
        </div>

        <div className="rounded-card border border-reel-700 bg-reel-800/60 p-6 shadow-card">
          <div className="mb-5 flex rounded-full bg-reel-700/50 p-1 text-sm">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 rounded-full py-2 transition-colors ${
                mode === 'login' ? 'bg-marquee text-reel-950 font-medium' : 'text-reel-300'
              }`}
            >
              Inloggen
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 rounded-full py-2 transition-colors ${
                mode === 'register' ? 'bg-marquee text-reel-950 font-medium' : 'text-reel-300'
              }`}
            >
              Account maken
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <input
                type="text"
                placeholder="Naam"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full rounded-lg border border-reel-600 bg-reel-900 px-4 py-2.5 text-sm text-white placeholder-reel-400 outline-none focus:border-marquee"
              />
            )}
            <input
              type="email"
              placeholder="E-mailadres"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-reel-600 bg-reel-900 px-4 py-2.5 text-sm text-white placeholder-reel-400 outline-none focus:border-marquee"
            />
            <input
              type="password"
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-reel-600 bg-reel-900 px-4 py-2.5 text-sm text-white placeholder-reel-400 outline-none focus:border-marquee"
            />

            {error && <p className="text-sm text-skip">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-marquee py-2.5 text-sm font-semibold text-reel-950 transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-reel-600" />
            <span className="text-xs text-reel-400">of</span>
            <div className="h-px flex-1 bg-reel-600" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full rounded-lg border border-reel-600 bg-reel-900 py-2.5 text-sm font-medium text-reel-100 transition-colors hover:bg-reel-700 disabled:opacity-60"
          >
            Doorgaan met Google
          </button>
        </div>
      </div>
    </div>
  )
}

function readableError(err) {
  const code = err?.code || ''
  if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'Onjuiste inloggegevens.'
  if (code.includes('email-already-in-use')) return 'Dit e-mailadres is al in gebruik.'
  if (code.includes('weak-password')) return 'Kies een wachtwoord van minimaal 6 tekens.'
  if (code.includes('user-not-found')) return 'Geen account gevonden met dit e-mailadres.'
  return 'Er ging iets mis. Probeer het opnieuw.'
}
