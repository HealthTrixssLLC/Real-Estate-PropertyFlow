import * as React from "react";
import {
  CommonActions,
  StackActions,
  createNavigationContainerRef,
  useNavigation,
  useRoute,
} from "@react-navigation/native";

/**
 * Replacement for `expo-router`'s imperative `router` API and the
 * `useLocalSearchParams` / `useRouter` / `usePathname` hooks. Backed by
 * React Navigation; path strings are parsed against our known route table
 * (matches src/navigation/RootNavigator.tsx).
 */

export type RootStackParamList = {
  Login: undefined;
  Help: undefined;
  Tabs: { screen?: keyof TabParamList } | undefined;
  TourDetail: { tourId: string };
  TourSummary: { tourId: string };
  StopDetail: { stopId: string };
  BuyerDetail: { buyerId: string };
  SkipStop: { stopId: string; tourId: string };
  NotFound: undefined;
};

export type TabParamList = {
  Today: undefined;
  Tours: undefined;
  Buyers: undefined;
  Notes: undefined;
  Settings: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type Href = string | { pathname: string; params?: Record<string, string | number | undefined> };

function resolveHref(href: Href): { name: keyof RootStackParamList; params: any } | null {
  const pathname = typeof href === "string" ? href.split("?")[0] : href.pathname;
  const params = typeof href === "string" ? parseQuery(href) : (href.params ?? {});

  // Normalize: drop trailing slash and (tabs) group marker.
  const path = pathname.replace(/\/+$/, "").replace("/(tabs)", "");

  if (path === "" || path === "/" || path === "/index") {
    return { name: "Tabs", params: { screen: "Today" } };
  }
  if (path === "/login") return { name: "Login", params: undefined };
  if (path === "/help") return { name: "Help", params: undefined };
  if (path === "/tours") return { name: "Tabs", params: { screen: "Tours" } };
  if (path === "/buyers") return { name: "Tabs", params: { screen: "Buyers" } };
  if (path === "/notes") return { name: "Tabs", params: { screen: "Notes" } };
  if (path === "/settings") return { name: "Tabs", params: { screen: "Settings" } };
  if (path === "/skip-stop") return { name: "SkipStop", params };

  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/tour\/([^/]+)\/summary$/))) {
    return { name: "TourSummary", params: { tourId: m[1] } };
  }
  if ((m = path.match(/^\/tour\/([^/]+)$/))) {
    return { name: "TourDetail", params: { tourId: m[1] } };
  }
  if ((m = path.match(/^\/stop\/([^/]+)$/))) {
    return { name: "StopDetail", params: { stopId: m[1] } };
  }
  if ((m = path.match(/^\/buyers\/([^/]+)$/))) {
    return { name: "BuyerDetail", params: { buyerId: m[1] } };
  }

  return null;
}

function parseQuery(href: string): Record<string, string> {
  const qIdx = href.indexOf("?");
  if (qIdx < 0) return {};
  const out: Record<string, string> = {};
  for (const part of href.slice(qIdx + 1).split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

function dispatchNav(action: ReturnType<typeof CommonActions.navigate>) {
  if (navigationRef.isReady()) navigationRef.dispatch(action);
}

export const router = {
  push(href: Href) {
    const r = resolveHref(href);
    if (!r) return;
    dispatchNav(CommonActions.navigate({ name: r.name as string, params: r.params }));
  },
  replace(href: Href) {
    const r = resolveHref(href);
    if (!r) return;
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.replace(r.name as string, r.params));
    }
  },
  navigate(href: Href) {
    this.push(href);
  },
  back() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  },
  canGoBack() {
    return navigationRef.isReady() && navigationRef.canGoBack();
  },
  setParams(_params: Record<string, unknown>) {
    // expo-router updates URL params in place; React Navigation has
    // navigation.setParams which we expose via the hook variant.
  },
};

export function useRouter() {
  return router;
}

export function useLocalSearchParams<
  T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(): T {
  const route = useRoute();
  return (route.params ?? {}) as T;
}

export function usePathname(): string {
  // Reconstruct an expo-router-style path from the current route so
  // existing call sites that compare `pathname.startsWith("/tour/<id>")`
  // or `"/stop/"` keep working. Mirrors the route table in resolveHref().
  if (!navigationRef.isReady()) return "/";
  const r = navigationRef.getCurrentRoute();
  if (!r) return "/";
  const p = (r.params ?? {}) as Record<string, string | undefined>;
  switch (r.name) {
    case "Login":
      return "/login";
    case "Help":
      return "/help";
    case "Tabs": {
      const screen = (p as { screen?: string }).screen;
      if (!screen || screen === "Today") return "/";
      return `/${screen.toLowerCase()}`;
    }
    case "TourDetail":
      return p.tourId ? `/tour/${p.tourId}` : "/tour";
    case "TourSummary":
      return p.tourId ? `/tour/${p.tourId}/summary` : "/tour/summary";
    case "StopDetail":
      return p.stopId ? `/stop/${p.stopId}` : "/stop";
    case "BuyerDetail":
      return p.buyerId ? `/buyers/${p.buyerId}` : "/buyers";
    case "SkipStop":
      return "/skip-stop";
    case "NotFound":
      return "/not-found";
    default:
      return `/${r.name}`;
  }
}

interface RedirectProps {
  href: Href;
}

/**
 * expo-router <Redirect /> behavior: imperatively replace navigation on mount.
 */
export function Redirect({ href }: RedirectProps): null {
  React.useEffect(() => {
    router.replace(href);
  }, [href]);
  return null;
}

interface LinkProps {
  href: Href;
  children?: React.ReactNode;
  asChild?: boolean;
  [key: string]: unknown;
}

/**
 * Minimal <Link /> shim — most callers wrap a Pressable via asChild.
 * For simplicity we always render children inside a Pressable that
 * triggers router.push on press.
 */
export function Link({ href, children, asChild: _asChild, ...rest }: LinkProps) {
  const { Pressable } = require("react-native");
  return React.createElement(
    Pressable,
    { onPress: () => router.push(href), ...rest },
    children,
  );
}

export { useNavigation };
