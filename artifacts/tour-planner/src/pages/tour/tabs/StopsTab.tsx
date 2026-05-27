import { useState, useEffect, useMemo, useRef } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import {
  useAddPropertyToTour,
  useReorderTourStops,
  useOptimizeTourRoute,
  useDeleteTourStop,
  useListProperties,
} from "@workspace/api-client-react"
import type { TourStop } from "@workspace/api-client-react"
import { GripVertical, Plus, Route, Loader2, MapPin, Building2, Trash2, Search, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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

const DEBOUNCE_MS = 300

export default function StopsTab({ tourId, stops: initialStops, tourStatus }: StopsTabProps) {
  const [stops, setStops] = useState<TourStop[]>(initialStops)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [stopToDelete, setStopToDelete] = useState<TourStop | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addProp = useAddPropertyToTour()
  const reorder = useReorderTourStops()
  const optimize = useOptimizeTourRoute()
  const deleteStop = useDeleteTourStop()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const searchParams = debouncedSearch ? { q: debouncedSearch } : undefined
  const { data: propertiesData, isFetching: propertiesFetching } = useListProperties(searchParams)
  const catalogProperties = propertiesData?.properties ?? []

  useEffect(() => { setStops(initialStops) }, [initialStops])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const alreadyOnTourIds = useMemo(
    () => new Set(stops.map(s => s.propertyId)),
    [stops]
  )

  const selectedProperty = catalogProperties.find(p => p.id === selectedPropertyId) ?? null

  const handleDialogClose = (open: boolean) => {
    setIsAddOpen(open)
    if (!open) {
      setSearch("")
      setDebouncedSearch("")
      setSelectedPropertyId(null)
    }
  }

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

  const handleAdd = async () => {
    if (!selectedPropertyId || !selectedProperty) return
    try {
      await addProp.mutateAsync({
        tourId,
        data: {
          propertyId: selectedPropertyId,
          formattedAddress: selectedProperty.formattedAddress,
        }
      })
      toast({ title: "Property added to tour" })
      handleDialogClose(false)
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

        <Dialog open={isAddOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-md shadow-primary/20">
              <Plus className="h-4 w-4" />
              Add Property Stop
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Property to Tour</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                {propertiesFetching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                <Input
                  className="pl-9 pr-8"
                  placeholder="Search by address, nickname, or MLS ID..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelectedPropertyId(null) }}
                  autoFocus
                />
              </div>

              {!propertiesFetching && catalogProperties.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {debouncedSearch ? (
                    <span>
                      No properties match your search.{" "}
                      <span className="block mt-1 text-xs">
                        Make sure the property has been added on the{" "}
                        <a
                          href="/properties"
                          className="underline hover:text-foreground"
                          onClick={e => e.stopPropagation()}
                        >
                          Properties page
                        </a>{" "}
                        first.
                      </span>
                    </span>
                  ) : (
                    "No properties in your catalog yet. Add properties on the Properties page first."
                  )}
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
                  {catalogProperties.map(prop => {
                    const alreadyAdded = alreadyOnTourIds.has(prop.id)
                    const isSelected = selectedPropertyId === prop.id
                    return (
                      <button
                        key={prop.id}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => setSelectedPropertyId(isSelected ? null : prop.id)}
                        className={cn(
                          "w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-3 transition-colors border",
                          alreadyAdded
                            ? "opacity-50 cursor-not-allowed bg-muted/40 border-transparent"
                            : isSelected
                              ? "bg-primary/10 border-primary/40 hover:bg-primary/15"
                              : "bg-background border-transparent hover:bg-muted/50 hover:border-border/60"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate flex items-center gap-2">
                            {prop.nickname || prop.formattedAddress}
                            {alreadyAdded && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">Already added</Badge>
                            )}
                          </div>
                          {prop.nickname && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">{prop.formattedAddress}</div>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {prop.mlsId && <span>MLS: {prop.mlsId}</span>}
                            {prop.listPrice != null && <span>${prop.listPrice.toLocaleString()}</span>}
                            {prop.beds != null && <span>{prop.beds} bd</span>}
                            {prop.baths != null && <span>{prop.baths} ba</span>}
                          </div>
                        </div>
                        {isSelected && !alreadyAdded && (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {selectedProperty && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm text-foreground flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium truncate">{selectedProperty.nickname || selectedProperty.formattedAddress}</span>
                </div>
              )}

              <Button
                className="w-full"
                disabled={!selectedPropertyId || addProp.isPending}
                onClick={handleAdd}
              >
                {addProp.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adding...</>
                ) : (
                  "Add to Route"
                )}
              </Button>
            </div>
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
