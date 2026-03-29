import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

router.get("/admin/ai/config", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const config = {
    transcription: {
      enabled: !!process.env.AZURE_SPEECH_KEY || !!process.env.OPENAI_API_KEY,
      provider: process.env.AZURE_SPEECH_KEY ? "azure_speech" : "openai",
    },
    summarization: {
      enabled: !!(process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
      provider: process.env.AZURE_OPENAI_API_KEY ? "azure_openai" : "openai",
    },
    drafting: {
      enabled: !!(process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
      provider: process.env.AZURE_OPENAI_API_KEY ? "azure_openai" : "openai",
    },
    patternAnalysis: {
      enabled: !!(process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
      provider: process.env.AZURE_OPENAI_API_KEY ? "azure_openai" : "openai",
    },
    azureOpenAiConfigured: !!(
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_BASE_URL &&
      process.env.AZURE_OPENAI_MODEL
    ),
    azureSpeechConfigured: !!(
      process.env.AZURE_SPEECH_KEY &&
      process.env.AZURE_SPEECH_REGION
    ),
    openAiConfigured: !!process.env.OPENAI_API_KEY,
  };
  res.json({ config });
});

router.post("/admin/ai/config", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({
    config: {
      transcription: { enabled: false, provider: "azure_speech" },
      summarization: { enabled: false, provider: "azure_openai" },
      drafting: { enabled: false, provider: "azure_openai" },
      patternAnalysis: { enabled: false, provider: "azure_openai" },
      azureOpenAiConfigured: false,
      azureSpeechConfigured: false,
      openAiConfigured: false,
    },
  });
});

router.post("/admin/ai/config/test", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ success: false, error: "AI provider not configured" });
});

router.get("/admin/ai/health", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({
    providers: {
      azure_openai: {
        healthy: !!(
          process.env.AZURE_OPENAI_API_KEY &&
          process.env.AZURE_OPENAI_BASE_URL
        ),
        error: null,
      },
      azure_speech: {
        healthy: !!(
          process.env.AZURE_SPEECH_KEY &&
          process.env.AZURE_SPEECH_REGION
        ),
        error: null,
      },
      openai: {
        healthy: !!process.env.OPENAI_API_KEY,
        error: null,
      },
    },
  });
});

export default router;
