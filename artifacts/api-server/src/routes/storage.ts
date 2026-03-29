import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { z } from "zod";
import { sendValidated, UploadUrlResponseSchema } from "../lib/responseSchemas";
import { eq, like } from "drizzle-orm";
import { db, voiceNotesTable, tourStopsTable, toursTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const RequestUploadUrlBody = z.object({
  name: z.string(),
  size: z.number(),
  contentType: z.string(),
});

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    sendValidated(res, UploadUrlResponseSchema, { uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = (req as Express.AuthedRequest).user;

  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const voiceNotes = await db
      .select({
        id: voiceNotesTable.id,
        fileUrl: voiceNotesTable.fileUrl,
        agentId: toursTable.agentId,
      })
      .from(voiceNotesTable)
      .innerJoin(tourStopsTable, eq(tourStopsTable.id, voiceNotesTable.tourStopId))
      .innerJoin(toursTable, eq(toursTable.id, tourStopsTable.tourId))
      .where(like(voiceNotesTable.fileUrl, `%${wildcardPath}%`));

    if (voiceNotes.length === 0) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const ownsObject = voiceNotes.some(vn => vn.agentId === user.id);
    if (!ownsObject) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
