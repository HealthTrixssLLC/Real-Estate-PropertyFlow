import { useState, useEffect } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { useAddPropertyToTour, useReorderTourStops, useOptimizeTourRoute, useDeleteTourStop } from "@workspace/api-client-react"
import type { TourStop } from "@workspace/api-client-react"
import { GripVertical, Plus, Route, Loader2, MapPin, Building2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { getGetTourQueryKey } from "@workspace/api-client-react"
import { cn, getStatusColor } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface StopsTabProps {
  tourId: string
  stops: TourStop[]
  tourStatus?: string
}

export default function StopsTab({ tourId, stops: initialStops, tourStatus }: StopsTabProps) {
  const [stops, setStops] = useState<TourStop[]>(initialStops)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [stopToDelete, setStopToDelete] = useState<TourStop | null>(null)
  const addProp = useAddPropertyToTour()
  const reorder = useReorderTourStops()
  const optimize = useOptimizeTourRoute()
  const deleteStop = useDeleteTourStop()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  useEffect(() => { setStops(initialStops) }, [initialStops])

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const items = Array.from(stops)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)
    setStops(items)

    try {
      await reorder.mutateAsync({
        tourId,
        data: { orderedStopIds: items.map(i => i.id) }
      })
      toast({ title: "Route order saved" })
    } catch {
      toast({ title: "Failed to save order", variant: "destructive" })
      setStops(initialStops)
    }
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await addProp.mutateAsync({
        tourId,
        data: {
          formattedAddress: fd.get("address") as string,
          mlsId: (fd.get("mlsId") as string) || undefined,
        }
      })
      toast({ title: "Property added to tour" })
      setIsAddOpen(false)
      await queryClient.invalidateQueries({ queryKey: getGetTourQueryKey(tourId) })
    } catch {
      toast({ title: "Failed to add property", variant: "destructive" })
    }
  }

  const handleOptimize = async () => {
    try {
      await optimize.mutateAsync({ tourId, data: {} })
      toast({ title: "Route optimized!" })
      await queryClient.invalidateQueries({ queryKey: getGetTourQueryKey(tourId) })
    } catch {
      toast({ title: "Failed to optimize route", variant: "destructive" })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!stopToDelete) return
    const removedStop = stopToDelete
    setStopToDelete(null)
    setStops(prev => prev.filter(s => s.id !== removedStop.id))
    try {
      await deleteStop.mutateAsync({ stopId: removedStop.id })
      toast({ title: "Stop removed from tour" })
      await queryClient.invalidateQueries({ queryKey: getGetTourQueryKey(tourId) })
    } catch {
      toast({ title: "Failed to remove stop", variant: "destructive" })
      setStops(initialStops)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-2">
          <Button onClick={handleOptimize} variant="secondary" className="gap-2 bg-secondary/50 text-secondary-foreground shadow-sm" disabled={optimize.isPending}>
            {optimize.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
            Auto-Optimize Route
          </Button>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-md shadow-primary/20">
              <Plus className="h-4 w-4" />
              Add Property Stop
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Property to Tour</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Full Address <span className="text-destructive">*</span></Label>
                <Input name="address" required placeholder="123 Oak St, City, State" />
              </div>
              <div className="space-y-2">
                <Label>MLS ID (Optional)</Label>
                <Input name="mlsId" placeholder="#12345" />
              </div>
              <Button type="submit" className="w-full mt-4" disabled={addProp.isPending}>
                {addProp.isPending ? "Adding..." : "Add to Route"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {stops.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border/60">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No stops added yet</h3>
          <p className="text-muted-foreground text-sm">Add properties to build your tour itinerary.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="tour-stops">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                {stops.map((stop, index) => (
                  <Draggable key={stop.id} draggableId={stop.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "bg-background border border-border/50 rounded-xl p-4 flex items-center gap-4 group transition-shadow",
                          snapshot.isDragging ? "shadow-xl border-primary/50 z-50 bg-card" : "shadow-sm hover:shadow-md hover:border-border"
                        )}
                      >
                        <div {...provided.dragHandleProps} className="text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing p-1">
                          <GripVertical className="h-5 w-5" />
                        </div>

                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-muted-foreground font-semibold text-sm shrink-0">
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate flex items-center gap-2">
                            Property #{stop.propertyId.slice(0, 8)}
                            <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-wider", getStatusColor(stop.approvedStatus))}>
                              {stop.approvedStatus.replace(/_/g, " ")}
                            </Badge>
                          </h4>
                          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1 truncate">
                            <MapPin className="h-3.5 w-3.5" />
                            Stop {stop.sequence} · {stop.visited ? "Visited" : "Pending"}
                          </div>
                        </div>

                        {tourStatus !== "published" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setStopToDelete(stop)}
                            aria-label="Remove stop"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <AlertDialog open={!!stopToDelete} onOpenChange={(open) => { if (!open) setStopToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Stop</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this stop from the tour? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStop.isPending ? "Removing..." : "Remove Stop"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
