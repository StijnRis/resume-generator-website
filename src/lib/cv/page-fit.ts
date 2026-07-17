import type { HighLevelAnalysis, RenderedCv } from "@/lib/types";
import {
  estimateCvDisplayLines,
  findLowestImportanceExperienceIndex,
  orderExperiencesForDisplay,
} from "@/lib/cv/display-order";
import {
  estimateAttributeLines,
  estimateSummaryLines,
} from "@/lib/cv/line-estimates";

/** Conservative line budget per A4 page (padding, margins, print variance). */
export const LINES_PER_PAGE = 36;

/** Extra lines withheld so print layout stays within the page cap. */
const FIT_SAFETY_LINES = 4;

export function getPageLineBudget(pageCount: number): number {
  return Math.max(1, pageCount) * LINES_PER_PAGE - FIT_SAFETY_LINES;
}

export { estimateExperienceLines, estimateAttributeLines, estimateSummaryLines } from "@/lib/cv/line-estimates";

export function fitAttributesToBudget(
  sections: RenderedCv["attributeSections"],
  usedLines: number,
  budget: number,
): RenderedCv["attributeSections"] {
  const result: RenderedCv["attributeSections"] = [];
  let currentLines = usedLines;

  for (const section of sections) {
    const lines = estimateAttributeLines(section.items.length);
    if (currentLines + lines > budget) {
      const remaining = budget - currentLines - 2.5;
      if (remaining > 2) {
        const maxItems = Math.max(1, Math.floor(remaining * 3.5));
        result.push({
          id: section.id,
          category: section.category,
          items: section.items.slice(0, maxItems),
          order: section.order,
        });
      }
      break;
    }
    currentLines += lines;
    result.push(section);
  }

  return result;
}

export function fitCvToPageBudget(
  cv: RenderedCv,
  pageCount: number,
  analysis: HighLevelAnalysis,
): RenderedCv {
  const budget = getPageLineBudget(pageCount);

  let experiences = orderExperiencesForDisplay(cv.experiences, analysis);

  while (experiences.length > 0) {
    const candidate: RenderedCv = {
      ...cv,
      experiences,
      attributeSections: cv.attributeSections,
    };

    if (estimateCvDisplayLines(candidate) <= budget) {
      const usedWithoutAttributes = estimateCvDisplayLines({
        ...candidate,
        attributeSections: [],
      });
      return {
        ...candidate,
        attributeSections: fitAttributesToBudget(
          cv.attributeSections,
          usedWithoutAttributes,
          budget,
        ),
      };
    }

    const removeIndex = findLowestImportanceExperienceIndex(experiences);
    experiences = experiences.filter((_, index) => index !== removeIndex);
  }

  return {
    ...cv,
    experiences: [],
    attributeSections: [],
  };
}
