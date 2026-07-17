import { getInterestIdMap, ATTRIBUTE_KEYS, EXPERIENCE_KEYS } from "@/lib/biography/inject-ids";
import type {
  AttributeAnalysisItem,
  Biography,
  BiographyCategoryKey,
  CategoryAnalysisItem,
  ExperienceAnalysisItem,
  HighLevelAnalysis,
} from "@/lib/types";

export const CODE_BACKFILL_REASON =
  "Added by code because the AI did not mention this item.";

export const CODE_CATEGORY_BACKFILL_REASON =
  "Added by code because the AI did not rank this category.";

function completeCategoryAnalysis(
  biography: Biography,
  categoryAnalysis: CategoryAnalysisItem[],
): CategoryAnalysisItem[] {
  const present = new Set(categoryAnalysis.map((item) => item.category));
  const completed = [...categoryAnalysis];

  for (const category of [...EXPERIENCE_KEYS, ...ATTRIBUTE_KEYS] as BiographyCategoryKey[]) {
    const items = biography[category];
    const hasItems =
      category === "interests"
        ? Array.isArray(biography.interests) && biography.interests.length > 0
        : Array.isArray(items) && items.length > 0;

    if (!hasItems || present.has(category)) continue;
    completed.push({
      category,
      relevance_score: 99,
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

  for (const category of EXPERIENCE_KEYS) {
    const items = biography[category];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item.id || present.has(item.id)) continue;
      completed.push({
        category,
        id: item.id,
        relevance_score: 0,
        suggested_bullet_points: 0,
        reason: CODE_BACKFILL_REASON,
      });
    }
  }

  return completed;
}

function completeAttributeAnalysis(
  biography: Biography,
  attributeAnalysis: AttributeAnalysisItem[],
): AttributeAnalysisItem[] {
  const present = new Set(attributeAnalysis.map((item) => item.id));
  const completed = [...attributeAnalysis];

  for (const category of ATTRIBUTE_KEYS) {
    const items = biography[category];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const id = (item as { id?: string }).id;
      if (!id || present.has(id)) continue;
      completed.push({
        category,
        id,
        relevance_score: 0,
        reason: CODE_BACKFILL_REASON,
      });
    }
  }

  const interests = getInterestIdMap(biography);
  for (const id of interests.keys()) {
    if (present.has(id)) continue;
    completed.push({
      category: "interests",
      id,
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
  return {
    ...analysis,
    category_analysis: completeCategoryAnalysis(biography, analysis.category_analysis),
    experience_analysis: completeExperienceAnalysis(
      biography,
      analysis.experience_analysis,
    ),
    attribute_analysis: completeAttributeAnalysis(
      biography,
      analysis.attribute_analysis,
    ),
  };
}
