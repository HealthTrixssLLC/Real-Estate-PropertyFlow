import { useEffect, useRef, useState } from "react"
import {
  useListProperties,
  useCreateProperty,
  useUpdateProperty,
} from "@workspace/api-client-react"
import type { Property, CreatePropertyBody } from "@workspace/api-client-react"
import {
  Building2,
  Plus,
  Home,
  Search,
  MapPin,
  AlertCircle,
  Loader2,
  List,
  Map as MapIcon,
  Archive,
  ArchiveRestore,
  Pencil,
  ChevronLeft,
} from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
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
          fillColor: prop.archived ? "#9ca3af" : "#6366f1",
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
            ${prop.archived ? `<div style="font-size:11px;color:#ef4444;margin-top:4px">Archived</div>` : ""}
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

function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const { status } = useGoogleMaps()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)

  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        zoomControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        ],
      })
      new google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#6366f1",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      })
    }
  }, [status, lat, lng])

  if (status !== "ready") {
    return (
      <div className="h-40 rounded-lg bg-muted flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <div ref={mapRef} className="h-40 w-full rounded-lg overflow-hidden border border-border/50" />
}

interface PropertyFormData {
  addressInput: string
  placeData: Partial<CreatePropertyBody>
  mlsId: string
  listPrice: string
  beds: string
  baths: string
  squareFeet: string
  nickname: string
  notes: string
}

function emptyForm(): PropertyFormData {
  return {
    addressInput: "",
    placeData: {},
    mlsId: "",
    listPrice: "",
    beds: "",
    baths: "",
    squareFeet: "",
    nickname: "",
    notes: "",
  }
}

function formFromProperty(prop: Property): PropertyFormData {
  return {
    addressInput: prop.formattedAddress,
    placeData: {
      formattedAddress: prop.formattedAddress,
      placeId: prop.placeId ?? undefined,
      lat: prop.lat ?? undefined,
      lng: prop.lng ?? undefined,
      city: prop.city ?? undefined,
      state: prop.state ?? undefined,
      zip: prop.zip ?? undefined,
    },
    mlsId: prop.mlsId ?? "",
    listPrice: prop.listPrice != null ? String(prop.listPrice) : "",
    beds: prop.beds != null ? String(prop.beds) : "",
    baths: prop.baths != null ? String(prop.baths) : "",
    squareFeet: prop.squareFeet != null ? String(prop.squareFeet) : "",
    nickname: prop.nickname ?? "",
    notes: prop.notes ?? "",
  }
}

interface PropertyFormProps {
  form: PropertyFormData
  onChange: (form: PropertyFormData) => void
  addressValidated: boolean
  onAddressValidationChange: (v: boolean) => void
}

function PropertyForm({ form, onChange, addressValidated, onAddressValidationChange }: PropertyFormProps) {
  const { hasApiKey } = useGoogleMaps()
  const addressTouched = form.addressInput.length > 0 && !addressValidated

  const handlePlaceSelected = (place: PlaceResult) => {
    onAddressValidationChange(true)
    onChange({
      ...form,
      addressInput: place.formattedAddress,
      placeData: {
        formattedAddress: place.formattedAddress,
        placeId: place.placeId,
        lat: place.lat,
        lng: place.lng,
        city: place.city,
        state: place.state,
        zip: place.zip,
      },
    })
  }

  const handleAddressChange = (value: string) => {
    if (value !== form.addressInput) {
      onAddressValidationChange(false)
    }
    onChange({ ...form, addressInput: value })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="prop-address">Full Address *</Label>
        <PlacesAutocomplete
          id="prop-address"
          value={form.addressInput}
          onChange={handleAddressChange}
          onPlaceSelected={handlePlaceSelected}
          placeholder="Start typing an address..."
        />
        {addressValidated && form.placeData.lat != null && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Geocoded: {form.placeData.lat.toFixed(5)}, {form.placeData.lng?.toFixed(5)}
          </p>
        )}
        {addressTouched && hasApiKey && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Please select an address from the dropdown to validate it.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>MLS ID</Label>
          <Input
            value={form.mlsId}
            onChange={e => onChange({ ...form, mlsId: e.target.value })}
            placeholder="#1234567"
          />
        </div>
        <div className="space-y-2">
          <Label>List Price</Label>
          <Input
            value={form.listPrice}
            onChange={e => onChange({ ...form, listPrice: e.target.value })}
            type="number"
            placeholder="500000"
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Beds</Label>
          <Input
            value={form.beds}
            onChange={e => onChange({ ...form, beds: e.target.value })}
            type="number"
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Baths</Label>
          <Input
            value={form.baths}
            onChange={e => onChange({ ...form, baths: e.target.value })}
            type="number"
            step="0.5"
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Sq. Feet</Label>
          <Input
            value={form.squareFeet}
            onChange={e => onChange({ ...form, squareFeet: e.target.value })}
            type="number"
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Nickname</Label>
          <Input
            value={form.nickname}
            onChange={e => onChange({ ...form, nickname: e.target.value })}
            placeholder="Corner unit, etc."
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Agent Notes</Label>
          <Textarea
            value={form.notes}
            onChange={e => onChange({ ...form, notes: e.target.value })}
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}

type DetailView = "detail" | "edit"

interface PropertyDetailProps {
  property: Property
  onClose: () => void
  onUpdated: () => void
}

function PropertyDetail({ property, onClose, onUpdated }: PropertyDetailProps) {
  const { hasApiKey } = useGoogleMaps()
  const updateProperty = useUpdateProperty()
  const { toast } = useToast()
  const [view, setView] = useState<DetailView>("detail")
  const [editForm, setEditForm] = useState<PropertyFormData>(formFromProperty(property))
  const [editAddressValidated, setEditAddressValidated] = useState(true)

  const handleArchive = async () => {
    try {
      await updateProperty.mutateAsync({
        propertyId: property.id,
        data: { archived: true },
      })
      toast({ title: "Property archived" })
      onUpdated()
      onClose()
    } catch {
      toast({ title: "Failed to archive property", variant: "destructive" })
    }
  }

  const handleUnarchive = async () => {
    try {
      await updateProperty.mutateAsync({
        propertyId: property.id,
        data: { archived: false },
      })
      toast({ title: "Property unarchived" })
      onUpdated()
      onClose()
    } catch {
      toast({ title: "Failed to unarchive property", variant: "destructive" })
    }
  }

  const handleSaveEdit = async () => {
    if (!editForm.addressInput) {
      toast({ title: "Address is required", variant: "destructive" })
      return
    }
    if (hasApiKey && !editAddressValidated) {
      toast({ title: "Please select a valid address from the dropdown", variant: "destructive" })
      return
    }
    try {
      await updateProperty.mutateAsync({
        propertyId: property.id,
        data: {
          formattedAddress: editForm.placeData.formattedAddress ?? editForm.addressInput,
          placeId: editForm.placeData.placeId,
          lat: editForm.placeData.lat,
          lng: editForm.placeData.lng,
          city: editForm.placeData.city,
          state: editForm.placeData.state,
          zip: editForm.placeData.zip,
          mlsId: editForm.mlsId || undefined,
          listPrice: editForm.listPrice ? Number(editForm.listPrice) : undefined,
          beds: editForm.beds ? Number(editForm.beds) : undefined,
          baths: editForm.baths ? Number(editForm.baths) : undefined,
          squareFeet: editForm.squareFeet ? Number(editForm.squareFeet) : undefined,
          nickname: editForm.nickname || undefined,
          notes: editForm.notes || undefined,
        },
      })
      toast({ title: "Property updated" })
      onUpdated()
      onClose()
    } catch {
      toast({ title: "Failed to update property", variant: "destructive" })
    }
  }

  if (view === "edit") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setView("detail")} className="gap-1 -ml-2">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <h3 className="font-semibold text-base">Edit Property</h3>
        </div>
        <PropertyForm
          form={editForm}
          onChange={setEditForm}
          addressValidated={editAddressValidated}
          onAddressValidationChange={setEditAddressValidated}
        />
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => setView("detail")}>Cancel</Button>
          <Button onClick={handleSaveEdit} disabled={updateProperty.isPending}>
            {updateProperty.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-xl leading-tight">
              {property.nickname || property.formattedAddress}
            </h3>
            {property.archived && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">Archived</Badge>
            )}
          </div>
          {property.nickname && (
            <p className="text-sm text-muted-foreground">{property.formattedAddress}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {property.mlsId && (
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">MLS ID</span>
            <p className="font-medium mt-0.5">{property.mlsId}</p>
          </div>
        )}
        {property.listPrice != null && (
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">List Price</span>
            <p className="font-bold text-primary mt-0.5">${property.listPrice.toLocaleString()}</p>
          </div>
        )}
        {property.beds != null && (
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Beds</span>
            <p className="font-medium mt-0.5">{property.beds}</p>
          </div>
        )}
        {property.baths != null && (
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Baths</span>
            <p className="font-medium mt-0.5">{property.baths}</p>
          </div>
        )}
        {property.squareFeet != null && (
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Sq. Feet</span>
            <p className="font-medium mt-0.5">{property.squareFeet.toLocaleString()}</p>
          </div>
        )}
        {(property.city || property.state || property.zip) && (
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Location</span>
            <p className="font-medium mt-0.5">
              {[property.city, property.state, property.zip].filter(Boolean).join(", ")}
            </p>
          </div>
        )}
      </div>

      {property.notes && (
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Agent Notes</span>
          <p className="text-sm mt-1 bg-muted/40 rounded-lg p-3 leading-relaxed">{property.notes}</p>
        </div>
      )}

      {property.lat != null && property.lng != null && (
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Location Preview</span>
          <div className="mt-1.5">
            <MiniMap lat={property.lat} lng={property.lng} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t flex-wrap">
        <div className="flex gap-2">
          {property.archived ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleUnarchive}
              disabled={updateProperty.isPending}
            >
              {updateProperty.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <ArchiveRestore className="h-3.5 w-3.5" />}
              Unarchive
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive"
              onClick={handleArchive}
              disabled={updateProperty.isPending}
            >
              {updateProperty.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Archive className="h-3.5 w-3.5" />}
              Archive
            </Button>
          )}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setView("edit")}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>
    </div>
  )
}

export default function Properties() {
  const [showArchived, setShowArchived] = useState(false)
  const { data, isLoading, refetch } = useListProperties({ includeArchived: showArchived })
  const createProperty = useCreateProperty()
  const { toast } = useToast()
  const { hasApiKey } = useGoogleMaps()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<PropertyFormData>(emptyForm())
  const [addAddressValidated, setAddAddressValidated] = useState(false)

  const [detailProperty, setDetailProperty] = useState<Property | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const [search, setSearch] = useState("")

  const filtered = (data?.properties ?? []).filter(p =>
    p.formattedAddress.toLowerCase().includes(search.toLowerCase()) ||
    p.mlsId?.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddClose = () => {
    setIsAddOpen(false)
    setAddForm(emptyForm())
    setAddAddressValidated(false)
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!addForm.addressInput) {
      toast({ title: "Address required", variant: "destructive" })
      return
    }
    if (hasApiKey && !addAddressValidated) {
      toast({ title: "Please select a valid address from the dropdown", variant: "destructive" })
      return
    }
    try {
      await createProperty.mutateAsync({
        data: {
          formattedAddress: addForm.placeData.formattedAddress ?? addForm.addressInput,
          placeId: addForm.placeData.placeId,
          lat: addForm.placeData.lat,
          lng: addForm.placeData.lng,
          city: addForm.placeData.city,
          state: addForm.placeData.state,
          zip: addForm.placeData.zip,
          mlsId: addForm.mlsId || undefined,
          listPrice: addForm.listPrice ? Number(addForm.listPrice) : undefined,
          beds: addForm.beds ? Number(addForm.beds) : undefined,
          baths: addForm.baths ? Number(addForm.baths) : undefined,
          squareFeet: addForm.squareFeet ? Number(addForm.squareFeet) : undefined,
          nickname: addForm.nickname || undefined,
          notes: addForm.notes || undefined,
        },
      })
      toast({ title: "Property added" })
      handleAddClose()
    } catch {
      toast({ title: "Failed to add property", variant: "destructive" })
    }
  }

  const openDetail = (prop: Property) => {
    setDetailProperty(prop)
    setIsDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Property Database</h1>
          <p className="text-muted-foreground mt-1">Manage listings and homes for your tours.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={open => !open && handleAddClose()}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/25" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 mt-2">
              <PropertyForm
                form={addForm}
                onChange={setAddForm}
                addressValidated={addAddressValidated}
                onAddressValidationChange={setAddAddressValidated}
              />
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleAddClose}>Cancel</Button>
                <Button
                  type="submit"
                  disabled={createProperty.isPending || (hasApiKey && !!addForm.addressInput && !addAddressValidated)}
                >
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

        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-sm cursor-pointer select-none text-muted-foreground">
              Show archived properties
            </Label>
          </div>

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
                <Card
                  key={prop.id}
                  className={`overflow-hidden hover:shadow-xl transition-all border-border/50 group ${prop.archived ? "opacity-60" : ""}`}
                >
                  <div className="h-28 bg-gradient-to-br from-primary/5 to-primary/10 relative flex items-center justify-center">
                    <Home className={`h-10 w-10 ${prop.archived ? "text-muted-foreground/20" : "text-primary/20"}`} />
                    <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
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
                      {prop.archived && (
                        <Badge variant="secondary" className="bg-muted/90 backdrop-blur-sm text-xs text-muted-foreground">
                          Archived
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <h3 className={`font-semibold text-base line-clamp-1 transition-colors ${prop.archived ? "text-muted-foreground" : "group-hover:text-primary"}`}>
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
                      <div className={`font-bold text-lg ${prop.archived ? "text-muted-foreground" : "text-primary"}`}>
                        {prop.listPrice ? `$${prop.listPrice.toLocaleString()}` : "Price unlisted"}
                      </div>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => openDetail(prop)}>
                        Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailOpen} onOpenChange={open => { if (!open) setIsDetailOpen(false) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Property Details</DialogTitle>
          </DialogHeader>
          {detailProperty && (
            <PropertyDetail
              property={detailProperty}
              onClose={() => setIsDetailOpen(false)}
              onUpdated={() => refetch()}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
