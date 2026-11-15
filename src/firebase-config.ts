// Firebase web app config for SafeText (project safetext-2, Spark plan).
//
// NOTE 2026-11-15 ~17:58 WIB: the first project (safetext-e13d1) had a broken
// AI Logic setup — its SDK calls failed with "genai config not found" and the
// console showed NO Get started workflow. A clean project (safetext-2) DID
// offer the guided workflow; the Gemini Developer API backend was enabled
// through it (App Check auto-enforced for AI Logic). safetext-e13d1 is
// abandoned; this file now points at safetext-2.
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
  /**
   * reCAPTCHA Enterprise (Fraud Defense) site key for App Check attestation
   * in production. Public by design — site keys are meant to be embedded in
   * client code (the SECRET key is never here). Registered 2026-11-15 for
   * safetext-web-2, domains buahrasa01-hub.github.io + localhost.
   */
  recaptchaEnterpriseSiteKey: string;
}

export const firebaseConfig: FirebaseWebConfig = {
  apiKey: "AIzaSyCl5SIxXO1-4DWfSlltnQ-x49VqLxjl1Gc",
  authDomain: "safetext-2.firebaseapp.com",
  projectId: "safetext-2",
  storageBucket: "safetext-2.firebasestorage.app",
  messagingSenderId: "132534852478",
  appId: "1:132534852478:web:a22ce364f4be8554cf312f",
  recaptchaEnterpriseSiteKey: "6LewyCAuAAAAAH_AexpFKPDoTXK9QC6rtSG8OXNG",
};

export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== "" && firebaseConfig.projectId !== "";
}
