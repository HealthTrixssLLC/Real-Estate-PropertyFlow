import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  db,
  toursTable,
  tourStopsTable,
  propertiesTable,
  buyersTable,
  showingRequestsTable,
  tourSummariesTable,
  propertySummariesTable,
  voiceNotesTable,
  transcriptsTable,
} from "@workspace/db";
import {
  CreateTourBody,
  UpdateTourBody,
  AddPropertyToTourBody,
  OptimizeTourRouteBody,
  ReorderTourStopsBody,
  SkipTourStopBody,
} from "@workspace/api-zod";
import { idParams, parseParams, parseBody } from "../lib/validate";
import { generateText } from "../lib/ai";
import { aiConfig } from "../lib/aiConfig";

const router: IRouter = Router();

async function getTourWithCounts(tourId: string) {
  const [tour] = await db.select().from(toursTable).where(eq(toursTable.id, tourId));
  if (!tour) return null;
  const stops = await db.select().from(tourStopsTable).where(eq(tourStopsTable.tourId, tourId)).orderBy(tourStopsTable.sequence);
  const stopCount = stops.length;
  const approvedCount = stops.filter(s => s.approvedStatus === "approved").length;
  const pendingShowingsCount = stops.filter(s =>
    s.approvedStatus === "requested" || s.approvedStatus === "pending"
  ).length;
  return { ...tour, stopCount, approvedCount, pendingShowingsCount };
}

router.get("/tours", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  try {
    const rows = await db.select().from(toursTable).where(eq(toursTable.agentId, user.id)).orderBy(toursTable.createdAt);
    const stopsAgg = await db
      .select({
        tourId: tourStopsTable.tourId,
        stopCount: sql<number>`count(*)::int`,
        approvedCount: sql<number>`count(*) filter (where ${tourStopsTable.approvedStatus} = 'approved')::int`,
        pendingCount: sql<number>`count(*) filter (where ${tourStopsTable.approvedStatus} in ('requested','pending'))::int`,
      })
      .from(tourStopsTable)
      .groupBy(tourStopsTable.tourId);
    const aggMap = new Map(stopsAgg.map(a => [a.tourId, a]));
    const tours = rows.map(t => ({
      ...t,
      stopCount: aggMap.get(t.id)?.stopCount ?? 0,
      approvedCount: aggMap.get(t.id)?.approvedCount ?? 0,
      pendingShowingsCount: aggMap.get(t.id)?.pendingCount ?? 0,
    }));
    res.json({ tours });
  } catch (err) {
    req.log.error({ err }, "Failed to list tours");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tours", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = parseBody(CreateTourBody, req, res);
  if (!body) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const [tour] = await db
      .insert(toursTable)
      .values({ id: randomUUID(), agentId: user.id, ...body, status: "draft" })
      .returning();
    res.status(201).json({ tour: { ...tour, stopCount: 0, approvedCount: 0, pendingShowingsCount: 0 } });
  } catch (err) {
    req.log.error({ err }, "Failed to create tour");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tours/:tourId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  try {
    const [tour] = await db.select().from(toursTable).where(eq(toursTable.id, params.tourId));
    if (!tour) {
      res.status(404).json({ error: "Tour not found" });
      return;
    }
    const stops = await db
      .select()
      .from(tourStopsTable)
      .where(eq(tourStopsTable.tourId, params.tourId))
      .orderBy(tourStopsTable.sequence);
    const stopCount = stops.length;
    const approvedCount = stops.filter(s => s.approvedStatus === "approved").length;
    const pendingShowingsCount = stops.filter(s =>
      s.approvedStatus === "requested" || s.approvedStatus === "pending"
    ).length;

    let buyer = null;
    if (tour.buyerId) {
      const [b] = await db.select().from(buyersTable).where(eq(buyersTable.id, tour.buyerId));
      buyer = b ?? null;
    }

    res.json({
      tour: { ...tour, stopCount, approvedCount, pendingShowingsCount },
      stops,
      buyer,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get tour");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/tours/:tourId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(UpdateTourBody, req, res);
  if (!body) return;
  try {
    const [tour] = await db
      .update(toursTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(toursTable.id, params.tourId))
      .returning();
    if (!tour) {
      res.status(404).json({ error: "Tour not found" });
      return;
    }
    const stops = await db.select().from(tourStopsTable).where(eq(tourStopsTable.tourId, params.tourId));
    const stopCount = stops.length;
    const approvedCount = stops.filter(s => s.approvedStatus === "approved").length;
    const pendingShowingsCount = stops.filter(s =>
      s.approvedStatus === "requested" || s.approvedStatus === "pending"
    ).length;
    res.json({ tour: { ...tour, stopCount, approvedCount, pendingShowingsCount } });
  } catch (err) {
    req.log.error({ err }, "Failed to update tour");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tours/:tourId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  try {
    await db.delete(toursTable).where(eq(toursTable.id, params.tourId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete tour");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tours/:tourId/properties", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(AddPropertyToTourBody, req, res);
  if (!body) return;
  try {
    const [tour] = await db.select().from(toursTable).where(eq(toursTable.id, params.tourId));
    if (!tour) {
      res.status(404).json({ error: "Tour not found" });
      return;
    }

    let propertyId = body.propertyId;

    if (!propertyId) {
      const { propertyId: _ignored, ...propertyData } = body;
      const [property] = await db
        .insert(propertiesTable)
        .values({ id: randomUUID(), ...propertyData })
        .returning();
      propertyId = property.id;
    }

    const existingStops = await db
      .select()
      .from(tourStopsTable)
      .where(eq(tourStopsTable.tourId, params.tourId));
    const nextSequence = existingStops.length;

    const [stop] = await db
      .insert(tourStopsTable)
      .values({
        id: randomUUID(),
        tourId: params.tourId,
        propertyId,
        sequence: nextSequence,
        approvedStatus: "not_requested",
        skipped: false,
        visited: false,
        followUpFlag: false,
        revisitFlag: false,
      })
      .returning();

    if (tour.status === "draft") {
      await db.update(toursTable).set({ status: "active", updatedAt: new Date() }).where(eq(toursTable.id, params.tourId));
    }

    res.status(201).json({ stop });
  } catch (err) {
    req.log.error({ err }, "Failed to add property to tour");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function googleDistanceMatrix(
  origins: Array<{ lat: number; lng: number }>,
  destinations: Array<{ lat: number; lng: number }>,
): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not set");

  const originsStr = origins.map(o => `${o.lat},${o.lng}`).join("|");
  const destsStr = destinations.map(d => `${d.lat},${d.lng}`).join("|");
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originsStr)}&destinations=${encodeURIComponent(destsStr)}&mode=driving&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Maps API error: ${res.status}`);
  const data = (await res.json()) as {
    status: string;
    rows: Array<{ elements: Array<{ status: string; duration: { value: number } }> }>;
  };
  if (data.status !== "OK") throw new Error(`Distance Matrix status: ${data.status}`);

  return data.rows.map(row =>
    row.elements.map(el => (el.status === "OK" ? el.duration.value : 99999))
  );
}

function nearestNeighborOrder(
  stopIds: string[],
  coords: Array<{ lat: number; lng: number } | null>,
  travelTimes: number[][],
  startIdx: number,
): string[] {
  const n = stopIds.length;
  const visited = new Array(n).fill(false);
  const ordered: string[] = [];
  let current = startIdx;

  while (ordered.length < n) {
    visited[current] = true;
    ordered.push(stopIds[current]);
    let best = -1;
    let bestTime = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && travelTimes[current][j] < bestTime) {
        bestTime = travelTimes[current][j];
        best = j;
      }
    }
    if (best === -1) break;
    current = best;
  }
  return ordered;
}

router.post("/tours/:tourId/optimize", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(OptimizeTourRouteBody, req, res);
  if (!body) return;

  try {
    const [tour] = await db.select().from(toursTable).where(eq(toursTable.id, params.tourId));
    if (!tour) {
      res.status(404).json({ error: "Tour not found" });
      return;
    }

    let stops = await db
      .select()
      .from(tourStopsTable)
      .where(eq(tourStopsTable.tourId, params.tourId))
      .orderBy(tourStopsTable.sequence);

    if (body.includeApprovedOnly) {
      stops = stops.filter(s => s.approvedStatus === "approved" || s.approvedStatus === "not_requested");
    }
    stops = stops.filter(s => !s.skipped);

    if (stops.length === 0) {
      res.json({ orderedStopIds: [], estimatedDriveTimeMinutes: 0 });
      return;
    }
    if (stops.length === 1) {
      res.json({ orderedStopIds: [stops[0].id], estimatedDriveTimeMinutes: 0 });
      return;
    }

    const properties = await db
      .select()
      .from(propertiesTable)
      .where(inArray(propertiesTable.id, stops.map(s => s.propertyId)));
    const propMap = new Map(properties.map(p => [p.id, p]));

    const coords = stops.map(s => {
      const p = propMap.get(s.propertyId);
      return p?.lat != null && p?.lng != null ? { lat: p.lat, lng: p.lng } : null;
    });

    const validCoords = coords.filter((c): c is { lat: number; lng: number } => c !== null);
    if (validCoords.length < 2) {
      res.json({ orderedStopIds: stops.map(s => s.id), estimatedDriveTimeMinutes: 0 });
      return;
    }

    let startPoint: { lat: number; lng: number } | null = null;
    if (tour.startLat != null && tour.startLng != null) {
      startPoint = { lat: tour.startLat, lng: tour.startLng };
    }

    let orderedIds: string[];
    let totalDriveSeconds = 0;

    try {
      const allPoints = startPoint ? [startPoint, ...validCoords] : validCoords;
      const matrix = await googleDistanceMatrix(allPoints, allPoints);

      if (startPoint) {
        const stopMatrix = matrix.slice(1).map(row => row.slice(1));
        const startRow = matrix[0].slice(1);
        const combined = stopMatrix.map((row, i) => row.map((v, j) => (i === j ? 0 : v)));
        const startScores = startRow;
        const firstIdx = startScores.indexOf(Math.min(...startScores));
        orderedIds = nearestNeighborOrder(stops.map(s => s.id), coords, combined, firstIdx);
        totalDriveSeconds = startRow[firstIdx];
        for (let k = 0; k < orderedIds.length - 1; k++) {
          const fromIdx = stops.findIndex(s => s.id === orderedIds[k]);
          const toIdx = stops.findIndex(s => s.id === orderedIds[k + 1]);
          if (fromIdx >= 0 && toIdx >= 0) totalDriveSeconds += combined[fromIdx][toIdx];
        }
      } else {
        orderedIds = nearestNeighborOrder(stops.map(s => s.id), coords, matrix, 0);
        for (let k = 0; k < orderedIds.length - 1; k++) {
          const fromIdx = stops.findIndex(s => s.id === orderedIds[k]);
          const toIdx = stops.findIndex(s => s.id === orderedIds[k + 1]);
          if (fromIdx >= 0 && toIdx >= 0) totalDriveSeconds += matrix[fromIdx][toIdx];
        }
      }

      await db.transaction(async (tx) => {
        for (let i = 0; i < orderedIds.length; i++) {
          await tx
            .update(tourStopsTable)
            .set({ sequence: i, updatedAt: new Date() })
            .where(eq(tourStopsTable.id, orderedIds[i]));
        }
      });
    } catch (optimizeErr) {
      req.log.warn({ optimizeErr }, "Google Maps optimization failed, falling back to current order");
      orderedIds = stops.map(s => s.id);
    }

    res.json({
      orderedStopIds: orderedIds,
      estimatedDriveTimeMinutes: Math.round(totalDriveSeconds / 60),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to optimize tour route");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/tours/:tourId/stops/order", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(ReorderTourStopsBody, req, res);
  if (!body) return;
  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < body.orderedStopIds.length; i++) {
        await tx
          .update(tourStopsTable)
          .set({ sequence: i, updatedAt: new Date() })
          .where(
            and(
              eq(tourStopsTable.id, body.orderedStopIds[i]),
              eq(tourStopsTable.tourId, params.tourId),
            ),
          );
      }
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reorder tour stops");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tours/:tourId/skip-stop", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(SkipTourStopBody, req, res);
  if (!body) return;
  try {
    const [stop] = await db
      .select()
      .from(tourStopsTable)
      .where(
        and(
          eq(tourStopsTable.id, body.stopId),
          eq(tourStopsTable.tourId, params.tourId),
        ),
      );
    if (!stop) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }

    const [skippedStop] = await db
      .update(tourStopsTable)
      .set({
        skipped: true,
        skipReason: body.reason,
        skipNotes: body.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(tourStopsTable.id, body.stopId))
      .returning();

    const remaining = await db
      .select()
      .from(tourStopsTable)
      .where(
        and(
          eq(tourStopsTable.tourId, params.tourId),
          eq(tourStopsTable.skipped, false),
          eq(tourStopsTable.visited, false),
        ),
      )
      .orderBy(tourStopsTable.sequence);

    const afterSkipped = remaining.filter(s => s.sequence > stop.sequence);
    const nextStop = afterSkipped[0] ?? remaining[0] ?? null;

    res.json({ skippedStop, nextStop });
  } catch (err) {
    req.log.error({ err }, "Failed to skip stop");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tours/:tourId/publish", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  try {
    const [tour] = await db
      .update(toursTable)
      .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(toursTable.id, params.tourId))
      .returning();
    if (!tour) {
      res.status(404).json({ error: "Tour not found" });
      return;
    }
    const stops = await db.select().from(tourStopsTable).where(eq(tourStopsTable.tourId, params.tourId));
    res.json({
      tour: {
        ...tour,
        stopCount: stops.length,
        approvedCount: stops.filter(s => s.approvedStatus === "approved").length,
        pendingShowingsCount: stops.filter(s => s.approvedStatus === "requested" || s.approvedStatus === "pending").length,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to publish tour");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tours/:tourId/readiness", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  try {
    const stops = await db
      .select()
      .from(tourStopsTable)
      .where(and(eq(tourStopsTable.tourId, params.tourId), eq(tourStopsTable.skipped, false)));

    const showingRequests = stops.length > 0
      ? await db
          .select()
          .from(showingRequestsTable)
          .where(inArray(showingRequestsTable.tourStopId, stops.map(s => s.id)))
      : [];

    const srMap = new Map(showingRequests.map(sr => [sr.tourStopId, sr]));

    const approvedCount = showingRequests.filter(sr => sr.status === "approved").length;
    const pendingCount = showingRequests.filter(sr => sr.status === "pending" || sr.status === "requested").length;
    const declinedCount = showingRequests.filter(sr => sr.status === "declined" || sr.status === "cancelled").length;
    const missingAgentInfoCount = stops.filter(s => {
      const sr = srMap.get(s.id);
      return !sr || !sr.listingAgentName;
    }).length;

    const MINUTES_PER_STOP = 30;
    const DRIVE_MINUTES_PER_STOP = 10;
    const estimatedTotalMinutes = stops.length * (MINUTES_PER_STOP + DRIVE_MINUTES_PER_STOP);
    const estimatedDriveTimeMinutes = stops.length * DRIVE_MINUTES_PER_STOP;

    res.json({
      approvedCount,
      pendingCount,
      declinedCount,
      missingAgentInfoCount,
      estimatedDriveTimeMinutes,
      estimatedTotalMinutes,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get readiness");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tours/:tourId/generate-summary", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  try {
    const [tour] = await db.select().from(toursTable).where(eq(toursTable.id, params.tourId));
    if (!tour) {
      res.status(404).json({ error: "Tour not found" });
      return;
    }

    const stops = await db
      .select()
      .from(tourStopsTable)
      .where(eq(tourStopsTable.tourId, params.tourId))
      .orderBy(tourStopsTable.sequence);

    const properties = stops.length > 0
      ? await db.select().from(propertiesTable).where(inArray(propertiesTable.id, stops.map(s => s.propertyId)))
      : [];
    const propMap = new Map(properties.map(p => [p.id, p]));

    const propSummaries = stops.length > 0
      ? await db.select().from(propertySummariesTable).where(inArray(propertySummariesTable.tourStopId, stops.map(s => s.id)))
      : [];
    const summaryMap = new Map(propSummaries.map(ps => [ps.tourStopId, ps]));

    const stopDescriptions = stops.map(s => {
      const p = propMap.get(s.propertyId);
      const ps = summaryMap.get(s.id);
      const ratings = [
        s.overallFitRating != null ? `Overall: ${s.overallFitRating}/5` : null,
        s.buyerInterest != null ? `Interest: ${s.buyerInterest}/5` : null,
      ].filter(Boolean).join(", ");
      const flags = [s.followUpFlag ? "Follow-up" : null, s.revisitFlag ? "Revisit" : null].filter(Boolean).join(", ");
      return `- ${p?.formattedAddress ?? "Unknown"} | Status: ${s.approvedStatus} | ${ratings} | ${flags} | ${ps?.summaryText ?? "No AI summary"}`;
    }).join("\n");

    const prompt = `You are a real estate agent assistant. Here is the summary of today's property tour titled "${tour.title}":

${stopDescriptions}

Generate a comprehensive end-of-tour summary with the following sections:
1. Overall assessment (2-3 sentences)
2. Top homes to consider (list)
3. Homes to eliminate (list)
4. Buyer preferences observed (list)
5. Suggested next actions (list)

Format as JSON with keys: summaryText, topHomes, homesToEliminate, buyerPreferences, nextActions`;

    const provider = aiConfig.summarizationProvider ?? (process.env.AZURE_OPENAI_API_KEY ? "azure_openai" : "openai");
    const result = await generateText(prompt, provider as "azure_openai" | "openai");

    let parsed: { summaryText?: string; topHomes?: string[]; homesToEliminate?: string[]; buyerPreferences?: string[]; nextActions?: string[] } = {};
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { summaryText: result.text };
    }

    const [summary] = await db
      .insert(tourSummariesTable)
      .values({
        id: randomUUID(),
        tourId: params.tourId,
        summaryText: parsed.summaryText ?? result.text,
        topHomes: parsed.topHomes ?? [],
        homesToEliminate: parsed.homesToEliminate ?? [],
        buyerPreferences: parsed.buyerPreferences ?? [],
        nextActions: parsed.nextActions ?? [],
        provider: result.provider,
        generatedAt: new Date(),
      })
      .returning();

    res.json({ summary });
  } catch (err) {
    req.log.error({ err }, "Failed to generate tour summary");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/mobile/tours/active", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  try {
    const rows = await db
      .select()
      .from(toursTable)
      .where(and(eq(toursTable.agentId, user.id), eq(toursTable.status, "published")))
      .orderBy(toursTable.date);
    const stopsAgg = rows.length > 0
      ? await db
          .select({
            tourId: tourStopsTable.tourId,
            stopCount: sql<number>`count(*)::int`,
            approvedCount: sql<number>`count(*) filter (where ${tourStopsTable.approvedStatus} = 'approved')::int`,
            pendingCount: sql<number>`count(*) filter (where ${tourStopsTable.approvedStatus} in ('requested','pending'))::int`,
          })
          .from(tourStopsTable)
          .where(inArray(tourStopsTable.tourId, rows.map(t => t.id)))
          .groupBy(tourStopsTable.tourId)
      : [];
    const aggMap = new Map(stopsAgg.map(a => [a.tourId, a]));
    const tours = rows.map(t => ({
      ...t,
      stopCount: aggMap.get(t.id)?.stopCount ?? 0,
      approvedCount: aggMap.get(t.id)?.approvedCount ?? 0,
      pendingShowingsCount: aggMap.get(t.id)?.pendingCount ?? 0,
    }));
    res.json({ tours });
  } catch (err) {
    req.log.error({ err }, "Failed to list mobile tours");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
