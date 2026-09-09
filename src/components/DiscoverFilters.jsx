import { GENRE_NAMES } from '../utils/genreNames.js'

const STORAGE_KEY = 'moviematch:discover-filters'

// Elke optie draagt zijn eigen primary_release_date-range mee, zodat de
// TMDB-discover-call (zie services/tmdb.js: fetchDiscover) er direct mee
// kan werken zonder decennium-logica te dupliceren.
export const DECADE_OPTIONS = [
  { key: 'all', label: 'Alle jaren', gte: null, lte: null },
  { key: '2020', label: '2020s', gte: '2020-01-01', lte: '2029-12-31' },
  { key: '2010', label: '2010s', gte: '2010-01-01', lte: '2019-12-31' },
  { key: '2000', label: '2000s', gte: '2000-01-01', lte: '2009-12-31' },
  { key: '1990', label: '1990s', gte: '1990-01-01', lte: '1999-12-31' },
  { key: '1980', label: '1980s', gte: '1980-01-01', lte: '1989-12-31' },
  { key: 'pre1980', label: 'Voor 1980', gte: null, lte: '1979-12-31' }
]

export const DEFAULT_FILTERS = {
  genreIds: [],
  decadeKey: 'all',
  releaseDateGte: null,
  releaseDateLte: null,
  excludeMatureContent: false
}

// localStorage is puur een UX-gemak (filters blijven staan na een refresh)
// — als het niet beschikbaar is (privémodus e.d.) werkt filteren gewoon
// voor de huidige sessie, zonder ze te onthouden.
export function loadStoredFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_FILTERS
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_FILTERS,
      ...parsed,
      genreIds: Array.isArray(parsed.genreIds) ? parsed.genreIds : []
    }
  } catch {
    return DEFAULT_FILTERS
  }
}

export function saveStoredFilters(filters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch {
    // negeren — zie loadStoredFilters hierboven
  }
}

// Filterpaneel voor Discover: genre (multi-select chips), decennium
// (single-select chips) en een schakelaar om 18+/16+-films uit te sluiten.
// Puur gecontroleerd (filters + onChange) — Discover.jsx bepaalt wanneer
// het paneel getoond wordt en hoe filterwijzigingen de kandidatenpool
// verversen.
export default function DiscoverFilters({ filters, onChange, className = '' }) {
  function toggleGenre(id) {
    const has = filters.genreIds.includes(id)
    const genreIds = has ? filters.genreIds.filter((g) => g !== id) : [...filters.genreIds, id]
    onChange({ ...filters, genreIds })
  }

  function selectDecade(key) {
    const option = DECADE_OPTIONS.find((d) => d.key === key) || DECADE_OPTIONS[0]
    onChange({ ...filters, decadeKey: option.key, releaseDateGte: option.gte, releaseDateLte: option.lte })
  }

  function toggleMature() {
    onChange({ ...filters, excludeMatureContent: !filters.excludeMatureContent })
  }

  function reset() {
    onChange(DEFAULT_FILTERS)
  }

  const hasActiveFilters =
    filters.genreIds.length > 0 || filters.decadeKey !== 'all' || filters.excludeMatureContent

  return (
    <div className={`rounded-card border border-reel-700 bg-reel-800/60 p-3 ${className}`}>
      <div className="mb-2.5">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-reel-400">Genre</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(GENRE_NAMES).map(([id, name]) => {
            const active = filters.genreIds.includes(Number(id))
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleGenre(Number(id))}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  active ? 'bg-marquee font-medium text-reel-950' : 'bg-reel-700/70 text-reel-100'
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-2.5">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-reel-400">Decennium</p>
        <div className="flex flex-wrap gap-1.5">
          {DECADE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => selectDecade(option.key)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                filters.decadeKey === option.key
                  ? 'bg-marquee font-medium text-reel-950'
                  : 'bg-reel-700/70 text-reel-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggleMature}
          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
            filters.excludeMatureContent ? 'bg-marquee font-medium text-reel-950' : 'bg-reel-700/70 text-reel-100'
          }`}
        >
          🔞 18+/16+ uitsluiten
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={reset} className="text-xs text-reel-400 underline underline-offset-2">
            Filters wissen
          </button>
        )}
      </div>
    </div>
  )
}
