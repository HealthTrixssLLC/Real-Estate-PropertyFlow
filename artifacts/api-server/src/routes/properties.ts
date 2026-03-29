import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, propertiesTable } from "@workspace/db";
import { CreatePropertyBody, UpdatePropertyBody } from "@workspace/api-zod";
import { idParams, parseParams, parseBody } from "../lib/validate";

const router: IRouter = Router();

router.get("/properties", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const properties = await db.select().from(propertiesTable).orderBy(propertiesTable.createdAt);
    res.json({ properties });
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
  const body = parseBody(CreatePropertyBody, req, res);
  if (!body) return;
  try {
    const [property] = await db
      .insert(propertiesTable)
      .values({ id: randomUUID(), ...body })
      .returning();
    res.status(201).json({ property });
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
  const params = parseParams(idParams.propertyId, req, res);
  if (!params) return;
  try {
    const [property] = await db
      .select()
      .from(propertiesTable)
      .where(eq(propertiesTable.id, params.propertyId));
    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    res.json({ property });
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
  const params = parseParams(idParams.propertyId, req, res);
  if (!params) return;
  const body = parseBody(UpdatePropertyBody, req, res);
  if (!body) return;
  try {
    const [property] = await db
      .update(propertiesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(propertiesTable.id, params.propertyId))
      .returning();
    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    res.json({ property });
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
  const params = parseParams(idParams.propertyId, req, res);
  if (!params) return;
  try {
    await db.delete(propertiesTable).where(eq(propertiesTable.id, params.propertyId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete property");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
