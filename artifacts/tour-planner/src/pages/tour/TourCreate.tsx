import { useState } from "react"
import { useLocation, Link } from "wouter"
import { useCreateTour, useListBuyers } from "@workspace/api-client-react"
import { ChevronLeft, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import PlacesAutocomplete from "@/components/shared/PlacesAutocomplete"
import type { PlaceResult } from "@/components/shared/PlacesAutocomplete"

interface AddressPlace {
  formatted: string
  lat?: number
  lng?: number
}

export default function TourCreate() {
  const { data: buyersData } = useListBuyers()
  const createTour = useCreateTour()
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const [startAddr, setStartAddr] = useState<AddressPlace>({ formatted: "" })
  const [endAddr, setEndAddr] = useState<AddressPlace>({ formatted: "" })

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      const res = await createTour.mutateAsync({
        data: {
          title: fd.get("title") as string,
          date: fd.get("date") as string,
          buyerId: (fd.get("buyerId") as string) || undefined,
          startAddress: startAddr.formatted || undefined,
          startLat: startAddr.lat,
          startLng: startAddr.lng,
          endAddress: endAddr.formatted || undefined,
          endLat: endAddr.lat,
          endLng: endAddr.lng,
          startTime: (fd.get("startTime") as string) || undefined,
          geographicArea: (fd.get("geographicArea") as string) || undefined,
          buyerNotes: (fd.get("buyerNotes") as string) || undefined,
          tags: (fd.get("tags") as string)
            .split(",")
            .map(s => s.trim())
            .filter(Boolean),
        },
      })
      toast({ title: "Tour created successfully!" })
      setLocation(`/tours/${res.tour.id}`)
    } catch {
      toast({ title: "Failed to create tour", variant: "destructive" })
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      <div className="space-y-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create New Tour</h1>
        <p className="text-muted-foreground">Set up a new property tour itinerary for your client.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle>Tour Details</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">
                Tour Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="e.g. Weekend Homes for Smith Family"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">
                  Tour Date <span className="text-destructive">*</span>
                </Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input id="startTime" name="startTime" type="time" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Client / Buyer</Label>
              <Select name="buyerId">
                <SelectTrigger>
                  <SelectValue placeholder="Select a buyer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {buyersData?.buyers.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startAddress">Starting Address / Meeting Point</Label>
              <PlacesAutocomplete
                id="startAddress"
                value={startAddr.formatted}
                onChange={v => setStartAddr({ formatted: v })}
                onPlaceSelected={(p: PlaceResult) =>
                  setStartAddr({ formatted: p.formattedAddress, lat: p.lat, lng: p.lng })
                }
                placeholder="123 Main St, City, State"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endAddress">Ending Address</Label>
              <PlacesAutocomplete
                id="endAddress"
                value={endAddr.formatted}
                onChange={v => setEndAddr({ formatted: v })}
                onPlaceSelected={(p: PlaceResult) =>
                  setEndAddr({ formatted: p.formattedAddress, lat: p.lat, lng: p.lng })
                }
                placeholder="456 Oak Ave (leave blank to return to start)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="geographicArea">Geographic Target Area</Label>
              <Input
                id="geographicArea"
                name="geographicArea"
                placeholder="e.g. Downtown Austin, North Loop, ZIP 78701"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buyerNotes">Client Preferences / Notes</Label>
              <Textarea
                id="buyerNotes"
                name="buyerNotes"
                rows={3}
                placeholder="Looking for a large backyard, min 3 beds..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input id="tags" name="tags" placeholder="urgent, pool, luxury" />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createTour.isPending}>
                {createTour.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Tour"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
