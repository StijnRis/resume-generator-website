import { getExperienceById, getExperiences } from "@/lib/biography/flat";
import { isOngoingExperience, parseDateForSort } from "@/lib/formatting/dates";
import type { Biography, HighLevelAnalysis } from "@/lib/types";

const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;

/** Recent graduate (≤2 years), current student, or light work history vs education. */
export function shouldPrioritizeEducation(biography: Biography): boolean {
  const education = getExperiences(biography).filter(
    (item) => item.type === "education",
  );
  if (education.length === 0) return false;

  if (education.some((item) => isOngoingExperience(item.end_date))) {
    return true;
  }

  const now = Date.now();
  const recentGrad = education.some((item) => {
    if (!item.end_date || isOngoingExperience(item.end_date)) return false;
    const end = parseDateForSort(item.end_date);
    return end > 0 && now - end <= TWO_YEARS_MS;
  });
  if (recentGrad) return true;

  const workCount = getExperiences(biography).filter(
    (item) => item.type === "work",
  ).length;
  // Career-change heuristic: little or no work history relative to education.
  if (workCount <= 1 && education.length >= 1) return true;

  return false;
}

/** Force the category holding education experiences to order 1 when prioritization applies. */
export function applyEducationPriority(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  if (!shouldPrioritizeEducation(biography)) return analysis;

  const educationCategoryIds = new Set(
    analysis.experience_analysis
      .filter(
        (item) => getExperienceById(biography, item.id)?.type === "education",
      )
      .map((item) => item.category),
  );
  if (educationCategoryIds.size === 0) return analysis;

  const educationCats = analysis.experience_categories.filter((cat) =>
    educationCategoryIds.has(cat.id),
  );
  if (educationCats.length === 0) return analysis;

  const otherCats = analysis.experience_categories
    .filter((cat) => !educationCategoryIds.has(cat.id))
    .sort((a, b) => a.order - b.order);

  const reordered = [
    ...educationCats.map((cat, index) => ({
      ...cat,
      order: index + 1,
      reason: cat.reason.includes("Education placed first")
        ? cat.reason
        : `${cat.reason} (Education placed first: recent graduate, current student, or limited work history.)`,
    })),
    ...otherCats.map((cat, index) => ({
      ...cat,
      order: educationCats.length + index + 1,
    })),
  ];

  return {
    ...analysis,
    experience_categories: reordered,
  };
}
