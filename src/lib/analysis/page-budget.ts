import {
  getExperienceBulletCount,
  getExperienceImportance,
  isExperienceIncluded,
} from "@/lib/analysis/experience-score";
import { buildExperienceUnits, isUnitIncluded } from "@/lib/analysis/merges";
import type {
  Biography,
  ExperienceAnalysisItem,
  HighLevelAnalysis,
} from "@/lib/types";

/** Bumps importance on 0-importance bullets (in order) until `minCount` bullets are eligible. */
function bumpBulletImportances(
  item: ExperienceAnalysisItem,
  minCount: number,
): ExperienceAnalysisItem {
  const bullets = item.bullets ?? [];
  if (bullets.length === 0) return item;

  let remaining = minCount - getExperienceBulletCount(item);
  if (remaining <= 0) return item;

  const nextBullets = bullets.map((bullet) => {
    if (remaining <= 0 || bullet.importance > 0) return bullet;
    remaining -= 1;
    return { ...bullet, importance: 40 };
  });

  return { ...item, bullets: nextBullets };
}

/** Rough minimum included experiences to aim for ~N pages of content. */
function targetIncludedUnits(pageCount: number): number {
  return Math.max(6, pageCount * 6);
}

/**
 * Promote excluded experiences when the analysis would under-fill the page budget.
 */
export function expandAnalysisForPageBudget(
  _biography: Biography,
  analysis: HighLevelAnalysis,
  pageCount: number,
): HighLevelAnalysis {
  let next = analysis;
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
          ? bumpBulletImportances(
              {
                ...entry,
                relevance_score: 25,
                reason: entry.reason.includes("Added by code")
                  ? "Promoted to fill the target page budget."
                  : `${entry.reason} (Promoted to fill page budget.)`,
              },
              1,
            )
          : entry,
      ),
    };
  }

  if (pageCount >= 2) {
    next = {
      ...next,
      experience_analysis: next.experience_analysis.map((entry) => {
        if (!isExperienceIncluded(entry)) return entry;
        return bumpBulletImportances(entry, 2);
      }),
    };
  }

  return next;
}
