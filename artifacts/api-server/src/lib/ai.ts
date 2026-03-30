export interface AiTextProvider {
  readonly name: string;
  generateText(prompt: string): Promise<string>;
  ping(): Promise<{ healthy: boolean; error: string | null }>;
}

export interface AiSpeechProvider {
  readonly name: string;
  transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<{ text: string; confidence?: number }>;
  ping(): Promise<{ healthy: boolean; error: string | null }>;
}

export interface AiTextResult {
  text: string;
  provider: string;
}

export interface AiTranscriptResult {
  text: string;
  provider: string;
  confidence?: number;
}

class AzureOpenAiTextProvider implements AiTextProvider {
  readonly name = "azure_openai";

  private getConfig() {
    return {
      apiKey: process.env.AZURE_OPENAI_API_KEY ?? "",
      baseUrl: process.env.AZURE_OPENAI_BASE_URL ?? "",
      model: process.env.AZURE_OPENAI_MODEL ?? "gpt-4o",
    };
  }

  isConfigured(): boolean {
    const { apiKey, baseUrl } = this.getConfig();
    return !!(apiKey && baseUrl);
  }

  async generateText(prompt: string): Promise<string> {
    const { apiKey, baseUrl, model } = this.getConfig();
    if (!apiKey || !baseUrl) throw new Error("Azure OpenAI not configured: missing AZURE_OPENAI_API_KEY or AZURE_OPENAI_BASE_URL");
    const url = `${baseUrl.replace(/\/$/, "")}/openai/deployments/${model}/chat/completions?api-version=2024-12-01-preview`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 2000,
        temperature: 0.7,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Azure OpenAI error: ${response.status} ${text}`);
    }
    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content.trim();
  }

  async ping(): Promise<{ healthy: boolean; error: string | null }> {
    if (!this.isConfigured()) return { healthy: false, error: "AZURE_OPENAI_API_KEY or AZURE_OPENAI_BASE_URL not set" };
    try {
      await this.generateText("Reply with the single word: OK");
      return { healthy: true, error: null };
    } catch (err) {
      return { healthy: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

class OpenAiTextProvider implements AiTextProvider {
  readonly name = "openai";
  private readonly model = "gpt-4o-mini";

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async generateText(prompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI not configured: missing OPENAI_API_KEY");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content.trim();
  }

  async ping(): Promise<{ healthy: boolean; error: string | null }> {
    if (!this.isConfigured()) return { healthy: false, error: "OPENAI_API_KEY not set" };
    try {
      await this.generateText("Reply with the single word: OK");
      return { healthy: true, error: null };
    } catch (err) {
      return { healthy: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

class AzureOpenAiWhisperProvider implements AiSpeechProvider {
  readonly name = "azure_whisper";

  private getConfig() {
    return {
      apiKey: process.env.AZURE_OPENAI_API_KEY ?? "",
      baseUrl: process.env.AZURE_OPENAI_BASE_URL ?? "",
      deployment: process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? "whisper",
    };
  }

  isConfigured(): boolean {
    const { apiKey, baseUrl } = this.getConfig();
    return !!(apiKey && baseUrl);
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<{ text: string; confidence?: number }> {
    const { apiKey, baseUrl, deployment } = this.getConfig();
    if (!apiKey || !baseUrl) throw new Error("Azure OpenAI Whisper not configured: missing AZURE_OPENAI_API_KEY or AZURE_OPENAI_BASE_URL");
    const url = `${baseUrl.replace(/\/$/, "")}/openai/deployments/${deployment}/audio/transcriptions?api-version=2024-06-01`;
    const formData = new FormData();
    const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "wav";
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", blob, `audio.${ext}`);
    const response = await fetch(url, {
      method: "POST",
      headers: { "api-key": apiKey },
      body: formData,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Azure Whisper error: ${response.status} ${text}`);
    }
    const data = (await response.json()) as { text: string };
    return { text: data.text };
  }

  async ping(): Promise<{ healthy: boolean; error: string | null }> {
    if (!this.isConfigured()) return { healthy: false, error: "AZURE_OPENAI_API_KEY or AZURE_OPENAI_BASE_URL not set" };
    const { apiKey, baseUrl, deployment } = this.getConfig();
    try {
      const url = `${baseUrl.replace(/\/$/, "")}/openai/deployments/${deployment}/audio/transcriptions?api-version=2024-06-01`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "api-key": apiKey },
        body: new FormData(),
      });
      if (res.ok || res.status === 400 || res.status === 415 || res.status === 422 || res.status === 429) {
        return { healthy: true, error: null };
      }
      const text = await res.text();
      return { healthy: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    } catch (err) {
      return { healthy: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

class AzureSpeechProvider implements AiSpeechProvider {
  readonly name = "azure_speech";

  isConfigured(): boolean {
    return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<{ text: string; confidence?: number }> {
    const apiKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!apiKey || !region) throw new Error("Azure Speech not configured: missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION");
    const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;
    const contentType = mimeType.includes("webm") ? "audio/webm;codecs=opus" : "audio/wav";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": apiKey, "Content-Type": contentType },
      body: audioBuffer,
    });
    if (!response.ok) throw new Error(`Azure Speech error: ${response.status}`);
    const data = (await response.json()) as { RecognitionStatus: string; NBest?: Array<{ Confidence: number; Lexical: string }> };
    if (data.RecognitionStatus !== "Success" || !data.NBest?.length) {
      throw new Error(`Azure Speech recognition failed: ${data.RecognitionStatus}`);
    }
    return { text: data.NBest[0].Lexical, confidence: data.NBest[0].Confidence };
  }

  async ping(): Promise<{ healthy: boolean; error: string | null }> {
    const apiKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!apiKey || !region) return { healthy: false, error: "AZURE_SPEECH_KEY or AZURE_SPEECH_REGION not set" };
    try {
      const url = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": apiKey, "Content-Length": "0" },
      });
      return { healthy: res.ok, error: res.ok ? null : `HTTP ${res.status}` };
    } catch (err) {
      return { healthy: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

class OpenAiSpeechProvider implements AiSpeechProvider {
  readonly name = "openai";

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<{ text: string; confidence?: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI not configured: missing OPENAI_API_KEY");
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", blob, "audio.webm");
    formData.append("model", "whisper-1");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!response.ok) throw new Error(`OpenAI Whisper error: ${response.status}`);
    const data = (await response.json()) as { text: string };
    return { text: data.text };
  }

  async ping(): Promise<{ healthy: boolean; error: string | null }> {
    if (!this.isConfigured()) return { healthy: false, error: "OPENAI_API_KEY not set" };
    return { healthy: true, error: null };
  }
}

export const azureOpenAiProvider = new AzureOpenAiTextProvider();
export const openAiProvider = new OpenAiTextProvider();
export const azureWhisperProvider = new AzureOpenAiWhisperProvider();
export const azureSpeechProvider = new AzureSpeechProvider();
export const openAiSpeechProvider = new OpenAiSpeechProvider();

export function resolveTextProvider(preferredName: string): AiTextProvider {
  if (preferredName === "azure_openai" && azureOpenAiProvider.isConfigured()) return azureOpenAiProvider;
  if (preferredName === "openai" && openAiProvider.isConfigured()) return openAiProvider;
  if (azureOpenAiProvider.isConfigured()) return azureOpenAiProvider;
  if (openAiProvider.isConfigured()) return openAiProvider;
  throw new Error("No AI text provider configured. Set AZURE_OPENAI_API_KEY/AZURE_OPENAI_BASE_URL or OPENAI_API_KEY.");
}

export function resolveSpeechProvider(preferredName: string): AiSpeechProvider {
  if (preferredName === "azure_whisper" && azureWhisperProvider.isConfigured()) return azureWhisperProvider;
  if (preferredName === "azure_speech" && azureSpeechProvider.isConfigured()) return azureSpeechProvider;
  if (preferredName === "openai" && openAiSpeechProvider.isConfigured()) return openAiSpeechProvider;
  if (azureWhisperProvider.isConfigured()) return azureWhisperProvider;
  if (azureSpeechProvider.isConfigured()) return azureSpeechProvider;
  if (openAiSpeechProvider.isConfigured()) return openAiSpeechProvider;
  throw new Error("No speech provider configured. Set AZURE_OPENAI_API_KEY/AZURE_OPENAI_BASE_URL, AZURE_SPEECH_KEY/AZURE_SPEECH_REGION, or OPENAI_API_KEY.");
}

export async function generateText(prompt: string, preferredProvider?: string): Promise<AiTextResult> {
  const provider = resolveTextProvider(preferredProvider ?? "azure_openai");
  const text = await provider.generateText(prompt);
  return { text, provider: provider.name };
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string, preferredProvider?: string): Promise<AiTranscriptResult> {
  const provider = resolveSpeechProvider(preferredProvider ?? "azure_whisper");
  const result = await provider.transcribeAudio(audioBuffer, mimeType);
  return { text: result.text, provider: provider.name, confidence: result.confidence };
}

export function isTextAiAvailable(): boolean {
  return azureOpenAiProvider.isConfigured() || openAiProvider.isConfigured();
}

export function isSpeechAiAvailable(): boolean {
  return azureWhisperProvider.isConfigured() || azureSpeechProvider.isConfigured() || openAiSpeechProvider.isConfigured();
}
