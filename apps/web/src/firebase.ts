import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Firebase web config, read at build time from `VITE_FIREBASE_*` env vars
 * (see `.env.example`). These values are public — they identify the project to
 * Google, they are not secrets.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** True when the Firebase web config is present; the UI shows a hint if not. */
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);

/** The single Firebase Auth instance used for Google and email sign-in. */
export const firebaseAuth: Auth = getAuth(firebaseApp);
