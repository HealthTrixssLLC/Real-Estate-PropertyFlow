import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

const router: IRouter = Router();

router.post(
  "/voice-notes/upload",
  upload.single("audio"),
  (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const tourStopId = req.body?.tourStopId as string | undefined;
    if (!tourStopId) {
      res.status(400).json({ error: "tourStopId is required" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "audio file is required" });
      return;
    }
    const durationSeconds = req.body?.durationSeconds
      ? Number(req.body.durationSeconds)
      : null;
    const now = new Date().toISOString();
    const voiceNote = {
      id: randomUUID(),
      tourStopId,
      fileUrl: "",
      durationSeconds: isNaN(durationSeconds as number) ? null : durationSeconds,
      transcriptionStatus: "pending" as const,
      typedNote: null,
      createdAt: now,
      updatedAt: now,
    };
    res.status(201).json({ voiceNote });
  },
);

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
