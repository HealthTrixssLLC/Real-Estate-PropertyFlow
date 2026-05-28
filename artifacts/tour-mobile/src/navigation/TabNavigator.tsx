import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { ActiveTourBar } from "@/components/ui/ActiveTourBar";
import { Brand, sem } from "@/theme";
import { IconSymbol, type SFSymbol } from "@/lib/icon";
import type { TabParamList } from "@/lib/navigation";

import TodayScreen from "@/screens/TodayScreen";
import ToursScreen from "@/screens/ToursScreen";
import BuyersScreen from "@/screens/BuyersScreen";
import NotesScreen from "@/screens/NotesScreen";
import SettingsScreen from "@/screens/SettingsScreen";

const Tab = createBottomTabNavigator<TabParamList>();

function makeIcon(active: SFSymbol, inactive: SFSymbol) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <IconSymbol name={focused ? active : inactive} tintColor={color} size={24} />
  );
}

export function TabNavigator() {
  return (
    <View style={{ flex: 1, backgroundColor: sem("grouped") as string }}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: Brand.teal,
          tabBarInactiveTintColor: sem("labelTertiary") as string,
          tabBarStyle: { backgroundColor: sem("groupedSurface") as string },
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Today"
          component={TodayScreen}
          options={{ title: "Today", tabBarIcon: makeIcon("sun.max.fill", "sun.max") }}
        />
        <Tab.Screen
          name="Tours"
          component={ToursScreen}
          options={{ title: "Tours", tabBarIcon: makeIcon("map.fill", "map") }}
        />
        <Tab.Screen
          name="Buyers"
          component={BuyersScreen}
          options={{ title: "Buyers", tabBarIcon: makeIcon("person.2.fill", "person.2") }}
        />
        <Tab.Screen
          name="Notes"
          component={NotesScreen}
          options={{ title: "Notes", tabBarIcon: makeIcon("note.text.badge.plus", "note.text") }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: "Settings", tabBarIcon: makeIcon("gearshape.fill", "gearshape") }}
        />
      </Tab.Navigator>
      <ActiveTourBar />
    </View>
  );
}
