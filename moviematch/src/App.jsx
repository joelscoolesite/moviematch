import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import BottomNav from './components/BottomNav.jsx'
import Loader from './components/Loader.jsx'

import Login from './pages/Login.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Discover from './pages/Discover.jsx'
import Rooms from './pages/Rooms.jsx'
import RoomDetail from './pages/RoomDetail.jsx'
import Matches from './pages/Matches.jsx'
import Watchlist from './pages/Watchlist.jsx'
import Profile from './pages/Profile.jsx'

function AppLayout({ children }) {
  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col bg-reel-900">
      <main className="flex-1 overflow-hidden pb-16">{children}</main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const { loading } = useAuth()
  if (loading) return <Loader label="MovieMatch wordt geladen…" />

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requireOnboarding={false}>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/discover"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Discover />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Rooms />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms/:roomId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <RoomDetail />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/matches"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Matches />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/watchlist"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Watchlist />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Profile />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/discover" replace />} />
      <Route path="*" element={<Navigate to="/discover" replace />} />
    </Routes>
  )
}
