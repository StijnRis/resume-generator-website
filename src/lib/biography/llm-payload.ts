import { getInterestIdMap, ATTRIBUTE_KEYS, EXPERIENCE_KEYS } from "@/lib/biography/inject-ids";
import {
  getAttributeDisplayName,
  getExperienceDisplayName,
} from "@/lib/biography/lookup";
import type {
  AttributeCategoryKey,
  Biography,
  ExperienceCategoryKey,
} from "@/lib/types";
import { ATTRIBUTE_CATEGORIES, EXPERIENCE_CATEGORIES } from "@/lib/types";

/** Strip internal fields and normalize interests for LLM requests. */
export function prepareBiographyForLlm(
  biography: Biography,
): Record<string, unknown> {
  const clone = structuredClone(biography) as unknown as Record<string, unknown>;
  delete clone._interestsWithIds;

  const interestMap = getInterestIdMap(biography);
  if (interestMap.size > 0) {
    clone.interests = [...interestMap.entries()].map(([id, value]) => ({
      id,
      value,
    }));
  }

  return clone;
}

export function listRequiredExperienceIds(biography: Biography): {
  category: ExperienceCategoryKey;
  id: string;
  label: string;
}[] {
  const result: {
    category: ExperienceCategoryKey;
    id: string;
    label: string;
  }[] = [];

  for (const category of EXPERIENCE_KEYS) {
    const items = biography[category];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item.id) continue;
      result.push({
        category,
        id: item.id,
        label: getExperienceDisplayName(
          item as unknown as Record<string, unknown>,
          category,
        ),
      });
    }
  }

  return result;
}

export function listRequiredAttributeIds(biography: Biography): {
  category: AttributeCategoryKey;
  id: string;
  label: string;
}[] {
  const result: {
    category: AttributeCategoryKey;
    id: string;
    label: string;
  }[] = [];

  for (const category of ATTRIBUTE_KEYS) {
    const items = biography[category];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const id = (item as { id?: string }).id;
      if (!id) continue;
      result.push({
        category,
        id,
        label: getAttributeDisplayName(item, category),
      });
    }
  }

  const interests = getInterestIdMap(biography);
  for (const [id, value] of interests.entries()) {
    result.push({
      category: "interests",
      id,
      label: value,
    });
  }

  return result;
}

/** Full analyze user payload including explicit ID checklists for ranking. */
export function buildAnalyzeUserPayload(
  jobDescription: string,
  biography: Biography,
  pageCount: number,
): Record<string, unknown> {
  const biographyForLlm = prepareBiographyForLlm(biography);
  return {
    job_description: jobDescription,
    page_count: pageCount,
    biography: biographyForLlm,
    required_experience_ids: listRequiredExperienceIds(biography),
    required_attribute_ids: listRequiredAttributeIds(biography),
  };
}

export function summarizeBiographyForDebug(biography: Biography): string {
  const counts = EXPERIENCE_CATEGORIES.map((category) => {
    const items = biography[category];
    return `${category}: ${Array.isArray(items) ? items.length : 0}`;
  }).join(", ");

  const attributeCounts = ATTRIBUTE_CATEGORIES.map((category) => {
    if (category === "interests") {
      return `interests: ${biography.interests?.length ?? 0}`;
    }
    const items = biography[category];
    return `${category}: ${Array.isArray(items) ? items.length : 0}`;
  }).join(", ");

  return `Experiences — ${counts}. Attributes — ${attributeCounts}.`;
}
