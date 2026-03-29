import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { TourProvider, useTourContext } from "@/context/TourContext";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

function CacheLoader() {
  const { loadCachedTours } = useTourContext();
  useEffect(() => {
    loadCachedTours();
  }, [loadCachedTours]);
  return null;
}

function RootLayoutNav() {
  const { token, isLoading } = useAuth();

  if (isLoading) return null;

  if (!token) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Redirect href="/login" />
      </Stack>
    );
  }

  return (
    <TourProvider>
      <CacheLoader />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="tour/[tourId]"
          options={{ title: "Tour", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="tour/[tourId]/summary"
          options={{ title: "Tour Summary", presentation: "modal" }}
        />
        <Stack.Screen
          name="stop/[stopId]"
          options={{ title: "Stop Details", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="skip-stop"
          options={{
            title: "Skip Stop",
            presentation: "formSheet",
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
    </TourProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    const flushAll = () => {
      import("@/utils/voiceUploadQueue").then(({ flushQueue }) => flushQueue());
      import("@/utils/noteQueue").then(({ flushNoteQueue }) =>
        flushNoteQueue(apiBase)
      );
    };
    let wasOffline = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (wasOffline && state.isConnected) flushAll();
      wasOffline = !state.isConnected;
    });
    flushAll();
    return () => unsubscribe();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
