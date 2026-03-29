import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import {
  CreateShowingRequestBody,
  UpdateShowingRequestBody,
  UpsertRestrictionNoteBody,
} from "@workspace/api-zod";
import { parseParams, parseBody } from "../lib/validate";
import { z } from "zod";

const stopIdSchema = z.object({ stopId: z.string().min(1) });

const router: IRouter = Router();

router.get("/tour-stops/:stopId/showing-request", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  res.status(404).json({ error: "Showing request not found" });
});

router.post("/tour-stops/:stopId/showing-request", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(CreateShowingRequestBody, req, res);
  if (!body) return;
  const now = new Date().toISOString();
  const showingRequest = {
    id: randomUUID(),
    tourStopId: params.stopId,
    status: "not_requested" as const,
    ...body,
    createdAt: now,
    updatedAt: now,
  };
  res.status(201).json({ showingRequest });
});

router.put("/tour-stops/:stopId/showing-request", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(UpdateShowingRequestBody, req, res);
  if (!body) return;
  res.status(404).json({ error: "Showing request not found" });
});

router.get("/tour-stops/:stopId/restrictions", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  res.status(404).json({ error: "Restriction note not found" });
});

router.put("/tour-stops/:stopId/restrictions", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(UpsertRestrictionNoteBody, req, res);
  if (!body) return;
  const now = new Date().toISOString();
  const restrictionNote = {
    id: randomUUID(),
    tourStopId: params.stopId,
    occupied: false,
    tenantNoticeRequired: false,
    doNotUseBathroom: false,
    removeShoes: false,
    ...body,
    createdAt: now,
    updatedAt: now,
  };
  res.json({ restrictionNote });
});

export default router;
