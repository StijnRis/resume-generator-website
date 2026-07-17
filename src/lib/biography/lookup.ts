import type {
  AttributeAnalysisItem,
  AttributeCategoryKey,
  Biography,
  ExperienceAnalysisItem,
  ExperienceCategoryKey,
  HighLevelAnalysis,
} from "@/lib/types";
import { ATTRIBUTE_CATEGORIES, CATEGORY_LABELS, EXPERIENCE_CATEGORIES } from "@/lib/types";
import { getInterestIdMap } from "@/lib/biography/inject-ids";

export function getExperienceItemById(
  biography: Biography,
  category: ExperienceCategoryKey,
  id: string,
): Record<string, unknown> | null {
  const items = biography[category];
  if (Array.isArray(items)) {
    const found = items.find((item) => item.id === id);
    if (found) return found as unknown as Record<string, unknown>;
  }

  for (const key of EXPERIENCE_CATEGORIES) {
    if (key === category) continue;
    const categoryItems = biography[key];
    if (!Array.isArray(categoryItems)) continue;
    const found = categoryItems.find((item) => item.id === id);
    if (found) return found as unknown as Record<string, unknown>;
  }

  return null;
}

export function getAttributeItemById(
  biography: Biography,
  category: AttributeCategoryKey,
  id: string,
): unknown | null {
  if (category === "interests") {
    const map = getInterestIdMap(biography);
    const value = map.get(id);
    return value ?? null;
  }

  const items = biography[category];
  if (Array.isArray(items)) {
    const found = items.find((item) => (item as { id?: string }).id === id);
    if (found) return found;
  }

  for (const key of ATTRIBUTE_CATEGORIES) {
    if (key === category || key === "interests") continue;
    const categoryItems = biography[key];
    if (!Array.isArray(categoryItems)) continue;
    const found = categoryItems.find((item) => (item as { id?: string }).id === id);
    if (found) return found;
  }

  return null;
}

export function getExperienceRole(
  item: Record<string, unknown> | null,
  category: ExperienceCategoryKey,
): string {
  if (!item) return "Unknown";

  switch (category) {
    case "work":
      return String(item.position ?? item.title ?? "Role");
    case "education":
      return String(item.degree ?? item.title ?? "Degree");
    case "volunteer":
      return String(item.role ?? item.title ?? "Role");
    case "projects":
      return String(item.title ?? "Project");
    case "research":
      // Research title is the research goal/topic, not the person's role.
      return String(item.goal ?? item.title ?? item.summary ?? "Research");
    default:
      return String(item.title ?? "Experience");
  }
}

export function getExperienceOrganization(
  item: Record<string, unknown> | null,
  _category: ExperienceCategoryKey,
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

export function getExperienceDisplayName(
  item: Record<string, unknown> | null,
  category: ExperienceCategoryKey,
): string {
  if (!item) return "Unknown";

  const role = getExperienceRole(item, category);
  const organization = getExperienceOrganization(item, category);
  const partTime = isPartTimeExperience(item)
    ? " (part time)"
    : "";

  switch (category) {
    case "work":
    case "volunteer":
      return organization
        ? `${role}${partTime} at ${organization}`
        : `${role}${partTime}`;
    case "education":
      return organization ? `${role} — ${organization}` : role;
    case "projects":
      return organization ? `${role} — ${organization}` : role;
    case "research":
      return organization ? `${role} — ${organization}` : role;
    default:
      return organization ? `${role} at ${organization}` : role;
  }
}

export function getAttributeDisplayName(
  item: unknown,
  category: AttributeCategoryKey,
): string {
  if (category === "interests") {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "value" in item) {
      return String((item as { value?: string }).value ?? "");
    }
    return String(item);
  }
  if (!item || typeof item !== "object") return "Unknown";

  const obj = item as Record<string, unknown>;
  switch (category) {
    case "skills":
    case "tools":
      return String(obj.name ?? (category === "tools" ? "Tool" : "Skill"));
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
      return "Item";
  }
}

/** Label used on the left of an Attributes row (e.g. "Technologies"). */
export function getAttributeRowLabel(
  item: unknown,
  category: AttributeCategoryKey,
): string {
  if (category === "skills" && item && typeof item === "object") {
    const obj = item as { name?: string; keywords?: unknown };
    const name = String(obj.name ?? "").trim();
    const keywords = Array.isArray(obj.keywords)
      ? obj.keywords.map(String).filter(Boolean)
      : [];
    if (keywords.length > 0 && name) return name;
    return CATEGORY_LABELS.skills;
  }
  if (category === "tools") {
    return CATEGORY_LABELS.tools;
  }
  return CATEGORY_LABELS[category] ?? category;
}

/** Items listed after the row label. */
export function getAttributeRowItems(
  item: unknown,
  category: AttributeCategoryKey,
): string[] {
  if (category === "interests") {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object" && "value" in item) {
      const value = String((item as { value?: string }).value ?? "").trim();
      return value ? [value] : [];
    }
    return [String(item)];
  }
  if (!item || typeof item !== "object") return [];

  const obj = item as Record<string, unknown>;
  if (category === "skills") {
    const keywords = Array.isArray(obj.keywords)
      ? obj.keywords.map(String).filter(Boolean)
      : [];
    if (keywords.length > 0) return keywords;
    const name = String(obj.name ?? "").trim();
    return name ? [name] : [];
  }

  if (category === "tools") {
    const name = String(obj.name ?? "").trim();
    return name ? [name] : [];
  }

  const label = getAttributeDisplayName(item, category);
  return label && label !== "Unknown" ? [label] : [];
}

export function groupExperienceAnalysis(
  analysis: HighLevelAnalysis,
): Map<ExperienceCategoryKey, ExperienceAnalysisItem[]> {
  const map = new Map<ExperienceCategoryKey, ExperienceAnalysisItem[]>();

  for (const cat of EXPERIENCE_CATEGORIES) {
    map.set(cat, []);
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
): Map<AttributeCategoryKey, AttributeAnalysisItem[]> {
  const map = new Map<AttributeCategoryKey, AttributeAnalysisItem[]>();

  for (const cat of ATTRIBUTE_CATEGORIES) {
    map.set(cat, []);
  }

  for (const item of analysis.attribute_analysis) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }

  return map;
}

export function getCategoryOrder(
  analysis: HighLevelAnalysis,
  category: string,
): number {
  const found = analysis.category_analysis.find((c) => c.category === category);
  return found?.relevance_score ?? 99;
}

export function getCategoryReason(
  analysis: HighLevelAnalysis,
  category: string,
): string {
  const found = analysis.category_analysis.find((c) => c.category === category);
  return found?.reason ?? "";
}

export { CATEGORY_LABELS };
