import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import React, { useState } from "react";
import {
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

interface HelpTipProps {
  title: string;
  description: string;
  size?: number;
}

export function HelpTip({ title, description, size = 16 }: HelpTipProps) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const isIOS = Platform.OS === "ios";
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        testID={`help-tip-${title.toLowerCase().replace(/\s+/g, "-")}`}
        style={[styles.btn, { backgroundColor: C.surfaceAlt }]}
      >
        {isIOS ? (
          <SymbolView name="questionmark" tintColor={C.textSecondary} size={size - 2} />
        ) : (
          <Feather name="help-circle" size={size} color={C.textSecondary} />
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.tooltip,
              {
                backgroundColor: C.card,
                borderColor: C.border,
                marginBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={styles.tooltipHeader}>
              {isIOS ? (
                <SymbolView name="questionmark.circle.fill" tintColor={C.accent} size={18} />
              ) : (
                <Feather name="help-circle" size={18} color={C.accent} />
              )}
              <Text style={[styles.tooltipTitle, { color: C.text }]}>{title}</Text>
            </View>
            <Text style={[styles.tooltipDesc, { color: C.textSecondary }]}>
              {description}
            </Text>
            <Pressable
              onPress={() => setOpen(false)}
              style={[styles.closeBtn, { backgroundColor: C.accent }]}
            >
              <Text style={styles.closeBtnText}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
  },
  tooltip: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 10,
  },
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tooltipTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  tooltipDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  closeBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  closeBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
