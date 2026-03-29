import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import {
  CreateShowingRequestBody,
  UpdateShowingRequestBody,
  UpsertRestrictionNoteBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tour-stops/:stopId/showing-request", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ showingRequest: null });
});

router.post("/tour-stops/:stopId/showing-request", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateShowingRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const now = new Date().toISOString();
  const showingRequest = {
    id: randomUUID(),
    tourStopId: req.params.stopId,
    status: "not_requested" as const,
    ...parsed.data,
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
  const parsed = UpdateShowingRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  res.status(404).json({ error: "Showing request not found" });
});

router.get("/tour-stops/:stopId/restrictions", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ restrictionNote: null });
});

router.put("/tour-stops/:stopId/restrictions", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = UpsertRestrictionNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const now = new Date().toISOString();
  const restrictionNote = {
    id: randomUUID(),
    tourStopId: req.params.stopId,
    occupied: false,
    tenantNoticeRequired: false,
    doNotUseBathroom: false,
    removeShoes: false,
    ...parsed.data,
    createdAt: now,
    updatedAt: now,
  };
  res.json({ restrictionNote });
});

export default router;
