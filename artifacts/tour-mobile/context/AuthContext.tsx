import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const AUTH_TOKEN_KEY = "tourflow_auth_token";

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  setToken: (token: string | null) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  isLoading: true,
  setToken: async () => {},
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_TOKEN_KEY).then((stored) => {
      setTokenState(stored ?? null);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  const setToken = useCallback(async (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
    } else {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const apiBase =
      process.env.EXPO_PUBLIC_API_URL ??
      `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    const res = await fetch(`${apiBase}/api/mobile-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Login failed");
    }

    const data = await res.json();
    await setToken(data.token);
  }, [setToken]);

  const signOut = useCallback(async () => {
    await setToken(null);
  }, [setToken]);

  return (
    <AuthContext.Provider value={{ token, isLoading, setToken, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
