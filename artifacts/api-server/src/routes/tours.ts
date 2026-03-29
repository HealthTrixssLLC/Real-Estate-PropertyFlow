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
import { idParams, parseParams, parseBody } from "../lib/validate";

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
  const body = parseBody(CreateTourBody, req, res);
  if (!body) return;
  const now = new Date().toISOString();
  const tour = {
    id: randomUUID(),
    agentId: (req as Express.AuthedRequest).user.id,
    ...body,
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
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  res.status(404).json({ error: "Tour not found" });
});

router.put("/tours/:tourId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(UpdateTourBody, req, res);
  if (!body) return;
  res.status(404).json({ error: "Tour not found" });
});

router.delete("/tours/:tourId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  res.status(204).send();
});

router.post("/tours/:tourId/properties", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(AddPropertyToTourBody, req, res);
  if (!body) return;
  const now = new Date().toISOString();
  const stop = {
    id: randomUUID(),
    tourId: params.tourId,
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
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(OptimizeTourRouteBody, req, res);
  if (!body) return;
  res.json({ orderedStopIds: [], estimatedDriveTimeMinutes: 0 });
});

router.put("/tours/:tourId/stops/order", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(ReorderTourStopsBody, req, res);
  if (!body) return;
  res.json({ success: true });
});

router.post("/tours/:tourId/skip-stop", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(SkipTourStopBody, req, res);
  if (!body) return;
  res.status(404).json({ error: "Stop not found" });
});

router.post("/tours/:tourId/publish", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  res.status(404).json({ error: "Tour not found" });
});

router.get("/tours/:tourId/readiness", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
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
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
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
