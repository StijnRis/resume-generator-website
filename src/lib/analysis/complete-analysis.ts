import {
  getAttributes,
  getExperiences,
} from "@/lib/biography/flat";
import { applySkillListRules } from "@/lib/analysis/attribute-merges";
import { applyExperienceSubsetMerges } from "@/lib/analysis/merges";
import type {
  AttributeAnalysisItem,
  Biography,
  DynamicCategoryDefinition,
  ExperienceAnalysisItem,
  HighLevelAnalysis,
} from "@/lib/types";

export const CODE_BACKFILL_REASON =
  "Added by code because the AI did not mention this item.";

export const CODE_CATEGORY_BACKFILL_REASON =
  "Added by code because the AI did not rank this category.";

function ensureCategoriesFromAssignments(
  defined: DynamicCategoryDefinition[],
  assignedIds: string[],
): DynamicCategoryDefinition[] {
  const present = new Set(defined.map((entry) => entry.id));
  const completed = [...defined];
  let nextOrder =
    Math.max(0, ...completed.map((entry) => entry.order), 0) + 1;

  for (const id of assignedIds) {
    if (!id || present.has(id)) continue;
    present.add(id);
    completed.push({
      id,
      label: id,
      order: nextOrder++,
      reason: CODE_CATEGORY_BACKFILL_REASON,
    });
  }

  return completed;
}

function completeExperienceAnalysis(
  biography: Biography,
  experienceAnalysis: ExperienceAnalysisItem[],
): ExperienceAnalysisItem[] {
  const present = new Set(experienceAnalysis.map((item) => item.id));
  const completed = [...experienceAnalysis];
  const fallbackCategory =
    experienceAnalysis[0]?.category ||
    getExperiences(biography)[0]?.type ||
    "experience";

  for (const item of getExperiences(biography)) {
    if (!item.id || present.has(item.id)) continue;
    completed.push({
      category: fallbackCategory,
      id: item.id,
      relevance_score: 0,
      bullets: [],
      reason: CODE_BACKFILL_REASON,
    });
  }

  return completed;
}

function completeAttributeAnalysis(
  biography: Biography,
  attributeAnalysis: AttributeAnalysisItem[],
): AttributeAnalysisItem[] {
  const present = new Set(attributeAnalysis.map((item) => item.id));
  const completed = [...attributeAnalysis];
  const fallbackCategory =
    attributeAnalysis[0]?.category ||
    getAttributes(biography)[0]?.type ||
    "skills";

  for (const item of getAttributes(biography)) {
    if (!item.id || present.has(item.id)) continue;
    completed.push({
      category: fallbackCategory,
      id: item.id,
      relevance_score: 0,
      reason: CODE_BACKFILL_REASON,
    });
  }

  return completed;
}

export function completeAnalysis(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  const experience_analysis = completeExperienceAnalysis(
    biography,
    analysis.experience_analysis ?? [],
  );
  const attribute_analysis = completeAttributeAnalysis(
    biography,
    analysis.attribute_analysis ?? [],
  );

  const experience_categories = ensureCategoriesFromAssignments(
    analysis.experience_categories ?? [],
    experience_analysis.map((item) => item.category),
  );
  const attribute_categories = ensureCategoriesFromAssignments(
    analysis.attribute_categories ?? [],
    attribute_analysis.map((item) => item.category),
  );

  return applyExperienceSubsetMerges(
    biography,
    applySkillListRules(biography, {
      ...analysis,
      experience_categories,
      attribute_categories,
      experience_analysis,
      attribute_analysis,
    }),
  );
}
