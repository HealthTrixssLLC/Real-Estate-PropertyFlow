import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { CreateBuyerBody, UpdateBuyerBody } from "@workspace/api-zod";

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
  const parsed = CreateBuyerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const now = new Date().toISOString();
  const buyer = {
    id: randomUUID(),
    ...parsed.data,
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
  res.status(404).json({ error: "Buyer not found" });
});

router.put("/buyers/:buyerId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = UpdateBuyerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  res.status(404).json({ error: "Buyer not found" });
});

router.delete("/buyers/:buyerId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(204).send();
});

export default router;
