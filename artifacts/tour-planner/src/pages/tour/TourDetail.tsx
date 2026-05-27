import { useState } from "react"
import { useGetTour, useListProperties, useArchiveTour, useRestoreTour, useDeleteTour, getListToursQueryKey } from "@workspace/api-client-react"
import { useRoute, useLocation } from "wouter"
import { Calendar, MapPin, User, ChevronLeft, Building2, Map as MapIcon, ListChecks, CheckCircle2, Loader2, Archive, Trash2, AlertTriangle, RotateCcw, MoreHorizontal } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "wouter"
import { cn, formatDate, getStatusColor } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"

import StopsTab from "./tabs/StopsTab"
import MapTab from "./tabs/MapTab"
import ShowingsTab from "./tabs/ShowingsTab"
import ReadinessTab from "./tabs/ReadinessTab"
import EditTourDialog from "./EditTourDialog"

export default function TourDetail() {
  const [, params] = useRoute("/tours/:id")
  const [, navigate] = useLocation()
  const tourId = params?.id || ""
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useGetTour(tourId)
  const { data: propertiesData } = useListProperties()

  const archiveTour = useArchiveTour()
  const restoreTour = useRestoreTour()
  const deleteTour = useDeleteTour()

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!data?.tour) return <div>Tour not found.</div>

  const tour = data.tour
  const stops = data.stops || []
  const properties = propertiesData?.properties ?? []
  const isArchived = tour.status === "cancelled"
  const isPublished = tour.status === "published"

  const invalidateTours = async () => {
    await queryClient.invalidateQueries({ queryKey: getListToursQueryKey() })
    await queryClient.invalidateQueries({ queryKey: getListToursQueryKey({ status: "cancelled" }) })
  }

  const handleArchive = async () => {
    try {
      await archiveTour.mutateAsync({ tourId })
      await invalidateTours()
      toast({ title: "Tour archived", description: "You can restore it from the Dashboard." })
      navigate("/")
    } catch {
      toast({ title: "Failed to archive tour", variant: "destructive" })
    }
  }

  const handleRestore = async () => {
    try {
      await restoreTour.mutateAsync({ tourId })
      await invalidateTours()
      toast({ title: "Tour restored", description: "The tour is now in draft status." })
      navigate("/")
    } catch {
      toast({ title: "Failed to restore tour", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    try {
      await deleteTour.mutateAsync({ tourId })
      await invalidateTours()
      toast({ title: "Tour deleted" })
      navigate("/")
    } catch {
      toast({ title: "Failed to delete tour", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="space-y-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2 hover-elevate">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
        </Link>
        
        <div className="bg-card p-6 md:p-8 rounded-2xl border border-border/50 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />
          
          <div className="space-y-2 z-10">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{tour.title}</h1>
              <Badge variant="outline" className={cn("px-3 py-1 text-sm border shadow-sm", getStatusColor(tour.status))}>
                {tour.status}
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary/70" />
                <span className="font-medium text-foreground">{formatDate(tour.date)}</span>
                {tour.startTime && <span>at {tour.startTime}</span>}
              </div>
              {data.buyer && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary/70" />
                  <span className="font-medium text-foreground">{(data.buyer as { name?: string }).name}</span>
                </div>
              )}
              {tour.startAddress && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary/70" />
                  <span>Start: {tour.startAddress}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto z-10">
            {!isArchived && (
              <Button
                variant="outline"
                className="flex-1 md:flex-none bg-background shadow-sm hover-elevate"
                onClick={() => setEditOpen(true)}
              >
                Edit Details
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="bg-background shadow-sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isArchived ? (
                  <DropdownMenuItem
                    onClick={handleRestore}
                    disabled={restoreTour.isPending}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore Tour
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => isPublished ? setArchiveOpen(true) : handleArchive()}
                    disabled={archiveTour.isPending}
                    className="gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Archive Tour
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Tour
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <EditTourDialog open={editOpen} onOpenChange={setEditOpen} tour={tour} />

      {/* Archive warning dialog for published tours */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Archive Published Tour?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This tour is currently <strong>published</strong> and visible on the mobile app. Archiving it will hide it from the active list and remove it from the mobile app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archive Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Tour?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{tour.title}</strong> and all its stops. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tabs */}
      <Tabs defaultValue="stops" className="w-full">
        <TabsList className="grid grid-cols-4 w-full h-auto p-1 bg-muted/50 rounded-xl mb-6 shadow-inner">
          <TabsTrigger value="stops" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 rounded-lg text-sm sm:text-base transition-all">
            <Building2 className="h-4 w-4 mr-2 hidden sm:block" />
            Route Stops ({stops.length})
          </TabsTrigger>
          <TabsTrigger value="map" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 rounded-lg text-sm sm:text-base transition-all">
            <MapIcon className="h-4 w-4 mr-2 hidden sm:block" />
            Map View
          </TabsTrigger>
          <TabsTrigger value="showings" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 rounded-lg text-sm sm:text-base transition-all">
            <ListChecks className="h-4 w-4 mr-2 hidden sm:block" />
            Showings
          </TabsTrigger>
          <TabsTrigger value="readiness" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 rounded-lg text-sm sm:text-base transition-all">
            <CheckCircle2 className="h-4 w-4 mr-2 hidden sm:block" />
            Readiness
          </TabsTrigger>
        </TabsList>

        <div className="bg-card rounded-2xl border border-border/50 shadow-sm min-h-[500px]">
          <TabsContent value="stops" className="m-0 p-0 outline-none">
            <StopsTab tourId={tourId} stops={stops} tourStatus={tour.status} />
          </TabsContent>
          <TabsContent value="map" className="m-0 p-0 outline-none">
            <MapTab
              stops={stops}
              properties={properties}
              startLat={tour.startLat}
              startLng={tour.startLng}
              startAddress={tour.startAddress}
            />
          </TabsContent>
          <TabsContent value="showings" className="m-0 p-0 outline-none">
            <ShowingsTab stops={stops} />
          </TabsContent>
          <TabsContent value="readiness" className="m-0 p-0 outline-none">
            <ReadinessTab tourId={tourId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
