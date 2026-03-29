export type AiTextProvider = "azure_openai" | "openai";
export type AiSpeechProvider = "azure_speech" | "openai";

export interface AiTextResult {
  text: string;
  provider: string;
}

export interface AiTranscriptResult {
  text: string;
  provider: string;
  confidence?: number;
}

function getAzureOpenAiConfig() {
  return {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseUrl: process.env.AZURE_OPENAI_BASE_URL,
    model: process.env.AZURE_OPENAI_MODEL || "gpt-4o",
  };
}

function getOpenAiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-mini",
  };
}

export async function generateText(
  prompt: string,
  provider: AiTextProvider = "azure_openai",
): Promise<AiTextResult> {
  if (provider === "azure_openai") {
    const { apiKey, baseUrl, model } = getAzureOpenAiConfig();
    if (apiKey && baseUrl) {
      const url = `${baseUrl.replace(/\/$/, "")}/openai/deployments/${model}/chat/completions?api-version=2024-02-15-preview`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": apiKey },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });
      if (!response.ok) {
        throw new Error(`Azure OpenAI error: ${response.status} ${await response.text()}`);
      }
      const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
      return { text: data.choices[0].message.content.trim(), provider: "azure_openai" };
    }
  }

  const { apiKey, model } = getOpenAiConfig();
  if (apiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`);
    }
    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return { text: data.choices[0].message.content.trim(), provider: "openai" };
  }

  throw new Error("No AI text provider configured. Set AZURE_OPENAI_API_KEY/AZURE_OPENAI_BASE_URL or OPENAI_API_KEY.");
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  provider: AiSpeechProvider = "azure_speech",
): Promise<AiTranscriptResult> {
  if (provider === "azure_speech") {
    const apiKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (apiKey && region) {
      const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
          "Content-Type": mimeType.includes("webm") ? "audio/webm;codecs=opus" : "audio/wav",
        },
        body: audioBuffer,
      });
      if (!response.ok) {
        throw new Error(`Azure Speech error: ${response.status}`);
      }
      const data = (await response.json()) as { RecognitionStatus: string; NBest?: Array<{ Confidence: number; Lexical: string }> };
      if (data.RecognitionStatus !== "Success" || !data.NBest?.length) {
        throw new Error(`Azure Speech recognition failed: ${data.RecognitionStatus}`);
      }
      return {
        text: data.NBest[0].Lexical,
        provider: "azure_speech",
        confidence: data.NBest[0].Confidence,
      };
    }
  }

  const { apiKey } = getOpenAiConfig();
  if (apiKey) {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", blob, "audio.webm");
    formData.append("model", "whisper-1");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`OpenAI Whisper error: ${response.status}`);
    }
    const data = (await response.json()) as { text: string };
    return { text: data.text, provider: "openai" };
  }

  throw new Error("No speech provider configured. Set AZURE_SPEECH_KEY/AZURE_SPEECH_REGION or OPENAI_API_KEY.");
}

export function isTextAiAvailable(): boolean {
  const { apiKey, baseUrl } = getAzureOpenAiConfig();
  return !!(apiKey && baseUrl) || !!process.env.OPENAI_API_KEY;
}

export function isSpeechAiAvailable(): boolean {
  return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) || !!process.env.OPENAI_API_KEY;
}

export async function pingTextProvider(provider: AiTextProvider): Promise<{ healthy: boolean; error: string | null }> {
  try {
    await generateText("Reply with the single word: OK", provider);
    return { healthy: true, error: null };
  } catch (err) {
    return { healthy: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function pingSpeechProvider(provider: AiSpeechProvider): Promise<{ healthy: boolean; error: string | null }> {
  if (provider === "azure_speech") {
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
  const { apiKey } = getOpenAiConfig();
  if (!apiKey) return { healthy: false, error: "OPENAI_API_KEY not set" };
  return { healthy: true, error: null };
}
