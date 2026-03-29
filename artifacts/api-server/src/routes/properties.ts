import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { CreatePropertyBody, UpdatePropertyBody } from "@workspace/api-zod";
import { idParams, parseParams, parseBody } from "../lib/validate";

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
  const body = parseBody(CreatePropertyBody, req, res);
  if (!body) return;
  const now = new Date().toISOString();
  const property = {
    id: randomUUID(),
    ...body,
    placeId: body.placeId ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    zip: body.zip ?? null,
    mlsId: body.mlsId ?? null,
    listPrice: body.listPrice ?? null,
    beds: body.beds ?? null,
    baths: body.baths ?? null,
    squareFeet: body.squareFeet ?? null,
    nickname: body.nickname ?? null,
    notes: body.notes ?? null,
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
  const params = parseParams(idParams.propertyId, req, res);
  if (!params) return;
  res.status(404).json({ error: "Property not found" });
});

router.put("/properties/:propertyId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.propertyId, req, res);
  if (!params) return;
  const body = parseBody(UpdatePropertyBody, req, res);
  if (!body) return;
  res.status(404).json({ error: "Property not found" });
});

router.delete("/properties/:propertyId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.propertyId, req, res);
  if (!params) return;
  res.status(204).send();
});

export default router;
