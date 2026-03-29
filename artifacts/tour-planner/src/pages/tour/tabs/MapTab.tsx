import { useEffect, useRef } from "react"
import type { TourStop } from "@workspace/api-client-react"
import { Navigation } from "lucide-react"
import "leaflet/dist/leaflet.css"

interface MapTabProps {
  stops: TourStop[]
}

export default function MapTab({ stops }: MapTabProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    let L: typeof import("leaflet")

    const initMap = async () => {
      L = await import("leaflet")

      delete (L.Icon.Default.prototype as { _getIconUrl?: () => void })._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const stopsWithCoords = stops.filter(
        s => typeof (s as TourStop & { lat?: number; lng?: number }).lat === "number"
      ) as (TourStop & { lat: number; lng: number })[]

      const defaultCenter: [number, number] = stopsWithCoords.length > 0
        ? [stopsWithCoords[0].lat, stopsWithCoords[0].lng]
        : [37.7749, -122.4194]

      const map = L.map(mapRef.current!, {
        center: defaultCenter,
        zoom: stopsWithCoords.length > 0 ? 13 : 10,
        zoomControl: true,
      })

      mapInstanceRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      const statusColors: Record<string, string> = {
        approved: "#22c55e",
        pending: "#f59e0b",
        declined: "#ef4444",
        not_requested: "#94a3b8",
        requested: "#3b82f6",
        needs_follow_up: "#f97316",
        restricted: "#a855f7",
        cancelled: "#6b7280",
      }

      const markerBounds: L.LatLng[] = []

      stopsWithCoords.forEach((stop, index) => {
        const color = statusColors[stop.approvedStatus] ?? "#94a3b8"
        const icon = L.divIcon({
          html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;color:#fff">${index + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          className: "",
        })

        const latlng = L.latLng(stop.lat, stop.lng)
        markerBounds.push(latlng)

        L.marker(latlng, { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:180px">
              <strong>Stop ${index + 1}</strong><br/>
              <span style="font-size:11px;color:#6b7280">Status: ${stop.approvedStatus.replace(/_/g, " ")}</span><br/>
              <span style="font-size:11px;color:#6b7280">${stop.visited ? "✓ Visited" : "Scheduled"}</span>
            </div>
          `)
      })

      if (stopsWithCoords.length > 1) {
        const polyline = L.polyline(
          stopsWithCoords.map(s => [s.lat, s.lng]),
          { color: "#6366f1", weight: 3, dashArray: "6 4", opacity: 0.7 }
        ).addTo(map)
        map.fitBounds(polyline.getBounds().pad(0.2))
      } else if (markerBounds.length === 1) {
        map.setView(markerBounds[0], 14)
      }
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || stops.length === 0) return
    const stopsWithCoords = stops.filter(
      s => typeof (s as TourStop & { lat?: number }).lat === "number"
    )
    if (stopsWithCoords.length > 0) return
  }, [stops])

  const stopsWithCoords = stops.filter(
    s => typeof (s as TourStop & { lat?: number }).lat === "number"
  )

  return (
    <div className="relative h-[600px] rounded-b-2xl overflow-hidden">
      <div ref={mapRef} className="h-full w-full z-0" />

      <div className="absolute top-4 right-4 z-10 bg-background/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-lg text-sm space-y-2 min-w-[160px]">
        <div className="font-semibold text-foreground flex items-center gap-2 mb-1">
          <Navigation className="h-4 w-4 text-primary" />
          Route Summary
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Total stops</span>
          <span className="font-medium text-foreground">{stops.length}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Mapped</span>
          <span className="font-medium text-foreground">{stopsWithCoords.length}</span>
        </div>

        {stops.length > 0 && stopsWithCoords.length === 0 && (
          <div className="text-xs text-amber-600 pt-1 border-t border-border/50">
            Stops have no coordinates yet. Add lat/lng data to see markers.
          </div>
        )}

        <div className="pt-2 border-t border-border/50 space-y-1">
          {[
            { label: "Approved", color: "#22c55e" },
            { label: "Pending", color: "#f59e0b" },
            { label: "Declined", color: "#ef4444" },
            { label: "Not requested", color: "#94a3b8" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded-full border border-white/80 shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
