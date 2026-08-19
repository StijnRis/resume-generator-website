import {
  getAttributeDisplayName,
  getExperienceDisplayName,
} from "@/lib/biography/lookup";
import {
  getAttributes,
  getExperiences,
} from "@/lib/biography/flat";
import type { Biography } from "@/lib/types";

/** Strip internal fields for LLM requests — flat experiences/attributes. */
export function prepareBiographyForLlm(
  biography: Biography,
): Record<string, unknown> {
  const clone = structuredClone(biography) as unknown as {
    experiences: Record<string, unknown>[];
    attributes: Record<string, unknown>[];
  };
  // Never invent skill levels — omit blank/default "Proficient" from the payload.
  clone.attributes = (clone.attributes ?? []).map((attr) => {
    const next = { ...attr };
    const level = String(next.level ?? "").trim();
    if (!level || /^proficient$/i.test(level)) {
      delete next.level;
    }
    return next;
  });
  return clone as unknown as Record<string, unknown>;
}

export function listRequiredExperienceIds(biography: Biography): {
  type: string;
  id: string;
  label: string;
}[] {
  return getExperiences(biography)
    .filter((item) => item.id)
    .map((item) => ({
      type: item.type,
      id: item.id!,
      label: getExperienceDisplayName(
        item as unknown as Record<string, unknown>,
        item.type,
      ),
    }));
}

export function listRequiredAttributeIds(biography: Biography): {
  type: string;
  id: string;
  label: string;
}[] {
  return getAttributes(biography)
    .filter((item) => item.id)
    .map((item) => ({
      type: item.type,
      id: item.id!,
      label: getAttributeDisplayName(item, item.type),
    }));
}

/** Full analyze user payload including explicit ID checklists for ranking. */
export function buildAnalyzeUserPayload(
  jobDescription: string,
  biography: Biography,
  pageCount: number,
): Record<string, unknown> {
  return {
    job_description: jobDescription,
    page_count: pageCount,
    biography: prepareBiographyForLlm(biography),
    required_experience_ids: listRequiredExperienceIds(biography),
    required_attribute_ids: listRequiredAttributeIds(biography),
  };
}

export function summarizeBiographyForDebug(biography: Biography): string {
  const byType = new Map<string, number>();
  for (const item of getExperiences(biography)) {
    byType.set(item.type, (byType.get(item.type) ?? 0) + 1);
  }
  const exp = [...byType.entries()]
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  const attrByType = new Map<string, number>();
  for (const item of getAttributes(biography)) {
    attrByType.set(item.type, (attrByType.get(item.type) ?? 0) + 1);
  }
  const attr = [...attrByType.entries()]
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  return `Experiences — ${exp || "none"}. Attributes — ${attr || "none"}.`;
}
