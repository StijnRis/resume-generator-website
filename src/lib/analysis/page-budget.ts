import { getExperienceImportance, isExperienceIncluded } from "@/lib/analysis/experience-score";
import {
  applyAllSuggestedMerges,
  buildExperienceUnits,
  isUnitIncluded,
} from "@/lib/analysis/merges";
import type { Biography, HighLevelAnalysis } from "@/lib/types";

/** Rough minimum included experiences to aim for ~N pages of content. */
function targetIncludedUnits(pageCount: number): number {
  return Math.max(6, pageCount * 6);
}

/**
 * Promote excluded experiences when the analysis would under-fill the page budget.
 */
export function expandAnalysisForPageBudget(
  biography: Biography,
  analysis: HighLevelAnalysis,
  pageCount: number,
): HighLevelAnalysis {
  let next = applyAllSuggestedMerges(biography, analysis);
  const target = targetIncludedUnits(pageCount);

  const countIncluded = () =>
    buildExperienceUnits(next).filter(isUnitIncluded).length;

  if (countIncluded() >= target) return next;

  const excluded = next.experience_analysis
    .filter((item) => !isExperienceIncluded(item))
    .sort((a, b) => getExperienceImportance(b) - getExperienceImportance(a));

  for (const item of excluded) {
    if (countIncluded() >= target) break;
    next = {
      ...next,
      experience_analysis: next.experience_analysis.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              relevance_score: 25,
              suggested_bullet_points: Math.max(
                1,
                entry.suggested_bullet_points ?? 0,
              ),
              reason: entry.reason.includes("Added by code")
                ? "Promoted to fill the target page budget."
                : `${entry.reason} (Promoted to fill page budget.)`,
            }
          : entry,
      ),
    };
  }

  if (pageCount >= 2) {
    next = {
      ...next,
      experience_analysis: next.experience_analysis.map((entry) => {
        if (!isExperienceIncluded(entry)) return entry;
        const bullets = entry.suggested_bullet_points ?? 0;
        if (bullets >= 2) return entry;
        return {
          ...entry,
          suggested_bullet_points: Math.min(3, Math.max(2, bullets)),
        };
      }),
    };
  }

  return next;
}
