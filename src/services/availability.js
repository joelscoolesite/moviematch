// Waar kun je een film zien? Twee bronnen, allebei gratis via de TMDB-key
// die we al hebben (geen Groq of andere externe dienst nodig):
//
// 1. "watch/providers" (JustWatch-data via TMDB): betrouwbare, actuele
//    streaming/huur/koop-opties per land.
// 2. "release_dates": releasedata per land + type (o.a. theatrical). Er
//    bestaat geen gratis, betrouwbare API voor "welke bioscoop bij mij in
//    de buurt speelt deze film nu" (dat is precies wat Fandango/Pathé/
//    Cineville-achtige diensten los aanbieden en niet publiek/gratis
//    delen). We benaderen dit daarom met een simpele heuristiek (recent
//    bioscoop-releasedatum = waarschijnlijk nog in de bioscoop) plus een
//    directe zoeklink, in plaats van te doen alsof we exacte speeltijden
//    hebben.

import { fetchWatchProviders, fetchReleaseDates } from './tmdb.js'

const REGION = 'NL'
const THEATRICAL_TYPES = new Set([2, 3]) // 2 = Theatrical (limited), 3 = Theatrical
const THEATRICAL_WINDOW_DAYS = 60

export async function getAvailability(tmdbId, title) {
  const [providers, releaseDates] = await Promise.all([
    fetchWatchProviders(tmdbId).catch(() => null),
    fetchReleaseDates(tmdbId).catch(() => null)
  ])

  const regionProviders = providers?.results?.[REGION] || providers?.results?.US || null

  const regionReleases =
    releaseDates?.results?.find((r) => r.iso_3166_1 === REGION)?.release_dates ||
    releaseDates?.results?.find((r) => r.iso_3166_1 === 'US')?.release_dates ||
    []

  const theatrical = regionReleases
    .filter((r) => THEATRICAL_TYPES.has(r.type))
    .sort((a, b) => new Date(a.release_date) - new Date(b.release_date))[0]

  let inTheaters = false
  if (theatrical?.release_date) {
    const daysSinceRelease = (Date.now() - new Date(theatrical.release_date).getTime()) / 86400000
    inTheaters = daysSinceRelease >= -14 && daysSinceRelease <= THEATRICAL_WINDOW_DAYS
  }

  return {
    streaming: regionProviders?.flatrate || [],
    rent: regionProviders?.rent || [],
    buy: regionProviders?.buy || [],
    justWatchLink: regionProviders?.link || null,
    inTheaters,
    theatricalDate: theatrical?.release_date || null,
    cinemaSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(`${title} bioscoop tijden`)}`
  }
}
