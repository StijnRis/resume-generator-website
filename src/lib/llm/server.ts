import { GoogleGenAI } from "@google/genai";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  temperature?: number;
  responseFormat?: "json_object";
  responseJsonSchema?: Record<string, unknown>;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Get one at https://aistudio.google.com/apikey",
    );
  }
  return new GoogleGenAI({ apiKey });
}

function getModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
}

export async function callLlm(request: LlmRequest): Promise<LlmResponse> {
  const ai = getClient();
  const model = getModel();

  const systemMessage = request.messages.find((m) => m.role === "system");
  const userMessages = request.messages.filter((m) => m.role !== "system");
  const contents = userMessages.map((m) => m.content).join("\n\n");

  try {
    const useJson =
      request.responseFormat === "json_object" || request.responseJsonSchema;

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemMessage?.content,
        temperature: request.temperature ?? 0.2,
        ...(useJson ? { responseMimeType: "application/json" } : {}),
        ...(request.responseJsonSchema
          ? { responseJsonSchema: request.responseJsonSchema }
          : {}),
      },
    });

    const content = response.text;
    if (!content) {
      throw new Error("Google AI Studio returned an empty response");
    }

    const usage = response.usageMetadata;

    return {
      content,
      model,
      usage: usage
        ? {
            prompt_tokens: usage.promptTokenCount ?? 0,
            completion_tokens: usage.candidatesTokenCount ?? 0,
            total_tokens: usage.totalTokenCount ?? 0,
          }
        : undefined,
    };
  } catch (error) {
    console.error(`[callLlm] Model "${model}" request failed:`, error);
    throw error;
  }
}

export function extractJsonFromResponse(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) {
      return JSON.parse(match[1].trim());
    }
    throw new Error("Response is not valid JSON");
  }
}
