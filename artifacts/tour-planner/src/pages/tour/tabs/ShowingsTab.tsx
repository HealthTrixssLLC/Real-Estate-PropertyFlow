import { useState } from "react"
import {
  useGetShowingRequest,
  useUpdateShowingRequest,
  useCreateShowingRequest,
  useGetRestrictionNote,
  useUpsertRestrictionNote,
} from "@workspace/api-client-react"
import { UpdateShowingRequestBodyStatus } from "@workspace/api-client-react"
import { Phone, Mail, Building, Loader2, UserIcon, ChevronDown, ChevronUp, Save, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn, getStatusColor } from "@/lib/utils"

export default function ShowingsTab({ stops }: { stops: any[] }) {
  if (stops.length === 0) return (
    <div className="p-12 text-center text-muted-foreground">No stops in this tour yet.</div>
  )

  return (
    <div className="divide-y divide-border/50">
      {stops.map((stop, index) => (
        <ShowingRow key={stop.id} stop={stop} index={index} />
      ))}
    </div>
  )
}

function ShowingRow({ stop, index }: { stop: any; index: number }) {
  const { data, isLoading, refetch } = useGetShowingRequest(stop.id)
  const updateShowing = useUpdateShowingRequest()
  const createShowing = useCreateShowingRequest()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)

  const req = data?.showingRequest

  if (isLoading) return (
    <div className="p-6 space-y-3">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
  )

  const handleSaveShowing = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const status = fd.get("status") as UpdateShowingRequestBodyStatus
    const body = {
      listingAgentName: (fd.get("listingAgentName") as string) || undefined,
      brokerageName: (fd.get("brokerageName") as string) || undefined,
      email: (fd.get("email") as string) || undefined,
      phone: (fd.get("phone") as string) || undefined,
      requestMethod: (fd.get("requestMethod") as string) || undefined,
      requestedWindowStart: (fd.get("requestedWindowStart") as string) || undefined,
      requestedWindowEnd: (fd.get("requestedWindowEnd") as string) || undefined,
      status: status || undefined,
      notes: (fd.get("notes") as string) || undefined,
    }

    try {
      if (req) {
        await updateShowing.mutateAsync({ stopId: stop.id, data: body })
      } else {
        await createShowing.mutateAsync({ stopId: stop.id, data: body })
      }
      toast({ title: "Showing request saved" })
      refetch()
    } catch {
      toast({ title: "Failed to save showing request", variant: "destructive" })
    }
  }

  const isSaving = updateShowing.isPending || createShowing.isPending

  return (
    <div className="bg-background">
      <button
        type="button"
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">
            Stop {index + 1}
            {req?.listingAgentName && (
              <span className="text-muted-foreground font-normal ml-2">· {req.listingAgentName}</span>
            )}
          </div>
          {req?.brokerageName && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building className="h-3 w-3" />
              {req.brokerageName}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge
            variant="outline"
            className={cn("uppercase text-[10px] tracking-wider font-bold border", getStatusColor(req?.status || "not_requested"))}
          >
            {(req?.status || "not_requested").replace(/_/g, " ")}
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-border/30 pt-4">
          <form onSubmit={handleSaveShowing} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`agent-${stop.id}`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <UserIcon className="h-3.5 w-3.5" />
                  Listing Agent Name
                </Label>
                <Input id={`agent-${stop.id}`} name="listingAgentName" defaultValue={req?.listingAgentName || ""} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`brokerage-${stop.id}`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Building className="h-3.5 w-3.5" />
                  Brokerage
                </Label>
                <Input id={`brokerage-${stop.id}`} name="brokerageName" defaultValue={req?.brokerageName || ""} placeholder="Acme Realty" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`phone-${stop.id}`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  Phone
                </Label>
                <Input id={`phone-${stop.id}`} name="phone" defaultValue={req?.phone || ""} placeholder="(555) 000-0000" type="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`email-${stop.id}`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </Label>
                <Input id={`email-${stop.id}`} name="email" defaultValue={req?.email || ""} placeholder="agent@brokerage.com" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request Method</Label>
                <Select name="requestMethod" defaultValue={req?.requestMethod || "phone"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="showing_time">ShowingTime</SelectItem>
                    <SelectItem value="supra">Supra</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Approval Status</Label>
                <Select name="status" defaultValue={req?.status || UpdateShowingRequestBodyStatus.not_requested}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UpdateShowingRequestBodyStatus.not_requested}>Not Requested</SelectItem>
                    <SelectItem value={UpdateShowingRequestBodyStatus.requested}>Requested</SelectItem>
                    <SelectItem value={UpdateShowingRequestBodyStatus.pending}>Pending</SelectItem>
                    <SelectItem value={UpdateShowingRequestBodyStatus.approved}>Approved</SelectItem>
                    <SelectItem value={UpdateShowingRequestBodyStatus.declined}>Declined</SelectItem>
                    <SelectItem value={UpdateShowingRequestBodyStatus.needs_follow_up}>Needs Follow-up</SelectItem>
                    <SelectItem value={UpdateShowingRequestBodyStatus.restricted}>Restricted</SelectItem>
                    <SelectItem value={UpdateShowingRequestBodyStatus.cancelled}>Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Window Start</Label>
                <Input name="requestedWindowStart" type="datetime-local" defaultValue={req?.requestedWindowStart?.slice(0, 16) || ""} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Window End</Label>
                <Input name="requestedWindowEnd" type="datetime-local" defaultValue={req?.requestedWindowEnd?.slice(0, 16) || ""} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Textarea name="notes" defaultValue={req?.notes || ""} placeholder="Additional notes about the showing request..." rows={2} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Showing Info
              </Button>
            </div>
          </form>

          <RestrictionNotes tourStopId={stop.id} />
        </div>
      )}
    </div>
  )
}

function RestrictionNotes({ tourStopId }: { tourStopId: string }) {
  const { data, refetch } = useGetRestrictionNote(tourStopId)
  const upsert = useUpsertRestrictionNote()
  const { toast } = useToast()
  const note = data?.restrictionNote

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await upsert.mutateAsync({
        stopId: tourStopId,
        data: {
          occupied: fd.get("occupied") === "on",
          tenantNoticeRequired: fd.get("tenantNoticeRequired") === "on",
          doNotUseBathroom: fd.get("doNotUseBathroom") === "on",
          removeShoes: fd.get("removeShoes") === "on",
          gateCode: (fd.get("gateCode") as string) || undefined,
          alarmInstructions: (fd.get("alarmInstructions") as string) || undefined,
          petInstructions: (fd.get("petInstructions") as string) || undefined,
          parkingInstructions: (fd.get("parkingInstructions") as string) || undefined,
          timeRestriction: (fd.get("timeRestriction") as string) || undefined,
          offerDeadlineNote: (fd.get("offerDeadlineNote") as string) || undefined,
          freeTextNotes: (fd.get("freeTextNotes") as string) || undefined,
        }
      })
      toast({ title: "Restriction notes saved" })
      refetch()
    } catch {
      toast({ title: "Failed to save restriction notes", variant: "destructive" })
    }
  }

  return (
    <Card className="border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/10 shadow-sm">
      <CardHeader className="pb-3 border-b border-amber-200/40">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4" />
          Property Restrictions & Access Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <CheckboxField name="occupied" label="Occupied" defaultChecked={note?.occupied ?? false} />
            <CheckboxField name="tenantNoticeRequired" label="Tenant Notice Required" defaultChecked={note?.tenantNoticeRequired ?? false} />
            <CheckboxField name="doNotUseBathroom" label="Do Not Use Bathroom" defaultChecked={note?.doNotUseBathroom ?? false} />
            <CheckboxField name="removeShoes" label="Remove Shoes" defaultChecked={note?.removeShoes ?? false} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gate Code</Label>
              <Input name="gateCode" defaultValue={note?.gateCode || ""} placeholder="#1234" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alarm Instructions</Label>
              <Input name="alarmInstructions" defaultValue={note?.alarmInstructions || ""} placeholder="Disarm: 1234, panel near garage" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pet Instructions</Label>
              <Input name="petInstructions" defaultValue={note?.petInstructions || ""} placeholder="Do not let dog out, 2 cats inside" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parking Instructions</Label>
              <Input name="parkingInstructions" defaultValue={note?.parkingInstructions || ""} placeholder="Street parking only on Elm St" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time Restrictions</Label>
              <Input name="timeRestriction" defaultValue={note?.timeRestriction || ""} placeholder="Mon–Sat 9am–6pm only" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offer Deadline</Label>
              <Input name="offerDeadlineNote" defaultValue={note?.offerDeadlineNote || ""} placeholder="Offers due Monday 5pm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Additional Notes</Label>
            <Textarea name="freeTextNotes" defaultValue={note?.freeTextNotes || ""} placeholder="Any other important details..." rows={2} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="outline" disabled={upsert.isPending} className="gap-2 border-amber-300 hover:bg-amber-50">
              {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Restrictions
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function CheckboxField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-background rounded-lg border border-border/50">
      <Checkbox id={name} name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <Label htmlFor={name} className="text-xs font-medium leading-snug cursor-pointer">{label}</Label>
    </div>
  )
}
