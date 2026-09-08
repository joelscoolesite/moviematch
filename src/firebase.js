// Firebase-initialisatie.
// Alle waarden komen uit environment variables (.env) — nooit hardcoded,
// zodat er geen geheime sleutels in de broncode of git-historie belanden.
// De Firebase "apiKey" is overigens geen geheim in de klassieke zin (Google
// documenteert dit), maar we houden hem toch buiten de code voor nette
// scheiding tussen config en logica, en omdat de Security Rules de échte
// beveiliging vormen.

import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

if (!firebaseConfig.apiKey) {
  // Duidelijke fout i.p.v. cryptische Firebase-errors verderop.
  console.error(
    'Firebase config ontbreekt. Kopieer .env.example naar .env en vul je Firebase-projectgegevens in.'
  )
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
