import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SymbolView, type SFSymbol } from "expo-symbols";
import React, { type ComponentProps } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { HelpTip } from "@/components/HelpTip";

export interface ActionButton {
  id: string;
  label: string;
  sfIcon?: SFSymbol;
  featherIcon?: ComponentProps<typeof Feather>["name"];
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}

interface ActionTrayProps {
  buttons: ActionButton[];
}

export function ActionTray({ buttons }: ActionTrayProps) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <View
      style={[
        styles.tray,
        {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          paddingBottom: isWeb ? 34 : insets.bottom + 8,
        },
      ]}
    >
      <View style={styles.trayHeader}>
        <Text style={[styles.trayLabel, { color: C.textTertiary }]}>Actions</Text>
        <HelpTip
          title="Action Tray"
          description="Use Navigate to open directions to the current stop. Tap Mark Arrived when you pull up to the property. After the showing, tap Complete Showing to move to the next stop. Use Skip if you need to bypass a stop."
        />
      </View>
      <View style={styles.grid}>
        {buttons.map((btn) => {
          const bgColor = btn.primary
            ? C.accent
            : btn.danger
            ? "#FFF0EE"
            : C.surfaceAlt;
          const textColor = btn.primary
            ? "#FFFFFF"
            : btn.danger
            ? C.coral
            : C.text;
          const iconColor = btn.primary ? "#FFFFFF" : btn.danger ? C.coral : C.accent;

          return (
            <Pressable
              key={btn.id}
              testID={`action-${btn.id}`}
              disabled={btn.disabled || btn.loading}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                btn.onPress();
              }}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: bgColor },
                (btn.disabled || btn.loading) && { opacity: 0.5 },
                pressed && { opacity: 0.75 },
                btn.primary && styles.primaryBtn,
              ]}
            >
              {btn.loading ? (
                <ActivityIndicator color={iconColor} size="small" />
              ) : btn.sfIcon && isIOS ? (
                <SymbolView name={btn.sfIcon} tintColor={iconColor} size={18} />
              ) : btn.featherIcon ? (
                <Feather name={btn.featherIcon} size={18} color={iconColor} />
              ) : null}
              <Text style={[styles.btnLabel, { color: textColor }]}>{btn.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  trayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  trayLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 100,
    flex: 1,
    justifyContent: "center",
  },
  primaryBtn: {
    flex: 2,
    minWidth: "100%",
  },
  btnLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
