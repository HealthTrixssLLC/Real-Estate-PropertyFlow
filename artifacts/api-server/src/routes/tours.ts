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
import {
  sendValidated,
  TourListResponseSchema,
  TourResponseSchema,
  TourDetailResponseSchema,
  TourStopResponseSchema,
  SkipStopResponseSchema,
  OptimizeResponseSchema,
  SuccessResponseSchema,
  TourReadinessResponseSchema,
  TourSummaryResponseSchema,
} from "../lib/responseSchemas";

const router: IRouter = Router();

async function assertTourOwner(tourId: string, agentId: string, res: Response): Promise<typeof toursTable.$inferSelect | null> {
  const [tour] = await db.select().from(toursTable).where(eq(toursTable.id, tourId));
  if (!tour) {
    res.status(404).json({ error: "Tour not found" });
    return null;
  }
  if (tour.agentId !== agentId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return tour;
}

function assertTourNotPublished(tour: typeof toursTable.$inferSelect, res: Response): boolean {
  if (tour.status === "published") {
    res.status(409).json({ error: "Tour is published. Itinerary is locked and cannot be modified." });
    return false;
  }
  return true;
}

async function getStopCounts(tourId: string) {
  const stops = await db.select().from(tourStopsTable).where(eq(tourStopsTable.tourId, tourId));
  return {
    stopCount: stops.length,
    approvedCount: stops.filter(s => s.approvedStatus === "approved").length,
    pendingShowingsCount: stops.filter(s => s.approvedStatus === "requested" || s.approvedStatus === "pending").length,
  };
}

router.get("/tours", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  try {
    const rows = await db.select().from(toursTable).where(eq(toursTable.agentId, user.id)).orderBy(toursTable.createdAt);
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
    sendValidated(res, TourListResponseSchema, { tours });
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
    if (body.buyerId) {
      const [ownedBuyer] = await db
        .select({ id: buyersTable.id })
        .from(buyersTable)
        .where(and(eq(buyersTable.id, body.buyerId), eq(buyersTable.agentId, user.id)));
      if (!ownedBuyer) {
        res.status(403).json({ error: "Forbidden: buyer not owned by current user" });
        return;
      }
    }
    const [tour] = await db
      .insert(toursTable)
      .values({ id: randomUUID(), agentId: user.id, ...body, status: "draft" })
      .returning();
    sendValidated(res, TourResponseSchema, { tour: { ...tour, stopCount: 0, approvedCount: 0, pendingShowingsCount: 0 } }, 201);
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
  const user = (req as Express.AuthedRequest).user;
  try {
    const tour = await assertTourOwner(params.tourId, user.id, res);
    if (!tour) return;

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

    const propertyIds = stops.map(s => s.propertyId);
    const properties = propertyIds.length > 0
      ? await db.select({ id: propertiesTable.id, formattedAddress: propertiesTable.formattedAddress, nickname: propertiesTable.nickname })
          .from(propertiesTable)
          .where(inArray(propertiesTable.id, propertyIds))
      : [];
    const propMap = new Map(properties.map(p => [p.id, p]));

    const stopsWithAddress = stops.map(s => {
      const prop = propMap.get(s.propertyId);
      return {
        ...s,
        formattedAddress: prop?.formattedAddress ?? "",
        propertyNickname: prop?.nickname ?? null,
      };
    });

    let buyer = null;
    if (tour.buyerId) {
      const [b] = await db.select().from(buyersTable).where(and(eq(buyersTable.id, tour.buyerId), eq(buyersTable.agentId, user.id)));
      buyer = b ?? null;
    }

    sendValidated(res, TourDetailResponseSchema, {
      tour: { ...tour, stopCount, approvedCount, pendingShowingsCount },
      stops: stopsWithAddress,
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
  const user = (req as Express.AuthedRequest).user;
  try {
    const existing = await assertTourOwner(params.tourId, user.id, res);
    if (!existing) return;

    const itineraryFields = ["date", "startTime", "startAddress", "startLat", "startLng", "endAddress", "endLat", "endLng"] as const;
    const isItineraryChange = itineraryFields.some(f => f in body);
    if (isItineraryChange && !assertTourNotPublished(existing, res)) return;

    if (body.buyerId) {
      const [ownedBuyer] = await db
        .select({ id: buyersTable.id })
        .from(buyersTable)
        .where(and(eq(buyersTable.id, body.buyerId), eq(buyersTable.agentId, user.id)));
      if (!ownedBuyer) {
        res.status(403).json({ error: "Forbidden: buyer not owned by current user" });
        return;
      }
    }

    const [tour] = await db
      .update(toursTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(toursTable.id, params.tourId))
      .returning();
    const counts = await getStopCounts(params.tourId);
    sendValidated(res, TourResponseSchema, { tour: { ...tour, ...counts } });
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
  const user = (req as Express.AuthedRequest).user;
  try {
    const tour = await assertTourOwner(params.tourId, user.id, res);
    if (!tour) return;
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
  const user = (req as Express.AuthedRequest).user;
  try {
    const tour = await assertTourOwner(params.tourId, user.id, res);
    if (!tour) return;
    if (!assertTourNotPublished(tour, res)) return;

    let propertyId = body.propertyId;

    if (!propertyId) {
      const { propertyId: _ignored, ...propertyData } = body;
      const [property] = await db
        .insert(propertiesTable)
        .values({ id: randomUUID(), agentId: user.id, ...propertyData })
        .returning();
      propertyId = property.id;
    } else {
      const [owned] = await db
        .select({ id: propertiesTable.id })
        .from(propertiesTable)
        .where(and(eq(propertiesTable.id, propertyId), eq(propertiesTable.agentId, user.id)));
      if (!owned) {
        res.status(403).json({ error: "Forbidden: property not owned by current user" });
        return;
      }
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

    sendValidated(res, TourStopResponseSchema, { stop }, 201);
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
    row.elements.map(el => (el.status === "OK" ? el.duration.value : 999999))
  );
}

function nearestNeighborOrder(n: number, matrix: number[][], startIdx: number): number[] {
  const visited = new Array(n).fill(false);
  const ordered: number[] = [];
  let current = startIdx;

  while (ordered.length < n) {
    visited[current] = true;
    ordered.push(current);
    let best = -1;
    let bestTime = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && matrix[current][j] < bestTime) {
        bestTime = matrix[current][j];
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
  const user = (req as Express.AuthedRequest).user;

  try {
    const tour = await assertTourOwner(params.tourId, user.id, res);
    if (!tour) return;
    if (!assertTourNotPublished(tour, res)) return;

    let stops = await db
      .select()
      .from(tourStopsTable)
      .where(eq(tourStopsTable.tourId, params.tourId))
      .orderBy(tourStopsTable.sequence);

    if (body.includeApprovedOnly) {
      stops = stops.filter(s => s.approvedStatus === "approved" || s.approvedStatus === "not_requested");
    }
    const activeStops = stops.filter(s => !s.skipped);

    if (activeStops.length === 0) {
      sendValidated(res, OptimizeResponseSchema, { orderedStopIds: [], estimatedDriveTimeMinutes: 0 });
      return;
    }
    if (activeStops.length === 1) {
      sendValidated(res, OptimizeResponseSchema, { orderedStopIds: [activeStops[0].id], estimatedDriveTimeMinutes: 0 });
      return;
    }

    const properties = await db
      .select()
      .from(propertiesTable)
      .where(inArray(propertiesTable.id, activeStops.map(s => s.propertyId)));
    const propMap = new Map(properties.map(p => [p.id, p]));

    const geoStopIndices: number[] = [];
    const ungeoStopIndices: number[] = [];
    const coords: Array<{ lat: number; lng: number }> = [];

    activeStops.forEach((s, i) => {
      const p = propMap.get(s.propertyId);
      if (p?.lat != null && p?.lng != null) {
        geoStopIndices.push(i);
        coords.push({ lat: p.lat, lng: p.lng });
      } else {
        ungeoStopIndices.push(i);
      }
    });

    let orderedIds: string[] = [];
    let totalDriveSeconds = 0;

    if (coords.length >= 2) {
      try {
        let matrixPoints: Array<{ lat: number; lng: number }> = coords;
        let startOffset = 0;
        if (tour.startLat != null && tour.startLng != null) {
          matrixPoints = [{ lat: tour.startLat, lng: tour.startLng }, ...coords];
          startOffset = 1;
        }

        const fullMatrix = await googleDistanceMatrix(matrixPoints, matrixPoints);
        const coordsMatrix = fullMatrix
          .slice(startOffset)
          .map(row => row.slice(startOffset));

        let firstGeoIdx = 0;
        if (startOffset === 1) {
          const startRow = fullMatrix[0].slice(startOffset);
          firstGeoIdx = startRow.indexOf(Math.min(...startRow));
          totalDriveSeconds += fullMatrix[0][startOffset + firstGeoIdx];
        }

        const orderedGeoLocalIdx = nearestNeighborOrder(coords.length, coordsMatrix, firstGeoIdx);

        for (let k = 0; k < orderedGeoLocalIdx.length - 1; k++) {
          totalDriveSeconds += coordsMatrix[orderedGeoLocalIdx[k]][orderedGeoLocalIdx[k + 1]];
        }

        const orderedGeoStopIds = orderedGeoLocalIdx.map(li => activeStops[geoStopIndices[li]].id);
        const ungeoStopIds = ungeoStopIndices.map(i => activeStops[i].id);
        orderedIds = [...orderedGeoStopIds, ...ungeoStopIds];
      } catch (optimizeErr) {
        req.log.warn({ optimizeErr }, "Google Maps optimization failed, falling back to current order");
        orderedIds = activeStops.map(s => s.id);
      }
    } else {
      orderedIds = activeStops.map(s => s.id);
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(tourStopsTable)
          .set({ sequence: i, updatedAt: new Date() })
          .where(eq(tourStopsTable.id, orderedIds[i]));
      }
    });

    sendValidated(res, OptimizeResponseSchema, {
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
  const user = (req as Express.AuthedRequest).user;
  try {
    const tour = await assertTourOwner(params.tourId, user.id, res);
    if (!tour) return;
    if (!assertTourNotPublished(tour, res)) return;

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
    sendValidated(res, SuccessResponseSchema, { success: true });
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
  const user = (req as Express.AuthedRequest).user;
  const currentLat = body.currentLat ?? null;
  const currentLng = body.currentLng ?? null;

  try {
    const tour = await assertTourOwner(params.tourId, user.id, res);
    if (!tour) return;

    const [targetStop] = await db
      .select()
      .from(tourStopsTable)
      .where(
        and(
          eq(tourStopsTable.id, body.stopId),
          eq(tourStopsTable.tourId, params.tourId),
        ),
      );
    if (!targetStop) {
      res.status(404).json({ error: "Stop not found in this tour" });
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

    if (remaining.length >= 2 && process.env.GOOGLE_MAPS_API_KEY) {
      const properties = await db
        .select()
        .from(propertiesTable)
        .where(inArray(propertiesTable.id, remaining.map(s => s.propertyId)));
      const propMap = new Map(properties.map(p => [p.id, p]));
      const geoIdx: number[] = [];
      const coords: Array<{ lat: number; lng: number }> = [];

      remaining.forEach((s, i) => {
        const p = propMap.get(s.propertyId);
        if (p?.lat != null && p?.lng != null) {
          geoIdx.push(i);
          coords.push({ lat: p.lat, lng: p.lng });
        }
      });

      if (coords.length >= 2) {
        try {
          let matrixPoints: Array<{ lat: number; lng: number }> = coords;
          let startOffset = 0;
          const origin = currentLat != null && currentLng != null
            ? { lat: currentLat, lng: currentLng }
            : (tour.startLat != null && tour.startLng != null ? { lat: tour.startLat, lng: tour.startLng } : null);

          if (origin) {
            matrixPoints = [origin, ...coords];
            startOffset = 1;
          }

          const fullMatrix = await googleDistanceMatrix(matrixPoints, matrixPoints);
          const coordsMatrix = fullMatrix.slice(startOffset).map(row => row.slice(startOffset));

          let firstGeoIdx = 0;
          if (startOffset === 1) {
            const startRow = fullMatrix[0].slice(startOffset);
            firstGeoIdx = startRow.indexOf(Math.min(...startRow));
          }

          const orderedLocalIdx = nearestNeighborOrder(coords.length, coordsMatrix, firstGeoIdx);
          const orderedGeoIds = orderedLocalIdx.map(li => remaining[geoIdx[li]].id);
          const ungeoIds = remaining.filter((_, i) => !geoIdx.includes(i)).map(s => s.id);
          const allOrdered = [...orderedGeoIds, ...ungeoIds];

          await db.transaction(async (tx) => {
            for (let i = 0; i < allOrdered.length; i++) {
              await tx
                .update(tourStopsTable)
                .set({ sequence: i, updatedAt: new Date() })
                .where(eq(tourStopsTable.id, allOrdered[i]));
            }
          });
        } catch (e) {
          req.log.warn({ err: e }, "Reroute optimization failed after skip");
        }
      }
    }

    const resequenced = await db
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

    const nextStop = resequenced[0] ?? null;

    sendValidated(res, SkipStopResponseSchema, { skippedStop, nextStop });
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
  const user = (req as Express.AuthedRequest).user;
  try {
    const existing = await assertTourOwner(params.tourId, user.id, res);
    if (!existing) return;

    const [tour] = await db
      .update(toursTable)
      .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(toursTable.id, params.tourId))
      .returning();
    const counts = await getStopCounts(params.tourId);
    sendValidated(res, TourResponseSchema, { tour: { ...tour, ...counts } });
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
  const user = (req as Express.AuthedRequest).user;
  try {
    const tour = await assertTourOwner(params.tourId, user.id, res);
    if (!tour) return;

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

    sendValidated(res, TourReadinessResponseSchema, {
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
  const user = (req as Express.AuthedRequest).user;
  try {
    const tour = await assertTourOwner(params.tourId, user.id, res);
    if (!tour) return;

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

    const allVoiceNotes = stops.length > 0
      ? await db.select().from(voiceNotesTable).where(inArray(voiceNotesTable.tourStopId, stops.map(s => s.id)))
      : [];
    const notesMap = new Map<string, string[]>();
    for (const vn of allVoiceNotes) {
      if (vn.typedNote) {
        const arr = notesMap.get(vn.tourStopId) ?? [];
        arr.push(vn.typedNote);
        notesMap.set(vn.tourStopId, arr);
      }
    }

    const stopDescriptions = stops.map(s => {
      const p = propMap.get(s.propertyId);
      const ps = summaryMap.get(s.id);
      const ratings = [
        s.overallFitRating != null ? `Overall: ${s.overallFitRating}/5` : null,
        s.buyerInterest != null ? `Interest: ${s.buyerInterest}/5` : null,
      ].filter(Boolean).join(", ");
      const flags = [s.followUpFlag ? "Follow-up" : null, s.revisitFlag ? "Revisit" : null].filter(Boolean).join(", ");
      const notes = (notesMap.get(s.id) ?? []).join("; ") || "None";
      return `- ${p?.formattedAddress ?? "Unknown"} | Status: ${s.approvedStatus} | ${ratings} | ${flags} | Notes: ${notes} | ${ps?.summaryText ?? "No AI summary"}`;
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

    const result = await generateText(prompt, aiConfig.summarizationProvider);

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

    sendValidated(res, TourSummaryResponseSchema, { summary });
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
    sendValidated(res, TourListResponseSchema, { tours });
  } catch (err) {
    req.log.error({ err }, "Failed to list mobile tours");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
