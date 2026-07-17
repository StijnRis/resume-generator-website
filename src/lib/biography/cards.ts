import {
  getAttributeDisplayName,
  getExperienceDisplayName,
} from "@/lib/biography/lookup";
import { formatDate, formatDateRange, parseDateForSort } from "@/lib/formatting/dates";
import { formatLocationString } from "@/lib/formatting/location";
import type {
  AttributeCategoryKey,
  Biography,
  ExperienceCategoryKey,
} from "@/lib/types";
import {
  ATTRIBUTE_CATEGORIES,
  CATEGORY_LABELS,
  EXPERIENCE_CATEGORIES,
} from "@/lib/types";

export interface BiographyExperienceCard {
  key: string;
  category: ExperienceCategoryKey;
  categoryLabel: string;
  title: string;
  dateRange: string;
  location: string;
  raw: Record<string, unknown>;
  sortDate: number;
}

export interface BiographyAttributeCard {
  key: string;
  category: AttributeCategoryKey;
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
  const cards: BiographyExperienceCard[] = [];

  for (const category of EXPERIENCE_CATEGORIES) {
    const items = biography[category];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const raw = item as unknown as Record<string, unknown>;
      cards.push({
        key: `${category}-${String(raw.id ?? raw.title ?? cards.length)}`,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        title: getExperienceDisplayName(raw, category),
        dateRange: formatDateRange(
          String(raw.start_date ?? ""),
          raw.end_date as string | null | undefined,
        ),
        location: formatLocationString(String(raw.location ?? "")),
        raw,
        sortDate: parseDateForSort(raw.start_date as string | undefined),
      });
    }
  }

  return cards.sort((a, b) => b.sortDate - a.sortDate);
}

export function extractAttributeCards(
  biography: Biography,
): BiographyAttributeCard[] {
  const cards: BiographyAttributeCard[] = [];

  for (const category of ATTRIBUTE_CATEGORIES) {
    if (category === "interests") {
      const interests = biography.interests ?? [];
      for (const interest of interests) {
        const value =
          typeof interest === "string"
            ? interest
            : String(interest.value ?? "");
        const id =
          typeof interest === "object" && interest && "id" in interest
            ? String(interest.id ?? value)
            : value;
        cards.push({
          key: `interests-${id}`,
          category,
          categoryLabel: CATEGORY_LABELS[category],
          title: value,
          dateLabel: "",
          location: "",
          raw: interest,
          sortDate: 0,
        });
      }
      continue;
    }

    const items = biography[category];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const raw = item as Record<string, unknown>;
      const dateField =
        category === "publications"
          ? raw.release_date
          : category === "certificates" || category === "awards"
            ? raw.date
            : null;

      cards.push({
        key: `${category}-${String(raw.id ?? raw.name ?? raw.title ?? cards.length)}`,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        title: getAttributeDisplayName(item, category),
        dateLabel: dateField ? formatDate(String(dateField)) : "",
        location: raw.issuer
          ? String(raw.issuer)
          : raw.publisher
            ? String(raw.publisher)
            : raw.awarder
              ? String(raw.awarder)
              : "",
        raw: item,
        sortDate: dateField ? parseDateForSort(String(dateField)) : 0,
      });
    }
  }

  return cards.sort((a, b) => {
    if (a.sortDate !== b.sortDate) return b.sortDate - a.sortDate;
    return a.title.localeCompare(b.title);
  });
}
