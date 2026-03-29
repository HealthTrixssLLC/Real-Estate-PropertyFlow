import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { CreatePropertyBody, UpdatePropertyBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/properties", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ properties: [] });
});

router.post("/properties", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }
  const now = new Date().toISOString();
  const property = {
    id: randomUUID(),
    ...parsed.data,
    placeId: parsed.data.placeId ?? null,
    lat: parsed.data.lat ?? null,
    lng: parsed.data.lng ?? null,
    city: parsed.data.city ?? null,
    state: parsed.data.state ?? null,
    zip: parsed.data.zip ?? null,
    mlsId: parsed.data.mlsId ?? null,
    listPrice: parsed.data.listPrice ?? null,
    beds: parsed.data.beds ?? null,
    baths: parsed.data.baths ?? null,
    squareFeet: parsed.data.squareFeet ?? null,
    nickname: parsed.data.nickname ?? null,
    notes: parsed.data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  res.status(201).json({ property });
});

router.get("/properties/:propertyId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(404).json({ error: "Property not found" });
});

router.put("/properties/:propertyId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }
  res.status(404).json({ error: "Property not found" });
});

router.delete("/properties/:propertyId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(204).send();
});

export default router;
