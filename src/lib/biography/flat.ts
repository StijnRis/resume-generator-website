import type {
  Biography,
  BiographyAttribute,
  BiographyExperience,
} from "@/lib/types";

export function getExperiences(biography: Biography): BiographyExperience[] {
  return biography.experiences ?? [];
}

export function getAttributes(biography: Biography): BiographyAttribute[] {
  return biography.attributes ?? [];
}

export function getExperienceById(
  biography: Biography,
  id: string,
): BiographyExperience | null {
  return getExperiences(biography).find((item) => item.id === id) ?? null;
}

export function getAttributeById(
  biography: Biography,
  id: string,
): BiographyAttribute | null {
  return getAttributes(biography).find((item) => item.id === id) ?? null;
}

export function groupExperiencesByType(
  biography: Biography,
): Map<string, BiographyExperience[]> {
  const map = new Map<string, BiographyExperience[]>();
  for (const item of getExperiences(biography)) {
    const list = map.get(item.type) ?? [];
    list.push(item);
    map.set(item.type, list);
  }
  return map;
}

export function groupAttributesByType(
  biography: Biography,
): Map<string, BiographyAttribute[]> {
  const map = new Map<string, BiographyAttribute[]>();
  for (const item of getAttributes(biography)) {
    const list = map.get(item.type) ?? [];
    list.push(item);
    map.set(item.type, list);
  }
  return map;
}
