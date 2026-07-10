import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { GoogleAuthProvider, signInWithCredential, onIdTokenChanged } from "firebase/auth";
import { firebaseAuth } from "@/src/firebase/config";
import { api, AppUser } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "jbm_session_token";

type AuthState = {
  loading: boolean;
  user: AppUser | null;
  token: string | null;
  deactivated: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  clearDeactivated: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return storage.getItem(TOKEN_KEY, null as string | null);
  }
  return storage.secureGet(TOKEN_KEY, null as string | null);
}

async function saveToken(t: string): Promise<void> {
  if (Platform.OS === "web") {
    await storage.setItem(TOKEN_KEY, t);
  } else {
    await storage.secureSet(TOKEN_KEY, t);
  }
}

async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    await storage.removeItem(TOKEN_KEY);
  } else {
    await storage.secureRemove(TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [deactivated, setDeactivated] = useState(false);

  // Google OAuth client IDs — from Firebase Console > Authentication >
  // Sign-in method > Google, and from the Google Cloud Console credentials
  // page for each platform. Set these as EXPO_PUBLIC_* env vars.
  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  const processFirebaseIdToken = useCallback(async (idToken: string) => {
    try {
      const { session_token, user: u } = await api.authSession(idToken);
      await saveToken(session_token);
      setToken(session_token);
      setUser(u);
    } catch (e: any) {
      if (e?.status === 403) {
        setDeactivated(true);
        await clearToken();
        setToken(null);
        setUser(null);
      } else {
        throw e;
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      setToken(null);
      return;
    }
    try {
      const me = await api.me(t);
      setToken(t);
      setUser(me);
    } catch (e: any) {
      if (e?.status === 403) {
        setDeactivated(true);
      }
      await clearToken();
      setUser(null);
      setToken(null);
    }
  }, []);

  // Initial mount: restore an existing token, if any.
  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (e) {
        console.warn("auth init error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const signIn = useCallback(async () => {
    const result = await promptAsync();
    if (result?.type !== "success") return;
    const idToken =
      (result.params as any)?.id_token ||
      (result.authentication as any)?.idToken;
    if (!idToken) {
      console.warn("Google sign-in did not return an id_token");
      return;
    }
    // Exchange the Google id_token for a signed-in Firebase user, then
    // grab THAT user's Firebase ID token — this is what the backend verifies.
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(firebaseAuth, credential);
    const firebaseIdToken = await cred.user.getIdToken();
    await processFirebaseIdToken(firebaseIdToken);
  }, [promptAsync, processFirebaseIdToken]);

  const signOut = useCallback(async () => {
    try {
      await firebaseAuth.signOut();
    } catch {}
    await clearToken();
    setUser(null);
    setToken(null);
  }, []);

  // Keep our backend session in sync if Firebase silently refreshes/rotates
  // the ID token (it does this roughly hourly while signed in).
  useEffect(() => {
    const unsub = onIdTokenChanged(firebaseAuth, async (fbUser) => {
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        await saveToken(idToken);
        setToken(idToken);
      }
    });
    return unsub;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      user,
      token,
      deactivated,
      signIn,
      signOut,
      refresh,
      clearDeactivated: () => setDeactivated(false),
    }),
    [loading, user, token, deactivated, signIn, signOut, refresh],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
