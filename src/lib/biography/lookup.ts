import type {
  AttributeAnalysisItem,
  Biography,
  BiographyAttribute,
  BiographyExperience,
  DynamicCategoryDefinition,
  ExperienceAnalysisItem,
  HighLevelAnalysis,
} from "@/lib/types";
import { sourceTypeLabel } from "@/lib/types";
import {
  getAttributeById,
  getExperienceById,
  getExperiences,
  getAttributes,
} from "@/lib/biography/flat";

export function getExperienceItemById(
  biography: Biography,
  _category: string,
  id: string,
): Record<string, unknown> | null {
  const found = getExperienceById(biography, id);
  return found ? (found as unknown as Record<string, unknown>) : null;
}

export function getAttributeItemById(
  biography: Biography,
  _category: string,
  id: string,
): unknown | null {
  return getAttributeById(biography, id);
}

function experienceSourceType(
  item: Record<string, unknown> | BiographyExperience | null,
): string {
  if (!item) return "";
  return String((item as { type?: string }).type ?? "");
}

export function getExperienceRole(
  item: Record<string, unknown> | null,
  category?: string,
): string {
  if (!item) return "Unknown";
  const type = category || experienceSourceType(item);

  switch (type) {
    case "work":
      return String(item.position ?? item.title ?? "Role");
    case "education":
      return String(item.degree ?? item.title ?? "Degree");
    case "volunteer":
      return String(item.role ?? item.title ?? "Role");
    case "projects":
      return String(item.title ?? "Project");
    case "research":
      return String(item.goal ?? item.title ?? item.summary ?? "Research");
    default:
      return String(item.title ?? "Experience");
  }
}

export function getExperienceOrganization(
  item: Record<string, unknown> | null,
  _category?: string,
): string {
  if (!item) return "";
  return String(item.organization ?? "");
}

export function isPartTimeExperience(
  item: Record<string, unknown> | null,
): boolean {
  if (!item) return false;
  const hours = item.hours_per_week;
  return typeof hours === "number" && hours > 0 && hours < 40;
}

export const PART_TIME_LABEL = "(Part-time)";

/** Append a single "(Part-time)" suffix; strip any existing part-time marker first. */
export function formatTitleWithPartTime(
  title: string,
  partTime: boolean,
): string {
  const cleaned = title.replace(/\s*\(part[-\s]?time\)\s*$/i, "").trim();
  return partTime ? `${cleaned} ${PART_TIME_LABEL}` : cleaned;
}

export function getExperienceDisplayName(
  item: Record<string, unknown> | null,
  category?: string,
): string {
  if (!item) return "Unknown";

  const type = category || experienceSourceType(item);
  const role = getExperienceRole(item, type);
  const organization = getExperienceOrganization(item, type);
  const partTime = isPartTimeExperience(item) ? ` ${PART_TIME_LABEL}` : "";

  switch (type) {
    case "work":
    case "volunteer":
      return organization
        ? `${role}${partTime} at ${organization}`
        : `${role}${partTime}`;
    case "education":
    case "projects":
    case "research":
      return organization ? `${role} — ${organization}` : role;
    default:
      return organization ? `${role} at ${organization}` : role;
  }
}

export function getAttributeDisplayName(
  item: unknown,
  category?: string,
): string {
  const type =
    category ||
    (item && typeof item === "object"
      ? String((item as BiographyAttribute).type ?? "")
      : "");

  if (type === "interests") {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const obj = item as BiographyAttribute;
      return String(obj.value ?? obj.name ?? "");
    }
    return String(item);
  }
  if (!item || typeof item !== "object") return "Unknown";

  const obj = item as BiographyAttribute;
  switch (type) {
    case "skills":
    case "tools":
      return String(obj.name ?? (type === "tools" ? "Tool" : "Skill"));
    case "certificates":
      return String(obj.name ?? "Certificate");
    case "awards":
      return String(obj.title ?? "Award");
    case "publications":
      return String(obj.name ?? "Publication");
    case "references":
      return String(obj.name ?? "Reference");
    case "languages":
      return `${obj.language ?? "Language"} (${obj.fluency ?? "unknown"})`;
    default:
      return String(obj.name ?? obj.title ?? obj.value ?? "Item");
  }
}

export function getAttributeRowLabel(
  item: unknown,
  category?: string,
): string {
  const type =
    category ||
    (item && typeof item === "object"
      ? String((item as BiographyAttribute).type ?? "")
      : "");

  if (type === "skills" && item && typeof item === "object") {
    const obj = item as BiographyAttribute;
    const name = String(obj.name ?? "").trim();
    const keywords = Array.isArray(obj.keywords)
      ? obj.keywords.map(String).filter(Boolean)
      : [];
    if (keywords.length > 0 && name) return name;
    return sourceTypeLabel("skills");
  }
  if (type === "tools") return sourceTypeLabel("tools");
  return sourceTypeLabel(type || "skills");
}

export function getAttributeRowItems(
  item: unknown,
  category?: string,
): string[] {
  const type =
    category ||
    (item && typeof item === "object"
      ? String((item as BiographyAttribute).type ?? "")
      : "");

  if (type === "interests") {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object") {
      const value = String(
        (item as BiographyAttribute).value ??
          (item as BiographyAttribute).name ??
          "",
      ).trim();
      return value ? [value] : [];
    }
    return [String(item)];
  }
  if (!item || typeof item !== "object") return [];

  const obj = item as BiographyAttribute;
  if (type === "skills") {
    const keywords = Array.isArray(obj.keywords)
      ? obj.keywords.map(String).filter(Boolean)
      : [];
    if (keywords.length > 0) return keywords;
    const name = String(obj.name ?? "").trim();
    return name ? [name] : [];
  }

  if (type === "tools") {
    const name = String(obj.name ?? "").trim();
    return name ? [name] : [];
  }

  const label = getAttributeDisplayName(item, type);
  return label && label !== "Unknown" ? [label] : [];
}

export function getExperienceCategoryDefs(
  analysis: HighLevelAnalysis,
): DynamicCategoryDefinition[] {
  return analysis.experience_categories ?? [];
}

export function getAttributeCategoryDefs(
  analysis: HighLevelAnalysis,
): DynamicCategoryDefinition[] {
  return analysis.attribute_categories ?? [];
}

export function getCategoryOrder(
  analysis: HighLevelAnalysis,
  category: string,
): number {
  const fromExp = getExperienceCategoryDefs(analysis).find(
    (entry) => entry.id === category || entry.label === category,
  );
  if (fromExp) return fromExp.order;
  const fromAttr = getAttributeCategoryDefs(analysis).find(
    (entry) => entry.id === category || entry.label === category,
  );
  if (fromAttr) return fromAttr.order;
  return 99;
}

export function getCategoryLabel(
  analysis: HighLevelAnalysis,
  category: string,
): string {
  const fromExp = getExperienceCategoryDefs(analysis).find(
    (entry) => entry.id === category || entry.label === category,
  );
  if (fromExp?.label) return fromExp.label;
  const fromAttr = getAttributeCategoryDefs(analysis).find(
    (entry) => entry.id === category || entry.label === category,
  );
  if (fromAttr?.label) return fromAttr.label;
  return sourceTypeLabel(category);
}

export function getCategoryReason(
  analysis: HighLevelAnalysis,
  category: string,
): string {
  const fromExp = getExperienceCategoryDefs(analysis).find(
    (entry) => entry.id === category || entry.label === category,
  );
  if (fromExp) return fromExp.reason;
  const fromAttr = getAttributeCategoryDefs(analysis).find(
    (entry) => entry.id === category || entry.label === category,
  );
  return fromAttr?.reason ?? "";
}

export function groupExperienceAnalysis(
  analysis: HighLevelAnalysis,
): Map<string, ExperienceAnalysisItem[]> {
  const map = new Map<string, ExperienceAnalysisItem[]>();
  for (const def of getExperienceCategoryDefs(analysis)) {
    map.set(def.id, []);
  }
  for (const item of analysis.experience_analysis) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
}

export function groupAttributeAnalysis(
  analysis: HighLevelAnalysis,
): Map<string, AttributeAnalysisItem[]> {
  const map = new Map<string, AttributeAnalysisItem[]>();
  for (const def of getAttributeCategoryDefs(analysis)) {
    map.set(def.id, []);
  }
  for (const item of analysis.attribute_analysis) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
}

export function listBiographyExperienceIds(biography: Biography): string[] {
  return getExperiences(biography)
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
}

export function listBiographyAttributeIds(biography: Biography): string[] {
  return getAttributes(biography)
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
}

export { CATEGORY_LABELS } from "@/lib/types";
