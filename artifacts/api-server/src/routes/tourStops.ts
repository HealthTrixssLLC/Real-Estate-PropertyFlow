import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import {
  db,
  tourStopsTable,
  toursTable,
  propertiesTable,
  showingRequestsTable,
  restrictionNotesTable,
  voiceNotesTable,
  propertySummariesTable,
} from "@workspace/db";
import { UpdateTourStopBody, AddStopNoteBody } from "@workspace/api-zod";
import { parseParams, parseBody } from "../lib/validate";
import { z } from "zod";
import { generateText } from "../lib/ai";
import { aiConfig } from "../lib/aiConfig";

const stopIdSchema = z.object({ stopId: z.string().min(1) });

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

router.get("/tour-stops/:stopId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const stop = await assertStopOwner(params.stopId, user.id, res);
    if (!stop) return;

    const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, stop.propertyId));
    const [showingRequest] = await db
      .select()
      .from(showingRequestsTable)
      .where(eq(showingRequestsTable.tourStopId, params.stopId));
    const [restrictionNote] = await db
      .select()
      .from(restrictionNotesTable)
      .where(eq(restrictionNotesTable.tourStopId, params.stopId));
    const voiceNotes = await db
      .select()
      .from(voiceNotesTable)
      .where(eq(voiceNotesTable.tourStopId, params.stopId));
    const [propertySummary] = await db
      .select()
      .from(propertySummariesTable)
      .where(eq(propertySummariesTable.tourStopId, params.stopId));

    res.json({
      stop,
      property: property ?? null,
      showingRequest: showingRequest ?? null,
      restrictionNote: restrictionNote ?? null,
      voiceNotes,
      propertySummary: propertySummary ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get tour stop");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/tour-stops/:stopId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(UpdateTourStopBody, req, res);
  if (!body) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const existing = await assertStopOwner(params.stopId, user.id, res);
    if (!existing) return;

    const [stop] = await db
      .update(tourStopsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(tourStopsTable.id, params.stopId))
      .returning();
    res.json({ stop });
  } catch (err) {
    req.log.error({ err }, "Failed to update tour stop");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tour-stops/:stopId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const stop = await assertStopOwner(params.stopId, user.id, res);
    if (!stop) return;
    await db.delete(tourStopsTable).where(eq(tourStopsTable.id, params.stopId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete tour stop");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tour-stops/:stopId/arrive", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const existing = await assertStopOwner(params.stopId, user.id, res);
    if (!existing) return;

    const [stop] = await db
      .update(tourStopsTable)
      .set({ arrivalTime: new Date(), visited: true, updatedAt: new Date() })
      .where(eq(tourStopsTable.id, params.stopId))
      .returning();
    res.json({ stop });
  } catch (err) {
    req.log.error({ err }, "Failed to mark stop as arrived");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tour-stops/:stopId/complete", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const existing = await assertStopOwner(params.stopId, user.id, res);
    if (!existing) return;

    const [stop] = await db
      .update(tourStopsTable)
      .set({ departureTime: new Date(), visited: true, updatedAt: new Date() })
      .where(eq(tourStopsTable.id, params.stopId))
      .returning();
    res.json({ stop });
  } catch (err) {
    req.log.error({ err }, "Failed to mark stop as completed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tour-stops/:stopId/note", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(AddStopNoteBody, req, res);
  if (!body) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const existing = await assertStopOwner(params.stopId, user.id, res);
    if (!existing) return;

    const typedNote = body.note;
    const existingNotes = await db
      .select()
      .from(voiceNotesTable)
      .where(and(eq(voiceNotesTable.tourStopId, params.stopId), eq(voiceNotesTable.fileUrl, "")));

    if (existingNotes.length > 0) {
      await db
        .update(voiceNotesTable)
        .set({ typedNote, updatedAt: new Date() })
        .where(eq(voiceNotesTable.id, existingNotes[0].id));
    } else {
      await db.insert(voiceNotesTable).values({
        id: randomUUID(),
        tourStopId: params.stopId,
        fileUrl: "",
        transcriptionStatus: "completed",
        typedNote,
      });
    }

    const [stop] = await db.select().from(tourStopsTable).where(eq(tourStopsTable.id, params.stopId));
    res.json({ stop });
  } catch (err) {
    req.log.error({ err }, "Failed to add stop note");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tour-stops/:stopId/summarize", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const stop = await assertStopOwner(params.stopId, user.id, res);
    if (!stop) return;

    const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, stop.propertyId));
    const voiceNotes = await db.select().from(voiceNotesTable).where(eq(voiceNotesTable.tourStopId, params.stopId));
    const notes = voiceNotes.map(n => n.typedNote).filter(Boolean).join("\n");

    const ratings = [
      stop.overallFitRating != null ? `Overall fit: ${stop.overallFitRating}/5` : null,
      stop.buyerInterest != null ? `Buyer interest: ${stop.buyerInterest}/5` : null,
      stop.kitchenRating != null ? `Kitchen: ${stop.kitchenRating}/5` : null,
      stop.primarySuiteRating != null ? `Primary suite: ${stop.primarySuiteRating}/5` : null,
      stop.backyardRating != null ? `Backyard: ${stop.backyardRating}/5` : null,
      stop.roadNoiseRating != null ? `Road noise: ${stop.roadNoiseRating}/5` : null,
    ].filter(Boolean).join(", ");

    const prompt = `You are a real estate agent assistant analyzing a property showing.

Property: ${property?.formattedAddress ?? "Unknown address"}
Ratings: ${ratings || "None recorded"}
${property?.beds ? `Beds: ${property.beds}, Baths: ${property.baths}, Sq Ft: ${property.squareFeet}` : ""}
${property?.listPrice ? `List Price: $${property.listPrice.toLocaleString()}` : ""}
Notes from showing: ${notes || "None recorded"}
Tags: ${stop.quickTags?.join(", ") || "None"}
Follow-up flag: ${stop.followUpFlag ? "Yes" : "No"}
Revisit flag: ${stop.revisitFlag ? "Yes" : "No"}

Generate a concise property summary with:
1. summaryText: 2-3 sentence overview
2. positives: list of pros (max 5)
3. negatives: list of cons (max 5)
4. questions: follow-up questions for listing agent (max 3)

Return as JSON with those exact keys.`;

    const result = await generateText(prompt, aiConfig.summarizationProvider);

    let parsed: { summaryText?: string; positives?: string[]; negatives?: string[]; questions?: string[] } = {};
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { summaryText: result.text };
    }

    await db.delete(propertySummariesTable).where(eq(propertySummariesTable.tourStopId, params.stopId));
    const [summary] = await db
      .insert(propertySummariesTable)
      .values({
        id: randomUUID(),
        tourStopId: params.stopId,
        summaryText: parsed.summaryText ?? result.text,
        positives: parsed.positives ?? [],
        negatives: parsed.negatives ?? [],
        questions: parsed.questions ?? [],
        provider: result.provider,
        generatedAt: new Date(),
      })
      .returning();

    res.json({ summary });
  } catch (err) {
    req.log.error({ err }, "Failed to summarize property");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
