# MovieMatch — Project Context

Dit bestand geeft een nieuwe Claude-sessie (bv. in Cowork) snel de achtergrond
van dit project, zonder de hele chatgeschiedenis te hoeven kennen.

## Wat is dit?

Een Tinder-achtige webapp om samen met vrienden te bepalen welke film je gaat
kijken. Swipe door films (Discover), join/maak een room met vrienden, en zie
live welke films jullie allemaal geliked hebben (Matches).

## Stack

- **Frontend:** React 18 + Vite, Tailwind CSS, Framer Motion (swipe-animaties),
  React Router.
- **Backend:** geen eigen server. Firebase Authentication (email/wachtwoord +
  Google) en Firestore (gratis Spark-plan) rechtstreeks vanuit de client.
- **Filmdata:** TMDB REST API, gecached in Firestore (`movies`-collectie) om
  herhaalde calls te vermijden.
- **Hosting:** Vercel, gekoppeld aan GitHub — elke push naar `main` deployt
  automatisch.

## Belangrijkste mappen

```
src/
  services/       ← alle Firebase/TMDB/aanbevelingslogica (geen React)
    tmdb.js            TMDB API calls + normalisatie
    movieCache.js      Firestore-cache laag voor filmdata
    recommendation.js  Het aanbevelingsalgoritme (zie hieronder)
    candidatePool.js   Beheert de kandidatenpool voor solo Discover
    swipes.js          Solo swipes (users/{uid}/swipes)
    rooms.js           Rooms: aanmaken/joinen/swipen/matches
    watchlist.js
  pages/          ← 1 bestand per route (Discover, Rooms, RoomDetail, Matches, Watchlist, Profile, Login, Onboarding)
  components/     ← MovieCard, SwipeDeck, BottomNav, ProtectedRoute, Loader
  contexts/       ← AuthContext (Firebase auth + user-profieldoc)
  utils/          ← roomCode.js, genreNames.js
firebase/           ← ONGEBRUIKTE kopieën (firebase.json wijst naar de root-
                       bestanden hieronder, niet naar deze map — hield ze nu
                       gesynchroniseerd, maar bewerk voortaan de root-versie)
firestore.rules       ← ECHTE Security Rules (root, zie firebase.json > firestore.rules)
firestore.indexes.json
```

## Firestore datamodel

```
movies/{tmdbId}                    — gedeelde TMDB-cache (30 dagen geldig)
users/{uid}
  preferences: { genres: {id:score}, directors: {id:score}, actors: {id:score} }
  onboardingDone, swipeCount, displayName, photoURL, email
  /swipes/{movieId}                — solo Discover-swipes
  /watchlist/{movieId}
rooms/{roomCode}                   — roomCode IS de Firestore-document-id
  code, name, createdBy, memberIds[], movieIds[] (vaste gedeelde deck van 30 films)
  /members/{uid}                   — publieke naam/foto (i.p.v. users/{uid} lezen)
  /swipes/{movieId}                — likedBy[], dislikedBy[], likeCount → matches (≥2 likes)
  /userSwipes/{uid}                — { swipes: { movieId: 'like'|'dislike' } }, per-gebruiker voortgang
```

## Aanbevelingsalgoritme (`src/services/recommendation.js`)

Puur regelgebaseerd, GEEN AI/ML:
- Gewichten: genre=3, regisseur=4, acteur=2, TMDB-rating=1.
- Elke like/dislike past `preferences` aan met Firestore `increment()`.
- `scoreMovie()` scoort nieuwe films op basis van het profiel.
- `pickNextCandidate()`: ~20% van de kaarten is puur willekeurig ("ontdekking"),
  de rest is gewogen willekeurig gekozen uit de best scorende helft.
- `explainRecommendation()`: geeft de "waarom deze film?"-uitleg op de kaart.
- `buildPreferenceUpdate(movie, liked)`: bouwt de increment-updates. Let op:
  om een eerdere update terug te draaien (undo), roep je deze aan met
  `!liked` in plaats van een aparte "revert"-functie te bouwen — het teken
  klopt dan vanzelf.

## Bekende gotchas / lessons learned

1. **Firestore-transacties vereisen ALLE reads vóór ALLE writes.** In
   `recordRoomSwipe` (rooms.js) hadden we ooit lees→schrijf→lees→schrijf,
   wat een silent-ish failure gaf (transaction error) die de optimistische
   UI-update terugdraaide. Fix: eerst beide `tx.get()`, dan pas de `tx.set()`s.
2. **Security Rules en `resource == null`.** Als je een Firestore-rule schrijft
   die `resource.data.xxx` checkt op een pad dat mogelijk nog niet bestaat
   (bv. het checken of een room-code al bezet is, of het vinden van een room
   om te joinen vóór je zelf lid bent), crasht de rule-evaluatie stil met
   "permission denied" i.p.v. "not found". De huidige `rooms/{roomId}`-rule
   staat daarom `allow read: if isSignedIn();` toe op het hele document
   (submappen zoals `swipes`/`members` blijven wel lid-only).
3. **De rooms-lijst-query** (`memberIds array-contains uid` + `orderBy
   createdAt`) heeft een Firestore composite index nodig — staat in
   root-`firestore.indexes.json` (zie gotcha 7), moet wel gedeployed worden
   (`firebase deploy --only firestore:indexes`) of automatisch via de link
   die Firestore toont bij de eerste keer dat de query faalt.
4. **Optimistic UI + rollback.** Zowel Discover als RoomDetail werken
   optimistisch (kaart verdwijnt meteen bij swipe, nog vóór Firestore
   bevestigt). Bij een fout wordt de swipe teruggedraaid in de UI. Nieuwe
   swipe-achtige features moeten dit patroon volgen, anders "springt" de UI
   terug (verwarrend voor gebruikers, hebben we al 1x moeten debuggen).
5. **TMDB-attributie is verplicht** (zie Profile.jsx) — niet verwijderen,
   TMDB's API-voorwaarden vereisen dit.
6. **`profile.swipeCount` telt alleen solo-Discover-swipes**, niet
   room-swipes. Dit is bekend en (nog) niet gefixt — vermeld dit als je
   ergens "totaal aantal swipes" wilt tonen.
7. **`firebase.json` verwijst naar de root-`firestore.rules`/`firestore.indexes.json`**,
   niet naar de gelijknamige bestanden in `firebase/`. Die map was een
   verouderde kopie (raakte ooit uit sync, `firebase/firestore.indexes.json`
   had bv. wel de composite index en de root-versie niet). Beide zijn nu
   gesynchroniseerd, maar **bewerk voortaan de root-bestanden** — dat zijn
   de bestanden die `firebase deploy --only firestore:rules,firestore:indexes`
   daadwerkelijk gebruikt.

## Environment variables (`.env`, nooit committen)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_TMDB_API_KEY=
```
Zie `.env.example` voor het sjabloon en README.md voor hoe je deze waarden
verkrijgt (Firebase Console + TMDB developer account).

## Deployment

- Repo staat op GitHub (`joelscoolesite/moviematch`), gekoppeld aan Vercel.
  Elke `git push` naar `main` triggert een automatische deploy.
- Firebase Authorized Domains moet het Vercel-domein bevatten
  (Firebase Console → Authentication → Settings → Authorized domains),
  anders werkt Google-login niet vanaf de live site.
- Firestore Security Rules staan in root-`firestore.rules` (zie gotcha 7) —
  bij elke wijziging daaraan: `firebase deploy --only firestore:rules` (of
  handmatig plakken in Firebase Console → Firestore → Rules → Publish).
  **Let op:** de rules zijn zojuist aangepast (delete-rechten voor rooms) —
  dit MOET nog gedeployed worden, anders werkt "room verwijderen/verlaten"
  niet in productie (zie hieronder).

## Al gebouwde features (v1 + eerste uitbreiding)

**v1 (basis):** Login (email + Google), Onboarding (10 films liken/skippen),
Discover (solo swipe + aanbevelingsalgoritme), Rooms (aanmaken/joinen via
code), realtime Matches per room, Watchlist, Profile.

**Eerste uitbreiding (5 features):**
1. Undo-knop (solo én in rooms) — `undoSoloSwipe()` / `undoRoomSwipe()`
2. "Waarom deze film?"-badge op de kaart (`explainRecommendation()`)
3. Matches-filter "Alleen unaniem" (bij rooms met 3+ leden)
4. Visuele smaakprofiel-statistieken op Profile (genre-balkjes, like/skip-ratio)
5. Vriendelijkere lege-staat states (Rooms, Watchlist)

**Tweede uitbreiding (n.a.v. gebruikersfeedback):**
1. **Watchlist-knop op de kaart zelf** (☆-icoon, rechtsboven op Discover-
   en Room-kaarten) i.p.v. pas na het liken. Optimistisch bijgewerkt via
   `toggleWatchlist()`/losse add/remove-calls, met dezelfde
   optimistic-UI-aanpak als de swipes (zie gotcha 4). Ook toegevoegd aan
   RoomDetail-kaarten.
2. **Volledig filmdetail-scherm** (`MovieDetailModal.jsx`): grote
   achtergrondfoto, volledige beschrijving, score, jaar, genres, regie/
   cast. Te openen via het ⓘ-icoon op een kaart (Discover/Rooms), of door
   op een poster te tikken (Watchlist-grid, Matches-lijst). Watchlist-
   items/matches slaan alleen minimale data op, dus de modal haalt zelf
   de volledige details op via `movieCache.getOrCacheMovie()` als
   `overview` ontbreekt.
3. **"Waar kun je 'm zien?"** (`services/availability.js`, nieuw):
   - Streamen/huren/kopen via TMDB's `watch/providers`-endpoint
     (JustWatch-data, gratis, geen extra key nodig — zelfde TMDB-key).
   - "Nu in de bioscoop"-inschatting via `release_dates` (theatrical
     releasedatum binnen ~60 dagen), plus een directe Google-zoeklink
     naar bioscooptijden. **Bewust geen Groq/AI gebruikt**: er bestaat
     geen gratis, betrouwbare API die per plaats/bioscoop actuele
     speeltijden geeft, en een LLM zonder browsing kan dat ook niet
     verzinnen zonder te hallucineren — de heuristiek + zoeklink is
     eerlijker dan doen alsof we exacte showtimes hebben.
4. **Rooms verwijderbaar/verlaatbaar**: de maker kan een room volledig
   verwijderen (`deleteRoom()`, ruimt member/swipe/userSwipes-
   subcollecties op), overige leden kunnen 'm verlaten (`leaveRoom()`).
   Vereiste rules-wijziging: `rooms/{roomId}` en subcollecties hadden
   `allow delete: if false` — nu `if isRoomCreator(roomId)` (plus
   `isOwner(memberUid)` voor zelf-verlaten). **Moet nog gedeployed
   worden**, zie hierboven.
5. QOL: toetsenbord-snelkoppelingen in Discover (←/→ swipen, W
   watchlist, U/Backspace ongedaan maken), sterscore op Watchlist-
   thumbnails, inline bevestiging i.p.v. blokkerende `confirm()` bij
   room verwijderen/verlaten.

## Nog niet gebouwd / mogelijke volgende stappen

- Room-discussie/reacties per film
- Export/deel je smaakprofiel
- AI-gedreven filmzoekfunctie via Groq blijft een optie voor een
  natuurlijke-taal-zoekfunctie ("toon me iets als Inception maar
  luchtiger") — hou de services modulair zodat dit als aparte service
  (bv. `aiSearch.js`) toegevoegd kan worden. Niet gebruikt voor
  bioscoop-/streaminginfo, zie punt 3 van de tweede uitbreiding hierboven.
- `profile.swipeCount` zou ook room-swipes moeten meetellen (zie gotcha 6).
