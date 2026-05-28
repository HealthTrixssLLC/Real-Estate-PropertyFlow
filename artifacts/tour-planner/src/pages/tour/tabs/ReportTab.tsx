import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { FileDown, FileText, Mail, MessageSquare, Loader2, ExternalLink, Sparkles, CheckCircle2, XCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

type Capabilities = {
  emailConfigured: boolean
  smsConfigured: boolean
  smsTwilioConfigured?: boolean
  publicBaseUrlConfigured?: boolean
  reportLinkSecretConfigured?: boolean
  objectStorageConfigured?: boolean
}

type ReportStop = {
  stop: { id: string; sequence?: number; status?: string; address?: string | null; formattedAddress?: string | null }
  property: { id: string; address?: string | null; formattedAddress?: string | null; price?: number | null; bedrooms?: number | null; bathrooms?: number | null; squareFeet?: number | null } | null
  propertySummary: { summaryText?: string | null; highlights?: string[] | null; concerns?: string[] | null } | null
  typedNotes: string[]
  debriefSummary: string | null
  debriefTranscript: string | null
  fitScore: number | null
  fitScoreVerdict: string | null
  fitScorePositives: string[] | null
  fitScoreNegatives: string[] | null
}

type ReportData = {
  tour: { id: string; title: string; date: string; status: string }
  buyer: { id?: string; name?: string; email?: string | null; phone?: string | null } | null
  agentName: string | null
  generatedAt: string
  stops: ReportStop[]
  tourSummary: { summaryText?: string | null; createdAt?: string | null } | null
  crossTourRollup: {
    totalCompletedTours: number
    recurringPositives?: string[] | null
    recurringConcerns?: string[] | null
    preferenceProfile?: string | null
  } | null
  hasBuyerEmail: boolean
  hasBuyerPhone: boolean
  emailConfigured: boolean
  smsConfigured: boolean
}

type Delivery = {
  id: string
  channel: "email" | "sms"
  recipient: string
  status: "pending" | "sent" | "failed"
  provider: string | null
  errorMessage: string | null
  sentAt: string | null
  createdAt: string
}

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res.json()
}

async function downloadBinary(url: string, filename: string) {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) {
    let msg = `Download failed (${res.status})`
    try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

export default function ReportTab({ tourId }: { tourId: string }) {
  const { toast } = useToast()
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingDocx, setDownloadingDocx] = useState(false)
  const [emailRecipient, setEmailRecipient] = useState("")
  const [smsRecipient, setSmsRecipient] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingSms, setSendingSms] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function loadAll() {
    setLoading(true)
    try {
      const [capsRes, dataRes, delRes] = await Promise.all([
        fetch("/api/tours/report/capabilities", { credentials: "include" }).then(jsonOrThrow),
        fetch(`/api/tours/${tourId}/report/data`, { credentials: "include" }).then(jsonOrThrow),
        fetch(`/api/tours/${tourId}/report/deliveries`, { credentials: "include" }).then(jsonOrThrow),
      ])
      setCaps(capsRes)
      setData(dataRes)
      setDeliveries(delRes.deliveries || [])
      setEmailRecipient(dataRes.buyer?.email || "")
      setSmsRecipient(dataRes.buyer?.phone || "")
    } catch (err) {
      toast({ title: "Could not load report", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function reloadDeliveries() {
    try {
      const delRes = await fetch(`/api/tours/${tourId}/report/deliveries`, { credentials: "include" }).then(jsonOrThrow)
      setDeliveries(delRes.deliveries || [])
    } catch { /* silent */ }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/tours/${tourId}/report/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Generate failed (${res.status})`)
      toast({
        title: "Report ready",
        description: `${json.stopsWithSummary ?? 0} of ${json.stopsTotal ?? 0} properties have summaries.`,
      })
      await loadAll()
    } catch (err) {
      toast({ title: "Could not generate report", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      await downloadBinary(`/api/tours/${tourId}/report.pdf`, `${data?.tour.title || "tour"}-report.pdf`)
    } catch (err) {
      toast({ title: "PDF download failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleDownloadDocx = async () => {
    setDownloadingDocx(true)
    try {
      await downloadBinary(`/api/tours/${tourId}/report.docx`, `${data?.tour.title || "tour"}-report.docx`)
    } catch (err) {
      toast({ title: "Word download failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
    } finally {
      setDownloadingDocx(false)
    }
  }

  const handleSendEmail = async () => {
    setSendingEmail(true)
    try {
      const res = await fetch(`/api/tours/${tourId}/report/email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: emailRecipient || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Email failed (${res.status})`)
      toast({ title: "Email sent", description: `Report sent to ${json.recipient}` })
      void reloadDeliveries()
    } catch (err) {
      toast({ title: "Email failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
      void reloadDeliveries()
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSendSms = async () => {
    setSendingSms(true)
    try {
      const res = await fetch(`/api/tours/${tourId}/report/sms`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: smsRecipient || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `SMS failed (${res.status})`)
      toast({ title: "SMS sent", description: `Link texted to ${json.recipient}` })
      void reloadDeliveries()
    } catch (err) {
      toast({ title: "SMS failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
      void reloadDeliveries()
    } finally {
      setSendingSms(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!data) {
    return <div className="p-12 text-center text-muted-foreground">Could not load report.</div>
  }

  const hasEmail = !!emailRecipient.trim()
  const hasPhone = !!smsRecipient.trim()
  const emailDisabled = !caps?.emailConfigured || sendingEmail || !hasEmail
  const smsDisabled = !caps?.smsConfigured || sendingSms || !hasPhone
  const emailDisabledReason = !caps?.emailConfigured
    ? "Email isn't configured (set SENDGRID_API_KEY)."
    : !hasEmail
      ? "Add a buyer email or type a recipient address."
      : ""
  const smsDisabledReason = !caps?.smsConfigured
    ? "SMS isn't configured."
    : !hasPhone
      ? "Add a buyer phone number or type a recipient."
      : ""

  return (
    <div className="p-6 space-y-6">
      {/* Top action card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Tour Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download a professionally formatted PDF or Word document of this tour, or send it directly to{" "}
            <span className="font-medium text-foreground">{data.buyer?.name || "the buyer"}</span>.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Report
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf} className="gap-2">
              {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Download PDF
            </Button>
            <Button variant="outline" onClick={handleDownloadDocx} disabled={downloadingDocx} className="gap-2">
              {downloadingDocx ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Download Word
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            "Generate Report" auto-creates AI summaries for any visited property that doesn't have one yet, then refreshes the preview below.
          </p>
        </CardContent>
      </Card>

      {/* AI Tour Summary */}
      {data.tourSummary?.summaryText && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Tour Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-foreground/90">{data.tourSummary.summaryText}</p>
          </CardContent>
        </Card>
      )}

      {/* Cross-tour preference rollup */}
      {data.crossTourRollup && data.crossTourRollup.totalCompletedTours >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Buyer Preferences (across {data.crossTourRollup.totalCompletedTours} tours)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data.crossTourRollup.recurringPositives?.length ?? 0) > 0 && (
              <div>
                <div className="font-medium text-foreground mb-1">Consistently loves</div>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  {data.crossTourRollup.recurringPositives!.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {(data.crossTourRollup.recurringConcerns?.length ?? 0) > 0 && (
              <div>
                <div className="font-medium text-foreground mb-1">Recurring concerns</div>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  {data.crossTourRollup.recurringConcerns!.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {data.crossTourRollup.preferenceProfile && (
              <div>
                <div className="font-medium text-foreground mb-1">Preference profile</div>
                <p className="text-muted-foreground whitespace-pre-wrap">{data.crossTourRollup.preferenceProfile}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Per-stop preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Properties Visited ({data.stops.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.stops.map((s, i) => (
            <div key={s.stop.id} className="border-l-2 border-primary/30 pl-4 py-2">
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm">
                  Stop {i + 1}: {s.property?.formattedAddress || s.property?.address || s.stop.formattedAddress || s.stop.address || "—"}
                </div>
                {s.fitScore != null && (
                  <Badge variant="outline" className="text-xs">
                    Fit: {s.fitScore}/100{s.fitScoreVerdict ? ` • ${s.fitScoreVerdict}` : ""}
                  </Badge>
                )}
              </div>
              {s.debriefSummary && (
                <p className="text-xs text-muted-foreground line-clamp-3">{s.debriefSummary}</p>
              )}
            </div>
          ))}
          {data.stops.length === 0 && (
            <p className="text-sm text-muted-foreground">No stops on this tour.</p>
          )}
        </CardContent>
      </Card>

      {/* Email delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            Email PDF to Buyer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!caps?.emailConfigured && (
            <div className="text-xs rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-3 py-2">
              Email isn't configured. Set <code>SENDGRID_API_KEY</code> and <code>SENDGRID_FROM_EMAIL</code> to enable.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email-recipient">Recipient email</Label>
            <Input
              id="email-recipient"
              type="email"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              placeholder={data.buyer?.email || "buyer@example.com"}
            />
          </div>
          <Button onClick={handleSendEmail} disabled={emailDisabled} className="gap-2" title={emailDisabledReason || undefined}>
            {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send Email
          </Button>
          {emailDisabled && emailDisabledReason && (
            <p className="text-xs text-muted-foreground">{emailDisabledReason}</p>
          )}
        </CardContent>
      </Card>

      {/* SMS delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            Text Download Link to Buyer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!caps?.smsConfigured && (
            <div className="text-xs rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-3 py-2 space-y-1">
              <div>SMS isn't ready. To enable, set:</div>
              <ul className="list-disc list-inside">
                {!caps?.smsTwilioConfigured && <li><code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_FROM_NUMBER</code></li>}
                {!caps?.objectStorageConfigured && !caps?.publicBaseUrlConfigured && <li>Object Storage (preferred) or <code>PUBLIC_APP_URL</code></li>}
                {!caps?.objectStorageConfigured && !caps?.reportLinkSecretConfigured && <li><code>REPORT_LINK_SECRET</code> (only needed if not using Object Storage)</li>}
              </ul>
            </div>
          )}
          {caps?.smsConfigured && caps?.objectStorageConfigured && (
            <p className="text-xs text-muted-foreground">
              Uses a signed Object Storage download URL (no public app route needed).
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="sms-recipient">Recipient phone (E.164, e.g. +15551234567)</Label>
            <Input
              id="sms-recipient"
              type="tel"
              value={smsRecipient}
              onChange={(e) => setSmsRecipient(e.target.value)}
              placeholder={data.buyer?.phone || "+15551234567"}
            />
          </div>
          <Button onClick={handleSendSms} disabled={smsDisabled} className="gap-2" title={smsDisabledReason || undefined}>
            {sendingSms ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            Text Link
          </Button>
          {smsDisabled && smsDisabledReason && (
            <p className="text-xs text-muted-foreground">{smsDisabledReason}</p>
          )}
          <p className="text-xs text-muted-foreground">Link is signed and expires after 7 days.</p>
        </CardContent>
      </Card>

      {/* Recent deliveries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries yet.</p>
          ) : (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 text-sm border border-border/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {d.channel === "email" ? <Mail className="h-4 w-4 text-muted-foreground shrink-0" /> : <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{d.recipient}</div>
                      {d.errorMessage && <div className="text-xs text-destructive truncate">{d.errorMessage}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={d.status} />
                    <span className="text-xs text-muted-foreground">{new Date(d.sentAt || d.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground text-right">
        Generated {new Date(data.generatedAt).toLocaleString()}
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: Delivery["status"] }) {
  const map = {
    sent: { icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900", label: "Sent" },
    pending: { icon: Clock, cls: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900", label: "Pending" },
    failed: { icon: XCircle, cls: "text-destructive bg-destructive/10 border-destructive/30", label: "Failed" },
  } as const
  const { icon: Icon, cls, label } = map[status]
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}

// Silence unused-import lint (ExternalLink reserved for future use)
void ExternalLink
