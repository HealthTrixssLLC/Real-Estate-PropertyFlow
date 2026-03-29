import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, buyersTable } from "@workspace/db";
import { CreateBuyerBody, UpdateBuyerBody } from "@workspace/api-zod";
import { idParams, parseParams, parseBody } from "../lib/validate";
import { sendValidated, BuyerResponseSchema, BuyerListResponseSchema } from "../lib/responseSchemas";

const router: IRouter = Router();

router.get("/buyers", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const buyers = await db.select().from(buyersTable).orderBy(buyersTable.createdAt);
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
  const body = parseBody(CreateBuyerBody, req, res);
  if (!body) return;
  try {
    const [buyer] = await db.insert(buyersTable).values({ id: randomUUID(), ...body }).returning();
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
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  try {
    const [buyer] = await db.select().from(buyersTable).where(eq(buyersTable.id, params.buyerId));
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
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  const body = parseBody(UpdateBuyerBody, req, res);
  if (!body) return;
  try {
    const [buyer] = await db
      .update(buyersTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(buyersTable.id, params.buyerId))
      .returning();
    if (!buyer) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }
    sendValidated(res, BuyerResponseSchema, { buyer });
  } catch (err) {
    req.log.error({ err }, "Failed to update buyer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/buyers/:buyerId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  try {
    await db.delete(buyersTable).where(eq(buyersTable.id, params.buyerId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete buyer");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
