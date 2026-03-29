import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const AUTH_TOKEN_KEY = "tourflow_auth_token";

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  setToken: (token: string | null) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  isLoading: true,
  setToken: async () => {},
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

  const signOut = useCallback(async () => {
    await setToken(null);
  }, [setToken]);

  return (
    <AuthContext.Provider value={{ token, isLoading, setToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
