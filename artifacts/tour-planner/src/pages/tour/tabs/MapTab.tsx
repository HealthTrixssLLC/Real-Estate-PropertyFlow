import { useEffect, useRef } from "react"
import type { TourStop, Property } from "@workspace/api-client-react"
import { useGoogleMaps } from "@/hooks/useGoogleMaps"
import { Loader2, MapPin, AlertCircle, Navigation } from "lucide-react"
import { HelpPopover } from "@/components/shared/HelpPopover"

interface MapTabProps {
  stops: TourStop[]
  properties: Property[]
  startLat?: number | null
  startLng?: number | null
  startAddress?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  approved: "#22c55e",
  pending: "#f59e0b",
  declined: "#ef4444",
  not_requested: "#94a3b8",
  requested: "#3b82f6",
  needs_follow_up: "#f97316",
  restricted: "#a855f7",
  cancelled: "#6b7280",
}

export default function MapTab({ stops, properties, startLat, startLng, startAddress }: MapTabProps) {
  const { status, hasApiKey } = useGoogleMaps()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const polylineRef = useRef<google.maps.Polyline | null>(null)

  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return

    const stopsWithCoords = stops
      .slice()
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map(stop => {
        const prop = properties.find(p => p.id === stop.propertyId)
        if (!prop?.lat || !prop?.lng) return null
        return { stop, prop, lat: prop.lat, lng: prop.lng }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    const hasStartCoords = startLat != null && startLng != null

    const defaultCenter = hasStartCoords
      ? { lat: startLat!, lng: startLng! }
      : stopsWithCoords.length > 0
        ? { lat: stopsWithCoords[0].lat, lng: stopsWithCoords[0].lng }
        : { lat: 37.7749, lng: -122.4194 }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: stopsWithCoords.length > 0 || hasStartCoords ? 13 : 10,
        mapTypeControl: false,
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        ],
      })
      infoWindowRef.current = new google.maps.InfoWindow()
    }

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
      directionsRendererRef.current = null
    }
    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    if (hasStartCoords) {
      const startMarker = new google.maps.Marker({
        position: { lat: startLat!, lng: startLng! },
        map: mapInstanceRef.current!,
        label: {
          text: "S",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "12px",
        },
        icon: {
          path: "M -10,-10 L 10,-10 L 10,10 L -10,10 Z",
          fillColor: "#1e293b",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale: 1,
          anchor: new google.maps.Point(0, 0),
        },
        title: startAddress ?? "Starting Point",
        zIndex: 20,
      })

      startMarker.addListener("click", () => {
        infoWindowRef.current!.setContent(`
          <div style="max-width:240px;font-family:system-ui,sans-serif;padding:4px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#111">
              Starting Point
            </div>
            ${startAddress ? `<div style="font-size:13px;color:#374151">${startAddress}</div>` : ""}
          </div>
        `)
        infoWindowRef.current!.open(mapInstanceRef.current!, startMarker)
      })

      markersRef.current.push(startMarker)
    }

    stopsWithCoords.forEach(({ stop, prop, lat, lng }, idx) => {
      const color = stop.skipped
        ? "#6b7280"
        : (STATUS_COLORS[stop.approvedStatus] ?? "#3b82f6")

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current!,
        label: {
          text: String(stop.sequence ?? idx + 1),
          color: "#fff",
          fontWeight: "bold",
          fontSize: "12px",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 18,
          fillColor: color,
          fillOpacity: stop.skipped ? 0.5 : 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        title: prop.formattedAddress,
        zIndex: stop.skipped ? 1 : 10,
      })

      marker.addListener("click", () => {
        infoWindowRef.current!.setContent(`
          <div style="max-width:240px;font-family:system-ui,sans-serif;padding:4px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#111">
              Stop ${stop.sequence ?? idx + 1}${stop.skipped ? " (Skipped)" : ""}
            </div>
            <div style="font-size:13px;color:#374151;margin-bottom:6px">${prop.formattedAddress}</div>
            <div style="display:flex;gap:8px;font-size:12px;color:#6b7280;flex-wrap:wrap">
              ${prop.beds != null ? `<span>${prop.beds} bd</span>` : ""}
              ${prop.baths != null ? `<span>${prop.baths} ba</span>` : ""}
              ${prop.squareFeet != null ? `<span>${prop.squareFeet.toLocaleString()} sqft</span>` : ""}
              ${prop.listPrice != null ? `<span style="font-weight:600;color:#111">$${prop.listPrice.toLocaleString()}</span>` : ""}
            </div>
            <div style="margin-top:8px;padding:3px 8px;border-radius:999px;display:inline-block;
              font-size:11px;font-weight:600;
              background:${color}20;color:${color};border:1px solid ${color}50">
              ${stop.skipped ? `Skipped: ${stop.skipReason ?? ""}` : stop.approvedStatus.replace(/_/g, " ")}
            </div>
          </div>
        `)
        infoWindowRef.current!.open(mapInstanceRef.current!, marker)
      })

      markersRef.current.push(marker)
    })

    if (stopsWithCoords.length > 0 && mapInstanceRef.current) {
      const bounds = new google.maps.LatLngBounds()
      if (hasStartCoords) {
        bounds.extend({ lat: startLat!, lng: startLng! })
      }
      stopsWithCoords.forEach(({ lat, lng }) => bounds.extend({ lat, lng }))
      mapInstanceRef.current.fitBounds(bounds, 60)
    }

    const routePoints = stopsWithCoords.length > 0 || hasStartCoords
    if (!routePoints) return

    const origin = hasStartCoords
      ? { lat: startLat!, lng: startLng! }
      : { lat: stopsWithCoords[0].lat, lng: stopsWithCoords[0].lng }

    const allPoints = [
      ...(hasStartCoords ? [] : []),
      ...stopsWithCoords.map(({ lat, lng }) => ({ lat, lng })),
    ]

    if (allPoints.length < (hasStartCoords ? 1 : 2)) return

    const destination = allPoints[allPoints.length - 1]
    const waypoints = allPoints.slice(0, -1).map(pt => ({
      location: new google.maps.LatLng(pt.lat, pt.lng),
      stopover: true,
    }))

    const directionsService = new google.maps.DirectionsService()
    const renderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#6366f1",
        strokeOpacity: 0.85,
        strokeWeight: 4,
      },
    })
    renderer.setMap(mapInstanceRef.current)
    directionsRendererRef.current = renderer

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          renderer.setDirections(result)
        } else {
          renderer.setMap(null)
          directionsRendererRef.current = null
          const allCoords = [
            ...(hasStartCoords ? [{ lat: startLat!, lng: startLng! }] : []),
            ...stopsWithCoords.map(({ lat, lng }) => ({ lat, lng })),
          ]
          if (allCoords.length > 1) {
            polylineRef.current = new google.maps.Polyline({
              path: allCoords,
              map: mapInstanceRef.current,
              strokeColor: "#6366f1",
              strokeOpacity: 0.7,
              strokeWeight: 3,
              icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3 },
                offset: "100%",
                repeat: "80px",
              }],
            })
          }
        }
      }
    )
  }, [status, stops, properties, startLat, startLng, startAddress])

  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null)
        directionsRendererRef.current = null
      }
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
        polylineRef.current = null
      }
    }
  }, [])

  if (!hasApiKey) {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center gap-4 text-muted-foreground p-8 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <div>
          <p className="font-semibold text-foreground text-lg">Google Maps API Key Required</p>
          <p className="text-sm mt-2 max-w-sm">
            Add <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to your environment secrets to enable the interactive map with color-coded stop markers.
          </p>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="font-medium">Failed to load Google Maps. Check your API key and enabled APIs.</p>
      </div>
    )
  }

  if (status !== "ready") {
    return (
      <div className="h-[500px] flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading map...</span>
      </div>
    )
  }

  const mappableCount = stops.filter(s => {
    const prop = properties.find(p => p.id === s.propertyId)
    return prop?.lat && prop?.lng
  }).length

  return (
    <div className="relative h-[600px] rounded-b-2xl overflow-hidden">
      <div ref={mapRef} className="h-full w-full" />

      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 text-xs space-y-1.5 border border-border/30 min-w-[160px]">
        <p className="font-semibold text-foreground flex items-center gap-1.5 mb-2">
          <Navigation className="h-3.5 w-3.5 text-primary" />
          Route Summary
          <HelpPopover
            title="Route Optimization"
            description="Pins are color-coded by showing approval status. Click any pin for property details. Reorder stops in the Route Stops tab to optimize your driving path."
            helpSection="route-optimization"
          />
        </p>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Total stops</span>
          <span className="font-semibold text-foreground">{stops.length}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Mapped</span>
          <span className="font-semibold text-foreground">{mappableCount}</span>
        </div>
        <div className="pt-2 border-t border-border/50 space-y-1.5 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm flex-shrink-0 border border-white shadow-sm bg-[#1e293b]" />
            <span className="text-muted-foreground">Start</span>
          </div>
          {[
            { key: "approved", label: "Approved" },
            { key: "pending", label: "Pending" },
            { key: "requested", label: "Requested" },
            { key: "not_requested", label: "Not Requested" },
            { key: "declined", label: "Declined" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full flex-shrink-0 border border-white shadow-sm" style={{ background: STATUS_COLORS[key] }} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {mappableCount < stops.length && stops.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700 flex items-center gap-1.5 shadow-sm">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          {stops.length - mappableCount} stop{stops.length - mappableCount !== 1 ? "s" : ""} missing geocoordinates
        </div>
      )}
    </div>
  )
}
