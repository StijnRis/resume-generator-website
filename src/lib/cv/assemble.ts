import type {
  Biography,
  BiographyCategoryKey,
  ExperienceAnalysisItem,
  GeneratedCvTexts,
  HighLevelAnalysis,
  RenderedCv,
} from "@/lib/types";
import { ATTRIBUTE_CATEGORIES, CATEGORY_LABELS, EXPERIENCE_CATEGORIES } from "@/lib/types";
import { titleCase } from "title-case";
import {
  getExperienceImportance,
  isExperienceIncluded,
  normalizeAnalysis,
} from "@/lib/analysis/experience-score";
import {
  buildExperienceUnits,
  getUnitBulletCount,
  getUnitCvId,
  getUnitImportance,
  isUnitIncluded,
  type CvExperienceUnit,
} from "@/lib/analysis/merges";
import { formatDateRange, formatMergedDateRange, parseDateForSort } from "@/lib/formatting/dates";
import { formatLocationObject, formatLocationString } from "@/lib/formatting/location";
import {
  mergeUiLabels,
} from "@/lib/formatting/ui-labels";
import type { Basics } from "@/lib/types";
import {
  getSharedLocation,
  getSharedOrganization,
} from "@/lib/cv/merged-meta";
import {
  buildAttributeUnits,
  defaultAttributeSectionTitle,
  getAttributeUnitId,
  getAttributeUnitImportance,
  type CvAttributeUnit,
} from "@/lib/analysis/attribute-merges";
import {
  getAttributeItemById,
  getAttributeRowItems,
  getCategoryOrder,
  getExperienceItemById,
  getExperienceOrganization,
  getExperienceRole,
  isPartTimeExperience,
} from "@/lib/biography/lookup";

function applyCopiedTranslation(
  value: string,
  translations?: GeneratedCvTexts["translations"],
): string {
  if (!value || !translations?.length) return value;
  const hit = translations.find((entry) => entry.original === value);
  return hit?.translated ?? value;
}

function localizeBasics(
  basics: Basics,
  translations?: GeneratedCvTexts["translations"],
): Basics {
  if (!translations?.length || !basics.location) return basics;
  const locationText = formatLocationObject(basics.location);
  const translated = applyCopiedTranslation(locationText, translations);
  if (translated === locationText) return basics;
  // Keep structure but prefer translated display via city field when needed.
  return {
    ...basics,
    location: {
      ...basics.location,
      city: translated,
      region: "",
      country: "",
    },
  };
}

function dateOptionsFromTexts(texts?: GeneratedCvTexts | null) {
  const labels = mergeUiLabels(texts?.uiLabels);
  return {
    language: texts?.language,
    labels: {
      present: labels.present,
      starting: labels.starting,
      expected: labels.expected,
    },
  };
}

function collectAttributeUnitItems(
  biography: Biography,
  unit: CvAttributeUnit,
  generated?: GeneratedCvTexts["attributes"],
  translations?: GeneratedCvTexts["translations"],
): { id: string; text: string }[] {
  const items = unit.type === "single" ? [unit.item] : unit.items;
  const sectionId = getAttributeUnitId(unit);
  const generatedItems = generated?.[sectionId]?.items;
  const values: { id: string; text: string }[] = [];

  for (const item of items) {
    if (item.relevance_score <= 0 && unit.type === "single") continue;
    const source = getAttributeItemById(biography, item.category, item.id);
    const rawValues = getAttributeRowItems(source, item.category);
    for (const raw of rawValues) {
      if (!raw) continue;
      const text =
        generatedItems?.[item.id] ??
        applyCopiedTranslation(raw, translations);
      if (!values.some((entry) => entry.id === item.id || entry.text === text)) {
        values.push({ id: item.id, text });
      }
    }
  }

  return values;
}

function buildAttributeSections(
  biography: Biography,
  analysis: HighLevelAnalysis,
  texts?: GeneratedCvTexts | null,
): RenderedCv["attributeSections"] {
  const units = buildAttributeUnits(analysis).filter(
    (unit) => getAttributeUnitImportance(unit) > 0,
  );

  // Group unmerged singles by category into one row per category (unless titled individually by AI).
  const categoryBuckets = new Map<
    string,
    {
      id: string;
      items: { id: string; text: string }[];
      order: number;
      maxScore: number;
      title: string;
    }
  >();
  const sections: RenderedCv["attributeSections"] = [];

  for (const unit of units) {
    if (unit.type === "merged") {
      const id = unit.group.id;
      const items = collectAttributeUnitItems(
        biography,
        unit,
        texts?.attributes,
        texts?.translations,
      );
      if (items.length === 0) continue;
      const title =
        texts?.attributes?.[id]?.title?.trim() ||
        unit.group.title?.trim() ||
        defaultAttributeSectionTitle(unit);
      sections.push({
        id,
        category: title,
        items,
        order: Math.min(
          ...unit.items.map((item) =>
            getCategoryOrder(analysis, item.category),
          ),
        ),
      });
      continue;
    }

    const category = unit.item.category;
    const bucketId = `cat:${category}`;
    const itemValues = collectAttributeUnitItems(
      biography,
      unit,
      texts?.attributes,
      texts?.translations,
    );
    if (itemValues.length === 0) continue;

    const existing = categoryBuckets.get(bucketId);
    if (existing) {
      for (const value of itemValues) {
        if (
          !existing.items.some(
            (entry) => entry.id === value.id || entry.text === value.text,
          )
        ) {
          existing.items.push(value);
        }
      }
      existing.maxScore = Math.max(
        existing.maxScore,
        unit.item.relevance_score,
      );
    } else {
      const title =
        texts?.attributes?.[bucketId]?.title?.trim() ||
        texts?.attributes?.[category]?.title?.trim() ||
        CATEGORY_LABELS[category] ||
        category;
      categoryBuckets.set(bucketId, {
        id: bucketId,
        items: itemValues,
        order: getCategoryOrder(analysis, category),
        maxScore: unit.item.relevance_score,
        title,
      });
    }
  }

  for (const bucket of categoryBuckets.values()) {
    sections.push({
      id: bucket.id,
      category: bucket.title,
      items: bucket.items,
      order: bucket.order,
    });
  }

  return sections.sort(
    (a, b) => (a.order ?? 99) - (b.order ?? 99),
  );
}

function formatExperienceTitle(value: string): string {
  return titleCase(
    value
      .replace(/[.,:;'"`!?()[\]{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function sortUnitsByImportance(
  biography: Biography,
  units: CvExperienceUnit[],
): CvExperienceUnit[] {
  return [...units].sort((a, b) => {
    const importanceDiff = getUnitImportance(b) - getUnitImportance(a);
    if (importanceDiff !== 0) return importanceDiff;

    return getUnitSortDate(biography, b) - getUnitSortDate(biography, a);
  });
}

function getUnitsForPageFill(
  analysis: HighLevelAnalysis,
  biography: Biography,
): CvExperienceUnit[] {
  const units = buildExperienceUnits(analysis).filter(isUnitIncluded);
  return sortUnitsByImportance(biography, units);
}

function getItemEndSortDate(
  source: Record<string, unknown> | null,
): number {
  if (!source) return 0;
  const end = source.end_date as string | null | undefined;
  const start = source.start_date as string | undefined;
  // Ongoing / present end dates sort as most recent.
  if (end == null || end === "" || /^present$/i.test(String(end).trim())) {
    return parseDateForSort(null);
  }
  return parseDateForSort(String(end)) || parseDateForSort(start);
}

function getUnitSortDate(biography: Biography, unit: CvExperienceUnit): number {
  const items = unit.type === "single" ? [unit.item] : unit.items;
  return Math.max(
    ...items.map((item) => {
      const source = getExperienceItemById(biography, item.category, item.id);
      return getItemEndSortDate(source);
    }),
  );
}

export function buildPlaceholderCv(
  biography: Biography,
  analysis: HighLevelAnalysis,
): RenderedCv {
  const normalized = normalizeAnalysis(analysis);
  const units = getUnitsForPageFill(normalized, biography);

  const experiences = units.map((unit) => {
    const bulletCount = getUnitBulletCount(unit);
    return buildExperienceEntryFromParts(biography, unit, {
      bulletPoints: Array.from(
        { length: bulletCount },
        (_, i) =>
          `[Bullet point ${i + 1} — click Regenerate to generate tailored content]`,
      ),
      title: unit.type === "merged" ? "Combined Entry" : undefined,
    });
  });

  const draft: RenderedCv = {
    basics: biography.basics,
    label: biography.label,
    summary:
      "[Professional summary — click Regenerate to generate tailored content]",
    experiences,
    attributeSections: buildAttributeSections(biography, normalized),
    categoryOrders: buildCategoryOrders(normalized),
    uiLabels: mergeUiLabels(null),
  };

  return draft;
}

export function buildFinalCv(
  biography: Biography,
  analysis: HighLevelAnalysis,
  texts: GeneratedCvTexts,
): RenderedCv {
  const normalized = normalizeAnalysis(analysis);
  const units = getUnitsForPageFill(normalized, biography);
  const uiLabels = mergeUiLabels(texts.uiLabels);
  const dateOptions = dateOptionsFromTexts(texts);

  const experiences = units.map((unit) => {
    const cvId = getUnitCvId(unit);
    const generated = texts.experiences[cvId];
    const bulletCount = getUnitBulletCount(unit);
    return buildExperienceEntryFromParts(
      biography,
      unit,
      {
        bulletPoints: (generated?.bullet_points ?? []).slice(0, bulletCount),
        title: generated?.title,
        organization: generated?.organization,
        location: generated?.location,
      },
      texts.translations,
      dateOptions,
    );
  });

  const draft: RenderedCv = {
    basics: localizeBasics(biography.basics, texts.translations),
    label: biography.label,
    summary: texts.summary ?? biography.summary,
    experiences,
    attributeSections: buildAttributeSections(biography, normalized, texts),
    categoryOrders: buildCategoryOrders(normalized),
    uiLabels,
  };

  return draft;
}

function buildUnitRole(biography: Biography, unit: CvExperienceUnit): string {
  if (unit.type === "single") {
    const source = getExperienceItemById(
      biography,
      unit.item.category,
      unit.item.id,
    );
    return getExperienceRole(source, unit.item.category);
  }

  return unit.items
    .map((item) => {
      const source = getExperienceItemById(biography, item.category, item.id);
      return getExperienceRole(source, item.category);
    })
    .join(" · ");
}

function unitIsPartTime(biography: Biography, unit: CvExperienceUnit): boolean {
  const items = unit.type === "single" ? [unit.item] : unit.items;
  return items.some((item) =>
    isPartTimeExperience(
      getExperienceItemById(biography, item.category, item.id),
    ),
  );
}

function buildExperienceEntryFromParts(
  biography: Biography,
  unit: CvExperienceUnit,
  generated: {
    bulletPoints: string[];
    title?: string;
    organization?: string;
    location?: string;
  },
  translations?: GeneratedCvTexts["translations"],
  dateOptions?: ReturnType<typeof dateOptionsFromTexts>,
): RenderedCv["experiences"][0] {
  if (unit.type === "single") {
    return buildSingleExperienceEntry(
      biography,
      unit.item,
      generated,
      translations,
      dateOptions,
    );
  }

  const primaryItem = unit.items[0];
  const sources = unit.items.map((item) =>
    getExperienceItemById(biography, item.category, item.id),
  );

  const starts = unit.items.map((item) => {
    const source = getExperienceItemById(biography, item.category, item.id);
    return String(source?.start_date ?? "");
  });
  const ends = unit.items.map((item) => {
    const source = getExperienceItemById(biography, item.category, item.id);
    return source?.end_date as string | null | undefined;
  });
  const dateRange = formatMergedDateRange(starts, ends, dateOptions);

  const organizations = unit.items.map((item) => {
    const source = getExperienceItemById(biography, item.category, item.id);
    return getExperienceOrganization(source, item.category);
  });
  const sharedOrganization = getSharedOrganization(organizations);

  const locations = sources.map((source) =>
    formatLocationString(String(source?.location ?? "")),
  );
  const sharedLocation = getSharedLocation(locations);

  const rawTitle =
    generated.title?.trim() ||
    buildUnitRole(biography, unit).split(" · ")[0] ||
    "Combined Entry";
  const title = formatExperienceTitle(rawTitle);

  const subtitle = applyCopiedTranslation(
    (
      sharedOrganization ??
      generated.organization?.trim() ??
      ""
    ).trim(),
    translations,
  );

  const location = applyCopiedTranslation(
    (
      sharedLocation ??
      generated.location?.trim() ??
      ""
    ).trim(),
    translations,
  );

  return {
    id: unit.group.id,
    category: primaryItem.category,
    title,
    subtitle,
    dateRange,
    location,
    partTime: unitIsPartTime(biography, unit),
    summary: undefined,
    bulletPoints: generated.bulletPoints,
    requestedBulletCount: generated.bulletPoints.length,
    relevanceScore: getUnitImportance(unit),
    sortDate: getUnitSortDate(biography, unit),
    sourceIds: unit.items.map((item) => item.id),
    merged: true,
  };
}

function buildSingleExperienceEntry(
  biography: Biography,
  item: ExperienceAnalysisItem,
  generated: {
    bulletPoints: string[];
    title?: string;
    organization?: string;
    location?: string;
  },
  translations?: GeneratedCvTexts["translations"],
  dateOptions?: ReturnType<typeof dateOptionsFromTexts>,
): RenderedCv["experiences"][0] {
  const source = getExperienceItemById(biography, item.category, item.id);
  const biographyTitle = getExperienceRole(source, item.category);
  const title = formatExperienceTitle(
    generated.title?.trim() || biographyTitle,
  );
  const subtitle = applyCopiedTranslation(
    (
      generated.organization?.trim() ||
      getExperienceOrganization(source, item.category)
    ).trim(),
    translations,
  );
  const dateRange = source
    ? formatDateRange(
        String(source.start_date ?? ""),
        source.end_date as string | null,
        dateOptions,
      )
    : "";
  const location = applyCopiedTranslation(
    (
      generated.location?.trim() ||
      (source ? formatLocationString(String(source.location ?? "")) : "")
    ).trim(),
    translations,
  );

  return {
    id: item.id,
    category: item.category,
    title,
    subtitle,
    dateRange,
    location,
    partTime: isPartTimeExperience(source),
    summary: undefined,
    bulletPoints: generated.bulletPoints,
    requestedBulletCount: generated.bulletPoints.length,
    relevanceScore: getExperienceImportance(item),
    sortDate: getItemEndSortDate(source),
    sourceIds: [item.id],
    merged: false,
  };
}

function buildCategoryOrders(
  analysis: HighLevelAnalysis,
): Partial<Record<BiographyCategoryKey, number>> {
  const orders: Partial<Record<BiographyCategoryKey, number>> = {};
  for (const category of [...EXPERIENCE_CATEGORIES, ...ATTRIBUTE_CATEGORIES]) {
    orders[category] = getCategoryOrder(analysis, category);
  }
  return orders;
}

export function getIncludedExperiences(
  analysis: HighLevelAnalysis,
): ExperienceAnalysisItem[] {
  return analysis.experience_analysis
    .filter(isExperienceIncluded)
    .sort(
      (a, b) => getExperienceImportance(b) - getExperienceImportance(a),
    );
}
