import { useState } from "react"
import { Link, useLocation } from "wouter"
import { useListTours, useCreateTour, useListBuyers } from "@workspace/api-client-react"
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

export default function Dashboard() {
  const { data: toursData, isLoading } = useListTours()
  const { data: buyersData } = useListBuyers()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const createTour = useCreateTour()
  const { toast } = useToast()
  const [, setLocation] = useLocation()

  const activeTours = toursData?.tours.filter(t => t.status === 'active' || t.status === 'draft') || []
  const publishedTours = toursData?.tours.filter(t => t.status === 'published') || []

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    
    try {
      const res = await createTour.mutateAsync({
        data: {
          title: fd.get("title") as string,
          date: fd.get("date") as string,
          buyerId: fd.get("buyerId") as string || undefined,
          startAddress: fd.get("startAddress") as string,
          startTime: fd.get("startTime") as string || undefined,
          buyerNotes: fd.get("buyerNotes") as string,
          tags: (fd.get("tags") as string).split(',').map(s => s.trim()).filter(Boolean)
        }
      })
      toast({ title: "Tour created successfully!" })
      setIsCreateOpen(false)
      setLocation(`/tours/${res.tour.id}`)
    } catch (err) {
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
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-transform gap-2">
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
                  <Input id="startAddress" name="startAddress" placeholder="123 Main St, Office..." />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="buyerNotes">Client Preferences / Notes</Label>
                  <Textarea id="buyerNotes" name="buyerNotes" placeholder="Looking for a large backyard..." />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input id="tags" name="tags" placeholder="urgent, pool, luxury" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
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
                    <th className="px-6 py-4 font-semibold">Tags</th>
                    <th className="px-6 py-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {toursData?.tours.map((tour) => (
                    <tr key={tour.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-foreground">{tour.title}</div>
                        <div className="text-muted-foreground text-xs flex items-center gap-1 mt-1">
                          <CalendarIcon className="h-3 w-3" />
                          {formatDate(tour.date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {buyersData?.buyers.find(b => b.id === tour.buyerId)?.name || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={cn("capitalize border", getStatusColor(tour.status))}>
                          {tour.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {tour.tags?.map(t => (
                            <Badge key={t} variant="secondary" className="text-xs bg-accent/50">{t}</Badge>
                          ))}
                        </div>
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

function StatCard({ icon: Icon, title, value, loading }: any) {
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
