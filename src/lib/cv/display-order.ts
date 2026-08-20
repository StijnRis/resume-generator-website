import type { HighLevelAnalysis, RenderedCv } from "@/lib/types";
import {
  getCategoryOrder,
  getExperienceCategoryDefs,
} from "@/lib/biography/lookup";
import {
  CATEGORY_HEADER_LINES,
  estimateAttributeLines,
  estimateExperienceLines,
  estimateSummaryLines,
} from "@/lib/cv/line-estimates";

export function orderExperiencesForDisplay(
  experiences: RenderedCv["experiences"],
  analysis: HighLevelAnalysis,
): RenderedCv["experiences"] {
  const byCategory = new Map<string, RenderedCv["experiences"]>();

  for (const exp of experiences) {
    const list = byCategory.get(exp.category) ?? [];
    list.push(exp);
    byCategory.set(exp.category, list);
  }

  const categoryOrder = getExperienceCategoryDefs(analysis)
    .map((def) => def.id)
    .filter((category) => byCategory.has(category))
    .sort(
      (a, b) => getCategoryOrder(analysis, a) - getCategoryOrder(analysis, b),
    );

  // Include any categories present on experiences but missing from the
  // analysis category defs (e.g. stale data), ordered after known ones.
  for (const category of byCategory.keys()) {
    if (!categoryOrder.includes(category)) categoryOrder.push(category);
  }

  const result: RenderedCv["experiences"] = [];
  for (const category of categoryOrder) {
    const items = byCategory.get(category) ?? [];
    items.sort((a, b) => {
      const dateDiff = b.sortDate - a.sortDate;
      if (dateDiff !== 0) return dateDiff;
      return a.title.localeCompare(b.title);
    });
    result.push(...items);
  }

  return result;
}

export function estimateCvDisplayLines(cv: RenderedCv): number {
  let lines = 6 + estimateSummaryLines(cv.summary);
  let lastCategory: string | null = null;

  for (const exp of cv.experiences) {
    if (exp.category !== lastCategory) {
      lines += CATEGORY_HEADER_LINES;
      lastCategory = exp.category;
    }
    lines += estimateExperienceLines(exp);
  }

  if (cv.attributeSections.length > 0) {
    lines += CATEGORY_HEADER_LINES;
    for (const section of cv.attributeSections) {
      lines += estimateAttributeLines(section.items.length);
    }
  }

  return lines;
}

export function findLowestImportanceExperienceIndex(
  experiences: RenderedCv["experiences"],
): number {
  let index = 0;
  let lowestScore = experiences[0]?.relevanceScore ?? 0;
  let lowestDate = experiences[0]?.sortDate ?? 0;

  for (let i = 1; i < experiences.length; i++) {
    const exp = experiences[i];
    if (
      exp.relevanceScore < lowestScore ||
      (exp.relevanceScore === lowestScore && exp.sortDate < lowestDate)
    ) {
      lowestScore = exp.relevanceScore;
      lowestDate = exp.sortDate;
      index = i;
    }
  }

  return index;
}
