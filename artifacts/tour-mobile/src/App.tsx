import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { setBaseUrl } from "@workspace/api-client-react";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/context/AuthContext";
import { TourProvider } from "@/context/TourContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RootNavigator } from "@/navigation/RootNavigator";
import { navigationRef } from "@/lib/navigation";
import { API_URL } from "@/config";

setBaseUrl(API_URL);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

function OfflineQueueFlusher() {
  useEffect(() => {
    const flushAll = () => {
      import("@/utils/voiceUploadQueue").then(({ flushQueue }) => flushQueue()).catch(() => undefined);
      import("@/utils/noteQueue").then(({ flushNoteQueue }) => flushNoteQueue(API_URL)).catch(() => undefined);
    };
    let wasOffline = false;
    const unsub = NetInfo.addEventListener((state) => {
      if (wasOffline && state.isConnected) flushAll();
      wasOffline = !state.isConnected;
    });
    flushAll();
    return () => unsub();
  }, []);
  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <TourProvider>
                <KeyboardProvider>
                  <NavigationContainer ref={navigationRef}>
                    <OfflineQueueFlusher />
                    <RootNavigator />
                  </NavigationContainer>
                </KeyboardProvider>
              </TourProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
