import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.post("/voice-notes/upload", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { tourStopId, durationSeconds } = req.body as Record<string, unknown>;
  if (!tourStopId || typeof tourStopId !== "string") {
    res.status(400).json({ error: "tourStopId is required" });
    return;
  }
  const now = new Date().toISOString();
  const voiceNote = {
    id: randomUUID(),
    tourStopId,
    fileUrl: "",
    durationSeconds: typeof durationSeconds === "number" ? durationSeconds : null,
    transcriptionStatus: "pending" as const,
    typedNote: null,
    createdAt: now,
    updatedAt: now,
  };
  res.status(201).json({ voiceNote });
});

router.post("/voice-notes/:voiceNoteId/transcribe", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(404).json({ error: "Voice note not found" });
});

router.get("/voice-notes/:voiceNoteId", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(404).json({ error: "Voice note not found" });
});

export default router;
