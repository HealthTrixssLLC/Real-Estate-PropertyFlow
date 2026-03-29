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

export const BuyerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const PropertySchema = z.object({
  id: z.string(),
  formattedAddress: z.string().nullable().optional(),
  streetAddress: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  beds: z.number().nullable().optional(),
  baths: z.number().nullable().optional(),
  squareFeet: z.number().nullable().optional(),
  listPrice: z.number().nullable().optional(),
  yearBuilt: z.number().nullable().optional(),
  garageSpaces: z.number().nullable().optional(),
  mlsId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ShowingRequestSchema = z.object({
  id: z.string(),
  tourStopId: z.string(),
  status: z.string(),
  listingAgentName: z.string().nullable().optional(),
  brokerageName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  requestMethod: z.string().nullable().optional(),
  requestedAt: z.date().nullable().optional(),
  requestedWindowStart: z.string().nullable().optional(),
  requestedWindowEnd: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const RestrictionNoteSchema = z.object({
  id: z.string(),
  tourStopId: z.string(),
  occupied: z.boolean(),
  tenantNoticeRequired: z.boolean(),
  doNotUseBathroom: z.boolean(),
  removeShoes: z.boolean(),
  gateCode: z.string().nullable().optional(),
  alarmInstructions: z.string().nullable().optional(),
  petInstructions: z.string().nullable().optional(),
  parkingInstructions: z.string().nullable().optional(),
  timeRestriction: z.string().nullable().optional(),
  offerDeadlineNote: z.string().nullable().optional(),
  freeTextNotes: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const VoiceNoteSchema = z.object({
  id: z.string(),
  tourStopId: z.string(),
  fileUrl: z.string(),
  durationSeconds: z.number().nullable().optional(),
  transcriptionStatus: z.string(),
  typedNote: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ListingAgentContactSchema = z.object({
  id: z.string(),
  tourStopId: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  brokerageName: z.string().nullable().optional(),
  preferredContactMethod: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const BuyerResponseSchema = z.object({ buyer: BuyerSchema });
export const BuyerListResponseSchema = z.object({ buyers: z.array(BuyerSchema) });
export const PropertyResponseSchema = z.object({ property: PropertySchema });
export const PropertyListResponseSchema = z.object({ properties: z.array(PropertySchema) });
export const ShowingRequestResponseSchema = z.object({ showingRequest: ShowingRequestSchema });
export const RestrictionNoteResponseSchema = z.object({ restrictionNote: RestrictionNoteSchema.nullable() });
export const VoiceNoteResponseSchema = z.object({ voiceNote: VoiceNoteSchema });
export const ListingAgentContactResponseSchema = z.object({ contact: ListingAgentContactSchema.nullable() });

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
