import type { Biography, Skill, ToolItem } from "@/lib/types";
import { EXPERIENCE_CATEGORIES } from "@/lib/types";

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

function flattenExistingSkills(skills: Skill[] | undefined): string[] {
  const found: string[] = [];
  for (const skill of skills ?? []) {
    const keywords = collectStrings(skill.keywords);
    if (keywords.length > 0) {
      found.push(...keywords);
      continue;
    }
    const name = String(skill.name ?? "").trim();
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
  for (const category of EXPERIENCE_CATEGORIES) {
    const list = biography[category];
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const item = raw as { skills?: unknown; tools?: unknown };
      found.push(...collectStrings(item[field]));
    }
  }
  return found;
}

/**
 * Collect skills → biography.skills (one card each) and tools → biography.tools
 * (one card each) from experience fields and any existing skill groups.
 */
export function ensureSkillsFromDocument(biography: Biography): Biography {
  const skills = uniquePreserveOrder([
    ...flattenExistingSkills(biography.skills),
    ...collectFromExperiences(biography, "skills"),
  ]);

  const tools = uniquePreserveOrder([
    ...(biography.tools ?? [])
      .map((tool) => String(tool.name ?? "").trim())
      .filter(Boolean),
    ...collectFromExperiences(biography, "tools"),
  ]);

  return {
    ...biography,
    skills: skills.map(
      (name): Skill => ({
        name,
        level: "Proficient",
        keywords: [],
      }),
    ),
    tools: tools.map((name): ToolItem => ({ name })),
  };
}
