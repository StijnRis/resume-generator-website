import { NextResponse } from "next/server";

import { logRouteError } from "@/lib/api/log-error";
import { callLlm, extractJsonFromResponse } from "@/lib/llm/server";
import { BIOGRAPHY_MAPPING_PROMPT } from "@/lib/llm/prompts";
import { biographyMappingResponseSchema } from "@/lib/llm/schemas";
import { validateWithSchema } from "@/lib/validation";
import type { BiographyKeyMapping } from "@/lib/types";

const ROUTE = "POST /api/llm/convert-biography";

export async function POST(request: Request) {
  try {
    const { sourceJson } = (await request.json()) as { sourceJson: unknown };

    if (!sourceJson) {
      return NextResponse.json(
        { error: "sourceJson is required" },
        { status: 400 },
      );
    }

    const llmResponse = await callLlm({
      messages: [
        { role: "system", content: BIOGRAPHY_MAPPING_PROMPT },
        {
          role: "user",
          content: `Map this source JSON to the biography schema. Output ONLY the mapping object.\n\n${JSON.stringify(sourceJson, null, 2)}`,
        },
      ],
      responseFormat: "json_object",
      responseJsonSchema: biographyMappingResponseSchema as unknown as Record<
        string,
        unknown
      >,
      temperature: 0,
    });

    const parsed = extractJsonFromResponse(llmResponse.content);
    const validation = validateWithSchema<BiographyKeyMapping>(
      "biographyMapping",
      parsed,
    );

    if (!validation.valid) {
      console.error(`[API ${ROUTE}] Invalid LLM mapping:`, {
        errors: validation.errorItems,
        raw: llmResponse.content,
      });

      return NextResponse.json(
        {
          error: `Invalid mapping from LLM: ${validation.errorMessage}`,
          validationErrors: validation.errorItems,
          raw: llmResponse.content,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      mapping: validation.data,
      model: llmResponse.model,
    });
  } catch (error) {
    const message = logRouteError(ROUTE, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
