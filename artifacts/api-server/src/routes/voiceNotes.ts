import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.post("/voice-notes/upload", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const now = new Date().toISOString();
  const voiceNote = {
    id: randomUUID(),
    tourStopId: req.body?.tourStopId ?? "",
    fileUrl: "",
    durationSeconds: req.body?.durationSeconds ?? null,
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
