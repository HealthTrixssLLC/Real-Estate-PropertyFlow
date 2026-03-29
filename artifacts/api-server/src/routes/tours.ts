import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import {
  CreateTourBody,
  UpdateTourBody,
  AddPropertyToTourBody,
  OptimizeTourRouteBody,
  ReorderTourStopsBody,
  SkipTourStopBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tours", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ tours: [] });
});

router.post("/tours", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateTourBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const now = new Date().toISOString();
  const tour = {
    id: randomUUID(),
    agentId: (req as Express.AuthedRequest).user.id,
    ...parsed.data,
    status: "draft" as const,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  res.status(201).json({ tour });
});

router.get("/tours/:tourId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(404).json({ error: "Tour not found" });
});

router.put("/tours/:tourId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = UpdateTourBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  res.status(404).json({ error: "Tour not found" });
});

router.delete("/tours/:tourId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(204).send();
});

router.post("/tours/:tourId/properties", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = AddPropertyToTourBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const now = new Date().toISOString();
  const stop = {
    id: randomUUID(),
    tourId: req.params.tourId,
    propertyId: randomUUID(),
    sequence: 0,
    approvedStatus: "not_requested",
    skipped: false,
    visited: false,
    followUpFlag: false,
    revisitFlag: false,
    createdAt: now,
    updatedAt: now,
  };
  res.status(201).json({ stop });
});

router.post("/tours/:tourId/optimize", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = OptimizeTourRouteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }
  res.json({ orderedStopIds: [], estimatedDriveTimeMinutes: 0 });
});

router.put("/tours/:tourId/stops/order", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = ReorderTourStopsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  res.json({ success: true });
});

router.post("/tours/:tourId/skip-stop", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = SkipTourStopBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  res.status(404).json({ error: "Stop not found" });
});

router.post("/tours/:tourId/publish", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(404).json({ error: "Tour not found" });
});

router.get("/tours/:tourId/readiness", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({
    approvedCount: 0,
    pendingCount: 0,
    declinedCount: 0,
    missingAgentInfoCount: 0,
    estimatedDriveTimeMinutes: 0,
    estimatedTotalMinutes: 0,
  });
});

router.post("/tours/:tourId/generate-summary", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(404).json({ error: "Tour not found" });
});

router.get("/mobile/tours/active", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ tours: [] });
});

export default router;
