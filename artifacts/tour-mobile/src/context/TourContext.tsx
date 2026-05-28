import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Tour, TourDetailResponse, TourStop } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useState } from "react";

const CACHED_TOURS_KEY = "tourflow_cached_tours";

interface TourContextValue {
  activeTourId: string | null;
  setActiveTourId: (id: string | null) => void;
  cachedTours: Record<string, TourDetailResponse>;
  cacheTourDetail: (data: TourDetailResponse) => Promise<void>;
  loadCachedTours: () => Promise<void>;
  currentStopIndex: number;
  setCurrentStopIndex: (idx: number) => void;
  getActiveStop: (stops: TourStop[]) => TourStop | null;
}

const TourContext = createContext<TourContextValue>({
  activeTourId: null,
  setActiveTourId: () => {},
  cachedTours: {},
  cacheTourDetail: async () => {},
  loadCachedTours: async () => {},
  currentStopIndex: 0,
  setCurrentStopIndex: () => {},
  getActiveStop: () => null,
});

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [cachedTours, setCachedTours] = useState<Record<string, TourDetailResponse>>({});
  const [currentStopIndex, setCurrentStopIndex] = useState(0);

  const cacheTourDetail = useCallback(async (data: TourDetailResponse) => {
    setCachedTours((prev) => {
      const next = { ...prev, [data.tour.id]: data };
      AsyncStorage.setItem(CACHED_TOURS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const loadCachedTours = useCallback(async () => {
    const raw = await AsyncStorage.getItem(CACHED_TOURS_KEY);
    if (raw) {
      try {
        setCachedTours(JSON.parse(raw));
      } catch {}
    }
  }, []);

  const getActiveStop = useCallback(
    (stops: TourStop[]) => {
      const notDone = stops.filter((s) => !s.skipped && !s.visited);
      return notDone[0] ?? null;
    },
    []
  );

  return (
    <TourContext.Provider
      value={{
        activeTourId,
        setActiveTourId,
        cachedTours,
        cacheTourDetail,
        loadCachedTours,
        currentStopIndex,
        setCurrentStopIndex,
        getActiveStop,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTourContext() {
  return useContext(TourContext);
}
