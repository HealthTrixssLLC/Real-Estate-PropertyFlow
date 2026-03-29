import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { CreateBuyerBody, UpdateBuyerBody } from "@workspace/api-zod";
import { idParams, parseParams, parseBody } from "../lib/validate";

const router: IRouter = Router();

router.get("/buyers", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ buyers: [] });
});

router.post("/buyers", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = parseBody(CreateBuyerBody, req, res);
  if (!body) return;
  const now = new Date().toISOString();
  const buyer = {
    id: randomUUID(),
    ...body,
    createdAt: now,
    updatedAt: now,
  };
  res.status(201).json({ buyer });
});

router.get("/buyers/:buyerId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  res.status(404).json({ error: "Buyer not found" });
});

router.put("/buyers/:buyerId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  const body = parseBody(UpdateBuyerBody, req, res);
  if (!body) return;
  res.status(404).json({ error: "Buyer not found" });
});

router.delete("/buyers/:buyerId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  res.status(204).send();
});

export default router;
