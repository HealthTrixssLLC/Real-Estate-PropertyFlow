import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { Brand } from "@/theme";
import type { RootStackParamList } from "@/lib/navigation";

import { TabNavigator } from "./TabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import HelpScreen from "@/screens/HelpScreen";
import NotFoundScreen from "@/screens/NotFoundScreen";
import TourDetailScreen from "@/screens/TourDetailScreen";
import TourSummaryScreen from "@/screens/TourSummaryScreen";
import StopDetailScreen from "@/screens/StopDetailScreen";
import BuyerDetailScreen from "@/screens/BuyerDetailScreen";
import SkipStopScreen from "@/screens/SkipStopScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) return <View style={{ flex: 1 }} />;

  if (!token) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitle: "Back",
        headerTintColor: Brand.teal,
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="TourDetail"
        component={TourDetailScreen}
        options={{ title: "Tour" }}
      />
      <Stack.Screen
        name="TourSummary"
        component={TourSummaryScreen}
        options={{ title: "Tour Summary", presentation: "modal" }}
      />
      <Stack.Screen
        name="StopDetail"
        component={StopDetailScreen}
        options={{ title: "Stop Details" }}
      />
      <Stack.Screen
        name="BuyerDetail"
        component={BuyerDetailScreen}
        options={{ title: "Buyer" }}
      />
      <Stack.Screen
        name="SkipStop"
        component={SkipStopScreen}
        options={{
          title: "Skip Stop",
          presentation: Platform.OS === "ios" ? "formSheet" : "modal",
        }}
      />
      <Stack.Screen name="Help" component={HelpScreen} options={{ title: "Help" }} />
      <Stack.Screen name="NotFound" component={NotFoundScreen} options={{ title: "Not found" }} />
    </Stack.Navigator>
  );
}
