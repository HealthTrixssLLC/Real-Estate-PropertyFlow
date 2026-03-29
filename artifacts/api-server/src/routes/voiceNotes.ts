import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import multer from "multer";
import { eq } from "drizzle-orm";
import {
  db,
  voiceNotesTable,
  transcriptsTable,
  tourStopsTable,
  toursTable,
} from "@workspace/db";
import { idParams, parseParams } from "../lib/validate";
import { ObjectStorageService } from "../lib/objectStorage";
import { transcribeAudio, isSpeechAiAvailable } from "../lib/ai";
import { aiConfig } from "../lib/aiConfig";

const upload = multer({ storage: multer.memoryStorage() });
const storageService = new ObjectStorageService();

const router: IRouter = Router();

async function assertStopOwner(
  stopId: string,
  agentId: string,
  res: Response,
): Promise<typeof tourStopsTable.$inferSelect | null> {
  const [stop] = await db.select().from(tourStopsTable).where(eq(tourStopsTable.id, stopId));
  if (!stop) {
    res.status(404).json({ error: "Stop not found" });
    return null;
  }
  const [tour] = await db.select().from(toursTable).where(eq(toursTable.id, stop.tourId));
  if (!tour || tour.agentId !== agentId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return stop;
}

async function assertVoiceNoteOwner(
  voiceNoteId: string,
  agentId: string,
  res: Response,
): Promise<typeof voiceNotesTable.$inferSelect | null> {
  const [voiceNote] = await db.select().from(voiceNotesTable).where(eq(voiceNotesTable.id, voiceNoteId));
  if (!voiceNote) {
    res.status(404).json({ error: "Voice note not found" });
    return null;
  }
  const owned = await assertStopOwner(voiceNote.tourStopId, agentId, res);
  return owned ? voiceNote : null;
}

router.post(
  "/voice-notes/upload",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const tourStopId = req.body?.tourStopId as string | undefined;
    if (!tourStopId) {
      res.status(400).json({ error: "tourStopId is required" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "audio file is required" });
      return;
    }

    const rawDuration = req.body?.durationSeconds;
    const durationSeconds = rawDuration !== undefined ? Number(rawDuration) : null;
    const user = (req as Express.AuthedRequest).user;

    try {
      const stop = await assertStopOwner(tourStopId, user.id, res);
      if (!stop) return;

      let fileUrl = "";
      try {
        const signedUrl = await storageService.getObjectEntityUploadURL();
        const uploadResponse = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": req.file.mimetype },
          body: req.file.buffer,
        });
        if (uploadResponse.ok) {
          fileUrl = storageService.normalizeObjectEntityPath(signedUrl);
        }
      } catch (storageErr) {
        req.log.warn({ storageErr }, "Object storage upload failed, continuing with empty fileUrl");
      }

      const [voiceNote] = await db
        .insert(voiceNotesTable)
        .values({
          id: randomUUID(),
          tourStopId,
          fileUrl,
          durationSeconds:
            durationSeconds !== null && !isNaN(durationSeconds) ? durationSeconds : null,
          transcriptionStatus: "pending",
          typedNote: null,
        })
        .returning();

      res.status(201).json({ voiceNote });
    } catch (err) {
      req.log.error({ err }, "Failed to upload voice note");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post("/voice-notes/:voiceNoteId/transcribe", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.voiceNoteId, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const voiceNote = await assertVoiceNoteOwner(params.voiceNoteId, user.id, res);
    if (!voiceNote) return;

    if (voiceNote.transcriptionStatus === "completed") {
      res.json({ voiceNote });
      return;
    }

    await db
      .update(voiceNotesTable)
      .set({ transcriptionStatus: "in_progress", updatedAt: new Date() })
      .where(eq(voiceNotesTable.id, params.voiceNoteId));

    if (!isSpeechAiAvailable() || !voiceNote.fileUrl) {
      const [updated] = await db
        .update(voiceNotesTable)
        .set({ transcriptionStatus: "failed", updatedAt: new Date() })
        .where(eq(voiceNotesTable.id, params.voiceNoteId))
        .returning();
      res.json({ voiceNote: updated });
      return;
    }

    try {
      const audioFile = await storageService.getObjectEntityFile(voiceNote.fileUrl);
      const [metadata] = await audioFile.getMetadata();
      const mimeType = (metadata as { contentType?: string }).contentType ?? "audio/webm";
      const [audioBuffer] = await audioFile.download();
      const result = await transcribeAudio(audioBuffer, mimeType, aiConfig.transcriptionProvider);

      await db.insert(transcriptsTable).values({
        id: randomUUID(),
        voiceNoteId: params.voiceNoteId,
        text: result.text,
        provider: result.provider,
        confidence: result.confidence ?? null,
      });

      const [updated] = await db
        .update(voiceNotesTable)
        .set({ transcriptionStatus: "completed", typedNote: result.text, updatedAt: new Date() })
        .where(eq(voiceNotesTable.id, params.voiceNoteId))
        .returning();

      res.json({ voiceNote: updated });
    } catch (transcribeErr) {
      req.log.error({ transcribeErr }, "Transcription failed");
      const [updated] = await db
        .update(voiceNotesTable)
        .set({ transcriptionStatus: "failed", updatedAt: new Date() })
        .where(eq(voiceNotesTable.id, params.voiceNoteId))
        .returning();
      res.json({ voiceNote: updated });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to transcribe voice note");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/voice-notes/:voiceNoteId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.voiceNoteId, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const voiceNote = await assertVoiceNoteOwner(params.voiceNoteId, user.id, res);
    if (!voiceNote) return;

    const [transcript] = await db
      .select()
      .from(transcriptsTable)
      .where(eq(transcriptsTable.voiceNoteId, params.voiceNoteId));
    res.json({ voiceNote, transcript: transcript ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get voice note");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
