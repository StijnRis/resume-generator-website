import { NextResponse } from "next/server";

import { logRouteError } from "@/lib/api/log-error";
import { languageLabel } from "@/lib/language";
import { callLlm, extractJsonFromResponse } from "@/lib/llm/server";
import { TRANSLATE_PROMPT } from "@/lib/llm/prompts";
import { translateResponseSchema } from "@/lib/llm/schemas";
import { validateWithSchema } from "@/lib/validation";
import type { TranslationMapping } from "@/lib/types";

interface TranslateRequest {
  language: string;
  strings: string[];
}

const ROUTE = "POST /api/llm/translate";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TranslateRequest;
    const { language, strings } = body;

    if (!language?.trim()) {
      return NextResponse.json(
        { error: "language is required" },
        { status: 400 },
      );
    }

    const unique = [
      ...new Set(
        (strings ?? [])
          .map((value) => String(value ?? "").trim())
          .filter((value) => value.length > 0),
      ),
    ];

    if (unique.length === 0) {
      return NextResponse.json({
        translations: [] as TranslationMapping[],
        language,
        debug: {
          systemPrompt: TRANSLATE_PROMPT,
          userPrompt: "(no strings)",
        },
      });
    }

    const userPayload = {
      target_language: languageLabel(language),
      target_language_code: language,
      strings: unique,
    };

    const llmResponse = await callLlm({
      messages: [
        { role: "system", content: TRANSLATE_PROMPT },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      responseFormat: "json_object",
      responseJsonSchema: translateResponseSchema as unknown as Record<
        string,
        unknown
      >,
      temperature: 0.2,
    });

    const parsed = extractJsonFromResponse(llmResponse.content);
    const validation = validateWithSchema<{ translations: TranslationMapping[] }>(
      "translate",
      parsed,
    );

    // Soft-validate: if schema file missing, accept parsed shape.
    const translations =
      validation.valid && validation.data
        ? validation.data.translations
        : Array.isArray((parsed as { translations?: unknown }).translations)
          ? (
              parsed as {
                translations: TranslationMapping[];
              }
            ).translations
          : [];

    const byOriginal = new Map(
      translations.map((entry) => [entry.original, entry.translated]),
    );
    const ordered: TranslationMapping[] = unique.map((original) => ({
      original,
      translated: byOriginal.get(original) ?? original,
    }));

    return NextResponse.json({
      translations: ordered,
      language,
      debug: {
        systemPrompt: TRANSLATE_PROMPT,
        userPrompt: JSON.stringify(userPayload, null, 2),
      },
    });
  } catch (error) {
    const message = logRouteError(ROUTE, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
