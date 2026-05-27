import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { and, eq, or, ilike } from "drizzle-orm";
import { db, propertiesTable } from "@workspace/db";
import { CreatePropertyBody, UpdatePropertyBody } from "@workspace/api-zod";
import { idParams, parseParams, parseBody } from "../lib/validate";
import { sendValidated, PropertyResponseSchema, PropertyListResponseSchema } from "../lib/responseSchemas";

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
    const [property] = await db
      .insert(propertiesTable)
      .values({ id: randomUUID(), agentId: user.id, ...body })
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
    const [property] = await db
      .update(propertiesTable)
      .set({ ...body, updatedAt: new Date() })
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

export default router;
