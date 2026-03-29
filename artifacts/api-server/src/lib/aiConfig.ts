export interface AiConfigState {
  transcriptionEnabled: boolean;
  transcriptionProvider: string;
  summarizationEnabled: boolean;
  summarizationProvider: string;
  draftingEnabled: boolean;
  patternAnalysisEnabled: boolean;
}

function buildDefaultConfig(): AiConfigState {
  return {
    transcriptionEnabled: !!(process.env.AZURE_SPEECH_KEY || process.env.OPENAI_API_KEY),
    transcriptionProvider: process.env.AZURE_SPEECH_KEY ? "azure_speech" : "openai",
    summarizationEnabled: !!(process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
    summarizationProvider: process.env.AZURE_OPENAI_API_KEY ? "azure_openai" : "openai",
    draftingEnabled: !!(process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
    patternAnalysisEnabled: !!(process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
  };
}

export const aiConfig: AiConfigState = buildDefaultConfig();

export function updateAiConfig(updates: Partial<AiConfigState>): void {
  Object.assign(aiConfig, updates);
}

export function getAiConfigResponse() {
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
    azureOpenAiConfigured: !!(
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_BASE_URL &&
      process.env.AZURE_OPENAI_MODEL
    ),
    azureSpeechConfigured: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
    openAiConfigured: !!process.env.OPENAI_API_KEY,
  };
}
