import { useState } from "react"
import { Link } from "wouter"
import { useListTours, useListBuyers, useArchiveTour, useRestoreTour, useDeleteTour, getListToursQueryKey } from "@workspace/api-client-react"
import type { Tour } from "@workspace/api-client-react"
import { Plus, Map, Building2, Clock, Calendar as CalendarIcon, ArrowRight, CheckCircle2, MoreHorizontal, Archive, RotateCcw, Trash2, AlertTriangle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { cn, formatDate, getStatusColor } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import type { LucideIcon } from "lucide-react"

export default function Dashboard() {
  const [showArchived, setShowArchived] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: toursData, isLoading } = useListTours(
    showArchived ? { status: "cancelled" } : undefined
  )
  const { data: buyersData } = useListBuyers()

  const archiveTour = useArchiveTour()
  const restoreTour = useRestoreTour()
  const deleteTour = useDeleteTour()

  const activeTours = (toursData?.tours ?? []).filter(t => t.status === "active" || t.status === "draft")
  const publishedTours = (toursData?.tours ?? []).filter(t => t.status === "published")

  const invalidateTours = async () => {
    await queryClient.invalidateQueries({ queryKey: getListToursQueryKey() })
    await queryClient.invalidateQueries({ queryKey: getListToursQueryKey({ status: "cancelled" }) })
  }

  const handleArchive = async (tourId: string) => {
    try {
      await archiveTour.mutateAsync({ tourId })
      await invalidateTours()
      toast({ title: "Tour archived", description: "You can restore it from the Archived tab." })
    } catch {
      toast({ title: "Failed to archive tour", variant: "destructive" })
    }
  }

  const handleRestore = async (tourId: string) => {
    try {
      await restoreTour.mutateAsync({ tourId })
      await invalidateTours()
      toast({ title: "Tour restored", description: "The tour is now in draft status." })
    } catch {
      toast({ title: "Failed to restore tour", variant: "destructive" })
    }
  }

  const handleDelete = async (tourId: string) => {
    try {
      await deleteTour.mutateAsync({ tourId })
      await invalidateTours()
      toast({ title: "Tour deleted" })
    } catch {
      toast({ title: "Failed to delete tour", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your active property tours and showings.</p>
        </div>
        <Link href="/tours/new">
          <Button className="shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-transform gap-2">
            <Plus className="h-4 w-4" />
            New Tour
          </Button>
        </Link>
      </div>

      {!showArchived && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Map} title="Total Tours" value={toursData?.tours.length || 0} loading={isLoading} />
          <StatCard icon={Clock} title="Active Drafts" value={activeTours.length} loading={isLoading} />
          <StatCard icon={CheckCircle2} title="Published" value={publishedTours.length} loading={isLoading} />
          <StatCard icon={Building2} title="Total Buyers" value={buyersData?.buyers.length || 0} loading={!buyersData} />
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{showArchived ? "Archived Tours" : "Recent Tours"}</h2>
          <Button
            variant={showArchived ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setShowArchived(v => !v)}
          >
            <Archive className="h-4 w-4" />
            {showArchived ? "Back to Active" : "Show Archived"}
          </Button>
        </div>
        <Card className="border border-border/50 shadow-md shadow-black/5 overflow-hidden">
          {isLoading ? (
             <div className="p-6 space-y-4">
               <Skeleton className="h-12 w-full" />
               <Skeleton className="h-12 w-full" />
             </div>
          ) : toursData?.tours.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
              <Map className="h-12 w-12 mb-4 text-muted" />
              <p className="text-lg font-medium">{showArchived ? "No archived tours" : "No tours created yet"}</p>
              <p className="text-sm">{showArchived ? "Archived tours will appear here" : "Click 'New Tour' to get started"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Title & Date</th>
                    <th className="px-6 py-4 font-semibold">Client</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Area / Tags</th>
                    <th className="px-6 py-4 font-semibold">Readiness</th>
                    <th className="px-6 py-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {toursData?.tours.map((tour) => (
                    <TourRow
                      key={tour.id}
                      tour={tour}
                      buyerName={buyersData?.buyers.find(b => b.id === tour.buyerId)?.name}
                      showArchived={showArchived}
                      onArchive={handleArchive}
                      onRestore={handleRestore}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

interface TourRowProps {
  tour: Tour
  buyerName: string | undefined
  showArchived: boolean
  onArchive: (tourId: string) => void
  onRestore: (tourId: string) => void
  onDelete: (tourId: string) => void
}

function TourRow({ tour, buyerName, showArchived, onArchive, onRestore, onDelete }: TourRowProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isPublished = tour.status === "published"
  const isReadyToPublish = tour.status === "active"
  const isDraft = tour.status === "draft"

  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors group">
        <td className="px-6 py-4">
          <div className="font-semibold text-foreground">{tour.title}</div>
          <div className="text-muted-foreground text-xs flex items-center gap-1 mt-1">
            <CalendarIcon className="h-3 w-3" />
            {formatDate(tour.date)}
            {tour.startTime && <span className="ml-1">at {tour.startTime}</span>}
          </div>
        </td>
        <td className="px-6 py-4 font-medium">{buyerName || "—"}</td>
        <td className="px-6 py-4">
          <Badge variant="outline" className={cn("capitalize border", getStatusColor(tour.status))}>
            {tour.status}
          </Badge>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-1">
            {tour.geographicArea && (
              <div className="text-xs text-muted-foreground">{tour.geographicArea}</div>
            )}
            <div className="flex gap-1 flex-wrap">
              {tour.tags?.slice(0, 3).map(t => (
                <Badge key={t} variant="secondary" className="text-xs bg-accent/50">{t}</Badge>
              ))}
              {(tour.tags?.length ?? 0) > 3 && (
                <Badge variant="secondary" className="text-xs bg-accent/50">+{(tour.tags?.length ?? 0) - 3}</Badge>
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-1.5">
            {typeof tour.stopCount === "number" ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-secondary/60 text-secondary-foreground rounded-full px-2 py-0.5">
                  <Building2 className="h-3 w-3" />
                  {tour.stopCount} stop{tour.stopCount !== 1 ? "s" : ""}
                </span>
                {typeof tour.approvedCount === "number" && tour.approvedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                    {tour.approvedCount} ok
                  </span>
                )}
                {typeof tour.pendingShowingsCount === "number" && tour.pendingShowingsCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                    <Clock className="h-3 w-3" />
                    {tour.pendingShowingsCount} pending
                  </span>
                )}
              </div>
            ) : null}
            {isPublished ? (
              <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Published to mobile
              </div>
            ) : isReadyToPublish ? (
              <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                <Clock className="h-3.5 w-3.5" />
                Ready to review
              </div>
            ) : isDraft ? (
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Building2 className="h-3.5 w-3.5" />
                In planning
              </div>
            ) : (
              <div className="text-xs text-muted-foreground capitalize">{tour.status}</div>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {!showArchived && (
              <Link href={`/tours/${tour.id}`}>
                <Button variant="ghost" size="sm" className="group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  Manage
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showArchived ? (
                  <DropdownMenuItem onClick={() => onRestore(tour.id)} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Restore Tour
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onArchive(tour.id)} className="gap-2">
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
        </td>
      </tr>

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
              onClick={() => onDelete(tour.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface StatCardProps {
  icon: LucideIcon
  title: string
  value: number
  loading: boolean
}

function StatCard({ icon: Icon, title, value, loading }: StatCardProps) {
  return (
    <Card className="p-6 border border-border/50 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 group">
      <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-110 transition-transform">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold text-foreground">{value}</p>}
      </div>
    </Card>
  )
}
