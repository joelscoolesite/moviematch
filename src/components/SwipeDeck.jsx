import { AnimatePresence } from 'framer-motion'
import MovieCard from './MovieCard.jsx'

const VISIBLE_STACK = 3

export default function SwipeDeck({ queue, onSwipe, emptyState, getReason }) {
  const visible = queue.slice(0, VISIBLE_STACK)

  if (visible.length === 0) {
    return <div className="flex h-full w-full items-center justify-center px-8">{emptyState}</div>
  }

  return (
    <div className="relative h-full w-full">
      <AnimatePresence>
        {visible.map((movie, i) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            isTop={i === 0}
            stackIndex={i}
            reason={i === 0 && getReason ? getReason(movie) : null}
            onSwipe={(direction) => onSwipe(movie, direction === 'right')}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
