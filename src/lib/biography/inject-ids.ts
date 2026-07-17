import type {
  AttributeCategoryKey,
  Biography,
  ExperienceCategoryKey,
} from "@/lib/types";

const EXPERIENCE_KEYS: ExperienceCategoryKey[] = [
  "work",
  "education",
  "volunteer",
  "extracurriculars",
  "events",
  "research",
  "projects",
];

const ATTRIBUTE_KEYS: AttributeCategoryKey[] = [
  "skills",
  "tools",
  "certificates",
  "awards",
  "publications",
  "references",
  "languages",
];

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
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
      obj.organization,
      obj.position,
      obj.degree,
      obj.language,
    ]
      .filter(Boolean)
      .map(String);
    if (parts.length) return parts.join("|");
  }
  return String(index);
}

export async function injectBiographyIds(biography: Biography): Promise<Biography> {
  const result = structuredClone(biography);

  for (const key of EXPERIENCE_KEYS) {
    const items = result[key];
    if (!Array.isArray(items)) continue;

    for (let i = 0; i < items.length; i++) {
      const seed = getItemSeed(items[i], i);
      items[i] = {
        ...items[i],
        id: await deterministicId(key, i, seed),
      };
    }
  }

  for (const key of ATTRIBUTE_KEYS) {
    const items = result[key];
    if (!Array.isArray(items)) continue;

    for (let i = 0; i < items.length; i++) {
      const seed = getItemSeed(items[i], i);
      (items[i] as { id?: string }).id = await deterministicId(key, i, seed);
    }
  }

  if (result.interests?.length) {
    const withIds: { id: string; value: string }[] = [];
    for (let i = 0; i < result.interests.length; i++) {
      const raw = result.interests[i];
      const value =
        typeof raw === "string"
          ? raw
          : String((raw as { value?: string }).value ?? "");
      const existingId =
        typeof raw === "object" && raw && "id" in raw
          ? String((raw as { id?: string }).id ?? "")
          : "";
      withIds.push({
        id:
          existingId ||
          (await deterministicId("interests", i, value)),
        value,
      });
    }
    (result as Biography & { interests?: typeof withIds }).interests = withIds;
  }

  return result;
}

export function getInterestIdMap(biography: Biography): Map<string, string> {
  const map = new Map<string, string>();
  const interests = biography.interests ?? [];
  for (const entry of interests) {
    if (typeof entry === "string") {
      continue;
    }
    if (entry && typeof entry === "object" && "id" in entry && "value" in entry) {
      const { id, value } = entry as { id: string; value: string };
      if (id) map.set(id, value);
    }
  }
  const legacy = biography as Biography & {
    _interestsWithIds?: { id: string; value: string }[];
  };
  legacy._interestsWithIds?.forEach(({ id, value }) => map.set(id, value));
  return map;
}

export { EXPERIENCE_KEYS, ATTRIBUTE_KEYS };
