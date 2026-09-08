# MovieMatch

Een Tinder-achtige app om samen met vrienden te bepalen welke film je gaat kijken.
Swipe door films, join een room, en zie live welke films jullie allemaal leuk vinden.

100% gratis te hosten: React (Vite) frontend die rechtstreeks met Firebase
Authentication + Firestore praat (Spark/free plan), filmdata van TMDB. Geen
eigen server, geen Cloud Functions, geen betaalde diensten nodig.

---

## 1. Firebase-project opzetten (eenmalig, ~5 min)

1. Ga naar https://console.firebase.google.com en maak een nieuw project (het
   gratis **Spark**-plan is voldoende).
2. Ga naar **Build → Authentication → Get started** en zet twee providers aan:
   - **E-mail/wachtwoord**
   - **Google**
3. Ga naar **Build → Firestore Database → Create database**. Kies
   "Production mode" (de meegeleverde rules regelen de beveiliging) en een
   regio bij jou in de buurt (bv. `eur3`).
4. Ga naar **Project settings → Algemeen**, scroll naar "Jouw apps", klik op
   het `</>`-icoon om een **Web app** toe te voegen. Kopieer de
   configuratiewaarden (`apiKey`, `authDomain`, `projectId`, enz.).
5. Plak die waarden in je `.env`-bestand (zie stap 3 hieronder).

### Security Rules en indexes deployen

Met de Firebase CLI (`npm install -g firebase-tools`, dan `firebase login`):

```bash
firebase init firestore   # kies je bestaande project; gebruik de meegeleverde
                           # firebase/firestore.rules en firebase/firestore.indexes.json
firebase deploy --only firestore:rules,firestore:indexes
```

Of plak de inhoud van `firebase/firestore.rules` handmatig in
**Firestore Database → Rules** in de console, en maak de index uit
`firebase/firestore.indexes.json` handmatig aan onder **Indexes** (Firestore
zal ook automatisch een link tonen om de ontbrekende index aan te maken zodra
je de Rooms-pagina voor het eerst gebruikt — dat werkt net zo goed).

---

## 2. TMDB API-key aanvragen (gratis, ~2 min)

1. Maak een account op https://www.themoviedb.org
2. Ga naar **Instellingen → API** en vraag een **API Key (v3 auth)** aan
   (kies "Developer" / persoonlijk gebruik).
3. Kopieer de key naar je `.env`-bestand.

TMDB vereist attributie — deze zit al verwerkt in de Profile-pagina van de
app ("Filmdata en posters worden geleverd door TMDB"). Verwijder dit niet.
Zie https://www.themoviedb.org/api-terms-of-use voor de volledige voorwaarden.

> De TMDB-key wordt in deze opzet client-side gebruikt (rechtstreeks vanuit
> de browser), wat is toegestaan volgens TMDB's voorwaarden voor dit soort
> apps. De key is dus zichtbaar in netwerkverkeer van je gebruikers — dat is
> onvermijdelijk zonder eigen backend. Wil je dit later verbergen, dan kun je
> een gratis Firebase Cloud Function (Spark-plan heeft een beperkt gratis
> quotum) als proxy toevoegen zonder de rest van de architectuur te wijzigen.

---

## 3. Lokaal draaien

```bash
npm install
cp .env.example .env
# vul .env in met je Firebase- en TMDB-waarden
npm run dev
```

De app draait op http://localhost:5173

## 4. Gratis hosten

Firebase Hosting heeft een gratis tier die perfect past bij deze app:

```bash
npm run build
firebase init hosting   # public directory: dist, single-page app: yes
firebase deploy --only hosting
```

Alternatief: Vercel of Netlify (beide hebben een gratis tier) — zet daar
gewoon dezelfde `VITE_*` environment variables neer als in je `.env`.

---

## Architectuuroverzicht

```
Browser (React/Vite)
   │
   ├── Firebase Auth  (login/registratie, sessie)
   ├── Firestore       (users, movies-cache, rooms, swipes, matches)
   └── TMDB REST API   (filmdata + posters, gecached in Firestore)
```

Geen eigen server: alle logica (matches bepalen, voorkeuren bijwerken,
aanbevelingen scoren) draait client-side, beveiligd door Firestore Security
Rules (`firebase/firestore.rules`).

### Firestore datamodel

```
movies/{tmdbId}
  id, title, overview, posterPath, backdropPath, year, runtime,
  voteAverage, genres[], directors[], cast[], cachedAt
  → gedeelde cache, voorkomt herhaalde TMDB-calls (30 dagen geldig)

users/{uid}
  displayName, email, photoURL, onboardingDone, swipeCount,
  preferences: { genres: {genreId: score}, directors: {id: score}, actors: {id: score} }
  /swipes/{movieId}      → solo Discover-swipes (liked: bool)
  /watchlist/{movieId}   → bewaarde films

rooms/{roomCode}
  code, name, createdBy, memberIds[], movieIds[] (gedeelde film-deck), createdAt
  /members/{uid}         → publieke naam/foto (i.p.v. users/{uid} te lezen)
  /swipes/{movieId}      → likedBy[], dislikedBy[], likeCount  → basis voor matches
  /userSwipes/{uid}      → per-gebruiker voortgang { movieId: 'like' | 'dislike' }
```

### Aanbevelingsalgoritme (`src/services/recommendation.js`)

Geen AI/ML — puur regelgebaseerd en transparant:

- Gewichten: genre = 3, regisseur = 4, acteur = 2, TMDB-rating = 1.
- Elke like/dislike past `preferences` aan met `increment()` op de
  betreffende genre/regisseur/acteur-ids.
- Bij het scoren van nieuwe films tellen we de voorkeursscores van de
  kenmerken van die film op, plus een kleine rating-bonus/maluk.
- **~20% van de kaarten is bewust willekeurig** ("ontdekking"), de overige
  80% wordt gewogen willekeurig gekozen uit de best scorende helft van de
  kandidatenpool — zo blijft het voorspelbaar genoeg om persoonlijk te
  voelen, maar sleurt de gebruiker niet vast in een filterbubbel.

### Modulariteit voor latere AI-uitbreiding (Groq)

`src/services/recommendation.js` en `src/services/candidatePool.js` zijn
losse modules met een duidelijke functiegrens (`scoreMovie`,
`pickNextCandidate`). Een toekomstige AI-gedreven filmzoekfunctie kan als
nieuwe, aparte service (bv. `src/services/aiSearch.js`) worden toegevoegd
zonder de bestaande swipe- en matchlogica aan te raken.

---

## Belangrijkste pagina's

- **Discover** — solo swipe-ervaring, aangedreven door het aanbevelingsalgoritme.
- **Rooms** — room aanmaken/joinen via een korte code of link.
- **Matches** — per room de films die door meerdere leden geliked zijn,
  met "x/y vinden deze film leuk".
- **Watchlist** — bewaarde films.
- **Profile** — smaakprofiel-overzicht, uitloggen, TMDB-attributie.
- **Onboarding** — verschijnt eenmalig na registratie: 10 films
  liken/skippen om het voorkeursprofiel te starten.

## Bekende scope-keuzes (bewust klein gehouden voor v1)

- De film-deck van een room is vast (30 films, bepaald bij het aanmaken van
  de room), zodat matches betekenisvol zijn — iedereen beoordeelt dezelfde set.
- Een match vereist minimaal 2 likes in een room.
- Geen wachtwoord-reset-flow, geen profielfoto-upload (Google-login geeft er
  al één mee), geen paginering in Watchlist — bewust simpel voor v1.
