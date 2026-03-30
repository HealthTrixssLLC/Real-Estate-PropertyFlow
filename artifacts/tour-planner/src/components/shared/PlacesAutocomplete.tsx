import { useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { useGoogleMaps } from "@/hooks/useGoogleMaps"
import { MapPin } from "lucide-react"

export interface PlaceResult {
  formattedAddress: string
  placeId: string
  lat: number
  lng: number
  city?: string
  state?: string
  zip?: string
}

interface PlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelected: (place: PlaceResult) => void
  placeholder?: string
  className?: string
  name?: string
  required?: boolean
  id?: string
}

export default function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Start typing an address...",
  className,
  name,
  required,
  id,
}: PlacesAutocompleteProps) {
  const { status } = useGoogleMaps()
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    if (status !== "ready" || !inputRef.current || autocompleteRef.current) return

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      fields: ["formatted_address", "place_id", "geometry", "address_components"],
    })

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace()
      if (!place.geometry?.location) return

      const components = place.address_components ?? []
      const getComponent = (type: string) =>
        components.find(c => c.types.includes(type))?.long_name

      onPlaceSelected({
        formattedAddress: place.formatted_address ?? "",
        placeId: place.place_id ?? "",
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        city: getComponent("locality") ?? getComponent("sublocality"),
        state: components.find(c => c.types.includes("administrative_area_level_1"))?.short_name,
        zip: getComponent("postal_code"),
      })
    })

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [status, onPlaceSelected])

  if (status === "error") {
    return (
      <div className="relative">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          name={name}
          required={required}
          id={id}
        />
        <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Address autocomplete unavailable — set VITE_GOOGLE_MAPS_API_KEY to enable
        </div>
      </div>
    )
  }

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={status === "loading" ? "Loading autocomplete..." : placeholder}
      disabled={status === "loading"}
      className={className}
      name={name}
      required={required}
      id={id}
      autoComplete="off"
    />
  )
}
