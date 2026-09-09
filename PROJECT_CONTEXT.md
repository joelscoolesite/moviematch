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
8. **Er ontbrak een `vercel.json` met SPA-rewrite.** React Router doet
   client-side routing, maar zonder rewrite-config zoekt Vercel bij een
   directe request naar bv. `/discover` (harde refresh, bookmark,
   gedeelde link) een echt bestand op dat pad — dat bestaat niet, dus
   Vercel's eigen "404: NOT_FOUND"-pagina verschijnt (niet de app se
   eigen UI). Klikken door de app heen ging altijd goed (dat is
   client-side), alleen refresh/directe navigatie op een subroute brak.
   Fix: `vercel.json` toegevoegd met een rewrite die alles behalve
   `/assets/*` naar `/index.html` stuurt.

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
   `isOwner(memberUid)` voor zelf-verlaten). **Live gedeployed**, werkt
   in productie.
5. QOL: toetsenbord-snelkoppelingen in Discover (←/→ swipen, W
   watchlist, U/Backspace ongedaan maken), sterscore op Watchlist-
   thumbnails, inline bevestiging i.p.v. blokkerende `confirm()` bij
   room verwijderen/verlaten.

Status: alles hierboven staat live (gepusht naar `main`, Vercel
gedeployed, Firestore rules/indexes gedeployed).

## Derde uitbreiding (Discover-filters, room-reacties, watchlist sorteren/filteren)

1. **Discover-filters** (`components/DiscoverFilters.jsx`, nieuw): genre
   (multi-select chips), decennium (single-select chips,
   `DECADE_OPTIONS`) en een schakelaar om 18+/16+-films uit te sluiten.
   Filters staan standaard ingeklapt achter een "Filters"-knop met
   badge, en blijven bewaard in `localStorage`
   (`moviematch:discover-filters`) zodat ze een refresh overleven.
   - `services/tmdb.js`: nieuwe `fetchDiscover()` (generieke
     `/discover/movie`-call met optionele `genreIds`,
     `releaseDateGte/Lte` en `excludeMatureContent`). Bij
     `excludeMatureContent` wordt `certification_country=NL` +
     `certification.lte=12` gebruikt (NL-classificatievolgorde: AL, 6,
     9, 12, 16, 18 — "12" sluit dus 16 en 18 uit). **Let op:** niet elke
     film heeft NL-classificatiedata in TMDB, dus dit filtert soms iets
     te streng i.p.v. te weinig — een bewuste afweging, geen bug.
   - `services/candidatePool.js`: `createCandidatePool()` accepteert nu
     een `filters`-object. Bij een actieve genre-filter tonen we
     UITSLUITEND films uit die genres (i.p.v. de gebruikelijke mix van
     "populair" + "smaakprofiel") — dat is wat je van een expliciete
     filter verwacht. Decennium/classificatie gelden voor beide takken.
   - `pages/Discover.jsx`: bij het wijzigen van filters wordt de
     kandidatenpool + deck opnieuw opgebouwd, maar de bestaande kaarten
     blijven zichtbaar met een "Filters toepassen…"-overlay i.p.v. het
     hele scherm te vervangen door een loader (zelfde soort UX-afweging
     als gotcha 4 hieronder, al is dit geen swipe-actie).
2. **Room-reacties**: korte emoji-reactie (❤️😂🍿👍👎😴) en/of een
   opmerking (max 140 tekens) per film in een room, te zien/zetten op de
   Matches-pagina onder elke match. Nieuwe Firestore-subcollectie
   `rooms/{roomId}/reactions/{movieId}` met een `byUser`-map — elk lid
   raakt via een dot-path-sleutel (`byUser.<uid>`) alleen zijn eigen
   entry aan, zelfde patroon als `userSwipes` (zie
   `services/rooms.js`: `listenToRoomReactions`/`setRoomReaction`/
   `removeRoomReaction`). Firestore-rule toegevoegd:
   `rooms/{roomId}/reactions/{movieId}`, zelfde vertrouwensmodel als
   `swipes` (elk lid mag lezen/schrijven, alleen de maker mag
   verwijderen).
3. **Watchlist sorteren/filteren**: sorteren op toegevoegd-datum
   (standaard), jaar (oud/nieuw) of score, plus filteren op genre. De
   controls verschijnen pas zodra de watchlist groter is dan 20 films
   (`SHOW_CONTROLS_THRESHOLD` in `pages/Watchlist.jsx`) — bij een
   korte lijst voegen ze alleen ruis toe. Vereiste:
   `services/watchlist.js` slaat nu ook `genreIds` op bij
   `addToWatchlist()`. Films die vóór deze wijziging al bewaard waren
   missen dit veld — ze blijven gewoon zichtbaar onder "Alle genres",
   maar matchen nooit een specifiek genre-filter (geen migratie
   uitgevoerd, bewuste keuze i.v.m. schaal/kosten).

Status: lokaal geïmplementeerd en met `vite build` geverifieerd
(2026-09-09). **Nog niet gepusht/gedeployed** — de Firestore-rule voor
`reactions` moet nog gedeployed worden
(`firebase deploy --only firestore:rules`) voordat room-reacties in
productie werken.

## Nog niet gebouwd / mogelijke volgende stappen

- Export/deel je smaakprofiel
- AI-gedreven filmzoekfunctie via Groq blijft een optie voor een
  natuurlijke-taal-zoekfunctie ("toon me iets als Inception maar
  luchtiger") — hou de services modulair zodat dit als aparte service
  (bv. `aiSearch.js`) toegevoegd kan worden. Niet gebruikt voor
  bioscoop-/streaminginfo, zie punt 3 van de tweede uitbreiding hierboven.
- `profile.swipeCount` zou ook room-swipes moeten meetellen (zie gotcha 6).

## Bugfix (na live-gebruik, 265+ swipes)

Discover liep na veel swipes vast op "Even geen nieuwe films" en bleef dat
permanent tonen. Twee oorzaken, allebei gefixt:
1. `movieCache.getOrCacheMovies()` gebruikte `Promise.all()` over alle
   ontbrekende ids — als TMDB voor 1 id een 404 gaf (film verwijderd van
   TMDB), werd de HELE batch weggegooid, ook de films die wel prima
   ophaalden. Nu `Promise.allSettled()`: een kapotte id wordt overgeslagen
   (`console.warn`), de rest komt gewoon door.
2. `candidatePool.js` verhoogde `popularPage`/`genrePage` bij elke refill,
   zonder bovengrens. TMDB accepteert geen paginanummers boven de 500 —
   zodra dat gebeurde faalde ELKE volgende refill permanent (de pagina
   werd nooit meer lager). Fix: `wrapPage()` wrapt het paginanummer
   terug naar 1-500.
Zie eventueel ook of `fetchGenreList`/andere TMDB-calls diezelfde
Promise.all-kwetsbaarheid hebben als je daar later problemen mee krijgt.

Losstaand hiervan (maar in dezelfde sessie ontdekt): `vercel.json` met
de SPA-rewrite toegevoegd (zie gotcha 8) — een refresh op een subroute
gaf daarvoor Vercel's eigen 404-pagina, geen appfout.
