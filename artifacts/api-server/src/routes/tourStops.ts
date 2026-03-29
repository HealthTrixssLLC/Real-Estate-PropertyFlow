import { Router, type IRouter, type Request, type Response } from "express";
import { UpdateTourStopBody, AddStopNoteBody } from "@workspace/api-zod";
import { idParams, parseParams, parseBody } from "../lib/validate";
import { z } from "zod";

const stopIdSchema = z.object({ stopId: z.string().min(1) });

const router: IRouter = Router();

router.get("/tour-stops/:stopId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  res.status(404).json({ error: "Stop not found" });
});

router.put("/tour-stops/:stopId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(UpdateTourStopBody, req, res);
  if (!body) return;
  res.status(404).json({ error: "Stop not found" });
});

router.delete("/tour-stops/:stopId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  res.status(204).send();
});

router.post("/tour-stops/:stopId/arrive", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  res.status(404).json({ error: "Stop not found" });
});

router.post("/tour-stops/:stopId/complete", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  res.status(404).json({ error: "Stop not found" });
});

router.post("/tour-stops/:stopId/note", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  const body = parseBody(AddStopNoteBody, req, res);
  if (!body) return;
  res.status(404).json({ error: "Stop not found" });
});

router.post("/tour-stops/:stopId/summarize", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = parseParams(stopIdSchema, req, res);
  if (!params) return;
  res.status(404).json({ error: "Stop not found" });
});

export default router;
