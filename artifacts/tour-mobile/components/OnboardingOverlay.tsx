import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SymbolView } from "expo-symbols";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

const ONBOARDING_KEY = "tourflow_onboarding_complete_v1";


interface OnboardingCard {
  id: string;
  sfIcon: string;
  featherIcon: string;
  accent: string;
  title: string;
  description: string;
}

const CARDS: OnboardingCard[] = [
  {
    id: "welcome",
    sfIcon: "map.fill",
    featherIcon: "map",
    accent: "#6366F1",
    title: "Welcome to TourFlow",
    description:
      "TourFlow helps real estate agents plan, execute, and recap property tours — all in one place. Set up tours on the web, then run them seamlessly from your phone.",
  },
  {
    id: "plan",
    sfIcon: "laptopcomputer",
    featherIcon: "monitor",
    accent: "#0EA5E9",
    title: "Plan on the Web",
    description:
      "Use the TourFlow web app to create tours, add stops, coordinate showing approvals, and publish the final itinerary. Your phone picks it up automatically.",
  },
  {
    id: "execute",
    sfIcon: "location.fill",
    featherIcon: "navigation",
    accent: "#10B981",
    title: "Execute on Your Phone",
    description:
      "On tour day, open TourFlow here. Navigate to each stop, tap Mark Arrived, then record voice notes and star ratings while the property is fresh in mind.",
  },
  {
    id: "summary",
    sfIcon: "sparkles",
    featherIcon: "zap",
    accent: "#F59E0B",
    title: "Get an AI Summary",
    description:
      "After all stops, tap Tour Summary to generate an AI-powered recap of every property — ratings, notes, and recommended next steps — ready to share with your client.",
  },
];

export function OnboardingOverlay() {
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const check = async () => {
      try {
        const done = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!done) {
          setVisible(true);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      } catch {
      }
    };
    check();
  }, []);

  const dismiss = async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    } catch {
    }
  };

  const goNext = () => {
    if (currentIndex < CARDS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: C.card, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Pressable
            onPress={dismiss}
            style={styles.skipBtn}
            hitSlop={12}
            testID="onboarding-skip"
          >
            <Text style={[styles.skipText, { color: C.textSecondary }]}>Skip</Text>
          </Pressable>

          <View style={styles.card}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: CARDS[currentIndex].accent + "18" },
              ]}
            >
              {isIOS ? (
                <SymbolView name={CARDS[currentIndex].sfIcon as any} tintColor={CARDS[currentIndex].accent} size={48} />
              ) : (
                <Feather name={CARDS[currentIndex].featherIcon as any} size={48} color={CARDS[currentIndex].accent} />
              )}
            </View>
            <Text style={[styles.cardTitle, { color: C.text }]}>
              {CARDS[currentIndex].title}
            </Text>
            <Text style={[styles.cardDesc, { color: C.textSecondary }]}>
              {CARDS[currentIndex].description}
            </Text>
          </View>

          <View style={styles.dots}>
            {CARDS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === currentIndex ? CARDS[currentIndex].accent : C.border,
                    width: i === currentIndex ? 20 : 6,
                  },
                ]}
              />
            ))}
          </View>

          <Pressable
            onPress={goNext}
            testID="onboarding-next"
            style={({ pressed }) => [
              styles.nextBtn,
              { backgroundColor: CARDS[currentIndex].accent },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.nextText}>
              {currentIndex < CARDS.length - 1 ? "Next" : "Get Started"}
            </Text>
            {currentIndex < CARDS.length - 1 ? (
              isIOS ? (
                <SymbolView name="arrow.right" tintColor="#FFF" size={16} />
              ) : (
                <Feather name="arrow-right" size={16} color="#FFF" />
              )
            ) : (
              isIOS ? (
                <SymbolView name="checkmark" tintColor="#FFF" size={16} />
              ) : (
                <Feather name="check" size={16} color="#FFF" />
              )
            )}
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 24,
    overflow: "hidden",
  },
  skipBtn: {
    alignSelf: "flex-end",
    marginBottom: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  card: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  cardDesc: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginVertical: 20,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  nextText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
