import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";

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
  const { formattedAddress, placeId, lat, lng, city, state, zip, mlsId, listPrice, beds, baths, squareFeet, nickname, notes } = req.body as Record<string, unknown>;
  if (!formattedAddress) {
    res.status(400).json({ error: "formattedAddress is required" });
    return;
  }
  const now = new Date().toISOString();
  const property = {
    id: randomUUID(),
    formattedAddress,
    placeId: placeId ?? null,
    lat: lat ?? null,
    lng: lng ?? null,
    city: city ?? null,
    state: state ?? null,
    zip: zip ?? null,
    mlsId: mlsId ?? null,
    listPrice: listPrice ?? null,
    beds: beds ?? null,
    baths: baths ?? null,
    squareFeet: squareFeet ?? null,
    nickname: nickname ?? null,
    notes: notes ?? null,
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
