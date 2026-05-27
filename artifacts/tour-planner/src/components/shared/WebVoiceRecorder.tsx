import { useState, useRef, useCallback } from "react"
import { useUploadVoiceNote } from "@workspace/api-client-react"
import { Mic, Square, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface WebVoiceRecorderProps {
  stopId: string
  onUploaded: (voiceNoteId: string) => void
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "",
  ]
  return candidates.find((m) => !m || MediaRecorder.isTypeSupported(m)) ?? ""
}

export function WebVoiceRecorder({ stopId, onUploaded }: WebVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const mimeTypeRef = useRef<string>("")

  const upload = useUploadVoiceNote()

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    setPermissionError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickMimeType()
      mimeTypeRef.current = mimeType

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)
        const mt = mimeTypeRef.current
        const blob = new Blob(chunksRef.current, { type: mt || "audio/webm" })
        const ext = mt.includes("ogg") ? "ogg" : mt.includes("mp4") ? "mp4" : "webm"
        const file = new File([blob], `recording.${ext}`, { type: mt || "audio/webm" })

        setIsUploading(true)
        try {
          const res = await upload.mutateAsync({
            data: { tourStopId: stopId, audio: file, durationSeconds },
          })
          onUploaded(res.voiceNote.id)
        } finally {
          setIsUploading(false)
        }
      }

      mediaRecorderRef.current = mr
      startTimeRef.current = Date.now()
      mr.start(250)
      setElapsed(0)
      setIsRecording(true)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setPermissionError("Microphone access denied. Allow microphone access in your browser and try again.")
      } else {
        setPermissionError("Could not access microphone. Check your browser settings.")
      }
    }
  }, [stopId, upload, onUploaded])

  const stopRecording = useCallback(() => {
    stopTimer()
    setIsRecording(false)
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }, [stopTimer])

  if (isUploading) {
    return (
      <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Uploading &amp; queuing transcription…
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {permissionError && (
        <p className="text-xs text-destructive">{permissionError}</p>
      )}
      <Button
        type="button"
        size="sm"
        variant={isRecording ? "destructive" : "outline"}
        className={cn("gap-2 min-w-[160px]", isRecording && "ring-2 ring-destructive/30")}
        onClick={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? (
          <>
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop · {formatTime(elapsed)}
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5" />
            Record audio note
          </>
        )}
      </Button>
    </div>
  )
}
