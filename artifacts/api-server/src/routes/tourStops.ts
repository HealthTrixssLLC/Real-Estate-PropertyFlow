import { Router, type IRouter, type Request, type Response } from "express";
import { UpdateTourStopBody, AddStopNoteBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tour-stops/:stopId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(404).json({ error: "Stop not found" });
});

router.put("/tour-stops/:stopId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = UpdateTourStopBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  res.status(404).json({ error: "Stop not found" });
});

router.delete("/tour-stops/:stopId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(204).send();
});

router.post("/tour-stops/:stopId/arrive", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(404).json({ error: "Stop not found" });
});

router.post("/tour-stops/:stopId/complete", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(404).json({ error: "Stop not found" });
});

router.post("/tour-stops/:stopId/note", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = AddStopNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  res.status(404).json({ error: "Stop not found" });
});

router.post("/tour-stops/:stopId/summarize", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(404).json({ error: "Stop not found" });
});

export default router;
