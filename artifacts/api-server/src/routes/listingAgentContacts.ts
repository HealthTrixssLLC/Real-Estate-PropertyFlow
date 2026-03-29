import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, listingAgentContactsTable, tourStopsTable, toursTable } from "@workspace/db";
import { parseParams, parseBody } from "../lib/validate";
import { z } from "zod";
import { sendValidated, ListingAgentContactResponseSchema } from "../lib/responseSchemas";

const stopIdSchema = z.object({ stopId: z.string().min(1) });

const UpsertListingAgentBody = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  brokerageName: z.string().optional(),
  preferredContactMethod: z.string().optional(),
  notes: z.string().optional(),
});

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

router.get("/tour-stops/:stopId/listing-agent", async (req: Request, res: Response) => {
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

    const [contact] = await db
      .select()
      .from(listingAgentContactsTable)
      .where(eq(listingAgentContactsTable.tourStopId, params.stopId));
    sendValidated(res, ListingAgentContactResponseSchema, { contact: contact ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get listing agent contact");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/tour-stops/:stopId/listing-agent", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(UpsertListingAgentBody, req, res);
  if (!body) return;
  const user = (req as Express.AuthedRequest).user;
  try {
    const stop = await assertStopOwner(params.stopId, user.id, res);
    if (!stop) return;

    const [existing] = await db
      .select()
      .from(listingAgentContactsTable)
      .where(eq(listingAgentContactsTable.tourStopId, params.stopId));

    let contact;
    if (existing) {
      [contact] = await db
        .update(listingAgentContactsTable)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(listingAgentContactsTable.id, existing.id))
        .returning();
    } else {
      [contact] = await db
        .insert(listingAgentContactsTable)
        .values({ id: randomUUID(), tourStopId: params.stopId, ...body })
        .returning();
    }

    sendValidated(res, ListingAgentContactResponseSchema, { contact });
  } catch (err) {
    req.log.error({ err }, "Failed to upsert listing agent contact");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tour-stops/:stopId/listing-agent", async (req: Request, res: Response) => {
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

    await db
      .delete(listingAgentContactsTable)
      .where(eq(listingAgentContactsTable.tourStopId, params.stopId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete listing agent contact");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
