import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  buyersTable,
  toursTable,
  tourStopsTable,
  propertiesTable,
  showingRequestsTable,
  voiceNotesTable,
  debriefVoiceNotesTable,
} from "@workspace/db";
import { CreateBuyerBody, UpdateBuyerBody } from "@workspace/api-zod";
import { idParams, parseParams, parseBody } from "../lib/validate";
import {
  sendValidated,
  BuyerResponseSchema,
  BuyerListResponseSchema,
  BuyerDetailResponseSchema,
  PreferenceProfileResponseSchema,
} from "../lib/responseSchemas";
import { generateText, isTextAiAvailable } from "../lib/ai";
import { aiConfig } from "../lib/aiConfig";

const router: IRouter = Router();

router.get("/buyers", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  try {
    const buyers = await db
      .select()
      .from(buyersTable)
      .where(eq(buyersTable.agentId, user.id))
      .orderBy(buyersTable.createdAt);
    sendValidated(res, BuyerListResponseSchema, { buyers });
  } catch (err) {
    req.log.error({ err }, "Failed to list buyers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/buyers", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const body = parseBody(CreateBuyerBody, req, res);
  if (!body) return;
  try {
    const [buyer] = await db
      .insert(buyersTable)
      .values({ id: randomUUID(), agentId: user.id, ...body })
      .returning();
    sendValidated(res, BuyerResponseSchema, { buyer }, 201);
  } catch (err) {
    req.log.error({ err }, "Failed to create buyer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/buyers/:buyerId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  try {
    const [buyer] = await db
      .select()
      .from(buyersTable)
      .where(and(eq(buyersTable.id, params.buyerId), eq(buyersTable.agentId, user.id)));
    if (!buyer) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }
    sendValidated(res, BuyerResponseSchema, { buyer });
  } catch (err) {
    req.log.error({ err }, "Failed to get buyer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/buyers/:buyerId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  const body = parseBody(UpdateBuyerBody, req, res);
  if (!body) return;
  try {
    const [existing] = await db
      .select({ id: buyersTable.id })
      .from(buyersTable)
      .where(and(eq(buyersTable.id, params.buyerId), eq(buyersTable.agentId, user.id)));
    if (!existing) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }
    const [buyer] = await db
      .update(buyersTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(buyersTable.id, params.buyerId))
      .returning();
    sendValidated(res, BuyerResponseSchema, { buyer });
  } catch (err) {
    req.log.error({ err }, "Failed to update buyer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/buyers/:buyerId/detail", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  try {
    const [buyer] = await db
      .select()
      .from(buyersTable)
      .where(and(eq(buyersTable.id, params.buyerId), eq(buyersTable.agentId, user.id)));
    if (!buyer) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }

    const tours = await db
      .select()
      .from(toursTable)
      .where(and(eq(toursTable.buyerId, params.buyerId), eq(toursTable.agentId, user.id)))
      .orderBy(toursTable.date);

    const tourDetails = await Promise.all(
      tours.map(async (tour) => {
        const stops = await db
          .select()
          .from(tourStopsTable)
          .where(eq(tourStopsTable.tourId, tour.id))
          .orderBy(tourStopsTable.sequence);

        const stopsWithData = await Promise.all(
          stops.map(async (stop) => {
            const [property] = await db
              .select()
              .from(propertiesTable)
              .where(eq(propertiesTable.id, stop.propertyId));

            const [showingReq] = await db
              .select()
              .from(showingRequestsTable)
              .where(eq(showingRequestsTable.tourStopId, stop.id));

            const voiceNotes = await db
              .select()
              .from(voiceNotesTable)
              .where(eq(voiceNotesTable.tourStopId, stop.id))
              .orderBy(voiceNotesTable.createdAt);

            const [debrief] = await db
              .select()
              .from(debriefVoiceNotesTable)
              .where(eq(debriefVoiceNotesTable.tourStopId, stop.id));

            const comments = voiceNotes
              .filter((vn) => {
                if (vn.fileUrl && vn.fileUrl !== "") {
                  return vn.transcriptionStatus === "completed" && vn.typedNote;
                }
                return !!vn.typedNote;
              })
              .map((vn) => ({
                id: vn.id,
                text: vn.typedNote ?? "",
                isVoiceNote: !!(vn.fileUrl && vn.fileUrl !== ""),
                transcriptionStatus: vn.transcriptionStatus,
                createdAt: vn.createdAt,
              }));

            return {
              id: stop.id,
              tourId: stop.tourId,
              propertyId: stop.propertyId,
              sequence: stop.sequence,
              formattedAddress: property?.formattedAddress ?? "",
              propertyNickname: property?.nickname ?? null,
              listPrice: property?.listPrice ?? null,
              beds: property?.beds ?? null,
              baths: property?.baths ?? null,
              squareFeet: property?.squareFeet ?? null,
              approvedStatus: stop.approvedStatus,
              showingStatus: showingReq?.status ?? null,
              skipped: stop.skipped,
              skipReason: stop.skipReason ?? null,
              skipNotes: stop.skipNotes ?? null,
              visited: stop.visited,
              arrivalTime: stop.arrivalTime ?? null,
              departureTime: stop.departureTime ?? null,
              overallFitRating: stop.overallFitRating ?? null,
              buyerInterest: stop.buyerInterest ?? null,
              kitchenRating: stop.kitchenRating ?? null,
              primarySuiteRating: stop.primarySuiteRating ?? null,
              backyardRating: stop.backyardRating ?? null,
              roadNoiseRating: stop.roadNoiseRating ?? null,
              followUpFlag: stop.followUpFlag,
              revisitFlag: stop.revisitFlag,
              quickTags: stop.quickTags ?? null,
              predictedFitScore: stop.predictedFitScore ?? null,
              fitScore: debrief?.fitScore ?? null,
              fitScorePositives: debrief?.fitScorePositives ?? null,
              fitScoreNegatives: debrief?.fitScoreNegatives ?? null,
              fitScoreVerdict: debrief?.fitScoreVerdict ?? null,
              debriefTranscript: debrief?.transcript ?? null,
              debriefSummary: debrief?.aiSummary ?? null,
              debriefStatus: debrief?.processingStatus ?? null,
              comments,
              createdAt: stop.createdAt,
              updatedAt: stop.updatedAt,
            };
          })
        );

        return {
          id: tour.id,
          title: tour.title ?? "",
          date: tour.date ?? "",
          status: tour.status,
          stops: stopsWithData,
          createdAt: tour.createdAt,
          updatedAt: tour.updatedAt,
        };
      })
    );

    let preferenceProfile: Record<string, unknown> | null = null;
    if (buyer.preferenceProfile) {
      try {
        preferenceProfile = JSON.parse(buyer.preferenceProfile) as Record<string, unknown>;
      } catch {
        preferenceProfile = null;
      }
    }

    sendValidated(res, BuyerDetailResponseSchema, { buyer, tours: tourDetails, preferenceProfile });
  } catch (err) {
    req.log.error({ err }, "Failed to get buyer detail");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/buyers/:buyerId/preference-profile", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;

  if (!isTextAiAvailable()) {
    res.status(503).json({ error: "AI text provider not configured" });
    return;
  }

  try {
    const [buyer] = await db
      .select()
      .from(buyersTable)
      .where(and(eq(buyersTable.id, params.buyerId), eq(buyersTable.agentId, user.id)));
    if (!buyer) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }

    const tours = await db
      .select()
      .from(toursTable)
      .where(and(eq(toursTable.buyerId, params.buyerId), eq(toursTable.agentId, user.id)));

    const allStopData: Array<{
      stopId: string;
      address: string;
      ratings: string;
      tags: string[];
      debrief: string;
      fitScore: number | null;
      visited: boolean;
      property: typeof propertiesTable.$inferSelect | null;
    }> = [];

    for (const tour of tours) {
      const stops = await db
        .select()
        .from(tourStopsTable)
        .where(eq(tourStopsTable.tourId, tour.id));

      for (const stop of stops) {
        const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, stop.propertyId));
        const [debrief] = await db.select().from(debriefVoiceNotesTable).where(eq(debriefVoiceNotesTable.tourStopId, stop.id));

        const ratings = [
          stop.overallFitRating != null ? `Overall fit: ${stop.overallFitRating}/5` : null,
          stop.buyerInterest != null ? `Buyer interest: ${stop.buyerInterest}/5` : null,
          stop.kitchenRating != null ? `Kitchen: ${stop.kitchenRating}/5` : null,
          stop.primarySuiteRating != null ? `Primary suite: ${stop.primarySuiteRating}/5` : null,
          stop.backyardRating != null ? `Backyard: ${stop.backyardRating}/5` : null,
          stop.roadNoiseRating != null ? `Road noise: ${stop.roadNoiseRating}/5` : null,
        ].filter(Boolean).join(", ");

        allStopData.push({
          stopId: stop.id,
          address: property?.formattedAddress ?? "Unknown",
          ratings,
          tags: stop.quickTags ?? [],
          debrief: debrief?.transcript ?? debrief?.aiSummary ?? "",
          fitScore: debrief?.fitScore ?? null,
          visited: stop.visited,
          property: property ?? null,
        });
      }
    }

    const visitedData = allStopData.filter((s) => s.visited);
    if (visitedData.length === 0) {
      res.status(400).json({ error: "No visited stops with data to analyze" });
      return;
    }

    const stopsText = visitedData
      .map((s, i) =>
        `Property ${i + 1}: ${s.address}\n` +
        `  Ratings: ${s.ratings || "none"}\n` +
        `  Tags: ${s.tags.join(", ") || "none"}\n` +
        `  Fit score: ${s.fitScore ?? "not scored"}\n` +
        `  Debrief: ${s.debrief || "none"}`
      )
      .join("\n\n");

    const profilePrompt = `You are a real estate buyer preference analyst. Based on the showing data below, generate a buyer preference profile.

Buyer: ${buyer.name}
Showings completed: ${visitedData.length}

${stopsText}

Generate a JSON buyer preference profile with these keys:
- summary: 2-3 sentence overview of what this buyer values and their deal-breakers
- themes: array of objects, each with: { name: string, weight: 1-100, positive: boolean }
  (weight = importance, positive = they WANT this vs they DISLIKE it)
  Include 3-6 themes (e.g., "Natural light", "Open floor plan", "Road noise sensitivity")
- topPositives: array of 2-4 top things buyer loves (short phrases)
- topConcerns: array of 1-3 top concerns or deal-breakers (short phrases)
- priceRange: object with { min: number|null, max: number|null } inferred from visited properties

Return only valid JSON.`;

    const profileResult = await generateText(profilePrompt, aiConfig.summarizationProvider);
    let profile: Record<string, unknown> = {};
    try {
      const jsonMatch = profileResult.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) profile = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      profile = { summary: profileResult.text };
    }

    await db
      .update(buyersTable)
      .set({
        preferenceProfile: JSON.stringify(profile),
        preferenceProfileUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(buyersTable.id, params.buyerId));

    const unvisitedStops = allStopData.filter((s) => !s.visited && s.property);
    let updatedStops = 0;

    if (unvisitedStops.length > 0) {
      const profileSummary = JSON.stringify(profile);
      const unvisitedText = unvisitedStops
        .map((s, i) =>
          `Property ${i + 1} (ID: ${s.stopId}): ${s.address}\n` +
          `  Beds: ${s.property?.beds ?? "?"}, Baths: ${s.property?.baths ?? "?"}, Sq ft: ${s.property?.squareFeet ?? "?"}\n` +
          `  List price: ${s.property?.listPrice ? `$${s.property.listPrice.toLocaleString()}` : "unknown"}\n` +
          `  Tags: ${s.tags.join(", ") || "none"}`
        )
        .join("\n\n");

      const predictionPrompt = `You are a real estate buyer-matching analyst.

Buyer preference profile:
${profileSummary}

Rate each unvisited property below from 0-100 for predicted buyer fit.
Return a JSON object with stopId as key and score as integer value.
Example: { "stop-uuid-1": 72, "stop-uuid-2": 45 }

Properties:
${unvisitedText}

Return only valid JSON.`;

      try {
        const predResult = await generateText(predictionPrompt, aiConfig.summarizationProvider);
        const jsonMatch = predResult.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const scores = JSON.parse(jsonMatch[0]) as Record<string, number>;
          for (const [stopId, score] of Object.entries(scores)) {
            if (typeof score === "number") {
              await db
                .update(tourStopsTable)
                .set({ predictedFitScore: Math.min(100, Math.max(0, Math.round(score))), updatedAt: new Date() })
                .where(eq(tourStopsTable.id, stopId));
              updatedStops++;
            }
          }
        }
      } catch {
        req.log.warn("Failed to compute predicted scores, continuing without them");
      }
    }

    sendValidated(res, PreferenceProfileResponseSchema, { preferenceProfile: profile, updatedStops });
  } catch (err) {
    req.log.error({ err }, "Failed to generate preference profile");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.delete("/buyers/:buyerId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  try {
    const [existing] = await db
      .select({ id: buyersTable.id })
      .from(buyersTable)
      .where(and(eq(buyersTable.id, params.buyerId), eq(buyersTable.agentId, user.id)));
    if (!existing) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }
    await db.delete(buyersTable).where(eq(buyersTable.id, params.buyerId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete buyer");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
