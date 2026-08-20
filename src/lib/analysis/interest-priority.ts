import { getAttributeById, getAttributes, getExperiences } from "@/lib/biography/flat";
import { getAttributeDisplayName } from "@/lib/biography/lookup";
import { splitMixedAttributeCategories } from "@/lib/analysis/attribute-merges";
import type { Biography, HighLevelAnalysis } from "@/lib/types";

const DISTINCT_INTEREST_FLOOR = 58;
const DUPLICATE_INTEREST_CAP = 10;
const INTEREST_CATEGORY_LABEL = "Interests";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function professionalCorpus(biography: Biography): string {
  const parts: string[] = [];

  for (const item of getExperiences(biography)) {
    parts.push(
      item.title,
      item.organization ?? "",
      item.position ?? "",
      item.role ?? "",
      item.degree ?? "",
      item.area ?? "",
      item.summary ?? "",
      item.goal ?? "",
      ...(item.highlights ?? []),
      ...(item.skills ?? []),
      ...(item.tools ?? []),
    );
  }

  for (const item of getAttributes(biography)) {
    if (item.type === "interests") continue;
    parts.push(
      item.name ?? "",
      item.title ?? "",
      item.value ?? "",
      ...(Array.isArray(item.keywords) ? item.keywords.map(String) : []),
    );
  }

  return parts.join(" ").toLowerCase();
}

function interestOverlapsResume(interest: string, corpus: string): boolean {
  const needle = interest.trim().toLowerCase();
  if (needle.length < 3 || !corpus.trim()) return false;

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(needle)}($|[^a-z0-9])`,
    "i",
  );
  if (pattern.test(corpus)) return true;

  const words = needle.split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
  if (words.length === 0) return false;
  return words.every((word) =>
    new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}($|[^a-z0-9])`, "i").test(
      corpus,
    ),
  );
}

/**
 * Raise distinctive personal interests so they survive page-fit, and drop
 * interests that only restate work, education, or skills already on the resume.
 */
export function applyInterestPriority(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  const interestItems = analysis.attribute_analysis.filter(
    (item) => getAttributeById(biography, item.id)?.type === "interests",
  );
  if (interestItems.length === 0) return analysis;

  const corpus = professionalCorpus(biography);
  const distinctIds = new Set<string>();

  const attribute_analysis = analysis.attribute_analysis.map((item) => {
    const source = getAttributeById(biography, item.id);
    if (source?.type !== "interests") return item;

    const label = getAttributeDisplayName(source, "interests");
    const duplicate = interestOverlapsResume(label, corpus);
    if (duplicate) {
      return {
        ...item,
        relevance_score: Math.min(item.relevance_score, DUPLICATE_INTEREST_CAP),
      };
    }

    distinctIds.add(item.id);
    return {
      ...item,
      category:
        analysis.attribute_categories.find((entry) =>
          /interest/i.test(entry.label || entry.id),
        )?.label || INTEREST_CATEGORY_LABEL,
      relevance_score: Math.max(item.relevance_score, DISTINCT_INTEREST_FLOOR),
    };
  });

  if (distinctIds.size === 0) {
    return splitMixedAttributeCategories(biography, {
      ...analysis,
      attribute_analysis,
    });
  }

  const hasCategory = analysis.attribute_categories.some((entry) =>
    /interest/i.test(entry.label || entry.id),
  );
  const interestLabel =
    analysis.attribute_categories.find((entry) =>
      /interest/i.test(entry.label || entry.id),
    )?.label || INTEREST_CATEGORY_LABEL;
  const attribute_categories = hasCategory
    ? analysis.attribute_categories
    : [
        ...analysis.attribute_categories,
        {
          id: interestLabel,
          label: interestLabel,
          order:
            Math.max(
              0,
              ...analysis.attribute_categories.map((entry) => entry.order),
            ) + 1,
          reason:
            "Personal interests that are not already covered by resume content.",
        },
      ];

  return splitMixedAttributeCategories(biography, {
    ...analysis,
    attribute_categories,
    attribute_analysis,
  });
}
