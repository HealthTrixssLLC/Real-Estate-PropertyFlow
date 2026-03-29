import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import {
  db,
  showingRequestsTable,
  restrictionNotesTable,
  tourStopsTable,
  toursTable,
} from "@workspace/db";
import {
  CreateShowingRequestBody,
  UpdateShowingRequestBody,
  UpsertRestrictionNoteBody,
} from "@workspace/api-zod";
import { parseParams, parseBody } from "../lib/validate";
import { z } from "zod";
import { sendValidated, ShowingRequestResponseSchema, RestrictionNoteResponseSchema } from "../lib/responseSchemas";

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

router.get("/tour-stops/:stopId/showing-request", async (req: Request, res: Response) => {
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

    const [showingRequest] = await db
      .select()
      .from(showingRequestsTable)
      .where(eq(showingRequestsTable.tourStopId, params.stopId));
    if (!showingRequest) {
      res.status(404).json({ error: "Showing request not found" });
      return;
    }
    sendValidated(res, ShowingRequestResponseSchema, { showingRequest });
  } catch (err) {
    req.log.error({ err }, "Failed to get showing request");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tour-stops/:stopId/showing-request", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(CreateShowingRequestBody, req, res);
  if (!body) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const stop = await assertStopOwner(params.stopId, user.id, res);
    if (!stop) return;

    const [existing] = await db
      .select()
      .from(showingRequestsTable)
      .where(eq(showingRequestsTable.tourStopId, params.stopId));

    if (existing) {
      const showingRequest = await db.transaction(async (tx) => {
        const [sr] = await tx
          .update(showingRequestsTable)
          .set({ ...body, requestedAt: new Date(), updatedAt: new Date() })
          .where(eq(showingRequestsTable.id, existing.id))
          .returning();
        if (body.status && body.status !== existing.status) {
          await tx
            .update(tourStopsTable)
            .set({ approvedStatus: body.status, updatedAt: new Date() })
            .where(eq(tourStopsTable.id, params.stopId));
        }
        return sr;
      });
      sendValidated(res, ShowingRequestResponseSchema, { showingRequest }, 201);
      return;
    }

    const showingRequest = await db.transaction(async (tx) => {
      const [sr] = await tx
        .insert(showingRequestsTable)
        .values({
          id: randomUUID(),
          tourStopId: params.stopId,
          ...body,
          status: body.status ?? "not_requested",
          requestedAt: new Date(),
        })
        .returning();
      if (body.status) {
        await tx
          .update(tourStopsTable)
          .set({ approvedStatus: body.status, updatedAt: new Date() })
          .where(eq(tourStopsTable.id, params.stopId));
      }
      return sr;
    });

    sendValidated(res, ShowingRequestResponseSchema, { showingRequest }, 201);
  } catch (err) {
    req.log.error({ err }, "Failed to create showing request");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/tour-stops/:stopId/showing-request", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(UpdateShowingRequestBody, req, res);
  if (!body) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const stop = await assertStopOwner(params.stopId, user.id, res);
    if (!stop) return;

    const [existing] = await db
      .select()
      .from(showingRequestsTable)
      .where(eq(showingRequestsTable.tourStopId, params.stopId));
    if (!existing) {
      res.status(404).json({ error: "Showing request not found" });
      return;
    }
    const showingRequest = await db.transaction(async (tx) => {
      const [sr] = await tx
        .update(showingRequestsTable)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(showingRequestsTable.id, existing.id))
        .returning();
      if (body.status && body.status !== existing.status) {
        await tx
          .update(tourStopsTable)
          .set({ approvedStatus: body.status, updatedAt: new Date() })
          .where(eq(tourStopsTable.id, params.stopId));
      }
      return sr;
    });

    sendValidated(res, ShowingRequestResponseSchema, { showingRequest });
  } catch (err) {
    req.log.error({ err }, "Failed to update showing request");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tour-stops/:stopId/restrictions", async (req: Request, res: Response) => {
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

    const [restrictionNote] = await db
      .select()
      .from(restrictionNotesTable)
      .where(eq(restrictionNotesTable.tourStopId, params.stopId));
    sendValidated(res, RestrictionNoteResponseSchema, { restrictionNote: restrictionNote ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get restriction note");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/tour-stops/:stopId/restrictions", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(UpsertRestrictionNoteBody, req, res);
  if (!body) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const stop = await assertStopOwner(params.stopId, user.id, res);
    if (!stop) return;

    const [existing] = await db
      .select()
      .from(restrictionNotesTable)
      .where(eq(restrictionNotesTable.tourStopId, params.stopId));

    let restrictionNote;
    if (existing) {
      [restrictionNote] = await db
        .update(restrictionNotesTable)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(restrictionNotesTable.id, existing.id))
        .returning();
    } else {
      [restrictionNote] = await db
        .insert(restrictionNotesTable)
        .values({
          id: randomUUID(),
          tourStopId: params.stopId,
          occupied: body.occupied ?? false,
          tenantNoticeRequired: body.tenantNoticeRequired ?? false,
          doNotUseBathroom: body.doNotUseBathroom ?? false,
          removeShoes: body.removeShoes ?? false,
          ...body,
        })
        .returning();
    }

    sendValidated(res, RestrictionNoteResponseSchema, { restrictionNote });
  } catch (err) {
    req.log.error({ err }, "Failed to upsert restriction note");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
