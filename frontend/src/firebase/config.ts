import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import Constants from "expo-constants";

const extra =
  (Constants.expoConfig?.extra as Record<string, string> | undefined) ?? {};

function env(key: string): string {
  return (process.env[key] as string) || extra[key] || "";
}

// Fill these in from Firebase Console > Project settings > General > Your apps > Web app.
// Set them as EXPO_PUBLIC_* env vars (see frontend/.env.example) — these are
// safe to ship in the client, they are not secrets.
const firebaseConfig = {
  apiKey: env("EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: env("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: env("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: env("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: env("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("EXPO_PUBLIC_FIREBASE_APP_ID"),
};

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
