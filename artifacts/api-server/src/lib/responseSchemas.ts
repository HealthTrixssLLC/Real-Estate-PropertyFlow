import { z } from "zod";

export const TourSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  buyerId: z.string().nullable().optional(),
  title: z.string(),
  date: z.string(),
  startTime: z.string().nullable().optional(),
  startAddress: z.string().nullable().optional(),
  startLat: z.number().nullable().optional(),
  startLng: z.number().nullable().optional(),
  endAddress: z.string().nullable().optional(),
  endLat: z.number().nullable().optional(),
  endLng: z.number().nullable().optional(),
  buyerNotes: z.string().nullable().optional(),
  geographicArea: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  status: z.enum(["draft", "active", "published", "completed", "cancelled"]),
  publishedAt: z.date().nullable().optional(),
  stopCount: z.number().optional(),
  approvedCount: z.number().optional(),
  pendingShowingsCount: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TourStopSchema = z.object({
  id: z.string(),
  tourId: z.string(),
  propertyId: z.string(),
  sequence: z.number(),
  approvedStatus: z.string(),
  skipped: z.boolean(),
  skipReason: z.string().nullable().optional(),
  skipNotes: z.string().nullable().optional(),
  visited: z.boolean(),
  arrivalTime: z.date().nullable().optional(),
  departureTime: z.date().nullable().optional(),
  buyerInterest: z.number().nullable().optional(),
  kitchenRating: z.number().nullable().optional(),
  primarySuiteRating: z.number().nullable().optional(),
  backyardRating: z.number().nullable().optional(),
  roadNoiseRating: z.number().nullable().optional(),
  overallFitRating: z.number().nullable().optional(),
  followUpFlag: z.boolean(),
  revisitFlag: z.boolean(),
  quickTags: z.array(z.string()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TourListResponseSchema = z.object({
  tours: z.array(TourSchema),
});

export const TourResponseSchema = z.object({
  tour: TourSchema,
});

export const TourDetailResponseSchema = z.object({
  tour: TourSchema,
  stops: z.array(TourStopSchema),
  buyer: z.record(z.unknown()).nullable(),
});

export const TourStopResponseSchema = z.object({
  stop: TourStopSchema,
});

export const SkipStopResponseSchema = z.object({
  skippedStop: TourStopSchema,
  nextStop: TourStopSchema.nullable(),
});

export const OptimizeResponseSchema = z.object({
  orderedStopIds: z.array(z.string()),
  estimatedDriveTimeMinutes: z.number(),
});

export function sendValidated<T>(
  res: import("express").Response,
  schema: z.ZodSchema<T>,
  data: unknown,
  status = 200,
): void {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(500).json({ error: "Response validation failed", details: result.error.issues });
    return;
  }
  res.status(status).json(result.data);
}
