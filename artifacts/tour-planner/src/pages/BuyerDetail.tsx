import { useState } from "react"
import { useRoute, useLocation } from "wouter"
import {
  useGetBuyerDetail,
  getGetBuyerDetailQueryKey,
} from "@workspace/api-client-react"
import type { BuyerDetailStop, BuyerDetailTour } from "@workspace/api-client-react"
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  FileText,
  Star,
  Bookmark,
  RefreshCcw,
  MessageSquare,
  Mic,
  Calendar,
  Home,
  Tag,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatDate, getStatusColor } from "@/lib/utils"

function StarDisplay({ value, max = 5 }: { value: number | null | undefined; max?: number }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          )}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value}/{max}</span>
    </span>
  )
}

function VisitStatusBadge({ stop }: { stop: BuyerDetailStop }) {
  if (stop.skipped) {
    return (
      <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-orange-200 text-orange-600 bg-orange-50">
        Skipped
      </Badge>
    )
  }
  if (stop.visited) {
    return (
      <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-green-200 text-green-700 bg-green-50">
        Visited
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border text-muted-foreground">
      Not Visited
    </Badge>
  )
}

function StopCard({ stop }: { stop: BuyerDetailStop }) {
  const [expanded, setExpanded] = useState(false)

  const hasRatings =
    stop.overallFitRating || stop.buyerInterest || stop.kitchenRating ||
    stop.primarySuiteRating || stop.backyardRating || stop.roadNoiseRating

  const hasFlags = stop.followUpFlag || stop.revisitFlag
  const hasTags = stop.quickTags && stop.quickTags.length > 0
  const hasComments = stop.comments && stop.comments.length > 0

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-background">
      <button
        type="button"
        className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
          {stop.sequence}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {stop.propertyNickname ?? stop.formattedAddress}
          </div>
          {stop.propertyNickname && (
            <div className="text-xs text-muted-foreground truncate">{stop.formattedAddress}</div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <VisitStatusBadge stop={stop} />
            {stop.showingStatus && stop.showingStatus !== "not_requested" && (
              <Badge
                variant="outline"
                className={cn("text-[10px] uppercase tracking-wider font-bold border", getStatusColor(stop.showingStatus))}
              >
                {stop.showingStatus.replace(/_/g, " ")}
              </Badge>
            )}
            {stop.overallFitRating && (
              <span className="flex items-center gap-0.5 text-xs text-amber-500">
                <Star className="h-3 w-3 fill-amber-400" />
                {stop.overallFitRating}/5
              </span>
            )}
            {hasFlags && (
              <span className="flex items-center gap-1">
                {stop.followUpFlag && <Bookmark className="h-3 w-3 text-amber-500" />}
                {stop.revisitFlag && <RefreshCcw className="h-3 w-3 text-teal-500" />}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground mt-0.5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-4 bg-muted/10">
          {hasRatings && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ratings</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {[
                  ["Overall Fit", stop.overallFitRating],
                  ["Buyer Interest", stop.buyerInterest],
                  ["Kitchen", stop.kitchenRating],
                  ["Primary Suite", stop.primarySuiteRating],
                  ["Backyard", stop.backyardRating],
                  ["Road Noise", stop.roadNoiseRating],
                ].map(([label, val]) =>
                  val != null ? (
                    <div key={label as string} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">{label as string}</span>
                      <StarDisplay value={val as number} />
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {hasFlags && (
            <div className="flex items-center gap-3 flex-wrap">
              {stop.followUpFlag && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  <Bookmark className="h-3 w-3" />
                  Follow-up
                </span>
              )}
              {stop.revisitFlag && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-teal-600 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-1">
                  <RefreshCcw className="h-3 w-3" />
                  Revisit
                </span>
              )}
            </div>
          )}

          {hasTags && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Quick Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {stop.quickTags!.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stop.skipped && stop.skipReason && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Skip reason:</span>{" "}
              {stop.skipReason.replace(/_/g, " ")}
              {stop.skipNotes && ` — ${stop.skipNotes}`}
            </div>
          )}

          {hasComments && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Notes
              </p>
              <div className="space-y-2">
                {(stop.comments ?? []).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 text-sm text-foreground bg-background border border-border/50 rounded-lg px-3 py-2"
                  >
                    {c.isVoiceNote ? (
                      <Mic className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    )}
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasRatings && !hasFlags && !hasTags && !hasComments && (
            <p className="text-xs text-muted-foreground italic">No detailed data recorded for this stop.</p>
          )}
        </div>
      )}
    </div>
  )
}

function TourSection({ tour }: { tour: BuyerDetailTour }) {
  const [open, setOpen] = useState(true)
  const visited = tour.stops.filter(s => s.visited && !s.skipped).length
  const skipped = tour.stops.filter(s => s.skipped).length

  return (
    <div className="border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors text-left bg-muted/30"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-foreground">{tour.title}</span>
            <Badge
              variant="outline"
              className={cn("text-[10px] uppercase tracking-wider font-bold border", getStatusColor(tour.status))}
            >
              {tour.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(tour.date)}
            </span>
            <span className="flex items-center gap-1">
              <Home className="h-3 w-3" />
              {tour.stops.length} stop{tour.stops.length !== 1 ? "s" : ""}
              {visited > 0 && ` · ${visited} visited`}
              {skipped > 0 && ` · ${skipped} skipped`}
            </span>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="divide-y divide-border/30 px-4 py-3 space-y-2 bg-background">
          {tour.stops.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No stops on this tour.</p>
          ) : (
            tour.stops.map(stop => <StopCard key={stop.id} stop={stop} />)
          )}
        </div>
      )}
    </div>
  )
}

export default function BuyerDetail() {
  const [, params] = useRoute("/buyers/:id")
  const [, navigate] = useLocation()
  const buyerId = params?.id ?? ""

  const { data, isLoading } = useGetBuyerDetail(buyerId, {
    query: { queryKey: getGetBuyerDetailQueryKey(buyerId), enabled: !!buyerId },
  })

  const buyer = data?.buyer
  const tours = data?.tours ?? []

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!buyer) {
    return (
      <div className="p-12 text-center text-muted-foreground">Buyer not found.</div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => navigate("/buyers")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{buyer.name}</h1>
          <p className="text-sm text-muted-foreground">Buyer 360° View</p>
        </div>
      </div>

      <Card className="border border-border/50 shadow-md shadow-black/5">
        <CardContent className="pt-5 pb-4 px-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
              {buyer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground">{buyer.name}</p>
              <p className="text-xs text-muted-foreground">
                {tours.length} tour{tours.length !== 1 ? "s" : ""} · {tours.reduce((a, t) => a + t.stops.length, 0)} total stops
              </p>
            </div>
          </div>
          {(buyer.email || buyer.phone) && (
            <div className="flex flex-col gap-1.5">
              {buyer.email && (
                <a
                  href={`mailto:${buyer.email}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {buyer.email}
                </a>
              )}
              {buyer.phone && (
                <a
                  href={`tel:${buyer.phone}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {buyer.phone}
                </a>
              )}
            </div>
          )}
          {buyer.notes && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5">
              <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{buyer.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {tours.length === 0 ? (
        <Card className="border border-border/50 shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Home className="h-10 w-10 mx-auto mb-3 text-muted" />
            <p className="font-medium">No tours yet</p>
            <p className="text-sm mt-1">This buyer hasn't been added to any tours.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Tour History</h2>
          {tours.map(tour => (
            <TourSection key={tour.id} tour={tour} />
          ))}
        </div>
      )}
    </div>
  )
}
