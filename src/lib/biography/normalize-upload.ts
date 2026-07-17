import { ensureSkillsFromDocument } from "@/lib/biography/harvest-skills";
import type { Biography, ExtracurricularExperience } from "@/lib/types";

type RawRecord = Record<string, unknown>;

function asArray(value: unknown): RawRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as RawRecord[];
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function normalizeExperienceItem(
  item: RawRecord,
  defaults: { location?: string; start_date?: string; title?: string },
): RawRecord {
  return {
    ...item,
    title: str(item.title, defaults.title ?? str(item.position ?? item.role ?? item.organization)),
    location: str(item.location, defaults.location ?? ""),
    start_date: str(item.start_date, defaults.start_date ?? ""),
    end_date: item.end_date ?? null,
    highlights: Array.isArray(item.highlights) ? item.highlights : [],
    skills: Array.isArray(item.skills) ? item.skills : [],
    tools: Array.isArray(item.tools) ? item.tools : [],
  };
}

function normalizeWork(items: unknown): RawRecord[] {
  return asArray(items).map((item) =>
    normalizeExperienceItem(item, {
      title: str(item.position, str(item.organization)),
    }),
  );
}

function normalizeEducation(items: unknown): RawRecord[] {
  return asArray(items).map((item) =>
    normalizeExperienceItem(item, {
      title: str(item.title, `${str(item.degree)} — ${str(item.organization)}`),
    }),
  );
}

function normalizeVolunteer(items: unknown): Biography["volunteer"] {
  return asArray(items).map((item) => {
    const normalized = normalizeExperienceItem(item, {
      title: str(item.role, str(item.title, str(item.organization))),
    });
    return {
      id: normalized.id as string | undefined,
      title: str(normalized.title),
      organization: str(normalized.organization),
      role: str(item.role, str(item.position, "Volunteer")),
      start_date: str(normalized.start_date),
      end_date: (normalized.end_date as string | null) ?? null,
      location: str(normalized.location),
      url: (normalized.url as string | null) ?? null,
      summary: (normalized.summary as string | null) ?? null,
      highlights: (normalized.highlights as string[]) ?? [],
      skills: (normalized.skills as string[]) ?? [],
    };
  });
}

function normalizeGenericExperience(items: unknown): ExtracurricularExperience[] {
  return asArray(items).map((item) => {
    const normalized = normalizeExperienceItem(item, {
      title: str(item.title, str(item.organization)),
    });
    return {
      id: normalized.id as string | undefined,
      title: str(normalized.title),
      organization: str(normalized.organization),
      start_date: str(normalized.start_date),
      end_date: (normalized.end_date as string | null) ?? null,
      location: str(normalized.location),
      url: (normalized.url as string | null) ?? null,
      summary: (normalized.summary as string | null) ?? null,
      highlights: (normalized.highlights as string[]) ?? [],
      skills: (normalized.skills as string[]) ?? [],
    };
  });
}

function sportsToExtracurriculars(items: unknown): ExtracurricularExperience[] {
  return asArray(items).map((sport) => ({
    title: str(sport.title),
    organization: "Sports",
    start_date: str(sport.start_date, ""),
    end_date: str(sport.end_date, "") || null,
    location: str(sport.location, ""),
    highlights: Array.isArray(sport.highlights) ? (sport.highlights as string[]) : [],
    skills: [],
  }));
}

function normalizeResearch(items: unknown): RawRecord[] {
  return asArray(items).map((item) => ({
    ...normalizeExperienceItem(item, {
      title: str(item.title, "Research"),
      start_date: str(item.start_date, ""),
    }),
    organization: str(item.organization, str(item.reference, "Research")),
  }));
}

function normalizeProjects(items: unknown): RawRecord[] {
  return asArray(items).map((item) =>
    normalizeExperienceItem(item, {
      title: str(item.title, "Project"),
      start_date: str(item.start_date, ""),
    }),
  );
}

function normalizeEvents(items: unknown): RawRecord[] {
  return asArray(items).map((item) =>
    normalizeExperienceItem(item, {
      title: str(item.title, str(item.type, "Event")),
      start_date: str(item.start_date, ""),
    }),
  );
}

function normalizeSkills(items: unknown): RawRecord[] {
  return asArray(items).map((item) => ({
    ...item,
    level: str(item.level, "Proficient"),
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
  }));
}

function normalizeAwards(items: unknown): RawRecord[] {
  return asArray(items).map((item) => ({
    ...item,
    awarder: str(item.awarder, "Unknown"),
    date: str(item.date, ""),
    highlights: Array.isArray(item.highlights) ? item.highlights : [],
  }));
}

function normalizeCertificates(items: unknown): RawRecord[] {
  return asArray(items).map((item) => ({
    ...item,
    date: str(item.date, ""),
    issuer: str(item.issuer, "Unknown"),
  }));
}

export function isRecognizedBiographyShape(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as RawRecord;
  const basics = obj.basics as RawRecord | undefined;
  return Boolean(
    basics &&
      typeof basics === "object" &&
      typeof basics.name === "string" &&
      typeof obj.label === "string" &&
      typeof obj.summary === "string",
  );
}

export function normalizeUploadedBiography(raw: unknown): Biography {
  const data = raw as RawRecord;
  const basics = (data.basics ?? {}) as RawRecord;
  const location = (basics.location ?? {}) as RawRecord;

  const experienceItems = normalizeGenericExperience(data.experience);
  const sportItems = sportsToExtracurriculars(data.sports);
  const existingExtracurriculars = normalizeGenericExperience(data.extracurriculars);

  const normalized: Biography = {
    basics: {
      name: str(basics.name),
      email: str(basics.email, ""),
      phone: str(basics.phone, ""),
      image: str(basics.image, ""),
      location: {
        city: str(location.city, ""),
        region: str(location.region, ""),
        country: str(location.country, ""),
        country_code: str(location.country_code, ""),
      },
      profiles: Array.isArray(basics.profiles) ? (basics.profiles as Biography["basics"]["profiles"]) : [],
    },
    label: str(data.label),
    summary: str(data.summary),
    work: normalizeWork(data.work) as unknown as Biography["work"],
    education: normalizeEducation(data.education) as unknown as Biography["education"],
    volunteer: normalizeVolunteer(data.volunteer),
    extracurriculars: [...existingExtracurriculars, ...experienceItems, ...sportItems],
    events: normalizeEvents(data.events) as unknown as Biography["events"],
    skills: normalizeSkills(data.skills) as unknown as Biography["skills"],
    tools: Array.isArray(data.tools)
      ? (data.tools as Biography["tools"])
      : [],
    interests: Array.isArray(data.interests) ? data.interests.map(String) : [],
    research: normalizeResearch(data.research) as unknown as Biography["research"],
    projects: normalizeProjects(data.projects) as unknown as Biography["projects"],
    certificates: normalizeCertificates(data.certificates) as unknown as Biography["certificates"],
    awards: normalizeAwards(data.awards) as unknown as Biography["awards"],
    publications: asArray(data.publications) as unknown as Biography["publications"],
    references: asArray(data.references) as unknown as Biography["references"],
    languages: asArray(data.languages) as unknown as Biography["languages"],
  };

  return ensureSkillsFromDocument(normalized);
}
