// TODO: REAL FIREBASE WEB CONFIG — NOT AVAILABLE YET.
//
// This file holds the Firebase web app config for SafeText. The real values
// come from the Firebase console (parent step: create the dedicated
// SafeText Firebase project, AI Logic guided setup, Gemini Developer API
// backend). Until then the config is empty and the AI layer refuses to
// run, showing a clear "Firebase not configured yet" state in the app.
//
// The web config values (apiKey etc.) are public-by-design client config,
// NOT secrets — but never put a production API key, a live Google Cloud
// project secret, or any credential in this repo (Devpost Rules §6).

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  /** App Check debug token for the submission build (optional; set by the console step). */
  appCheckDebugToken?: string;
}

export const firebaseConfig: FirebaseWebConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== "" && firebaseConfig.projectId !== "";
}
