import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/discover', label: 'Discover', icon: FilmIcon },
  { to: '/rooms', label: 'Rooms', icon: UsersIcon },
  { to: '/matches', label: 'Matches', icon: HeartIcon },
  { to: '/watchlist', label: 'Watchlist', icon: BookmarkIcon },
  { to: '/profile', label: 'Profiel', icon: UserIcon }
]

export default function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-reel-700 bg-reel-900/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg items-center justify-between px-2">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  isActive ? 'text-marquee' : 'text-reel-400 hover:text-reel-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon active={isActive} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function FilmIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8b75a' : 'currentColor'} strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </svg>
  )
}
function UsersIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8b75a' : 'currentColor'} strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 19c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.5 13.6c2.6.4 4.5 2.2 4.5 5" />
    </svg>
  )
}
function HeartIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#e8b75a' : 'none'} stroke={active ? '#e8b75a' : 'currentColor'} strokeWidth="1.8">
      <path d="M12 20.5s-7.5-4.6-9.8-9.3C.6 7.8 2.4 4.5 5.7 4c2-.3 3.8.6 4.9 2.2C11.5 4.6 13.3 3.7 15.3 4c3.3.5 5.1 3.8 3.5 7.2C16.5 15.9 12 20.5 12 20.5z" />
    </svg>
  )
}
function BookmarkIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#e8b75a' : 'none'} stroke={active ? '#e8b75a' : 'currentColor'} strokeWidth="1.8">
      <path d="M6 3.5h12v17l-6-4-6 4v-17z" />
    </svg>
  )
}
function UserIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8b75a' : 'currentColor'} strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 19.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </svg>
  )
}
