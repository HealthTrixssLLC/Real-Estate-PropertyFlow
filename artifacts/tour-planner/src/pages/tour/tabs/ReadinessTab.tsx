import { useGetTourReadiness, usePublishTour } from "@workspace/api-client-react"
import { CheckCircle2, Clock, AlertTriangle, ShieldAlert, Smartphone, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

export default function ReadinessTab({ tourId }: { tourId: string }) {
  const { data, isLoading } = useGetTourReadiness(tourId)
  const publish = usePublishTour()
  const { toast } = useToast()

  const handlePublish = async () => {
    try {
      await publish.mutateAsync({ tourId })
      toast({ title: "Tour Published successfully", description: "It is now available on the mobile app." })
      window.location.reload()
    } catch {
      toast({ title: "Failed to publish", variant: "destructive" })
    }
  }

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-64 w-full"/></div>

  const r = data || { approvedCount: 0, pendingCount: 0, declinedCount: 0, missingAgentInfoCount: 0, estimatedDriveTimeMinutes: 0, estimatedTotalMinutes: 0 }
  
  const isReady = r.pendingCount === 0 && r.missingAgentInfoCount === 0

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Pre-Tour Checklist</h2>
        <p className="text-muted-foreground">Review showing approvals and warnings before publishing to the mobile app.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-green-500/10 border-green-500/20 text-center p-4 shadow-sm">
          <div className="text-3xl font-bold text-green-700">{r.approvedCount}</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-green-700/80 mt-1">Approved</div>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20 text-center p-4 shadow-sm">
          <div className="text-3xl font-bold text-amber-700">{r.pendingCount}</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700/80 mt-1">Pending</div>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20 text-center p-4 shadow-sm">
          <div className="text-3xl font-bold text-red-700">{r.declinedCount}</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-red-700/80 mt-1">Declined</div>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/20 text-center p-4 shadow-sm">
          <div className="text-3xl font-bold text-orange-700">{r.missingAgentInfoCount}</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-orange-700/80 mt-1">Missing Info</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 shadow-sm border-border/50 bg-card flex items-center gap-4">
          <div className="p-4 rounded-full bg-primary/10 text-primary">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Estimated Route Time</p>
            <p className="text-2xl font-bold">{r.estimatedDriveTimeMinutes} mins</p>
            <p className="text-xs text-muted-foreground">Drive time only</p>
          </div>
        </Card>
        <Card className="p-6 shadow-sm border-border/50 bg-card flex items-center gap-4">
          <div className="p-4 rounded-full bg-secondary text-secondary-foreground">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Tour Duration</p>
            <p className="text-2xl font-bold">~{r.estimatedTotalMinutes} mins</p>
            <p className="text-xs text-muted-foreground">Including showings</p>
          </div>
        </Card>
      </div>

      <div className="border-t border-border pt-8 text-center space-y-6">
        {!isReady && (
          <div className="bg-amber-500/10 text-amber-800 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3 max-w-2xl mx-auto text-left">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">You have pending approvals or missing agent information. You can still publish, but the itinerary may not be fully executable in the field.</p>
          </div>
        )}
        
        <Button 
          size="lg" 
          onClick={handlePublish}
          disabled={publish.isPending}
          className="w-full max-w-sm h-14 text-lg font-bold shadow-xl shadow-primary/25 hover:-translate-y-1 transition-all rounded-xl"
        >
          {publish.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2"/> : <Smartphone className="h-5 w-5 mr-2" />}
          Publish to Mobile App
        </Button>
      </div>
    </div>
  )
}
