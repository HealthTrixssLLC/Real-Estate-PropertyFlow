export { Semantic } from "./semantic";
export { Typography } from "./typography";

const teal = "#2DB8A0";
const tealLight = "#3DD9BF";
const amber = "#FF9500";
const coral = "#FF3B30";
const green = "#34C759";
const blue = "#007AFF";

export default {
  light: {
    background: "#F2F2F7",
    surface: "#FFFFFF",
    surfaceAlt: "#EFEFF4",
    primary: "#1C3A5E",
    primaryMid: "#2A4F7A",
    accent: teal,
    accentLight: tealLight,
    amber,
    coral,
    green,
    blue,
    text: "#000000",
    textSecondary: "#6B6B72",
    textTertiary: "#AEAEB2",
    border: "#C6C6C8",
    tint: teal,
    tabIconDefault: "#8E8E93",
    tabIconSelected: teal,
    card: "#FFFFFF",
    shadow: "rgba(0,0,0,0.04)",
    chip: {
      active: { bg: "#E8F8F5", text: "#2DB8A0" },
      draft: { bg: "#F2F2F7", text: "#6B6B72" },
      published: { bg: "#EBF4FF", text: "#007AFF" },
      completed: { bg: "#E8F8EC", text: "#34C759" },
      cancelled: { bg: "#FDECEC", text: "#FF3B30" },
    },
    approvedStatus: {
      approved: { bg: "#E8F8EC", text: "#34C759" },
      pending: { bg: "#FFF3E2", text: "#FF9500" },
      requested: { bg: "#EBF4FF", text: "#007AFF" },
      not_requested: { bg: "#F2F2F7", text: "#8E8E93" },
      declined: { bg: "#FDECEC", text: "#FF3B30" },
      needs_follow_up: { bg: "#FFF3E8", text: "#FF9500" },
      restricted: { bg: "#FDECEC", text: "#FF3B30" },
      cancelled: { bg: "#F2F2F7", text: "#AEAEB2" },
    },
  },
  dark: {
    background: "#000000",
    surface: "#1C1C1E",
    surfaceAlt: "#2C2C2E",
    primary: "#FFFFFF",
    primaryMid: "#D0D9E8",
    accent: teal,
    accentLight: tealLight,
    amber,
    coral,
    green,
    blue,
    text: "#FFFFFF",
    textSecondary: "#8E8E93",
    textTertiary: "#636366",
    border: "#38383A",
    tint: teal,
    tabIconDefault: "#636366",
    tabIconSelected: teal,
    card: "#1C1C1E",
    shadow: "rgba(0,0,0,0.35)",
    chip: {
      active: { bg: "#0E2922", text: "#2DB8A0" },
      draft: { bg: "#2C2C2E", text: "#8E8E93" },
      published: { bg: "#001E38", text: "#0A84FF" },
      completed: { bg: "#0E271A", text: "#30D158" },
      cancelled: { bg: "#2A1515", text: "#FF453A" },
    },
    approvedStatus: {
      approved: { bg: "#0E271A", text: "#30D158" },
      pending: { bg: "#2A1E0A", text: "#FF9F0A" },
      requested: { bg: "#001E38", text: "#0A84FF" },
      not_requested: { bg: "#2C2C2E", text: "#8E8E93" },
      declined: { bg: "#2A1515", text: "#FF453A" },
      needs_follow_up: { bg: "#2A1A0A", text: "#FF9F0A" },
      restricted: { bg: "#2A1515", text: "#FF453A" },
      cancelled: { bg: "#2C2C2E", text: "#636366" },
    },
  },
};
