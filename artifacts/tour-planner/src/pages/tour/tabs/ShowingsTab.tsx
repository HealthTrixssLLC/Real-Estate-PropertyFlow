import { useGetShowingRequest } from "@workspace/api-client-react"
import { Phone, Mail, FileText, CheckCircle2, AlertCircle, Building, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, getStatusColor } from "@/lib/utils"

export default function ShowingsTab({ stops }: { stops: any[] }) {
  if (stops.length === 0) return (
    <div className="p-12 text-center text-muted-foreground">No stops in this tour yet.</div>
  )

  return (
    <div className="p-0 overflow-hidden rounded-b-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Stop # / Property</th>
              <th className="px-6 py-4 font-semibold">Agent Info</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Restrictions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {stops.map((stop, index) => (
              <ShowingRow key={stop.id} stop={stop} index={index} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ShowingRow({ stop, index }: { stop: any, index: number }) {
  const { data, isLoading } = useGetShowingRequest(stop.id)
  const req = data?.showingRequest

  if (isLoading) return (
    <tr>
      <td className="px-6 py-4"><Skeleton className="h-6 w-32" /></td>
      <td className="px-6 py-4"><Skeleton className="h-6 w-48" /></td>
      <td className="px-6 py-4"><Skeleton className="h-6 w-24" /></td>
      <td className="px-6 py-4"><Skeleton className="h-6 w-24" /></td>
    </tr>
  )

  return (
    <tr className="hover:bg-muted/20 transition-colors bg-background">
      <td className="px-6 py-4 align-top">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
            {index + 1}
          </div>
          <div>
            <div className="font-semibold text-foreground">Stop {stop.id.slice(0,6)}...</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 align-top space-y-1.5">
        {req?.listingAgentName ? (
          <>
            <div className="font-medium text-foreground flex items-center gap-2">
              <UserIcon /> {req.listingAgentName}
            </div>
            {req.brokerageName && <div className="text-xs text-muted-foreground flex items-center gap-2"><Building className="h-3 w-3"/> {req.brokerageName}</div>}
            {req.phone && <div className="text-xs text-muted-foreground flex items-center gap-2"><Phone className="h-3 w-3"/> {req.phone}</div>}
            {req.email && <div className="text-xs text-muted-foreground flex items-center gap-2"><Mail className="h-3 w-3"/> {req.email}</div>}
          </>
        ) : (
          <span className="text-muted-foreground italic">No agent info added</span>
        )}
      </td>
      <td className="px-6 py-4 align-top">
        <Badge variant="outline" className={cn("uppercase text-[10px] tracking-wider font-bold border", getStatusColor(req?.status || 'not_requested'))}>
          {(req?.status || 'not_requested').replace('_', ' ')}
        </Badge>
        {req?.notes && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic max-w-xs border-l-2 border-primary/30 pl-2">"{req.notes}"</p>
        )}
      </td>
      <td className="px-6 py-4 align-top">
        <Card className="p-3 bg-muted/30 border-dashed shadow-none space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
            <AlertCircle className="h-3 w-3" /> Restrictions
          </div>
          <div className="text-xs text-muted-foreground">
            Click to view/edit constraints like Gate Code, Pets, etc.
          </div>
          <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-secondary/80">Manage Details</Badge>
        </Card>
      </td>
    </tr>
  )
}

function UserIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
