import { v4 as uuidv4 } from "uuid";

import type {
  DynamicCategoryDefinition,
  ExperienceAnalysisItem,
  ExperienceBulletCandidate,
  HighLevelAnalysis,
} from "@/lib/types";

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

export function clampBulletImportance(value: number): number {
  return Math.min(MAX_IMPORTANCE, Math.max(0, Math.round(value || 0)));
}

/**
 * Clamp bullet fields. Preserve unique stable ids; rewrite missing/duplicate/
 * model-style ids (`b1`, `bullet-1`) to `${ownerId}-bN`.
 */
export function normalizeBullets(
  bullets: ExperienceBulletCandidate[] | undefined,
  ownerId = "exp",
): ExperienceBulletCandidate[] {
  if (!Array.isArray(bullets)) return [];
  const seen = new Set<string>();
  return bullets.map((bullet, index) => {
    let id = String(bullet.id ?? "").trim();
    if (!id || seen.has(id) || /^(b\d+|bullet-\d+)$/i.test(id)) {
      id = `${ownerId}-b${index + 1}`;
      let suffix = 1;
      while (seen.has(id)) {
        id = `${ownerId}-b${index + 1}-${suffix}`;
        suffix += 1;
      }
    }
    seen.add(id);
    return {
      id,
      topic: String(bullet.topic ?? "").trim(),
      importance: clampBulletImportance(bullet.importance ?? 0),
      text: bullet.text != null ? String(bullet.text) : "",
    };
  });
}

/** Assign fresh deterministic ids (used right after LLM analysis). */
export function assignBulletIds(
  bullets: ExperienceBulletCandidate[] | undefined,
  ownerId: string,
): ExperienceBulletCandidate[] {
  if (!Array.isArray(bullets)) return [];
  return bullets.map((bullet, index) => ({
    id: `${ownerId}-b${index + 1}`,
    topic: String(bullet.topic ?? "").trim(),
    importance: clampBulletImportance(bullet.importance ?? 0),
    text: bullet.text != null ? String(bullet.text) : "",
  }));
}

/** Eligible bullets (importance > 0), highest importance first. */
export function rankBulletsForFit(
  bullets: ExperienceBulletCandidate[],
): ExperienceBulletCandidate[] {
  return [...bullets]
    .map((bullet) => ({
      ...bullet,
      importance: clampBulletImportance(bullet.importance ?? 0),
    }))
    .filter((bullet) => bullet.importance > 0)
    .sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return a.id.localeCompare(b.id);
    });
}

/** Included on the CV when importance is 1–100 (0 = always excluded). */
export function isExperienceIncluded(
  item: Pick<ExperienceAnalysisItem, "relevance_score">,
): boolean {
  return getExperienceImportance(item) > 0;
}

function normalizeCategoryDefs(
  entries: DynamicCategoryDefinition[] | undefined,
): {
  defs: DynamicCategoryDefinition[];
  remap: Map<string, string>;
} {
  const remap = new Map<string, string>();
  const defs: DynamicCategoryDefinition[] = [];
  const seen = new Set<string>();

  for (const entry of entries ?? []) {
    const label = String(entry.label || entry.id || "").trim() || "Section";
    const previousId = String(entry.id || "").trim();
    if (previousId) remap.set(previousId, label);
    remap.set(label, label);

    if (seen.has(label)) continue;
    seen.add(label);
    defs.push({
      id: label,
      label,
      order: Math.max(1, Math.round(entry.order || 99)),
      reason: String(entry.reason ?? ""),
    });
  }

  return { defs, remap };
}

function remapCategory(category: string, remap: Map<string, string>): string {
  const key = String(category || "").trim();
  return remap.get(key) ?? key;
}

export function normalizeAnalysis(
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  const summaryImportance = clampBulletImportance(
    analysis.summary_importance ?? 70,
  );
  const experienceCats = normalizeCategoryDefs(analysis.experience_categories);
  const attributeCats = normalizeCategoryDefs(analysis.attribute_categories);
  const categoryRemap = new Map([
    ...experienceCats.remap,
    ...attributeCats.remap,
  ]);

  return {
    ...analysis,
    summary_importance: summaryImportance,
    experience_categories: experienceCats.defs,
    attribute_categories: attributeCats.defs,
    experience_merges: (analysis.experience_merges ?? [])
      .map((group) => {
        const memberIds = [...new Set(group.member_ids.filter(Boolean))];
        if (memberIds.length < 2) return null;
        const id = String(group.id || "").trim() || `merge-${uuidv4()}`;
        return {
          ...group,
          id,
          member_ids: memberIds,
          category: remapCategory(String(group.category ?? ""), categoryRemap),
          relevance_score: clampBulletImportance(group.relevance_score ?? 0),
          bullets: assignBulletIds(group.bullets, id),
        };
      })
      .filter(
        (group): group is NonNullable<typeof group> => group != null,
      ),
    attribute_merges: analysis.attribute_merges ?? [],
    experience_analysis: analysis.experience_analysis.map((item) => {
      let importance = item.relevance_score;
      let bullets = assignBulletIds(item.bullets, item.id);

      // Legacy: suggested_bullet_points / topics
      const legacy = item as ExperienceAnalysisItem & {
        suggested_bullet_points?: number;
        suggested_bullet_topics?: string[];
      };
      if (
        bullets.length === 0 &&
        (legacy.suggested_bullet_points != null ||
          legacy.suggested_bullet_topics != null)
      ) {
        const count = legacy.suggested_bullet_points ?? 0;
        const topics = legacy.suggested_bullet_topics ?? [];
        bullets = assignBulletIds(
          Array.from({ length: count }, (_, index) => ({
            id: "",
            topic: topics[index] ?? "",
            importance: count > 0 ? 50 : 0,
            text: "",
          })),
          item.id,
        );
      }

      // Legacy 1–5 scale without bullets.
      if (
        bullets.length === 0 &&
        importance >= 0 &&
        importance <= 5 &&
        importance > 0
      ) {
        bullets = normalizeBullets(
          Array.from({ length: importance }, (_, index) => ({
            id: "",
            topic: "",
            importance: 40 + index * 10,
            text: "",
          })),
          item.id,
        );
      }

      return {
        ...item,
        category: remapCategory(String(item.category), categoryRemap),
        relevance_score: Math.min(
          MAX_IMPORTANCE,
          Math.max(0, importance ?? 0),
        ),
        bullets,
      };
    }),
    attribute_analysis: analysis.attribute_analysis.map((item) => ({
      ...item,
      category: remapCategory(String(item.category), categoryRemap),
      relevance_score: Math.min(
        MAX_IMPORTANCE,
        Math.max(0, item.relevance_score ?? 0),
      ),
    })),
  };
}

export function formatImportanceSliderValue(value: number): string {
  if (value === 0) return "Excluded";
  return `${value}/100`;
}

/** @deprecated Bullet count slider removed. */
export const MAX_EXPERIENCE_BULLETS = 5;

/** @deprecated */
export function getExperienceBulletCount(
  item: Pick<ExperienceAnalysisItem, "bullets">,
): number {
  return rankBulletsForFit(item.bullets ?? []).length;
}

/** @deprecated */
export function formatExperienceSliderValue(value: number): string {
  if (value === 0) return "0 bullets";
  if (value === 1) return "1 bullet";
  return `${value} bullets`;
}
