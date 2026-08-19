import type { Biography } from "@/lib/types";

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

async function deterministicId(
  category: string,
  index: number,
  seed: string,
): Promise<string> {
  return hashString(`${category}:${index}:${seed}`);
}

function getItemSeed(item: unknown, index: number): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const parts = [
      obj.title,
      obj.name,
      obj.value,
      obj.organization,
      obj.position,
      obj.degree,
      obj.language,
      obj.type,
    ]
      .filter(Boolean)
      .map(String);
    if (parts.length) return parts.join("|");
  }
  return String(index);
}

export async function injectBiographyIds(
  biography: Biography,
): Promise<Biography> {
  const result = structuredClone(biography);

  for (let i = 0; i < result.experiences.length; i++) {
    const item = result.experiences[i];
    if (item.id) continue;
    const seed = getItemSeed(item, i);
    item.id = await deterministicId(item.type || "experience", i, seed);
  }

  for (let i = 0; i < result.attributes.length; i++) {
    const item = result.attributes[i];
    if (item.id) continue;
    const seed = getItemSeed(item, i);
    item.id = await deterministicId(item.type || "attribute", i, seed);
  }

  return result;
}

/** @deprecated Interests are flat attributes with type "interests". */
export function getInterestIdMap(biography: Biography): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of biography.attributes) {
    if (item.type !== "interests") continue;
    if (!item.id) continue;
    map.set(item.id, String(item.value ?? item.name ?? ""));
  }
  return map;
}

export const EXPERIENCE_KEYS = [
  "work",
  "education",
  "volunteer",
  "extracurriculars",
  "events",
  "research",
  "projects",
] as const;

export const ATTRIBUTE_KEYS = [
  "skills",
  "tools",
  "certificates",
  "awards",
  "publications",
  "references",
  "languages",
] as const;
