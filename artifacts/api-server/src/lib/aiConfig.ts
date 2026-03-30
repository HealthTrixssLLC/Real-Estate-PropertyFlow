import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AiConfigState {
  transcriptionEnabled: boolean;
  transcriptionProvider: string;
  summarizationEnabled: boolean;
  summarizationProvider: string;
  draftingEnabled: boolean;
  patternAnalysisEnabled: boolean;
}

const CONFIG_KEY = "ai_config";

function buildDefaultConfig(): AiConfigState {
  const hasAzureOpenAi = !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_BASE_URL);
  return {
    transcriptionEnabled: !!(hasAzureOpenAi || process.env.AZURE_SPEECH_KEY || process.env.OPENAI_API_KEY),
    transcriptionProvider: hasAzureOpenAi ? "azure_whisper" : process.env.AZURE_SPEECH_KEY ? "azure_speech" : "openai",
    summarizationEnabled: !!(hasAzureOpenAi || process.env.OPENAI_API_KEY),
    summarizationProvider: hasAzureOpenAi ? "azure_openai" : "openai",
    draftingEnabled: !!(hasAzureOpenAi || process.env.OPENAI_API_KEY),
    patternAnalysisEnabled: !!(hasAzureOpenAi || process.env.OPENAI_API_KEY),
  };
}

export const aiConfig: AiConfigState = buildDefaultConfig();

export async function loadAiConfigFromDb(): Promise<void> {
  try {
    const [row] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, CONFIG_KEY));
    if (row) {
      const saved = JSON.parse(row.value) as Partial<AiConfigState>;
      Object.assign(aiConfig, saved);
    }
  } catch {
  }
}

export function updateAiConfig(updates: Partial<AiConfigState>): void {
  Object.assign(aiConfig, updates);
  const value = JSON.stringify(aiConfig);
  db.insert(appSettingsTable)
    .values({ key: CONFIG_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } })
    .catch(() => {});
}

export function getAiConfigResponse() {
  const hasAzureKey = !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_BASE_URL);
  return {
    transcription: {
      enabled: aiConfig.transcriptionEnabled,
      provider: aiConfig.transcriptionProvider,
    },
    summarization: {
      enabled: aiConfig.summarizationEnabled,
      provider: aiConfig.summarizationProvider,
    },
    drafting: {
      enabled: aiConfig.draftingEnabled,
      provider: aiConfig.summarizationProvider,
    },
    patternAnalysis: {
      enabled: aiConfig.patternAnalysisEnabled,
      provider: aiConfig.summarizationProvider,
    },
    azureOpenAiConfigured: !!(hasAzureKey && process.env.AZURE_OPENAI_MODEL),
    azureOpenAiBaseUrl: process.env.AZURE_OPENAI_BASE_URL ?? null,
    azureOpenAiModel: process.env.AZURE_OPENAI_MODEL ?? null,
    azureWhisperConfigured: hasAzureKey,
    azureWhisperDeployment: process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? "whisper",
    azureSpeechConfigured: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
    openAiConfigured: !!process.env.OPENAI_API_KEY,
  };
}
