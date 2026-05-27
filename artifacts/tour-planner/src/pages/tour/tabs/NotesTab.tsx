import { useState } from "react"
import type { TourStopWithAddress } from "@workspace/api-client-react"
import { ChevronDown, ChevronUp, MapPin, Mic2, FileText } from "lucide-react"
import { cn, getStatusColor } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { StopNotesPanel } from "@/components/shared/StopNotesPanel"

interface NotesTabProps {
  stops: TourStopWithAddress[]
}

export default function NotesTab({ stops }: NotesTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    stops.length > 0 ? stops[0].id : null
  )

  if (stops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-muted">
          <Mic2 className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm">No stops added to this tour yet.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/50">
      {stops.map((stop, index) => {
        const isOpen = expandedId === stop.id
        const label = stop.propertyNickname ?? stop.formattedAddress ?? `Stop ${index + 1}`

        return (
          <div key={stop.id} className="bg-background">
            <button
              type="button"
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors text-left"
              onClick={() => setExpandedId(isOpen ? null : stop.id)}
            >
              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground truncate">{label}</div>
                {stop.propertyNickname && stop.formattedAddress && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {stop.formattedAddress}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={cn(
                    "uppercase text-[10px] tracking-wider font-bold border hidden sm:flex",
                    getStatusColor(stop.approvedStatus)
                  )}
                >
                  {stop.approvedStatus.replace(/_/g, " ")}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <Mic2 className="h-3.5 w-3.5" />
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border/40 bg-muted/10">
                <StopNotesPanel stopId={stop.id} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
