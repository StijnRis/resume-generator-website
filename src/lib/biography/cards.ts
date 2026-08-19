import {
  getAttributeDisplayName,
  getExperienceDisplayName,
} from "@/lib/biography/lookup";
import { formatDate, formatDateRange, parseDateForSort } from "@/lib/formatting/dates";
import { formatLocationString } from "@/lib/formatting/location";
import type { Biography } from "@/lib/types";
import { sourceTypeLabel } from "@/lib/types";
import {
  getAttributes,
  getExperiences,
  groupAttributesByType,
  groupExperiencesByType,
} from "@/lib/biography/flat";

export interface BiographyExperienceCard {
  key: string;
  category: string;
  categoryLabel: string;
  title: string;
  dateRange: string;
  location: string;
  raw: Record<string, unknown>;
  sortDate: number;
}

export interface BiographyAttributeCard {
  key: string;
  category: string;
  categoryLabel: string;
  title: string;
  dateLabel: string;
  location: string;
  raw: unknown;
  sortDate: number;
}

export function extractExperienceCards(
  biography: Biography,
): BiographyExperienceCard[] {
  return getExperiences(biography)
    .map((item, index) => {
      const raw = item as unknown as Record<string, unknown>;
      return {
        key: `${item.type}-${String(item.id ?? item.title ?? index)}`,
        category: item.type,
        categoryLabel: sourceTypeLabel(item.type),
        title: getExperienceDisplayName(raw, item.type),
        dateRange: formatDateRange(
          String(item.start_date ?? ""),
          item.end_date as string | null | undefined,
        ),
        location: formatLocationString(String(item.location ?? "")),
        raw,
        sortDate: parseDateForSort(item.start_date),
      };
    })
    .sort((a, b) => b.sortDate - a.sortDate);
}

export function extractAttributeCards(
  biography: Biography,
): BiographyAttributeCard[] {
  return getAttributes(biography)
    .map((item, index) => {
      const dateField =
        item.type === "publications"
          ? item.release_date
          : item.type === "certificates" || item.type === "awards"
            ? item.date
            : null;

      return {
        key: `${item.type}-${String(item.id ?? item.name ?? item.title ?? index)}`,
        category: item.type,
        categoryLabel: sourceTypeLabel(item.type),
        title: getAttributeDisplayName(item, item.type),
        dateLabel: dateField ? formatDate(String(dateField)) : "",
        location: item.issuer
          ? String(item.issuer)
          : item.publisher
            ? String(item.publisher)
            : item.awarder
              ? String(item.awarder)
              : "",
        raw: item,
        sortDate: dateField ? parseDateForSort(String(dateField)) : 0,
      };
    })
    .sort((a, b) => {
      if (a.sortDate !== b.sortDate) return b.sortDate - a.sortDate;
      return a.title.localeCompare(b.title);
    });
}

export function experienceTypeOrder(biography: Biography): string[] {
  const grouped = groupExperiencesByType(biography);
  const known = [
    "work",
    "education",
    "volunteer",
    "extracurriculars",
    "events",
    "research",
    "projects",
    "experience",
    "sports",
  ];
  const rest = [...grouped.keys()].filter((key) => !known.includes(key)).sort();
  return [...known.filter((key) => grouped.has(key)), ...rest];
}

export function attributeTypeOrder(biography: Biography): string[] {
  const grouped = groupAttributesByType(biography);
  const known = [
    "skills",
    "tools",
    "interests",
    "certificates",
    "awards",
    "publications",
    "references",
    "languages",
  ];
  const rest = [...grouped.keys()].filter((key) => !known.includes(key)).sort();
  return [...known.filter((key) => grouped.has(key)), ...rest];
}
