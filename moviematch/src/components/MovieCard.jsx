import { motion, useMotionValue, useTransform } from 'framer-motion'
import { IMG } from '../services/tmdb.js'

const SWIPE_THRESHOLD = 120

export default function MovieCard({ movie, onSwipe, isTop, stackIndex = 0 }) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-18, 18])
  const likeOpacity = useTransform(x, [20, 140], [0, 1])
  const skipOpacity = useTransform(x, [-140, -20], [1, 0])

  function handleDragEnd(_, info) {
    if (info.offset.x > SWIPE_THRESHOLD) {
      onSwipe('right')
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      onSwipe('left')
    }
  }

  const poster = IMG.poster(movie.posterPath, 'w780')

  return (
    <motion.div
      className="absolute inset-0 select-none"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex: 100 - stackIndex
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      animate={{
        scale: 1 - stackIndex * 0.04,
        y: stackIndex * 14,
        opacity: stackIndex > 2 ? 0 : 1
      }}
      exit={{
        x: x.get() > 0 ? 500 : -500,
        opacity: 0,
        rotate: x.get() > 0 ? 25 : -25,
        transition: { duration: 0.35 }
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-card bg-reel-800 shadow-card">
        {poster ? (
          <img
            src={poster}
            alt={movie.title}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-reel-700 text-reel-400">
            Geen poster beschikbaar
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-reel-950 via-reel-950/40 to-transparent" />

        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute right-6 top-8 rotate-6 rounded-lg border-4 border-like px-4 py-1.5 text-xl font-bold tracking-wide text-like"
            >
              LIKE
            </motion.div>
            <motion.div
              style={{ opacity: skipOpacity }}
              className="absolute left-6 top-8 -rotate-6 rounded-lg border-4 border-skip px-4 py-1.5 text-xl font-bold tracking-wide text-skip"
            >
              SKIP
            </motion.div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5 pb-6">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-reel-200">
            {movie.voteAverage > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 font-medium text-marquee">
                ★ {movie.voteAverage.toFixed(1)}
              </span>
            )}
            {movie.year && <span className="rounded-full bg-black/40 px-2.5 py-1">{movie.year}</span>}
            {movie.runtime && (
              <span className="rounded-full bg-black/40 px-2.5 py-1">
                {Math.floor(movie.runtime / 60)}u {movie.runtime % 60}m
              </span>
            )}
          </div>

          <h2 className="mb-2 text-3xl font-semibold leading-tight text-white drop-shadow-sm">
            {movie.title}
          </h2>

          {movie.genres?.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {movie.genres.slice(0, 3).map((g) => (
                <span key={g.id} className="rounded-full bg-reel-700/70 px-2.5 py-0.5 text-xs text-reel-100">
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {movie.overview && (
            <p className="line-clamp-3 text-sm leading-relaxed text-reel-200">{movie.overview}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
