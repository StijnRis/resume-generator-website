import type { ExperienceAnalysisItem, HighLevelAnalysis } from "@/lib/types";

export const MAX_EXPERIENCE_BULLETS = 5;
export const MAX_IMPORTANCE = 100;

/** Importance for ordering / page fill (0–100). 0 = excluded from CV. */
export function getExperienceImportance(
  item: Pick<ExperienceAnalysisItem, "relevance_score">,
): number {
  const score = item.relevance_score;
  if (Number.isInteger(score) && score >= 0 && score <= MAX_IMPORTANCE) {
    return score;
  }
  return Math.min(MAX_IMPORTANCE, Math.max(0, score || 0));
}

/** Bullet count for CV content (0–5). 0 = no bullets, entry may still appear. */
export function getExperienceBulletCount(
  item: Pick<ExperienceAnalysisItem, "suggested_bullet_points">,
): number {
  const bullets = item.suggested_bullet_points;
  if (
    Number.isInteger(bullets) &&
    bullets >= 0 &&
    bullets <= MAX_EXPERIENCE_BULLETS
  ) {
    return bullets;
  }
  return Math.min(MAX_EXPERIENCE_BULLETS, Math.max(0, bullets ?? 0));
}

/** Included on the CV when importance is 1–100 (0 = always excluded). */
export function isExperienceIncluded(
  item: Pick<ExperienceAnalysisItem, "relevance_score">,
): boolean {
  return getExperienceImportance(item) > 0;
}

export function normalizeAnalysis(analysis: HighLevelAnalysis): HighLevelAnalysis {
  return {
    ...analysis,
    experience_merges: analysis.experience_merges ?? [],
    experience_analysis: analysis.experience_analysis.map((item) => {
      let importance = item.relevance_score;
      let bullets = item.suggested_bullet_points;

      // Legacy 1–5 scale without explicit bullet counts.
      if (bullets == null && importance >= 0 && importance <= 5) {
        if (importance <= 0) {
          bullets = 0;
          importance = 0;
        } else {
          bullets = Math.min(MAX_EXPERIENCE_BULLETS, importance);
        }
      }

      return {
        ...item,
        relevance_score: Math.min(
          MAX_IMPORTANCE,
          Math.max(0, importance ?? 0),
        ),
        suggested_bullet_points: Math.min(
          MAX_EXPERIENCE_BULLETS,
          Math.max(0, bullets ?? 0),
        ),
      };
    }),
    attribute_analysis: analysis.attribute_analysis.map((item) => ({
      ...item,
      relevance_score: Math.min(
        MAX_IMPORTANCE,
        Math.max(0, item.relevance_score ?? 0),
      ),
    })),
  };
}

export function formatExperienceSliderValue(value: number): string {
  if (value === 0) return "0 bullets";
  if (value === 1) return "1 bullet";
  return `${value} bullets`;
}

export function formatImportanceSliderValue(value: number): string {
  if (value === 0) return "Excluded";
  return `${value}/100`;
}
