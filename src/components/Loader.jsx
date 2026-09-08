export default function Loader({ label = 'Laden…' }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-reel-300">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-reel-600 border-t-marquee" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
