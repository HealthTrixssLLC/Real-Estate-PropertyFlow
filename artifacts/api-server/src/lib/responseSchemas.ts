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
  buyerName: z.string().nullable().optional(),
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
  predictedFitScore: z.number().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TourListResponseSchema = z.object({
  tours: z.array(TourSchema),
});

export const TourResponseSchema = z.object({
  tour: TourSchema,
});

export const TourStopWithAddressSchema = TourStopSchema.extend({
  formattedAddress: z.string(),
  propertyNickname: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});

export const TourDetailResponseSchema = z.object({
  tour: TourSchema,
  stops: z.array(TourStopWithAddressSchema),
  buyer: z.record(z.unknown()).nullable(),
  pendingTranscriptions: z.number().optional(),
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
  agentId: z.string(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  preferenceProfile: z.string().nullable().optional(),
  preferenceProfileUpdatedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const PropertySchema = z.object({
  id: z.string(),
  agentId: z.string(),
  formattedAddress: z.string(),
  placeId: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  mlsId: z.string().nullable().optional(),
  listPrice: z.number().nullable().optional(),
  beds: z.number().nullable().optional(),
  baths: z.number().nullable().optional(),
  squareFeet: z.number().nullable().optional(),
  nickname: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  archived: z.boolean(),
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

export const TranscriptSchema = z.object({
  id: z.string(),
  voiceNoteId: z.string(),
  text: z.string(),
  provider: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  createdAt: z.date(),
});

export const PropertySummarySchema = z.object({
  id: z.string(),
  tourStopId: z.string(),
  summaryText: z.string(),
  positives: z.array(z.string()).nullable().optional(),
  negatives: z.array(z.string()).nullable().optional(),
  questions: z.array(z.string()).nullable().optional(),
  provider: z.string().nullable().optional(),
  generatedAt: z.date(),
  createdAt: z.date(),
});

export const TourSummarySchema = z.object({
  id: z.string(),
  tourId: z.string(),
  summaryText: z.string(),
  topHomes: z.array(z.string()).nullable().optional(),
  homesToEliminate: z.array(z.string()).nullable().optional(),
  buyerPreferences: z.array(z.string()).nullable().optional(),
  nextActions: z.array(z.string()).nullable().optional(),
  provider: z.string().nullable().optional(),
  generatedAt: z.date(),
  createdAt: z.date(),
});

export const DebriefVoiceNoteSchema = z.object({
  id: z.string(),
  tourStopId: z.string(),
  buyerId: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  transcript: z.string().nullable().optional(),
  aiSummary: z.string().nullable().optional(),
  fitScore: z.number().nullable().optional(),
  fitScorePositives: z.array(z.string()).nullable().optional(),
  fitScoreNegatives: z.array(z.string()).nullable().optional(),
  fitScoreVerdict: z.string().nullable().optional(),
  processingStatus: z.enum(["pending", "transcribing", "scoring", "completed", "failed"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const DebriefVoiceNoteResponseSchema = z.object({
  debrief: DebriefVoiceNoteSchema,
});

export const DebriefVoiceNoteNullableResponseSchema = z.object({
  debrief: DebriefVoiceNoteSchema.nullable(),
});

const AiFeatureConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.string(),
});

export const AiConfigResponseSchema = z.object({
  config: z.object({
    transcription: AiFeatureConfigSchema,
    summarization: AiFeatureConfigSchema,
    drafting: AiFeatureConfigSchema,
    patternAnalysis: AiFeatureConfigSchema,
    azureOpenAiConfigured: z.boolean(),
    azureOpenAiBaseUrl: z.string().nullable().optional(),
    azureOpenAiModel: z.string().nullable().optional(),
    azureWhisperConfigured: z.boolean(),
    azureWhisperDeployment: z.string().optional(),
    azureSpeechConfigured: z.boolean(),
    openAiConfigured: z.boolean(),
    googleMapsConfigured: z.boolean(),
  }),
});

export const AiTestResponseSchema = z.object({
  success: z.boolean(),
  result: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

const ProviderHealthSchema = z.object({
  healthy: z.boolean(),
  error: z.string().nullable().optional(),
});

export const AiHealthResponseSchema = z.object({
  providers: z.object({
    azure_openai: ProviderHealthSchema,
    azure_whisper: ProviderHealthSchema,
    azure_speech: ProviderHealthSchema,
    openai: ProviderHealthSchema,
  }),
});

export const UploadUrlResponseSchema = z.object({
  uploadURL: z.string(),
  objectPath: z.string(),
  metadata: z.object({
    name: z.string(),
    size: z.number(),
    contentType: z.string(),
  }),
});

export const SuccessResponseSchema = z.object({ success: z.boolean() });

export const TourReadinessResponseSchema = z.object({
  approvedCount: z.number(),
  pendingCount: z.number(),
  declinedCount: z.number(),
  missingAgentInfoCount: z.number(),
  estimatedDriveTimeMinutes: z.number(),
  estimatedTotalMinutes: z.number(),
});

export const TourStopDetailResponseSchema = z.object({
  stop: TourStopSchema,
  property: PropertySchema.nullable(),
  showingRequest: ShowingRequestSchema.nullable(),
  restrictionNote: RestrictionNoteSchema.nullable(),
  voiceNotes: z.array(VoiceNoteSchema),
  propertySummary: PropertySummarySchema.nullable(),
  debrief: DebriefVoiceNoteSchema.nullable(),
});

export const VoiceNoteDetailResponseSchema = z.object({
  voiceNote: VoiceNoteSchema,
  transcript: TranscriptSchema.nullable(),
});

export const PropertySummaryResponseSchema = z.object({ summary: PropertySummarySchema });
export const TourSummaryResponseSchema = z.object({ summary: TourSummarySchema });

export const BuyerDetailStopCommentSchema = z.object({
  id: z.string(),
  text: z.string(),
  isVoiceNote: z.boolean().optional(),
  transcriptionStatus: z.string().nullable().optional(),
  createdAt: z.date(),
});

export const BuyerDetailStopSchema = z.object({
  id: z.string(),
  tourId: z.string(),
  propertyId: z.string(),
  sequence: z.number(),
  formattedAddress: z.string(),
  propertyNickname: z.string().nullable().optional(),
  listPrice: z.number().nullable().optional(),
  beds: z.number().nullable().optional(),
  baths: z.number().nullable().optional(),
  squareFeet: z.number().nullable().optional(),
  approvedStatus: z.string(),
  showingStatus: z.string().nullable().optional(),
  skipped: z.boolean(),
  skipReason: z.string().nullable().optional(),
  skipNotes: z.string().nullable().optional(),
  visited: z.boolean(),
  arrivalTime: z.date().nullable().optional(),
  departureTime: z.date().nullable().optional(),
  overallFitRating: z.number().nullable().optional(),
  buyerInterest: z.number().nullable().optional(),
  kitchenRating: z.number().nullable().optional(),
  primarySuiteRating: z.number().nullable().optional(),
  backyardRating: z.number().nullable().optional(),
  roadNoiseRating: z.number().nullable().optional(),
  followUpFlag: z.boolean(),
  revisitFlag: z.boolean(),
  quickTags: z.array(z.string()).nullable().optional(),
  predictedFitScore: z.number().nullable().optional(),
  fitScore: z.number().nullable().optional(),
  fitScorePositives: z.array(z.string()).nullable().optional(),
  fitScoreNegatives: z.array(z.string()).nullable().optional(),
  fitScoreVerdict: z.string().nullable().optional(),
  debriefTranscript: z.string().nullable().optional(),
  debriefSummary: z.string().nullable().optional(),
  debriefStatus: z.string().nullable().optional(),
  comments: z.array(BuyerDetailStopCommentSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const BuyerDetailTourSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  status: z.enum(["draft", "active", "published", "completed", "cancelled"]),
  stops: z.array(BuyerDetailStopSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const BuyerDetailResponseSchema = z.object({
  buyer: BuyerSchema,
  tours: z.array(BuyerDetailTourSchema),
  preferenceProfile: z.record(z.unknown()).nullable(),
});

export const PreferenceProfileResponseSchema = z.object({
  preferenceProfile: z.record(z.unknown()),
  updatedStops: z.number(),
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
