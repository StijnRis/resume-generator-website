import { NextResponse } from "next/server";

import {
  getExperienceBulletCount,
  getExperienceImportance,
  normalizeAnalysis,
} from "@/lib/analysis/experience-score";
import { mergeExperienceDataForLlm } from "@/lib/analysis/merge-experience-data";
import {
  applyAllSuggestedMerges,
  buildExperienceUnits,
  getUnitBulletCount,
  getUnitCvId,
  getUnitImportance,
  isUnitIncluded,
} from "@/lib/analysis/merges";
import { logRouteError } from "@/lib/api/log-error";
import {
  buildAttributeUnits,
  defaultAttributeSectionTitle,
  getAttributeUnitId,
  getAttributeUnitImportance,
} from "@/lib/analysis/attribute-merges";
import {
  getAttributeItemById,
  getAttributeRowItems,
  getExperienceItemById,
  getExperienceOrganization,
} from "@/lib/biography/lookup";
import { formatMergedDateRange, isOngoingExperience } from "@/lib/formatting/dates";
import { formatLocationString } from "@/lib/formatting/location";
import {
  getSharedLocation,
  getSharedOrganization,
} from "@/lib/cv/merged-meta";
import { languageLabel } from "@/lib/language";
import { callLlm, extractJsonFromResponse } from "@/lib/llm/server";
import { BATCH_CV_GENERATION_PROMPT } from "@/lib/llm/prompts";
import { batchedCvTextResponseSchema } from "@/lib/llm/schemas";
import { validateWithSchema } from "@/lib/validation";
import type {
  BatchedCvTextGeneration,
  Biography,
  HighLevelAnalysis,
} from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

interface GenerateCvRequest {
  jobDescription: string;
  biography: Biography;
  analysis: HighLevelAnalysis;
  language?: string;
}

const ROUTE = "POST /api/llm/generate-cv";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateCvRequest;
    const { jobDescription, biography, analysis, language = "eng" } = body;

    if (!jobDescription?.trim()) {
      return NextResponse.json(
        { error: "jobDescription is required" },
        { status: 400 },
      );
    }

    if (!biography || !analysis) {
      return NextResponse.json(
        { error: "biography and analysis are required" },
        { status: 400 },
      );
    }

    const normalized = normalizeAnalysis(
      applyAllSuggestedMerges(biography, analysis),
    );
    const units = buildExperienceUnits(normalized)
      .filter(isUnitIncluded)
      .sort((a, b) => getUnitImportance(b) - getUnitImportance(a));

    const experiencesToGenerate = units
      .map((unit) => {
        const cvId = getUnitCvId(unit);
        const maxBullets = getUnitBulletCount(unit);

        if (unit.type === "single") {
          const experienceData = getExperienceItemById(
            biography,
            unit.item.category,
            unit.item.id,
          );
          if (!experienceData) return null;

          return {
            id: cvId,
            category: unit.item.category,
            importance: getExperienceImportance(unit.item),
            relevance_reason: unit.item.reason,
            max_bullet_points: maxBullets,
            tense: isOngoingExperience(
              experienceData.end_date as string | null | undefined,
            )
              ? "present"
              : "past",
            organization_shared: getExperienceOrganization(
              experienceData,
              unit.item.category,
            ) || null,
            location_shared: formatLocationString(
              String(experienceData.location ?? ""),
            ) || null,
            data: experienceData,
          };
        }

        const members = unit.items
          .map((item) => {
            const data = getExperienceItemById(
              biography,
              item.category,
              item.id,
            );
            if (!data) return null;
            return {
              id: item.id,
              category: item.category,
              reason: item.reason,
              data,
            };
          })
          .filter(Boolean);

        if (members.length === 0) return null;

        const memberData = members.map((member) => member!.data);
        const starts = memberData.map((data) => String(data.start_date ?? ""));
        const ends = memberData.map(
          (data) => data.end_date as string | null | undefined,
        );
        const locations = memberData.map((data) =>
          formatLocationString(String(data.location ?? "")),
        );
        const organizations = unit.items.map((item) => {
          const data = getExperienceItemById(
            biography,
            item.category,
            item.id,
          );
          return getExperienceOrganization(data, item.category);
        });

        const sharedLocation = getSharedLocation(locations);
        const sharedOrganization = getSharedOrganization(organizations);
        const mergedData = mergeExperienceDataForLlm(memberData);

        const memberEnds = ends;
        const tense = memberEnds.every((end) => isOngoingExperience(end))
          ? "present"
          : "past";

        return {
          id: cvId,
          category: unit.items[0].category,
          importance: Math.max(...unit.items.map(getExperienceImportance)),
          is_merged: true,
          max_bullet_points: maxBullets,
          tense,
          date_range: formatMergedDateRange(starts, ends),
          organization_shared: sharedOrganization,
          location_shared: sharedLocation,
          location_needs_generic: sharedLocation == null && locations.some(Boolean),
          member_locations: [...new Set(locations.filter(Boolean))],
          data: mergedData,
        };
      })
      .filter(Boolean);

    // Build attribute title requests: merged groups + one bucket per category of singles.
    const attributeUnits = buildAttributeUnits(normalized).filter(
      (unit) => getAttributeUnitImportance(unit) > 0,
    );
    const attributesByCategory = new Map<
      string,
      {
        id: string;
        default_label: string;
        member_ids: string[];
        items: string[];
      }
    >();
    const attributesToTitle: {
      id: string;
      default_label: string;
      member_ids: string[];
      items: string[];
    }[] = [];

    for (const unit of attributeUnits) {
      if (unit.type === "merged") {
        const items = unit.items.flatMap((item) => {
          const source = getAttributeItemById(
            biography,
            item.category,
            item.id,
          );
          return getAttributeRowItems(source, item.category);
        });
        attributesToTitle.push({
          id: unit.group.id,
          default_label: defaultAttributeSectionTitle(unit),
          member_ids: unit.items.map((item) => item.id),
          items: items.filter(Boolean),
        });
        continue;
      }

      const cat = unit.item.category;
      const bucketId = `cat:${cat}`;
      const source = getAttributeItemById(
        biography,
        unit.item.category,
        unit.item.id,
      );
      const labels = getAttributeRowItems(source, unit.item.category);
      const existing = attributesByCategory.get(bucketId);
      if (existing) {
        existing.member_ids.push(unit.item.id);
        for (const label of labels) {
          if (label && !existing.items.includes(label)) existing.items.push(label);
        }
      } else {
        attributesByCategory.set(bucketId, {
          id: bucketId,
          default_label: CATEGORY_LABELS[cat] ?? cat,
          member_ids: [unit.item.id],
          items: labels.filter(Boolean),
        });
      }
    }
    attributesToTitle.push(...attributesByCategory.values());

    const langName = languageLabel(language);
    const userPayload = {
      job_description: jobDescription,
      output_language: langName,
      output_language_code: language,
      biography_summary: biography.summary,
      label: biography.label,
      experiences_to_generate: experiencesToGenerate,
      attributes_to_title: attributesToTitle,
    };

    const languageDirective =
      language === "eng"
        ? "Write the entire CV response in English."
        : `CRITICAL: Write the entire CV response in ${langName} (${language}). Do not use English for summary, titles, bullets, attribute titles, or ui_labels — only ${langName}.`;

    const llmResponse = await callLlm({
      messages: [
        { role: "system", content: BATCH_CV_GENERATION_PROMPT },
        {
          role: "user",
          content: `${languageDirective}\n\n${JSON.stringify(userPayload)}`,
        },
      ],
      responseFormat: "json_object",
      responseJsonSchema: batchedCvTextResponseSchema as unknown as Record<
        string,
        unknown
      >,
      temperature: 0.4,
    });

    const parsed = extractJsonFromResponse(llmResponse.content);
    const validation = validateWithSchema<BatchedCvTextGeneration>(
      "batchedCvText",
      parsed,
    );

    if (!validation.valid || !validation.data) {
      console.error(`[API ${ROUTE}] Invalid batched CV text:`, {
        errors: validation.errorItems,
        raw: llmResponse.content,
      });

      return NextResponse.json(
        {
          error: `Invalid CV text from LLM: ${validation.errorMessage}`,
          validationErrors: validation.errorItems,
          raw: llmResponse.content,
        },
        { status: 422 },
      );
    }

    const maxBulletsById = new Map(
      units.map((unit) => [getUnitCvId(unit), getUnitBulletCount(unit)]),
    );

    const experiences: Record<
      string,
      {
        summary: string;
        bullet_points: string[];
        title?: string;
        organization?: string;
        location?: string;
      }
    > = {};

    for (const entry of validation.data.experiences) {
      const maxBullets = maxBulletsById.get(entry.id) ?? entry.bullet_points.length;
      experiences[entry.id] = {
        summary: entry.summary,
        bullet_points: entry.bullet_points.slice(0, maxBullets),
        ...(entry.title ? { title: entry.title.trim() } : {}),
        ...(entry.organization
          ? { organization: entry.organization.trim() }
          : {}),
        ...(entry.location ? { location: entry.location.trim() } : {}),
      };
    }

    const attributes: Record<string, { title: string }> = {};
    for (const entry of validation.data.attributes ?? []) {
      attributes[entry.id] = { title: entry.title.trim() };
    }
    // Fallback titles if the model omitted any.
    for (const row of attributesToTitle) {
      if (!attributes[row.id]) {
        attributes[row.id] = { title: row.default_label };
      }
    }

    const rawLabels = validation.data.ui_labels;
    const uiLabels = {
      at: rawLabels?.at?.trim() || "at",
      attributesHeading:
        rawLabels?.attributes_heading?.trim() || "Attributes",
      present: rawLabels?.present?.trim() || "present",
      starting: rawLabels?.starting?.trim() || "Starting",
      expected: rawLabels?.expected?.trim() || "exp.",
      sectionTitles: {
        work: rawLabels?.sections?.work,
        education: rawLabels?.sections?.education,
        volunteer: rawLabels?.sections?.volunteer,
        extracurriculars: rawLabels?.sections?.extracurriculars,
        events: rawLabels?.sections?.events,
        research: rawLabels?.sections?.research,
        projects: rawLabels?.sections?.projects,
      },
    };

    return NextResponse.json({
      summary: validation.data.summary,
      experiences,
      attributes,
      uiLabels,
      language,
      debug: {
        systemPrompt: BATCH_CV_GENERATION_PROMPT,
        userPrompt: JSON.stringify(userPayload, null, 2),
      },
    });
  } catch (error) {
    const message = logRouteError(ROUTE, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
