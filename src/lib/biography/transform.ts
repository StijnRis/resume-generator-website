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

function setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
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

const DEFAULT_BIOGRAPHY: Biography = {
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
  const target = structuredClone(DEFAULT_BIOGRAPHY) as unknown as Record<
    string,
    unknown
  >;

  for (const [sourcePath, targetPath] of Object.entries(mapping)) {
    const value = getValueAtPath(source, sourcePath);
    if (value !== undefined) {
      setValueAtPath(target, targetPath, value);
    }
  }

  return normalizeBiography(target);
}

function normalizeBiography(raw: Record<string, unknown>): Biography {
  const basics = (raw.basics as Biography["basics"]) ?? DEFAULT_BIOGRAPHY.basics;

  return {
    basics: {
      name: String(basics.name ?? ""),
      email: String(basics.email ?? "unknown@example.com"),
      image: String(basics.image ?? ""),
      phone: String(basics.phone ?? ""),
      location: {
        city: String(basics.location?.city ?? ""),
        region: String(basics.location?.region ?? ""),
        country: String(basics.location?.country ?? ""),
        country_code: String(basics.location?.country_code ?? ""),
      },
      profiles: Array.isArray(basics.profiles) ? basics.profiles : [],
    },
    label: String(raw.label ?? ""),
    summary: String(raw.summary ?? ""),
    work: Array.isArray(raw.work) ? raw.work : [],
    education: Array.isArray(raw.education) ? raw.education : [],
    volunteer: Array.isArray(raw.volunteer) ? raw.volunteer : [],
    extracurriculars: Array.isArray(raw.extracurriculars) ? raw.extracurriculars : [],
    events: Array.isArray(raw.events) ? raw.events : [],
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    tools: Array.isArray(raw.tools) ? raw.tools : [],
    interests: Array.isArray(raw.interests) ? raw.interests.map(String) : [],
    research: Array.isArray(raw.research) ? raw.research : [],
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    certificates: Array.isArray(raw.certificates) ? raw.certificates : [],
    awards: Array.isArray(raw.awards) ? raw.awards : [],
    publications: Array.isArray(raw.publications) ? raw.publications : [],
    references: Array.isArray(raw.references) ? raw.references : [],
    languages: Array.isArray(raw.languages) ? raw.languages : [],
  } as Biography;
}

export function getValueAtPathExported(obj: unknown, path: string): unknown {
  return getValueAtPath(obj, path);
}
