import { NextResponse } from "next/server";

import { logRouteError } from "@/lib/api/log-error";
import { completeAnalysis } from "@/lib/analysis/complete-analysis";
import { applyEducationPriority } from "@/lib/analysis/education-priority";
import { normalizeAnalysis } from "@/lib/analysis/experience-score";
import { expandAnalysisForPageBudget } from "@/lib/analysis/page-budget";
import { buildAnalyzeUserPayload } from "@/lib/biography/llm-payload";
import { callLlm, extractJsonFromResponse } from "@/lib/llm/server";
import { ANALYSIS_PROMPT } from "@/lib/llm/prompts";
import { relevanceResponseSchema } from "@/lib/llm/schemas";
import { validateWithSchema } from "@/lib/validation";
import type { Biography, HighLevelAnalysis } from "@/lib/types";

const ROUTE = "POST /api/llm/analyze";

export async function POST(request: Request) {
  try {
    const { jobDescription, biography, pageCount = 2 } = (await request.json()) as {
      jobDescription: string;
      biography: Biography;
      pageCount?: number;
    };

    if (!jobDescription?.trim()) {
      return NextResponse.json(
        { error: "jobDescription is required" },
        { status: 400 },
      );
    }

    if (!biography) {
      return NextResponse.json(
        { error: "biography is required" },
        { status: 400 },
      );
    }

    const pageCountClamped = Math.min(5, Math.max(1, pageCount ?? 2));
    const userPayload = buildAnalyzeUserPayload(
      jobDescription,
      biography,
      pageCountClamped,
    );

    const llmResponse = await callLlm({
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: JSON.stringify(userPayload),
        },
      ],
      responseFormat: "json_object",
      responseJsonSchema: relevanceResponseSchema as unknown as Record<
        string,
        unknown
      >,
      temperature: 0.3,
    });

    const parsed = extractJsonFromResponse(llmResponse.content);
    const validation = validateWithSchema<HighLevelAnalysis>("relevance", parsed);

    if (!validation.valid) {
      console.error(`[API ${ROUTE}] Invalid LLM analysis:`, {
        errors: validation.errorItems,
        raw: llmResponse.content,
      });

      return NextResponse.json(
        {
          error: `Invalid analysis from LLM: ${validation.errorMessage}`,
          validationErrors: validation.errorItems,
          raw: llmResponse.content,
        },
        { status: 422 },
      );
    }

    const llmAnalysis = normalizeAnalysis(validation.data!);
    const completed = expandAnalysisForPageBudget(
      biography,
      applyEducationPriority(
        biography,
        completeAnalysis(biography, llmAnalysis),
      ),
      pageCountClamped,
    );

    return NextResponse.json({
      analysis: completed,
      llmAnalysis,
      model: llmResponse.model,
      debug: {
        systemPrompt: ANALYSIS_PROMPT,
        userPrompt: JSON.stringify(userPayload, null, 2),
      },
    });
  } catch (error) {
    const message = logRouteError(ROUTE, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
