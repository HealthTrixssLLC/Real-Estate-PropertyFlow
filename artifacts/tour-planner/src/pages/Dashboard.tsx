import { useState } from "react"
import { Link, useLocation } from "wouter"
import { useListTours, useCreateTour, useListBuyers } from "@workspace/api-client-react"
import type { Tour } from "@workspace/api-client-react"
import { Plus, Map, Building2, Clock, Calendar as CalendarIcon, ArrowRight, CheckCircle2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn, formatDate, getStatusColor } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import PlacesAutocomplete from "@/components/shared/PlacesAutocomplete"
import type { PlaceResult } from "@/components/shared/PlacesAutocomplete"

interface AddressPlace {
  formatted: string
  lat?: number
  lng?: number
}

export default function Dashboard() {
  const { data: toursData, isLoading } = useListTours()
  const { data: buyersData } = useListBuyers()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const createTour = useCreateTour()
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const [startAddr, setStartAddr] = useState<AddressPlace>({ formatted: "" })
  const [endAddr, setEndAddr] = useState<AddressPlace>({ formatted: "" })

  const activeTours = toursData?.tours.filter(t => t.status === "active" || t.status === "draft") || []
  const publishedTours = toursData?.tours.filter(t => t.status === "published") || []

  const handleCreateClose = () => {
    setIsCreateOpen(false)
    setStartAddr({ formatted: "" })
    setEndAddr({ formatted: "" })
  }

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
          tags: (fd.get("tags") as string).split(",").map(s => s.trim()).filter(Boolean),
        },
      })
      toast({ title: "Tour created successfully!" })
      handleCreateClose()
      setLocation(`/tours/${res.tour.id}`)
    } catch {
      toast({ title: "Failed to create tour", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your active property tours and showings.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={open => !open && handleCreateClose()}>
          <DialogTrigger asChild>
            <Button
              className="shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-transform gap-2"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New Tour
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create New Tour</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="title">Tour Title <span className="text-destructive">*</span></Label>
                  <Input id="title" name="title" required placeholder="e.g. Weekend Homes for Smith Family" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Tour Date <span className="text-destructive">*</span></Label>
                  <Input id="date" name="date" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input id="startTime" name="startTime" type="time" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="buyerId">Client / Buyer</Label>
                  <Select name="buyerId">
                    <SelectTrigger><SelectValue placeholder="Select a buyer..." /></SelectTrigger>
                    <SelectContent>
                      {buyersData?.buyers.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="startAddress">Starting Address / Meeting Point</Label>
                  <PlacesAutocomplete
                    id="startAddress"
                    value={startAddr.formatted}
                    onChange={v => setStartAddr({ formatted: v })}
                    onPlaceSelected={(p: PlaceResult) => setStartAddr({ formatted: p.formattedAddress, lat: p.lat, lng: p.lng })}
                    placeholder="123 Main St, City, State"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="endAddress">Ending Address</Label>
                  <PlacesAutocomplete
                    id="endAddress"
                    value={endAddr.formatted}
                    onChange={v => setEndAddr({ formatted: v })}
                    onPlaceSelected={(p: PlaceResult) => setEndAddr({ formatted: p.formattedAddress, lat: p.lat, lng: p.lng })}
                    placeholder="456 Oak Ave (leave blank to return to start)"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="geographicArea">Geographic Target Area</Label>
                  <Input id="geographicArea" name="geographicArea" placeholder="e.g. Downtown Austin, North Loop, ZIP 78701" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="buyerNotes">Client Preferences / Notes</Label>
                  <Textarea id="buyerNotes" name="buyerNotes" placeholder="Looking for a large backyard, min 3 beds..." />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input id="tags" name="tags" placeholder="urgent, pool, luxury" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" type="button" onClick={handleCreateClose}>Cancel</Button>
                <Button type="submit" disabled={createTour.isPending}>
                  {createTour.isPending ? "Creating..." : "Create Tour"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Map} title="Total Tours" value={toursData?.tours.length || 0} loading={isLoading} />
        <StatCard icon={Clock} title="Active Drafts" value={activeTours.length} loading={isLoading} />
        <StatCard icon={CheckCircle2} title="Published" value={publishedTours.length} loading={isLoading} />
        <StatCard icon={Building2} title="Total Buyers" value={buyersData?.buyers.length || 0} loading={!buyersData} />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Tours</h2>
        <Card className="border border-border/50 shadow-md shadow-black/5 overflow-hidden">
          {isLoading ? (
             <div className="p-6 space-y-4">
               <Skeleton className="h-12 w-full" />
               <Skeleton className="h-12 w-full" />
             </div>
          ) : toursData?.tours.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
              <Map className="h-12 w-12 mb-4 text-muted" />
              <p className="text-lg font-medium">No tours created yet</p>
              <p className="text-sm">Click 'New Tour' to get started</p>
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
}

function TourRow({ tour, buyerName }: TourRowProps) {
  const isPublished = tour.status === "published"
  const isReadyToPublish = tour.status === "active"
  const isDraft = tour.status === "draft"

  return (
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
      </td>
      <td className="px-6 py-4 text-right">
        <Link href={`/tours/${tour.id}`}>
          <Button variant="ghost" size="sm" className="group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            Manage
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </td>
    </tr>
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
