import { EXPERIENCE_KEYS } from "@/lib/biography/inject-ids";
import {
  isOngoingExperience,
  parseDateForSort,
} from "@/lib/formatting/dates";
import type {
  Biography,
  EducationExperience,
  HighLevelAnalysis,
} from "@/lib/types";

const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;

/** Recent graduate (≤2 years), current student, or light work history vs education. */
export function shouldPrioritizeEducation(biography: Biography): boolean {
  const education = biography.education ?? [];
  if (education.length === 0) return false;

  if (education.some((item) => isOngoingExperience(item.end_date))) {
    return true;
  }

  const now = Date.now();
  const recentGrad = education.some((item: EducationExperience) => {
    if (!item.end_date || isOngoingExperience(item.end_date)) return false;
    const end = parseDateForSort(item.end_date);
    return end > 0 && now - end <= TWO_YEARS_MS;
  });
  if (recentGrad) return true;

  const workCount = biography.work?.length ?? 0;
  // Career-change heuristic: little or no work history relative to education.
  if (workCount <= 1 && education.length >= 1) return true;

  return false;
}

/** Force Education section order to 1 when prioritization applies. */
export function applyEducationPriority(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  if (!shouldPrioritizeEducation(biography)) return analysis;

  const experienceCategories = analysis.category_analysis.filter((item) =>
    (EXPERIENCE_KEYS as string[]).includes(item.category),
  );
  const otherCategories = analysis.category_analysis.filter(
    (item) => !(EXPERIENCE_KEYS as string[]).includes(item.category),
  );

  const education = experienceCategories.find(
    (item) => item.category === "education",
  );
  if (!education) return analysis;

  const others = experienceCategories
    .filter((item) => item.category !== "education")
    .sort((a, b) => a.relevance_score - b.relevance_score);

  const reordered = [
    {
      ...education,
      relevance_score: 1,
      reason: education.reason.includes("Education placed first")
        ? education.reason
        : `${education.reason} (Education placed first: recent graduate, current student, or limited work history.)`,
    },
    ...others.map((item, index) => ({
      ...item,
      relevance_score: index + 2,
    })),
  ];

  return {
    ...analysis,
    category_analysis: [...reordered, ...otherCategories],
  };
}
