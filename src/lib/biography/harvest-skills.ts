import type { Biography, BiographyAttribute } from "@/lib/types";
import { getExperiences } from "@/lib/biography/flat";

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function collectStrings(field: unknown): string[] {
  if (!Array.isArray(field)) return [];
  return field.map((value) => String(value ?? "").trim()).filter(Boolean);
}

function flattenExistingSkills(attributes: BiographyAttribute[]): string[] {
  const found: string[] = [];
  for (const attr of attributes) {
    if (attr.type !== "skills") continue;
    const keywords = collectStrings(attr.keywords);
    if (keywords.length > 0) {
      found.push(...keywords);
      continue;
    }
    const name = String(attr.name ?? "").trim();
    if (name && !/^technologies$/i.test(name)) {
      found.push(name);
    }
  }
  return found;
}

function collectFromExperiences(
  biography: Biography,
  field: "skills" | "tools",
): string[] {
  const found: string[] = [];
  for (const item of getExperiences(biography)) {
    found.push(...collectStrings(item[field]));
  }
  return found;
}

const LOOKS_LIKE_SENTENCE =
  /^(developed|built|led|created|managed|implemented|designed|worked|responsible|helped|improved|increased|reduced|collaborated)\b/i;

/** Pull short comma/slash-separated skill lists out of highlights and summaries. */
function collectSkillListsFromText(values: string[]): string[] {
  const found: string[] = [];
  for (const value of values) {
    const parts = value
      .split(/[,;/|]| and /i)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length < 2) continue;
    if (
      !parts.every(
        (part) =>
          part.length <= 40 &&
          part.split(/\s+/).length <= 4 &&
          !LOOKS_LIKE_SENTENCE.test(part) &&
          !/[.!?]$/.test(part),
      )
    ) {
      continue;
    }
    found.push(...parts);
  }
  return found;
}

function collectSkillsMentionedInExperiences(biography: Biography): string[] {
  const found: string[] = [];
  for (const item of getExperiences(biography)) {
    found.push(...collectStrings(item.skills));
    found.push(...collectStrings(item.tools));
    found.push(
      ...collectSkillListsFromText([
        ...collectStrings(item.highlights),
        item.summary ?? "",
        item.goal ?? "",
      ]),
    );
  }
  return found;
}

function indexByName(
  attributes: BiographyAttribute[],
  type: string,
): Map<string, BiographyAttribute> {
  const map = new Map<string, BiographyAttribute>();
  for (const attr of attributes) {
    if (attr.type !== type) continue;
    const name = String(attr.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, attr);
  }
  return map;
}

function toNamedCard(
  name: string,
  type: "skills" | "tools",
  existing: Map<string, BiographyAttribute>,
): BiographyAttribute {
  const prev = existing.get(name.toLowerCase());
  if (prev) {
    return {
      ...prev,
      type,
      name,
      ...(type === "skills" ? { keywords: [] } : {}),
    };
  }
  return type === "skills"
    ? { type: "skills", name, keywords: [] }
    : { type: "tools", name };
}

/**
 * Flatten skills/tools harvested from experiences into attribute cards
 * so skills used elsewhere on the resume also appear in the Skills list.
 * Preserves other attribute types and existing ids when the name matches.
 */
export function ensureSkillsFromDocument(biography: Biography): Biography {
  const otherAttributes = biography.attributes.filter(
    (attr) => attr.type !== "skills" && attr.type !== "tools",
  );
  const existingSkills = indexByName(biography.attributes, "skills");
  const existingTools = indexByName(biography.attributes, "tools");

  const skills = uniquePreserveOrder([
    ...flattenExistingSkills(biography.attributes),
    ...collectFromExperiences(biography, "skills"),
    ...collectSkillsMentionedInExperiences(biography),
  ]);

  const tools = uniquePreserveOrder([
    ...biography.attributes
      .filter((attr) => attr.type === "tools")
      .map((attr) => String(attr.name ?? "").trim())
      .filter(Boolean),
    ...collectFromExperiences(biography, "tools"),
  ]);

  return {
    ...biography,
    attributes: [
      ...otherAttributes,
      ...skills.map((name) => toNamedCard(name, "skills", existingSkills)),
      ...tools.map((name) => toNamedCard(name, "tools", existingTools)),
    ],
  };
}
