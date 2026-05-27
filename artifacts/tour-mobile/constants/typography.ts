import type { TextStyle } from "react-native";

export const Typography: Record<string, TextStyle> = {
  largeTitle:   { fontSize: 34, fontWeight: "bold",  letterSpacing: 0.37 },
  title1:       { fontSize: 28, fontWeight: "bold",  letterSpacing: 0.36 },
  title2:       { fontSize: 22, fontWeight: "bold",  letterSpacing: 0.35 },
  title3:       { fontSize: 20, fontWeight: "600",   letterSpacing: 0.38 },
  headline:     { fontSize: 17, fontWeight: "600",   letterSpacing: -0.41 },
  body:         { fontSize: 17, fontWeight: "400",   letterSpacing: -0.41 },
  callout:      { fontSize: 16, fontWeight: "400",   letterSpacing: -0.32 },
  subheadline:  { fontSize: 15, fontWeight: "400",   letterSpacing: -0.24 },
  footnote:     { fontSize: 13, fontWeight: "400",   letterSpacing: -0.08 },
  caption1:     { fontSize: 12, fontWeight: "400",   letterSpacing: 0 },
  caption2:     { fontSize: 11, fontWeight: "400",   letterSpacing: 0.07 },
  sectionHeader:{ fontSize: 13, fontWeight: "500",   letterSpacing: 0.5, textTransform: "uppercase" },
};
