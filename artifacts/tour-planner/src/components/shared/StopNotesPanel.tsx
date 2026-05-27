import { useState, useCallback } from "react"
import {
  useGetTourStop,
  useGetVoiceNote,
  useAddStopNote,
  getGetTourStopQueryKey,
  getGetVoiceNoteQueryKey,
} from "@workspace/api-client-react"
import type { VoiceNote } from "@workspace/api-client-react"
import { Loader2, Mic2, FileText, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { WebVoiceRecorder } from "./WebVoiceRecorder"

interface StopNotesPanelProps {
  stopId: string
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(dateStr).toLocaleDateString()
}

function VoiceNoteItem({ voiceNoteId }: { voiceNoteId: string }) {
  const { data, isLoading } = useGetVoiceNote(voiceNoteId, {
    query: {
      queryKey: getGetVoiceNoteQueryKey(voiceNoteId),
      refetchInterval: (query) => {
        const status = query.state.data?.voiceNote?.transcriptionStatus
        return status === "pending" || status === "in_progress" ? 2500 : false
      },
    },
  })

  const vn = data?.voiceNote
  const transcript = data?.transcript

  if (isLoading || !vn) {
    return (
      <div className="space-y-1.5 py-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }

  const status = vn.transcriptionStatus
  const isPending = status === "pending" || status === "in_progress"
  const isFailed = status === "failed"
  const isTyped = !vn.fileUrl

  return (
    <div className="py-3 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {isTyped ? (
          <FileText className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Mic2 className="h-3.5 w-3.5 shrink-0" />
        )}
        <span>{isTyped ? "Text note" : "Voice note"}</span>
        {vn.durationSeconds != null && (
          <span className="text-muted-foreground/60">· {formatDuration(vn.durationSeconds)}</span>
        )}
        <span className="ml-auto">{formatRelativeTime(vn.createdAt)}</span>
      </div>

      {isTyped && vn.typedNote ? (
        <p className="text-sm text-foreground leading-relaxed">{vn.typedNote}</p>
      ) : isPending ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {status === "in_progress" ? "Transcribing…" : "Transcription queued…"}
        </div>
      ) : isFailed ? (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          Transcription failed
        </div>
      ) : transcript?.text ? (
        <p className="text-sm text-foreground leading-relaxed">{transcript.text}</p>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3" />
          Recording saved
        </div>
      )}
    </div>
  )
}

export function StopNotesPanel({ stopId }: StopNotesPanelProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading, refetch, isRefetching } = useGetTourStop(stopId)
  const addNote = useAddStopNote()

  const [noteText, setNoteText] = useState("")
  const [localVoiceNoteIds, setLocalVoiceNoteIds] = useState<string[]>([])

  const voiceNotes = data?.voiceNotes ?? []

  const allNoteIds = [
    ...voiceNotes.map((vn: VoiceNote) => vn.id),
    ...localVoiceNoteIds.filter((id) => !voiceNotes.find((vn: VoiceNote) => vn.id === id)),
  ]

  const handleRecordingUploaded = useCallback(
    (voiceNoteId: string) => {
      setLocalVoiceNoteIds((prev) => [...prev, voiceNoteId])
      queryClient.invalidateQueries({ queryKey: getGetTourStopQueryKey(stopId) })
    },
    [stopId, queryClient]
  )

  const handleAddNote = useCallback(async () => {
    const text = noteText.trim()
    if (!text) return
    try {
      await addNote.mutateAsync({ stopId, data: { note: text } })
      setNoteText("")
      queryClient.invalidateQueries({ queryKey: getGetTourStopQueryKey(stopId) })
    } catch {
      toast({ title: "Failed to save note", variant: "destructive" })
    }
  }, [noteText, stopId, addNote, queryClient, toast])

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      {/* Existing notes */}
      {allNoteIds.length > 0 && (
        <div className="space-y-0">
          <div className="flex items-center justify-between mb-1">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {allNoteIds.length} note{allNoteIds.length !== 1 ? "s" : ""}
            </h5>
            <button
              type="button"
              onClick={() => refetch()}
              className={cn(
                "p-1 rounded text-muted-foreground hover:text-foreground transition-colors",
                isRefetching && "animate-spin"
              )}
              aria-label="Refresh notes"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-border/50 rounded-lg border border-border/50 bg-muted/20 px-3">
            {allNoteIds.map((id) => (
              <VoiceNoteItem key={id} voiceNoteId={id} />
            ))}
          </div>
        </div>
      )}

      {/* Add text note */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Text note
        </label>
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a note about this stop…"
            rows={2}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote()
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={!noteText.trim() || addNote.isPending}
            onClick={handleAddNote}
            className="self-end shrink-0"
          >
            {addNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      {/* Voice recorder */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Mic2 className="h-3.5 w-3.5" /> Voice note
        </label>
        <WebVoiceRecorder stopId={stopId} onUploaded={handleRecordingUploaded} />
        <p className="text-xs text-muted-foreground/70">
          Recording is transcribed automatically by AI
        </p>
      </div>
    </div>
  )
}
