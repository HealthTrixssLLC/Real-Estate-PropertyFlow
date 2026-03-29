import { useEffect, useState } from "react"
import { setOptions, importLibrary } from "@googlemaps/js-api-loader"

type LoadStatus = "idle" | "loading" | "ready" | "error"

let loadPromise: Promise<void> | null = null

async function loadGoogleMaps(apiKey: string): Promise<void> {
  setOptions({
    key: apiKey,
    v: "weekly",
    libraries: ["places", "geometry"],
  })
  await importLibrary("maps")
  await importLibrary("places")
}

export function useGoogleMaps() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const [status, setStatus] = useState<LoadStatus>("idle")

  useEffect(() => {
    if (!apiKey) {
      setStatus("error")
      return
    }

    if (typeof google !== "undefined" && typeof google.maps?.Map === "function") {
      setStatus("ready")
      return
    }

    setStatus("loading")

    if (!loadPromise) {
      loadPromise = loadGoogleMaps(apiKey)
    }

    loadPromise
      .then(() => setStatus("ready"))
      .catch(() => {
        setStatus("error")
        loadPromise = null
      })
  }, [apiKey])

  return { status, hasApiKey: Boolean(apiKey) }
}
