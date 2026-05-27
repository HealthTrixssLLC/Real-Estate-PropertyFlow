import { Router, type IRouter, type Request, type Response } from "express";
import { SaveAiConfigBody, TestAiConfigBody, TestGoogleMapsConfigBody } from "@workspace/api-zod";
import { requireRole, requireAuth } from "../middlewares/authMiddleware";
import { aiConfig, updateAiConfig, getAiConfigResponse } from "../lib/aiConfig";
import {
  generateText,
  azureOpenAiProvider,
  azureWhisperProvider,
  azureSpeechProvider,
  openAiProvider,
  resolveSpeechProvider,
} from "../lib/ai";
import {
  sendValidated,
  AiConfigResponseSchema,
  AiTestResponseSchema,
  AiHealthResponseSchema,
} from "../lib/responseSchemas";

export { aiConfig };

const router: IRouter = Router();

router.get("/config/maps-key", requireAuth, (_req: Request, res: Response) => {
  const key = aiConfig.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY || null;
  res.json({ key });
});

router.get("/admin/ai/config", requireRole("admin"), (_req: Request, res: Response) => {
  sendValidated(res, AiConfigResponseSchema, { config: getAiConfigResponse() });
});

router.post("/admin/ai/config", requireRole("admin"), (req: Request, res: Response) => {
  const parsed = SaveAiConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }
  const body = parsed.data as {
    transcriptionEnabled?: boolean;
    transcriptionProvider?: string;
    summarizationEnabled?: boolean;
    summarizationProvider?: string;
    draftingEnabled?: boolean;
    patternAnalysisEnabled?: boolean;
    azureOpenAiBaseUrl?: string;
    azureOpenAiModel?: string;
    azureOpenAiWhisperDeployment?: string;
    azureSpeechRegion?: string;
    googleMapsApiKey?: string;
  };

  updateAiConfig({
    transcriptionEnabled: body.transcriptionEnabled ?? aiConfig.transcriptionEnabled,
    transcriptionProvider: body.transcriptionProvider ?? aiConfig.transcriptionProvider,
    summarizationEnabled: body.summarizationEnabled ?? aiConfig.summarizationEnabled,
    summarizationProvider: body.summarizationProvider ?? aiConfig.summarizationProvider,
    draftingEnabled: body.draftingEnabled ?? aiConfig.draftingEnabled,
    patternAnalysisEnabled: body.patternAnalysisEnabled ?? aiConfig.patternAnalysisEnabled,
    googleMapsApiKey: body.googleMapsApiKey !== undefined ? body.googleMapsApiKey : aiConfig.googleMapsApiKey,
  });

  if (body.azureOpenAiBaseUrl) process.env.AZURE_OPENAI_BASE_URL = body.azureOpenAiBaseUrl;
  if (body.azureOpenAiModel) process.env.AZURE_OPENAI_MODEL = body.azureOpenAiModel;
  if (body.azureOpenAiWhisperDeployment) process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT = body.azureOpenAiWhisperDeployment;
  if (body.azureSpeechRegion) process.env.AZURE_SPEECH_REGION = body.azureSpeechRegion;

  sendValidated(res, AiConfigResponseSchema, { config: getAiConfigResponse() });
});

router.post("/admin/ai/config/test", requireRole("admin"), async (req: Request, res: Response) => {
  const parsed = TestAiConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }
  const { feature, prompt } = parsed.data;

  try {
    if (feature === "transcription") {
      const speechProvider = resolveSpeechProvider(aiConfig.transcriptionProvider);
      const result = await speechProvider.ping();
      sendValidated(res, AiTestResponseSchema, {
        success: result.healthy,
        result: result.healthy ? "Speech provider is reachable" : null,
        error: result.error ?? null,
      });
      return;
    }

    const testPrompt = prompt ?? "Reply with the single word: OK";
    const result = await generateText(testPrompt, aiConfig.summarizationProvider);
    sendValidated(res, AiTestResponseSchema, { success: true, result: result.text });
  } catch (err) {
    sendValidated(res, AiTestResponseSchema, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/admin/ai/config/test-google-maps", requireRole("admin"), async (req: Request, res: Response) => {
  const parsed = TestGoogleMapsConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const key = parsed.data.apiKey || aiConfig.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    sendValidated(res, AiTestResponseSchema, {
      success: false,
      error: "No Google Maps API key configured. Enter a key and save it first.",
    });
    return;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${encodeURIComponent(key)}`;
    const response = await fetch(url);
    const data = await response.json() as { status: string; error_message?: string };
    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      sendValidated(res, AiTestResponseSchema, {
        success: true,
        result: "Google Maps API key is valid and the Geocoding API is reachable.",
      });
    } else {
      sendValidated(res, AiTestResponseSchema, {
        success: false,
        error: data.error_message ?? `Google Maps API returned status: ${data.status}`,
      });
    }
  } catch (err) {
    sendValidated(res, AiTestResponseSchema, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/admin/ai/health", requireRole("admin"), async (_req: Request, res: Response) => {
  const [azureOpenAi, azureWhisper, azureSpeech, openaiResult] = await Promise.all([
    azureOpenAiProvider.ping().catch((e: unknown) => ({ healthy: false, error: String(e) })),
    azureWhisperProvider.ping().catch((e: unknown) => ({ healthy: false, error: String(e) })),
    azureSpeechProvider.ping().catch((e: unknown) => ({ healthy: false, error: String(e) })),
    openAiProvider.ping().catch((e: unknown) => ({ healthy: false, error: String(e) })),
  ]);

  sendValidated(res, AiHealthResponseSchema, {
    providers: {
      azure_openai: azureOpenAi,
      azure_whisper: azureWhisper,
      azure_speech: azureSpeech,
      openai: openaiResult,
    },
  });
});

export default router;
