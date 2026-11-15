// Firebase web app config for SafeText (project safetext-e13d1, Spark plan).
//
// These values are public-by-design client config, NOT secrets — Firebase
// AI Logic proxies the Gemini API key server-side. Never put a production
// API key, a live Google Cloud project secret, or any credential in this
// repo (Devpost Rules §6).
//
// The App Check debug token is deliberately NOT in this file. It lives only
// in a gitignored local .env.local as VITE_APPCHECK_DEBUG_TOKEN (local dev
// only) and is never committed or baked into production builds.

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const firebaseConfig: FirebaseWebConfig = {
  apiKey: "AIzaSyC2yKPJgFgm-dcGWAHs2XAkSNKpSw64Ykw",
  authDomain: "safetext-e13d1.firebaseapp.com",
  projectId: "safetext-e13d1",
  storageBucket: "safetext-e13d1.firebasestorage.app",
  messagingSenderId: "175931254232",
  appId: "1:175931254232:web:597a2d2d04c16ac3d67ead",
};

export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== "" && firebaseConfig.projectId !== "";
}
