import { Router, type IRouter, type Request, type Response } from "express";
import type { Logger } from "pino";
import { randomUUID } from "crypto";
import multer from "multer";
import { eq, and } from "drizzle-orm";
import {
  db,
  debriefVoiceNotesTable,
  tourStopsTable,
  toursTable,
  propertiesTable,
  voiceNotesTable,
} from "@workspace/db";
import { idParams, parseParams } from "../lib/validate";
import { sendValidated, DebriefVoiceNoteResponseSchema, DebriefVoiceNoteNullableResponseSchema } from "../lib/responseSchemas";
import { ObjectStorageService } from "../lib/objectStorage";
import { transcribeAudio, generateText, isSpeechAiAvailable, isTextAiAvailable } from "../lib/ai";
import { aiConfig } from "../lib/aiConfig";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const storageService = new ObjectStorageService();
const stopIdSchema = z.object({ stopId: z.string().min(1) });

const router: IRouter = Router();

async function assertStopOwner(
  stopId: string,
  agentId: string,
  res: Response,
): Promise<{ stop: typeof tourStopsTable.$inferSelect; tour: typeof toursTable.$inferSelect } | null> {
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
  return { stop, tour };
}

async function runDebriefJob(debriefId: string, fileUrl: string, stopId: string, buyerId: string | null, log: Logger): Promise<void> {
  try {
    await db
      .update(debriefVoiceNotesTable)
      .set({ processingStatus: "transcribing", updatedAt: new Date() })
      .where(eq(debriefVoiceNotesTable.id, debriefId));

    const audioFile = await storageService.getObjectEntityFile(fileUrl);
    const [metadata] = await audioFile.getMetadata();
    const mimeType = (metadata as { contentType?: string }).contentType ?? "audio/webm";
    const [audioBuffer] = await audioFile.download();
    const transcriptResult = await transcribeAudio(audioBuffer, mimeType, aiConfig.transcriptionProvider);
    const transcript = transcriptResult.text;

    await db
      .update(debriefVoiceNotesTable)
      .set({ transcript, processingStatus: "scoring", updatedAt: new Date() })
      .where(eq(debriefVoiceNotesTable.id, debriefId));

    if (!isTextAiAvailable()) {
      await db
        .update(debriefVoiceNotesTable)
        .set({ processingStatus: "completed", updatedAt: new Date() })
        .where(eq(debriefVoiceNotesTable.id, debriefId));
      return;
    }

    const [stop] = await db.select().from(tourStopsTable).where(eq(tourStopsTable.id, stopId));
    const [property] = stop ? await db.select().from(propertiesTable).where(eq(propertiesTable.id, stop.propertyId)) : [];
    const voiceNotes = await db.select().from(voiceNotesTable).where(eq(voiceNotesTable.tourStopId, stopId));
    const otherNotes = voiceNotes.map((n) => n.typedNote).filter(Boolean).join("\n");

    const ratings = stop ? [
      stop.overallFitRating != null ? `Overall fit: ${stop.overallFitRating}/5` : null,
      stop.buyerInterest != null ? `Buyer interest: ${stop.buyerInterest}/5` : null,
      stop.kitchenRating != null ? `Kitchen: ${stop.kitchenRating}/5` : null,
      stop.primarySuiteRating != null ? `Primary suite: ${stop.primarySuiteRating}/5` : null,
      stop.backyardRating != null ? `Backyard: ${stop.backyardRating}/5` : null,
      stop.roadNoiseRating != null ? `Road noise: ${stop.roadNoiseRating}/5` : null,
    ].filter(Boolean).join(", ") : "";

    const scoringPrompt = `You are a real estate agent assistant analyzing a property showing debrief.

Property: ${property?.formattedAddress ?? "Unknown"}
${property?.beds ? `Beds: ${property.beds}, Baths: ${property.baths}` : ""}
${property?.squareFeet ? `Sq ft: ${property.squareFeet.toLocaleString()}` : ""}
${property?.listPrice ? `List price: $${property.listPrice.toLocaleString()}` : ""}
Ratings: ${ratings || "None recorded"}
Tags: ${stop?.quickTags?.join(", ") || "None"}
${otherNotes ? `Earlier notes: ${otherNotes}` : ""}

Post-showing debrief transcript:
"${transcript}"

Analyze this debrief and return a JSON object with exactly these keys:
- fitScore: integer 0-100 (overall property fit for this buyer based on all data above)
- aiSummary: 2-4 sentence overall assessment
- fitScorePositives: array of 1-4 specific positives about this property for this buyer (short phrases)
- fitScoreNegatives: array of 1-4 specific concerns (short phrases)
- fitScoreVerdict: one sentence verdict (e.g., "Strong contender — revisit before making an offer")

Return only valid JSON.`;

    const scoringResult = await generateText(scoringPrompt, aiConfig.summarizationProvider);
    let parsed: {
      fitScore?: number;
      aiSummary?: string;
      fitScorePositives?: string[];
      fitScoreNegatives?: string[];
      fitScoreVerdict?: string;
    } = {};
    try {
      const jsonMatch = scoringResult.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { aiSummary: scoringResult.text };
    }

    await db
      .update(debriefVoiceNotesTable)
      .set({
        transcript,
        aiSummary: parsed.aiSummary ?? null,
        fitScore: typeof parsed.fitScore === "number" ? Math.min(100, Math.max(0, parsed.fitScore)) : null,
        fitScorePositives: parsed.fitScorePositives ?? [],
        fitScoreNegatives: parsed.fitScoreNegatives ?? [],
        fitScoreVerdict: parsed.fitScoreVerdict ?? null,
        processingStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(debriefVoiceNotesTable.id, debriefId));
  } catch (err) {
    log.error({ err, debriefId }, "Background debrief job failed");
    await db
      .update(debriefVoiceNotesTable)
      .set({ processingStatus: "failed", updatedAt: new Date() })
      .where(eq(debriefVoiceNotesTable.id, debriefId))
      .catch(() => {});
  }
}

router.post(
  "/tour-stops/:stopId/debrief",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const params = parseParams(stopIdSchema, req, res);
    if (!params) return;
    const user = (req as Express.AuthedRequest).user;

    try {
      const result = await assertStopOwner(params.stopId, user.id, res);
      if (!result) return;
      const { stop, tour } = result;
      const buyerId = tour.buyerId ?? null;

      const existingDebrief = await db
        .select()
        .from(debriefVoiceNotesTable)
        .where(eq(debriefVoiceNotesTable.tourStopId, params.stopId));
      if (existingDebrief.length > 0) {
        sendValidated(res, DebriefVoiceNoteResponseSchema, { debrief: existingDebrief[0] });
        return;
      }

      if (!req.file) {
        const [debrief] = await db
          .insert(debriefVoiceNotesTable)
          .values({
            id: randomUUID(),
            tourStopId: params.stopId,
            buyerId,
            processingStatus: "completed",
          })
          .returning();
        sendValidated(res, DebriefVoiceNoteResponseSchema, { debrief }, 201);
        return;
      }

      const rawDuration = req.body?.durationSeconds;
      const durationSeconds = rawDuration !== undefined ? Number(rawDuration) : null;

      let fileUrl: string;
      try {
        const signedUrl = await storageService.getObjectEntityUploadURL();
        const uploadResponse = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": req.file.mimetype },
          body: req.file.buffer,
        });
        if (!uploadResponse.ok) {
          res.status(502).json({ error: "Failed to upload audio to object storage" });
          return;
        }
        fileUrl = storageService.normalizeObjectEntityPath(signedUrl);
      } catch (storageErr) {
        req.log.error({ storageErr }, "Object storage upload error");
        res.status(502).json({ error: "Failed to upload audio to object storage" });
        return;
      }

      const [debrief] = await db
        .insert(debriefVoiceNotesTable)
        .values({
          id: randomUUID(),
          tourStopId: params.stopId,
          buyerId,
          fileUrl,
          durationSeconds: durationSeconds !== null && !isNaN(durationSeconds) ? durationSeconds : null,
          processingStatus: isSpeechAiAvailable() ? "pending" : "failed",
        })
        .returning();

      if (!stop.visited) {
        await db
          .update(tourStopsTable)
          .set({ visited: true, updatedAt: new Date() })
          .where(eq(tourStopsTable.id, params.stopId));
      }

      if (isSpeechAiAvailable()) {
        setImmediate(() => {
          runDebriefJob(debrief.id, fileUrl, params.stopId, buyerId, req.log).catch(() => {});
        });
      }

      sendValidated(res, DebriefVoiceNoteResponseSchema, { debrief }, 201);
    } catch (err) {
      req.log.error({ err }, "Failed to upload debrief");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.get("/tour-stops/:stopId/debrief", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;

  try {
    const result = await assertStopOwner(params.stopId, user.id, res);
    if (!result) return;

    const [debrief] = await db
      .select()
      .from(debriefVoiceNotesTable)
      .where(eq(debriefVoiceNotesTable.tourStopId, params.stopId));

    sendValidated(res, DebriefVoiceNoteNullableResponseSchema, { debrief: debrief ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get debrief");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
