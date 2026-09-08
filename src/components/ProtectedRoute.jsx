import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import Loader from './Loader.jsx'

export default function ProtectedRoute({ children, requireOnboarding = true }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loader label="Even opstarten…" />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  if (requireOnboarding && profile && !profile.onboardingDone && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
