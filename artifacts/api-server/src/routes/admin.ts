import { Router, type IRouter, type Request, type Response } from "express";
import { SaveAiConfigBody, TestAiConfigBody } from "@workspace/api-zod";
import { requireRole } from "../middlewares/authMiddleware";
import { aiConfig, updateAiConfig, getAiConfigResponse } from "../lib/aiConfig";
import {
  generateText,
  azureOpenAiProvider,
  openAiProvider,
  azureSpeechProvider,
  resolveSpeechProvider,
} from "../lib/ai";

export { aiConfig };

const router: IRouter = Router();

router.get("/admin/ai/config", requireRole("agent"), (_req: Request, res: Response) => {
  res.json({ config: getAiConfigResponse() });
});

router.post("/admin/ai/config", requireRole("agent"), (req: Request, res: Response) => {
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
    azureSpeechRegion?: string;
  };

  updateAiConfig({
    transcriptionEnabled: body.transcriptionEnabled ?? aiConfig.transcriptionEnabled,
    transcriptionProvider: body.transcriptionProvider ?? aiConfig.transcriptionProvider,
    summarizationEnabled: body.summarizationEnabled ?? aiConfig.summarizationEnabled,
    summarizationProvider: body.summarizationProvider ?? aiConfig.summarizationProvider,
    draftingEnabled: body.draftingEnabled ?? aiConfig.draftingEnabled,
    patternAnalysisEnabled: body.patternAnalysisEnabled ?? aiConfig.patternAnalysisEnabled,
  });

  if (body.azureOpenAiBaseUrl) process.env.AZURE_OPENAI_BASE_URL = body.azureOpenAiBaseUrl;
  if (body.azureOpenAiModel) process.env.AZURE_OPENAI_MODEL = body.azureOpenAiModel;
  if (body.azureSpeechRegion) process.env.AZURE_SPEECH_REGION = body.azureSpeechRegion;

  res.json({ config: getAiConfigResponse() });
});

router.post("/admin/ai/config/test", requireRole("agent"), async (req: Request, res: Response) => {
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
      res.json({
        success: result.healthy,
        result: result.healthy ? "Speech provider is reachable" : undefined,
        error: result.error ?? undefined,
      });
      return;
    }

    const testPrompt = prompt ?? "Reply with the single word: OK";
    const result = await generateText(testPrompt, aiConfig.summarizationProvider);
    res.json({ success: true, result: result.text });
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/admin/ai/health", requireRole("agent"), async (_req: Request, res: Response) => {
  const [azureOpenAi, azureSpeech, openaiResult] = await Promise.all([
    azureOpenAiProvider.ping().catch((e: unknown) => ({ healthy: false, error: String(e) })),
    azureSpeechProvider.ping().catch((e: unknown) => ({ healthy: false, error: String(e) })),
    openAiProvider.ping().catch((e: unknown) => ({ healthy: false, error: String(e) })),
  ]);

  res.json({
    providers: {
      azure_openai: azureOpenAi,
      azure_speech: azureSpeech,
      openai: openaiResult,
    },
  });
});

export default router;
