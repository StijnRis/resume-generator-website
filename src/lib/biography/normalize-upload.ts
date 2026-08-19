import { ensureSkillsFromDocument } from "@/lib/biography/harvest-skills";
import type {
  Biography,
  BiographyAttribute,
  BiographyExperience,
} from "@/lib/types";

type RawRecord = Record<string, unknown>;

function asArray(value: unknown): RawRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) => item && typeof item === "object",
  ) as RawRecord[];
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function normalizeExperienceFields(
  item: RawRecord,
  defaults: { location?: string; start_date?: string; title?: string },
): Omit<BiographyExperience, "type"> {
  const projectType =
    item.project_type != null
      ? str(item.project_type)
      : item.type != null && typeof item.type === "string"
        ? str(item.type)
        : null;

  return {
    id: item.id != null ? str(item.id) : undefined,
    title: str(
      item.title,
      defaults.title ?? str(item.position ?? item.role ?? item.organization),
    ),
    location: str(item.location, defaults.location ?? ""),
    start_date: str(item.start_date, defaults.start_date ?? ""),
    end_date: (item.end_date as string | null | undefined) ?? null,
    hours_per_week:
      typeof item.hours_per_week === "number" ? item.hours_per_week : null,
    url: (item.url as string | null | undefined) ?? null,
    summary: (item.summary as string | null | undefined) ?? null,
    highlights: Array.isArray(item.highlights)
      ? item.highlights.map(String)
      : [],
    skills: Array.isArray(item.skills) ? item.skills.map(String) : [],
    tools: Array.isArray(item.tools) ? item.tools.map(String) : [],
    organization:
      item.organization != null ? str(item.organization) : undefined,
    position: item.position != null ? str(item.position) : undefined,
    role: item.role != null ? str(item.role) : undefined,
    degree: item.degree != null ? str(item.degree) : undefined,
    area: item.area != null ? str(item.area) : undefined,
    grade: typeof item.grade === "number" ? item.grade : null,
    grade_scale: typeof item.grade_scale === "number" ? item.grade_scale : null,
    courses: Array.isArray(item.courses) ? item.courses : undefined,
    roles: Array.isArray(item.roles) ? item.roles.map(String) : undefined,
    project_type: projectType,
    goal: item.goal != null ? str(item.goal) : undefined,
    reference: item.reference != null ? str(item.reference) : undefined,
  };
}

function experiencesFromKey(
  raw: RawRecord,
  key: string,
  mapItem: (item: RawRecord) => Omit<BiographyExperience, "type">,
): BiographyExperience[] {
  return asArray(raw[key]).map((item) => ({
    ...mapItem(item),
    type: key,
  }));
}

function attributesFromKey(
  raw: RawRecord,
  key: string,
  mapItem?: (item: RawRecord) => Omit<BiographyAttribute, "type">,
): BiographyAttribute[] {
  if (key === "interests") {
    const interests = Array.isArray(raw.interests) ? raw.interests : [];
    return interests.map((entry, index) => {
      if (typeof entry === "string") {
        return { type: "interests", value: entry };
      }
      if (entry && typeof entry === "object") {
        const obj = entry as RawRecord;
        return {
          type: "interests",
          id: obj.id != null ? str(obj.id) : undefined,
          value: str(obj.value, str(obj.name, `Interest ${index + 1}`)),
        };
      }
      return { type: "interests", value: String(entry) };
    });
  }

  return asArray(raw[key]).map((item) => ({
    type: key,
    ...(mapItem
      ? mapItem(item)
      : {
          id: item.id != null ? str(item.id) : undefined,
          name: item.name != null ? str(item.name) : undefined,
          title: item.title != null ? str(item.title) : undefined,
          value: item.value != null ? str(item.value) : undefined,
          level: item.level != null ? str(item.level) : undefined,
          keywords: Array.isArray(item.keywords)
            ? item.keywords.map(String)
            : undefined,
          language: item.language != null ? str(item.language) : undefined,
          fluency: item.fluency != null ? str(item.fluency) : undefined,
          date: item.date != null ? str(item.date) : undefined,
          issuer: item.issuer != null ? str(item.issuer) : undefined,
          awarder: item.awarder != null ? str(item.awarder) : undefined,
          publisher: item.publisher != null ? str(item.publisher) : undefined,
          release_date:
            item.release_date != null ? str(item.release_date) : undefined,
          reference: item.reference != null ? str(item.reference) : undefined,
          position: item.position != null ? str(item.position) : undefined,
          contact: item.contact != null ? str(item.contact) : undefined,
          url: (item.url as string | null | undefined) ?? null,
          summary: (item.summary as string | null | undefined) ?? null,
          highlights: Array.isArray(item.highlights)
            ? item.highlights.map(String)
            : undefined,
        }),
  }));
}

const EXPERIENCE_SOURCE_KEYS = [
  "work",
  "education",
  "volunteer",
  "extracurriculars",
  "events",
  "research",
  "projects",
  "experience",
  "sports",
] as const;

const ATTRIBUTE_SOURCE_KEYS = [
  "skills",
  "tools",
  "interests",
  "certificates",
  "awards",
  "publications",
  "references",
  "languages",
] as const;

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

/**
 * Parse upload JSON into flat experiences/attributes.
 * Each item keeps `type` = the original JSON key it was found under.
 * Does not remap source buckets (e.g. sports stays sports).
 */
export function normalizeUploadedBiography(raw: unknown): Biography {
  const data = raw as RawRecord;
  const basics = (data.basics ?? {}) as RawRecord;
  const location = (basics.location ?? {}) as RawRecord;

  const experiences: BiographyExperience[] = [];

  // Prefer already-flat experiences array when present.
  if (Array.isArray(data.experiences)) {
    for (const entry of asArray(data.experiences)) {
      const type = str(entry.type, "experience");
      experiences.push({
        ...normalizeExperienceFields(entry, {}),
        type,
      });
    }
  } else {
    for (const key of EXPERIENCE_SOURCE_KEYS) {
      experiences.push(
        ...experiencesFromKey(data, key, (item) => {
          if (key === "work") {
            return normalizeExperienceFields(item, {
              title: str(item.position, str(item.organization)),
            });
          }
          if (key === "education") {
            return normalizeExperienceFields(item, {
              title: str(
                item.title,
                `${str(item.degree)} — ${str(item.organization)}`,
              ),
            });
          }
          if (key === "volunteer") {
            return normalizeExperienceFields(item, {
              title: str(item.role, str(item.title, str(item.organization))),
            });
          }
          if (key === "sports") {
            return normalizeExperienceFields(
              {
                ...item,
                organization: str(item.organization, "Sports"),
              },
              { title: str(item.title) },
            );
          }
          if (key === "research") {
            return normalizeExperienceFields(
              {
                ...item,
                organization: str(
                  item.organization,
                  str(item.reference, "Research"),
                ),
              },
              { title: str(item.title, "Research") },
            );
          }
          if (key === "events") {
            return normalizeExperienceFields(item, {
              title: str(item.title, str(item.type, "Event")),
            });
          }
          return normalizeExperienceFields(item, {
            title: str(item.title, str(item.organization, "Experience")),
          });
        }),
      );
    }
  }

  const attributes: BiographyAttribute[] = [];
  if (Array.isArray(data.attributes)) {
    for (const entry of asArray(data.attributes)) {
      attributes.push({
        type: str(entry.type, "skills"),
        id: entry.id != null ? str(entry.id) : undefined,
        name: entry.name != null ? str(entry.name) : undefined,
        title: entry.title != null ? str(entry.title) : undefined,
        value: entry.value != null ? str(entry.value) : undefined,
        level: entry.level != null ? str(entry.level) : undefined,
        keywords: Array.isArray(entry.keywords)
          ? entry.keywords.map(String)
          : undefined,
        language: entry.language != null ? str(entry.language) : undefined,
        fluency: entry.fluency != null ? str(entry.fluency) : undefined,
        date: entry.date != null ? str(entry.date) : undefined,
        issuer: entry.issuer != null ? str(entry.issuer) : undefined,
        awarder: entry.awarder != null ? str(entry.awarder) : undefined,
        publisher: entry.publisher != null ? str(entry.publisher) : undefined,
        release_date:
          entry.release_date != null ? str(entry.release_date) : undefined,
        reference: entry.reference != null ? str(entry.reference) : undefined,
        position: entry.position != null ? str(entry.position) : undefined,
        contact: entry.contact != null ? str(entry.contact) : undefined,
        url: (entry.url as string | null | undefined) ?? null,
        summary: (entry.summary as string | null | undefined) ?? null,
        highlights: Array.isArray(entry.highlights)
          ? entry.highlights.map(String)
          : undefined,
      });
    }
  } else {
    for (const key of ATTRIBUTE_SOURCE_KEYS) {
      if (key === "skills") {
        attributes.push(
          ...attributesFromKey(data, "skills", (item) => ({
            id: item.id != null ? str(item.id) : undefined,
            name: str(item.name),
            level: item.level != null ? str(item.level) : undefined,
            keywords: Array.isArray(item.keywords)
              ? item.keywords.map(String)
              : [],
          })),
        );
        continue;
      }
      if (key === "tools") {
        attributes.push(
          ...attributesFromKey(data, "tools", (item) => ({
            id: item.id != null ? str(item.id) : undefined,
            name: str(item.name),
          })),
        );
        continue;
      }
      if (key === "certificates") {
        attributes.push(
          ...attributesFromKey(data, "certificates", (item) => ({
            id: item.id != null ? str(item.id) : undefined,
            name: str(item.name),
            date: str(item.date),
            issuer: str(item.issuer, "Unknown"),
            url: (item.url as string | null | undefined) ?? null,
            summary: (item.summary as string | null | undefined) ?? null,
          })),
        );
        continue;
      }
      if (key === "awards") {
        attributes.push(
          ...attributesFromKey(data, "awards", (item) => ({
            id: item.id != null ? str(item.id) : undefined,
            title: str(item.title),
            awarder: str(item.awarder, "Unknown"),
            date: str(item.date),
            highlights: Array.isArray(item.highlights)
              ? item.highlights.map(String)
              : [],
            url: (item.url as string | null | undefined) ?? null,
            summary: (item.summary as string | null | undefined) ?? null,
          })),
        );
        continue;
      }
      attributes.push(...attributesFromKey(data, key));
    }
  }

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
      profiles: Array.isArray(basics.profiles)
        ? (basics.profiles as Biography["basics"]["profiles"])
        : [],
    },
    label: str(data.label),
    summary: str(data.summary),
    experiences,
    attributes,
  };

  return ensureSkillsFromDocument(normalized);
}
