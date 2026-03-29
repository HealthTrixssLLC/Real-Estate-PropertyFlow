import { useEffect, useRef, useState } from "react"
import { useListProperties, useCreateProperty } from "@workspace/api-client-react"
import type { Property, CreatePropertyBody } from "@workspace/api-client-react"
import { Building2, Plus, Home, Search, MapPin, AlertCircle, Loader2, List, Map as MapIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PlacesAutocomplete from "@/components/shared/PlacesAutocomplete"
import type { PlaceResult } from "@/components/shared/PlacesAutocomplete"
import { useGoogleMaps } from "@/hooks/useGoogleMaps"

function PropertiesMap({ properties }: { properties: Property[] }) {
  const { status, hasApiKey } = useGoogleMaps()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return

    const props = properties.filter(p => p.lat && p.lng)

    if (!mapInstanceRef.current) {
      const center = props.length > 0
        ? { lat: props[0].lat!, lng: props[0].lng! }
        : { lat: 37.7749, lng: -122.4194 }

      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: props.length > 0 ? 13 : 10,
        mapTypeControl: false,
        streetViewControl: false,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        ],
      })
      infoWindowRef.current = new google.maps.InfoWindow()
    }

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    props.forEach(prop => {
      const marker = new google.maps.Marker({
        position: { lat: prop.lat!, lng: prop.lng! },
        map: mapInstanceRef.current!,
        title: prop.formattedAddress,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#6366f1",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      })

      marker.addListener("click", () => {
        infoWindowRef.current!.setContent(`
          <div style="max-width:220px;font-family:system-ui,sans-serif;padding:4px">
            <div style="font-weight:700;font-size:13px;color:#111;margin-bottom:4px">${prop.formattedAddress}</div>
            <div style="display:flex;gap:8px;font-size:12px;color:#6b7280;flex-wrap:wrap">
              ${prop.beds != null ? `<span>${prop.beds} bd</span>` : ""}
              ${prop.baths != null ? `<span>${prop.baths} ba</span>` : ""}
              ${prop.listPrice != null ? `<span style="font-weight:600;color:#111">$${prop.listPrice.toLocaleString()}</span>` : ""}
            </div>
            ${prop.mlsId ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px">MLS: ${prop.mlsId}</div>` : ""}
          </div>
        `)
        infoWindowRef.current!.open(mapInstanceRef.current!, marker)
      })

      markersRef.current.push(marker)
    })

    if (props.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      props.forEach(p => bounds.extend({ lat: p.lat!, lng: p.lng! }))
      mapInstanceRef.current.fitBounds(bounds, 50)
    }
  }, [status, properties])

  useEffect(() => () => {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
  }, [])

  if (!hasApiKey) {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center gap-4 text-muted-foreground p-8 text-center rounded-xl border border-dashed">
        <AlertCircle className="h-10 w-10 text-amber-500" />
        <div>
          <p className="font-semibold text-foreground">Google Maps API Key Required</p>
          <p className="text-sm mt-1">
            Add <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to your secrets to see properties on the map.
          </p>
        </div>
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

  const unmapped = properties.filter(p => !p.lat || !p.lng).length

  return (
    <div className="relative h-[500px] rounded-xl overflow-hidden border border-border/50">
      <div ref={mapRef} className="h-full w-full" />
      {unmapped > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700 flex items-center gap-1.5 shadow">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          {unmapped} propert{unmapped !== 1 ? "ies" : "y"} without coordinates — use address autocomplete to geocode them
        </div>
      )}
    </div>
  )
}

export default function Properties() {
  const { data, isLoading } = useListProperties()
  const createProperty = useCreateProperty()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [addressInput, setAddressInput] = useState("")
  const [placeData, setPlaceData] = useState<Partial<CreatePropertyBody>>({})

  const filtered = (data?.properties ?? []).filter(p =>
    p.formattedAddress.toLowerCase().includes(search.toLowerCase()) ||
    p.mlsId?.toLowerCase().includes(search.toLowerCase())
  )

  const handlePlaceSelected = (place: PlaceResult) => {
    setPlaceData({
      formattedAddress: place.formattedAddress,
      placeId: place.placeId,
      lat: place.lat,
      lng: place.lng,
      city: place.city,
      state: place.state,
      zip: place.zip,
    })
  }

  const handleClose = () => {
    setIsOpen(false)
    setAddressInput("")
    setPlaceData({})
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!addressInput) {
      toast({ title: "Address required", variant: "destructive" })
      return
    }
    const fd = new FormData(e.currentTarget)
    try {
      await createProperty.mutateAsync({
        data: {
          formattedAddress: placeData.formattedAddress ?? addressInput,
          placeId: placeData.placeId,
          lat: placeData.lat,
          lng: placeData.lng,
          city: placeData.city,
          state: placeData.state,
          zip: placeData.zip,
          mlsId: (fd.get("mlsId") as string) || undefined,
          listPrice: Number(fd.get("listPrice")) || undefined,
          beds: Number(fd.get("beds")) || undefined,
          baths: Number(fd.get("baths")) || undefined,
          squareFeet: Number(fd.get("squareFeet")) || undefined,
          nickname: (fd.get("nickname") as string) || undefined,
          notes: (fd.get("notes") as string) || undefined,
        },
      })
      toast({ title: "Property added" })
      handleClose()
    } catch {
      toast({ title: "Failed to add property", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Property Database</h1>
          <p className="text-muted-foreground mt-1">Manage listings and homes for your tours.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/25" onClick={() => setIsOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="prop-address">Full Address *</Label>
                <PlacesAutocomplete
                  id="prop-address"
                  value={addressInput}
                  onChange={setAddressInput}
                  onPlaceSelected={handlePlaceSelected}
                  placeholder="Start typing an address..."
                />
                {placeData.lat != null && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Geocoded: {placeData.lat.toFixed(5)}, {placeData.lng?.toFixed(5)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>MLS ID</Label>
                  <Input name="mlsId" placeholder="#1234567" />
                </div>
                <div className="space-y-2">
                  <Label>List Price</Label>
                  <Input name="listPrice" type="number" placeholder="500000" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Beds</Label>
                  <Input name="beds" type="number" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Baths</Label>
                  <Input name="baths" type="number" step="0.5" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Sq. Feet</Label>
                  <Input name="squareFeet" type="number" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Nickname</Label>
                  <Input name="nickname" placeholder="Corner unit, etc." />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Agent Notes</Label>
                  <Textarea name="notes" rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                <Button type="submit" disabled={createProperty.isPending}>
                  {createProperty.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Property
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="list">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <Card className="flex-1 p-2 flex items-center gap-2 border-border/50 shadow-sm">
            <Search className="h-5 w-5 text-muted-foreground ml-2 flex-shrink-0" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by address or MLS ID..."
              className="border-0 shadow-none focus-visible:ring-0 text-base"
            />
          </Card>
          <TabsList className="h-9">
            <TabsTrigger value="list" className="gap-1.5 text-sm">
              <List className="h-3.5 w-3.5" />
              List
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5 text-sm">
              <MapIcon className="h-3.5 w-3.5" />
              Map View
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="map" className="mt-4">
          <PropertiesMap properties={data?.properties ?? []} />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No properties found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search term." : "Click 'Add Property' to get started."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(prop => (
                <Card key={prop.id} className="overflow-hidden hover:shadow-xl transition-all border-border/50 group">
                  <div className="h-28 bg-gradient-to-br from-primary/5 to-primary/10 relative flex items-center justify-center">
                    <Home className="h-10 w-10 text-primary/20" />
                    <div className="absolute top-3 left-3 flex gap-2">
                      {prop.mlsId && (
                        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm shadow-sm text-xs">
                          MLS: {prop.mlsId}
                        </Badge>
                      )}
                      {prop.lat && prop.lng && (
                        <Badge variant="outline" className="bg-green-50/90 backdrop-blur-sm text-xs border-green-200 text-green-700">
                          <MapPin className="h-2.5 w-2.5 mr-1" />
                          Mapped
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <h3 className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors">
                        {prop.nickname || prop.formattedAddress}
                      </h3>
                      {prop.nickname && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{prop.formattedAddress}</p>
                      )}
                      <div className="flex items-center gap-1 text-muted-foreground text-xs mt-1">
                        <MapPin className="h-3 w-3" />
                        {[prop.city, prop.state].filter(Boolean).join(", ") || "Location not set"}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/50 text-sm">
                      <div className="text-center">
                        <span className="block font-bold text-foreground">{prop.beds ?? "—"}</span>
                        <span className="text-muted-foreground text-xs">Beds</span>
                      </div>
                      <div className="text-center border-x border-border/50">
                        <span className="block font-bold text-foreground">{prop.baths ?? "—"}</span>
                        <span className="text-muted-foreground text-xs">Baths</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-foreground">
                          {prop.squareFeet ? prop.squareFeet.toLocaleString() : "—"}
                        </span>
                        <span className="text-muted-foreground text-xs">Sqft</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="font-bold text-lg text-primary">
                        {prop.listPrice ? `$${prop.listPrice.toLocaleString()}` : "Price unlisted"}
                      </div>
                      <Button variant="outline" size="sm" className="text-xs">Details</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
