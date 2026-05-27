import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { and, eq, or, ilike, isNull } from "drizzle-orm";
import { db, propertiesTable } from "@workspace/db";
import { CreatePropertyBody, UpdatePropertyBody } from "@workspace/api-zod";
import { idParams, parseParams, parseBody } from "../lib/validate";
import { sendValidated, PropertyResponseSchema, PropertyListResponseSchema } from "../lib/responseSchemas";
import { geocodeAddress } from "../lib/geocode";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/properties", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const isAdmin = user.role === "admin";
  const includeArchived = req.query.includeArchived === "true";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
  try {
    const baseFilter = isAdmin
      ? includeArchived
        ? undefined
        : eq(propertiesTable.archived, false)
      : includeArchived
        ? eq(propertiesTable.agentId, user.id)
        : and(eq(propertiesTable.agentId, user.id), eq(propertiesTable.archived, false));
    const searchFilter = q
      ? and(
          ...q
            .split(/\s+/)
            .filter(Boolean)
            .map(word =>
              or(
                ilike(propertiesTable.formattedAddress, `%${word}%`),
                ilike(propertiesTable.nickname, `%${word}%`),
                ilike(propertiesTable.mlsId, `%${word}%`),
              )
            ),
        )
      : undefined;
    const whereClause =
      baseFilter && searchFilter
        ? and(baseFilter, searchFilter)
        : baseFilter
          ? baseFilter
          : searchFilter;
    const properties = await db
      .select()
      .from(propertiesTable)
      .where(whereClause)
      .orderBy(propertiesTable.createdAt);
    sendValidated(res, PropertyListResponseSchema, { properties });
  } catch (err) {
    req.log.error({ err }, "Failed to list properties");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/properties", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const body = parseBody(CreatePropertyBody, req, res);
  if (!body) return;
  try {
    let { lat, lng, placeId, formattedAddress } = body;
    if (formattedAddress && (lat == null || lng == null)) {
      const geo = await geocodeAddress(formattedAddress);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        if (!placeId && geo.placeId) placeId = geo.placeId;
      } else {
        logger.warn({ formattedAddress }, "Geocoding failed for new property; saving without coordinates");
      }
    }
    const [property] = await db
      .insert(propertiesTable)
      .values({ id: randomUUID(), agentId: user.id, ...body, lat, lng, placeId })
      .returning();
    sendValidated(res, PropertyResponseSchema, { property }, 201);
  } catch (err) {
    req.log.error({ err }, "Failed to create property");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/properties/:propertyId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.propertyId, req, res);
  if (!params) return;
  try {
    const isAdmin = user.role === "admin";
    const [property] = await db
      .select()
      .from(propertiesTable)
      .where(
        isAdmin
          ? eq(propertiesTable.id, params.propertyId)
          : and(eq(propertiesTable.id, params.propertyId), eq(propertiesTable.agentId, user.id))
      );
    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    sendValidated(res, PropertyResponseSchema, { property });
  } catch (err) {
    req.log.error({ err }, "Failed to get property");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/properties/:propertyId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.propertyId, req, res);
  if (!params) return;
  const body = parseBody(UpdatePropertyBody, req, res);
  if (!body) return;
  const isAdmin = user.role === "admin";
  try {
    const [existing] = await db
      .select({ id: propertiesTable.id, lat: propertiesTable.lat, lng: propertiesTable.lng })
      .from(propertiesTable)
      .where(
        isAdmin
          ? eq(propertiesTable.id, params.propertyId)
          : and(eq(propertiesTable.id, params.propertyId), eq(propertiesTable.agentId, user.id))
      );
    if (!existing) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    let { lat, lng, placeId, formattedAddress } = body;
    if (formattedAddress && (lat == null || lng == null) && (existing.lat == null || existing.lng == null)) {
      const geo = await geocodeAddress(formattedAddress);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        if (!placeId && geo.placeId) placeId = geo.placeId;
      } else {
        logger.warn({ formattedAddress }, "Geocoding failed for updated property; saving without coordinates");
      }
    }
    const updatePayload = { ...body, updatedAt: new Date() } as Record<string, unknown>;
    if (lat != null) updatePayload.lat = lat;
    if (lng != null) updatePayload.lng = lng;
    if (placeId != null) updatePayload.placeId = placeId;
    const [property] = await db
      .update(propertiesTable)
      .set(updatePayload)
      .where(eq(propertiesTable.id, params.propertyId))
      .returning();
    sendValidated(res, PropertyResponseSchema, { property });
  } catch (err) {
    req.log.error({ err }, "Failed to update property");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/properties/:propertyId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.propertyId, req, res);
  if (!params) return;
  const isAdmin = user.role === "admin";
  try {
    const [existing] = await db
      .select({ id: propertiesTable.id })
      .from(propertiesTable)
      .where(
        isAdmin
          ? eq(propertiesTable.id, params.propertyId)
          : and(eq(propertiesTable.id, params.propertyId), eq(propertiesTable.agentId, user.id))
      );
    if (!existing) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    await db.delete(propertiesTable).where(eq(propertiesTable.id, params.propertyId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete property");
    res.status(500).json({ error: "Internal server error" });
  }
});

export async function geocodeMissingProperties(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const missing = await db
    .select({ id: propertiesTable.id, formattedAddress: propertiesTable.formattedAddress })
    .from(propertiesTable)
    .where(
      and(
        or(isNull(propertiesTable.lat), isNull(propertiesTable.lng)),
      )
    );

  const toGeocode = missing.filter(p => p.formattedAddress && p.formattedAddress.trim().length > 0);
  let succeeded = 0;
  let failed = 0;

  for (const prop of toGeocode) {
    try {
      const geo = await geocodeAddress(prop.formattedAddress!);
      if (geo) {
        await db
          .update(propertiesTable)
          .set({ lat: geo.lat, lng: geo.lng, placeId: geo.placeId ?? undefined, updatedAt: new Date() })
          .where(eq(propertiesTable.id, prop.id));
        succeeded++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  return { processed: toGeocode.length, succeeded, failed };
}

export default router;
