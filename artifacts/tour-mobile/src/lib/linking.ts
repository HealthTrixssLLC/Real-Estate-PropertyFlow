import { Linking as RNLinking } from "react-native";

/**
 * Stand-in for expo-linking. Only the methods used by the app are exposed.
 */
export const canOpenURL = (url: string) => RNLinking.canOpenURL(url);
export const openURL = (url: string) => RNLinking.openURL(url);

export function createURL(path: string): string {
  return `tourflow://${path.replace(/^\//, "")}`;
}

export default { canOpenURL, openURL, createURL };
