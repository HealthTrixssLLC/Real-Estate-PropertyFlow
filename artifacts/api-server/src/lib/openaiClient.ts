const BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  max_completion_tokens?: number;
  response_format?: { type: "json_object" | "text" };
  signal?: AbortSignal;
}

export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  const url = `${BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    max_completion_tokens: options.max_completion_tokens ?? 1024,
  };
  if (options.response_format) {
    body.response_format = options.response_format;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI API error: ${res.status} ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

export function isOpenAiConfigured(): boolean {
  const hasProxy =
    !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
  const hasDirect = !!process.env.OPENAI_API_KEY;
  return hasProxy || hasDirect;
}
