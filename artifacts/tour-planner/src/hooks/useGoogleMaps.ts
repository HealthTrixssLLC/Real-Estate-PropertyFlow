import { useEffect, useState } from "react"
import { setOptions, importLibrary } from "@googlemaps/js-api-loader"

type LoadStatus = "idle" | "loading" | "ready" | "error"

let loadPromise: Promise<void> | null = null
let globalStatus: LoadStatus = "idle"
const statusListeners = new Set<(s: LoadStatus) => void>()

function notifyListeners(s: LoadStatus) {
  globalStatus = s
  statusListeners.forEach(fn => fn(s))
}

async function loadGoogleMaps(apiKey: string): Promise<void> {
  setOptions({
    key: apiKey,
    v: "weekly",
    libraries: ["places", "geometry"],
  })
  await importLibrary("maps")
  await importLibrary("places")
}

function installGlobalErrorHandlers(onError: () => void) {
  const prevAuthFailure = (window as Window & { gm_authFailure?: () => void }).gm_authFailure
  ;(window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
    onError()
    if (prevAuthFailure) prevAuthFailure()
  }

  const handleWindowError = (event: ErrorEvent) => {
    const msg = event.message ?? ""
    if (
      msg.includes("ApiNotActivatedMapError") ||
      msg.includes("InvalidKeyMapError") ||
      msg.includes("RefererNotAllowedMapError")
    ) {
      onError()
    }
  }

  window.addEventListener("error", handleWindowError)
  return () => {
    window.removeEventListener("error", handleWindowError)
  }
}

export function useGoogleMaps() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const [status, setStatus] = useState<LoadStatus>(globalStatus === "idle" ? "idle" : globalStatus)

  useEffect(() => {
    const listener = (s: LoadStatus) => setStatus(s)
    statusListeners.add(listener)
    return () => {
      statusListeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    if (!apiKey) {
      notifyListeners("error")
      return
    }

    if (globalStatus === "ready" || globalStatus === "error") {
      setStatus(globalStatus)
      return
    }

    notifyListeners("loading")

    const cleanupErrorHandlers = installGlobalErrorHandlers(() => {
      if (globalStatus !== "error") {
        notifyListeners("error")
        loadPromise = null
      }
    })

    if (!loadPromise) {
      loadPromise = loadGoogleMaps(apiKey)
    }

    loadPromise
      .then(() => {
        if (globalStatus !== "error") {
          notifyListeners("ready")
        }
      })
      .catch(() => {
        notifyListeners("error")
        loadPromise = null
      })

    return cleanupErrorHandlers
  }, [apiKey])

  return { status, hasApiKey: Boolean(apiKey) }
}
