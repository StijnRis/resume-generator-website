import { normalizeUploadedBiography } from "@/lib/biography/normalize-upload";
import type { Biography, BiographyKeyMapping } from "@/lib/types";

function getValueAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    const index = Number(part);
    if (!Number.isNaN(index) && Array.isArray(current)) {
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current: Record<string, unknown> | unknown[] = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextIndex = !Number.isNaN(Number(nextPart));

    const index = Number(part);
    if (!Number.isNaN(index) && Array.isArray(current)) {
      if (current[index] === undefined) {
        current[index] = isNextIndex ? [] : {};
      }
      current = current[index] as Record<string, unknown> | unknown[];
    } else {
      const record = current as Record<string, unknown>;
      if (record[part] === undefined) {
        record[part] = isNextIndex ? [] : {};
      }
      current = record[part] as Record<string, unknown> | unknown[];
    }
  }

  const lastPart = parts[parts.length - 1];
  const lastIndex = Number(lastPart);

  if (!Number.isNaN(lastIndex) && Array.isArray(current)) {
    current[lastIndex] = value;
  } else {
    (current as Record<string, unknown>)[lastPart] = value;
  }
}

/**
 * Scaffold matching the legacy per-category biography shape. Used only as an
 * intermediate target for dot-path key mapping before flattening via
 * `normalizeUploadedBiography`.
 */
const DEFAULT_BIOGRAPHY_SHAPE = {
  basics: {
    name: "",
    email: "unknown@example.com",
    image: "",
    phone: "",
    location: {
      city: "",
      region: "",
      country: "",
      country_code: "",
    },
    profiles: [],
  },
  label: "",
  summary: "",
  work: [],
  education: [],
  volunteer: [],
  extracurriculars: [],
  events: [],
  skills: [],
  tools: [],
  interests: [],
  research: [],
  projects: [],
  certificates: [],
  awards: [],
  publications: [],
  references: [],
  languages: [],
};

export function applyBiographyMapping(
  source: unknown,
  mapping: BiographyKeyMapping,
): Biography {
  const target = structuredClone(DEFAULT_BIOGRAPHY_SHAPE) as Record<
    string,
    unknown
  >;

  for (const [sourcePath, targetPath] of Object.entries(mapping)) {
    const value = getValueAtPath(source, sourcePath);
    if (value !== undefined) {
      setValueAtPath(target, targetPath, value);
    }
  }

  return normalizeUploadedBiography(target);
}

export function getValueAtPathExported(obj: unknown, path: string): unknown {
  return getValueAtPath(obj, path);
}
