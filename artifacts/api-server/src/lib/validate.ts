import { type Request, type Response } from "express";
import { z } from "zod";

export const UUIDParam = z.object({ id: z.string().uuid().optional().or(z.string().min(1)) });

const uuidish = z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/);

export const idParams = {
  propertyId: z.object({ propertyId: uuidish }),
  tourId: z.object({ tourId: uuidish }),
  buyerId: z.object({ buyerId: uuidish }),
  tourStopId: z.object({ tourStopId: uuidish }),
  voiceNoteId: z.object({ voiceNoteId: uuidish }),
  showingId: z.object({ showingId: uuidish }),
};

export function parseParams<T extends z.ZodTypeAny>(
  schema: T,
  req: Request,
  res: Response,
): z.infer<T> | null {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid path parameters", details: parsed.error.issues });
    return null;
  }
  return parsed.data;
}

export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  req: Request,
  res: Response,
): z.infer<T> | null {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return null;
  }
  return parsed.data;
}
