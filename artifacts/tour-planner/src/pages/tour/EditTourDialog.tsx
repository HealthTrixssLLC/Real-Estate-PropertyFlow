import { useState, useEffect } from "react"
import { useUpdateTour, getGetTourQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PlacesAutocomplete from "@/components/shared/PlacesAutocomplete"
import type { PlaceResult } from "@/components/shared/PlacesAutocomplete"
import BuyerSelect from "@/components/shared/BuyerSelect"

interface Tour {
  id: string
  title: string
  date: string
  startTime?: string | null
  buyerId?: string | null
  startAddress?: string | null
  startLat?: number | null
  startLng?: number | null
}

interface EditTourDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tour: Tour
}

interface AddressPlace {
  formatted: string
  lat?: number
  lng?: number
}

export default function EditTourDialog({ open, onOpenChange, tour }: EditTourDialogProps) {
  const queryClient = useQueryClient()
  const updateTour = useUpdateTour()

  const [title, setTitle] = useState(tour.title)
  const [date, setDate] = useState(tour.date)
  const [startTime, setStartTime] = useState(tour.startTime ?? "")
  const [buyerId, setBuyerId] = useState(tour.buyerId ?? "__none__")
  const [startAddr, setStartAddr] = useState<AddressPlace>({
    formatted: tour.startAddress ?? "",
    lat: tour.startLat ?? undefined,
    lng: tour.startLng ?? undefined,
  })
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitle(tour.title)
      setDate(tour.date)
      setStartTime(tour.startTime ?? "")
      setBuyerId(tour.buyerId ?? "__none__")
      setStartAddr({
        formatted: tour.startAddress ?? "",
        lat: tour.startLat ?? undefined,
        lng: tour.startLng ?? undefined,
      })
      setApiError(null)
    }
  }, [open, tour])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)
    const resolvedBuyerId = buyerId === "__none__" || !buyerId ? undefined : buyerId
    try {
      await updateTour.mutateAsync({
        tourId: tour.id,
        data: {
          title,
          date,
          startTime: startTime || undefined,
          buyerId: resolvedBuyerId,
          startAddress: startAddr.formatted || undefined,
          startLat: startAddr.lat,
          startLng: startAddr.lng,
        },
      })
      await queryClient.invalidateQueries({ queryKey: getGetTourQueryKey(tour.id) })
      onOpenChange(false)
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Failed to save changes. Please try again."
      setApiError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Tour Details</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-title">
              Tour Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="e.g. Weekend Homes for Smith Family"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">
                Tour Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-startTime">Start Time</Label>
              <Input
                id="edit-startTime"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Client / Buyer</Label>
            <BuyerSelect value={buyerId} onValueChange={setBuyerId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-startAddress">Starting Address / Meeting Point</Label>
            <PlacesAutocomplete
              id="edit-startAddress"
              value={startAddr.formatted}
              onChange={v => setStartAddr({ formatted: v })}
              onPlaceSelected={(p: PlaceResult) =>
                setStartAddr({ formatted: p.formattedAddress, lat: p.lat, lng: p.lng })
              }
              placeholder="123 Main St, City, State"
            />
          </div>

          {apiError && (
            <p className="text-sm text-destructive">{apiError}</p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateTour.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateTour.isPending}>
              {updateTour.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
