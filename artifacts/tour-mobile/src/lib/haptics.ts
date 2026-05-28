import RNHaptic from "react-native-haptic-feedback";

/**
 * Drop-in replacement for expo-haptics that preserves the exact
 * import shape used by existing screens:
 *
 *   import * as Haptics from "@/lib/haptics";
 *   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
 *   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
 *   Haptics.selectionAsync();
 */

const opts = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

export const ImpactFeedbackStyle = {
  Light: "impactLight",
  Medium: "impactMedium",
  Heavy: "impactHeavy",
  Soft: "soft",
  Rigid: "rigid",
} as const;
export type ImpactFeedbackStyleType =
  (typeof ImpactFeedbackStyle)[keyof typeof ImpactFeedbackStyle];

export const NotificationFeedbackType = {
  Success: "notificationSuccess",
  Warning: "notificationWarning",
  Error: "notificationError",
} as const;
export type NotificationFeedbackTypeType =
  (typeof NotificationFeedbackType)[keyof typeof NotificationFeedbackType];

export async function impactAsync(style: ImpactFeedbackStyleType = "impactMedium") {
  try {
    RNHaptic.trigger(style, opts);
  } catch {
    /* haptics best-effort */
  }
}

export async function notificationAsync(
  type: NotificationFeedbackTypeType = "notificationSuccess",
) {
  try {
    RNHaptic.trigger(type, opts);
  } catch {
    /* haptics best-effort */
  }
}

export async function selectionAsync() {
  try {
    RNHaptic.trigger("selection", opts);
  } catch {
    /* haptics best-effort */
  }
}
