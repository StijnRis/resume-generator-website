import { v4 as uuidv4 } from "uuid";

import {
  getAttributeCategoryDefs,
  getAttributeDisplayName,
  getAttributeItemById,
  getCategoryLabel,
} from "@/lib/biography/lookup";
import { getAttributeById } from "@/lib/biography/flat";
import { sourceTypeLabel } from "@/lib/types";
import type {
  AttributeAnalysisItem,
  AttributeMergeGroup,
  Biography,
  HighLevelAnalysis,
} from "@/lib/types";

export type CvAttributeUnit =
  | { type: "single"; item: AttributeAnalysisItem }
  | {
      type: "merged";
      group: AttributeMergeGroup;
      items: AttributeAnalysisItem[];
    };

export function getAttributeMergeGroups(
  analysis: HighLevelAnalysis,
): AttributeMergeGroup[] {
  return analysis.attribute_merges ?? [];
}

export function getMemberIdsInAttributeMerges(
  analysis: HighLevelAnalysis,
): Set<string> {
  const ids = new Set<string>();
  for (const group of getAttributeMergeGroups(analysis)) {
    for (const id of group.member_ids) ids.add(id);
  }
  return ids;
}

export function getAttributeMergeGroupsForCategory(
  analysis: HighLevelAnalysis,
  category: string,
): AttributeMergeGroup[] {
  return getAttributeMergeGroups(analysis).filter((group) => {
    if (group.category) return group.category === category;
    const members = group.member_ids
      .map((id) => analysis.attribute_analysis.find((item) => item.id === id))
      .filter((item): item is AttributeAnalysisItem => item != null);
    return members.length > 0 && members.every((item) => item.category === category);
  });
}

export function buildAttributeUnits(
  analysis: HighLevelAnalysis,
): CvAttributeUnit[] {
  const mergedIds = getMemberIdsInAttributeMerges(analysis);
  const units: CvAttributeUnit[] = [];

  for (const group of getAttributeMergeGroups(analysis)) {
    const items = group.member_ids
      .map((id) => analysis.attribute_analysis.find((item) => item.id === id))
      .filter((item): item is AttributeAnalysisItem => item != null);
    if (items.length === 0) continue;
    units.push({ type: "merged", group, items });
  }

  for (const item of analysis.attribute_analysis) {
    if (mergedIds.has(item.id)) continue;
    if (item.relevance_score <= 0) continue;
    units.push({ type: "single", item });
  }

  return units;
}

export function getAttributeUnitId(unit: CvAttributeUnit): string {
  return unit.type === "merged" ? unit.group.id : unit.item.id;
}

export function getAttributeUnitImportance(unit: CvAttributeUnit): number {
  if (unit.type === "merged") {
    if (unit.group.relevance_score != null) return unit.group.relevance_score;
    return Math.max(0, ...unit.items.map((item) => item.relevance_score));
  }
  return unit.item.relevance_score;
}

/**
 * Include an attribute category only when its highest score is higher than
 * at least one other included attribute item, or it ties the global max.
 * Sole category is always kept.
 */
export function shouldIncludeAttributeCategory(
  analysis: HighLevelAnalysis,
  category: string,
): boolean {
  const included = analysis.attribute_analysis.filter(
    (item) => item.relevance_score > 0,
  );
  const inCategory = included.filter((item) => item.category === category);
  if (inCategory.length === 0) return false;

  const maxInCategory = Math.max(
    ...inCategory.map((item) => item.relevance_score),
  );
  const others = included.filter((item) => item.category !== category);
  if (others.length === 0) return true;

  if (others.some((item) => maxInCategory > item.relevance_score)) {
    return true;
  }

  const globalMax = Math.max(...included.map((item) => item.relevance_score));
  return maxInCategory >= globalMax;
}

export function addAttributeMergeGroup(
  analysis: HighLevelAnalysis,
  memberIds: string[],
  category?: AttributeAnalysisItem["category"],
): HighLevelAnalysis {
  const unique = [...new Set(memberIds)].filter(Boolean);
  if (unique.length < 2) return analysis;

  const members = unique
    .map((id) => analysis.attribute_analysis.find((item) => item.id === id))
    .filter((item): item is AttributeAnalysisItem => item != null);
  if (members.length < 2) return analysis;

  let next = analysis;
  for (const memberId of unique) {
    next = removeMemberFromAttributeMerges(next, memberId);
  }

  const group: AttributeMergeGroup = {
    id: uuidv4(),
    category: category ?? members[0].category,
    member_ids: unique,
    relevance_score: Math.max(...members.map((item) => item.relevance_score)),
    reason: `Combined ${unique.length} related attributes into one row.`,
  };

  return {
    ...next,
    attribute_merges: [...(next.attribute_merges ?? []), group],
  };
}

export function removeMemberFromAttributeMerges(
  analysis: HighLevelAnalysis,
  memberId: string,
): HighLevelAnalysis {
  const merges = (analysis.attribute_merges ?? [])
    .map((group) => ({
      ...group,
      member_ids: group.member_ids.filter((id) => id !== memberId),
    }))
    .filter((group) => group.member_ids.length >= 2);

  return { ...analysis, attribute_merges: merges };
}

export function removeAttributeMergeGroup(
  analysis: HighLevelAnalysis,
  groupId: string,
): HighLevelAnalysis {
  return {
    ...analysis,
    attribute_merges: (analysis.attribute_merges ?? []).filter(
      (group) => group.id !== groupId,
    ),
  };
}

export function updateAttributeMergeGroup(
  analysis: HighLevelAnalysis,
  groupId: string,
  update: Partial<Pick<AttributeMergeGroup, "relevance_score" | "title">>,
): HighLevelAnalysis {
  return {
    ...analysis,
    attribute_merges: (analysis.attribute_merges ?? []).map((group) =>
      group.id === groupId ? { ...group, ...update } : group,
    ),
  };
}

export function getAttributeMergeReason(
  biography: Biography,
  analysis: HighLevelAnalysis,
  group: Pick<AttributeMergeGroup, "member_ids" | "reason">,
): string {
  const existing = String(group.reason ?? "").trim();
  if (existing) return existing;
  const names = group.member_ids
    .map((id) => {
      const item = analysis.attribute_analysis.find((entry) => entry.id === id);
      if (!item) return null;
      return getAttributeDisplayName(
        getAttributeItemById(biography, item.category, item.id),
        item.category,
      );
    })
    .filter(Boolean);
  if (names.length === 0) {
    return `Combined ${group.member_ids.length} related attributes.`;
  }
  return `Combined related attributes: ${names.join(", ")}.`;
}

export function getAttributeMergeLabel(
  biography: Biography,
  analysis: HighLevelAnalysis,
  memberIds: string[],
): string {
  const names = memberIds
    .map((id) => {
      const item = analysis.attribute_analysis.find((entry) => entry.id === id);
      if (!item) return null;
      const source = getAttributeItemById(biography, item.category, item.id);
      return getAttributeDisplayName(source, item.category);
    })
    .filter(Boolean);
  if (names.length === 0) return "Combined attributes";
  if (names.length <= 3) return names.join(" · ");
  return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`;
}

export function defaultAttributeSectionTitle(
  analysis: HighLevelAnalysis,
  unit: CvAttributeUnit,
): string {
  if (unit.type === "merged") {
    if (unit.group.title?.trim()) return unit.group.title.trim();
    const cat = unit.group.category ?? unit.items[0]?.category;
    return cat ? getCategoryLabel(analysis, cat) : "Attributes";
  }
  return getCategoryLabel(analysis, unit.item.category);
}

function normalizeAttributeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[._/\-]+/g, " ")
    .replace(/\b(js|ts)\b/g, (match) =>
      match === "js" ? "javascript" : "typescript",
    )
    .replace(/\breact\.?js\b/g, "react")
    .replace(/\bnode\.?js\b/g, "node")
    .replace(/\bamazon web services\b/g, "aws")
    .replace(/\s+/g, " ")
    .trim();
}

const ATTRIBUTE_FAMILY_PATTERNS: { family: string; pattern: RegExp }[] = [
  { family: "cloud", pattern: /\b(aws|azure|gcp|cloud)\b/i },
  {
    family: "frontend",
    pattern: /\b(react|vue|angular|svelte|next|frontend|css|html|tailwind)\b/i,
  },
  {
    family: "backend",
    pattern: /\b(node|django|flask|spring|express|backend|fastapi)\b/i,
  },
  {
    family: "data",
    pattern: /\b(sql|postgres|mysql|mongo|spark|pandas|numpy|etl|data)\b/i,
  },
  {
    family: "devops",
    pattern: /\b(docker|kubernetes|k8s|terraform|ci|cd|devops|jenkins)\b/i,
  },
  {
    family: "languages",
    pattern:
      /\b(python|java|typescript|javascript|c\+\+|golang|go|rust|kotlin|swift)\b/i,
  },
];

function attributeSimilarityKey(
  biography: Biography,
  item: AttributeAnalysisItem,
): string | null {
  if (item.category !== "skills" && item.category !== "tools") {
    const source = getAttributeItemById(biography, item.category, item.id);
    const type =
      source && typeof source === "object"
        ? String((source as { type?: string }).type ?? "")
        : "";
    if (type !== "skills" && type !== "tools") return null;
  }
  if (item.relevance_score <= 0) return null;

  const source = getAttributeItemById(biography, item.category, item.id);
  const name = normalizeAttributeName(
    getAttributeDisplayName(source, item.category),
  );
  if (!name || name.length < 2) return null;

  for (const entry of ATTRIBUTE_FAMILY_PATTERNS) {
    if (entry.pattern.test(name)) {
      return `family|${item.category}|${entry.family}`;
    }
  }

  // Aggressive near-duplicate key: first token (≥3 chars) within category.
  const token = name.split(" ").find((part) => part.length >= 3);
  if (token) return `token|${item.category}|${token}`;

  return `exact|${item.category}|${name}`;
}

function tokenizeAttributeName(value: string): string[] {
  return normalizeAttributeName(value)
    .split(" ")
    .filter((token) => token.length > 0);
}

/** True when one name's words are all present in the other (e.g. Mentorship ⊂ Technical Mentorship). */
function namesNearDuplicate(a: string, b: string): boolean {
  const left = tokenizeAttributeName(a);
  const right = tokenizeAttributeName(b);
  if (left.length === 0 || right.length === 0) return false;
  if (left.join(" ") === right.join(" ")) return true;
  const [shorter, longer] =
    left.length <= right.length ? [left, right] : [right, left];
  if (shorter.every((token) => token.length < 2)) return false;
  const longerSet = new Set(longer);
  return shorter.every((token) => longerSet.has(token));
}

const STANDALONE_SOFT_SKILLS = new Set([
  "communication",
  "communications",
  "teamwork",
  "team work",
  "team player",
  "leadership",
  "problem solving",
  "adaptability",
  "time management",
  "creativity",
  "collaboration",
  "interpersonal",
  "interpersonal skills",
  "critical thinking",
  "attention to detail",
  "work ethic",
  "organization",
  "organizational skills",
  "organisational skills",
  "flexibility",
  "motivation",
  "self motivation",
  "empathy",
  "conflict resolution",
  "presentation skills",
  "listening",
  "active listening",
  "negotiation",
  "positive attitude",
  "multitasking",
  "reliability",
  "punctuality",
  "patience",
  "integrity",
  "professionalism",
]);

function isSkillOrToolAttribute(
  biography: Biography,
  item: AttributeAnalysisItem,
): boolean {
  const source = getAttributeItemById(biography, item.category, item.id);
  const type =
    source && typeof source === "object"
      ? String((source as { type?: string }).type ?? item.category)
      : item.category;
  return type === "skills" || type === "tools";
}

function isSoftSkillsCategory(label: string): boolean {
  return /\bsoft\b/i.test(label);
}

function isTechnicalSkillsCategory(label: string): boolean {
  if (isSoftSkillsCategory(label)) return false;
  return (
    /\btechnical\b|\btools?\b|\bhard\b/i.test(label) || /^skills$/i.test(label)
  );
}

const SOFT_SKILLS_LABEL = "Soft Skills";

function relocateStandaloneSoftSkills(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  const toMove = analysis.attribute_analysis.filter((item) => {
    if (!isSkillOrToolAttribute(biography, item)) return false;
    if (item.relevance_score <= 0) return false;
    if (isSoftSkillsCategory(item.category)) return false;
    if (!isTechnicalSkillsCategory(item.category) && item.category !== "skills") {
      return false;
    }
    const name = normalizeAttributeName(
      getAttributeDisplayName(
        getAttributeItemById(biography, item.category, item.id),
        item.category,
      ),
    );
    return STANDALONE_SOFT_SKILLS.has(name);
  });
  if (toMove.length === 0) return analysis;

  const existingSoft = analysis.attribute_categories.find((entry) =>
    isSoftSkillsCategory(entry.label || entry.id),
  );
  const softLabel = existingSoft?.label || SOFT_SKILLS_LABEL;
  const attribute_categories = existingSoft
    ? analysis.attribute_categories
    : [
        ...analysis.attribute_categories,
        {
          id: softLabel,
          label: softLabel,
          order:
            Math.max(
              0,
              ...analysis.attribute_categories.map((entry) => entry.order),
            ) + 1,
          reason: "Interpersonal skills kept separate from technical skills.",
        },
      ];

  const moveIds = new Set(toMove.map((item) => item.id));
  return {
    ...analysis,
    attribute_categories,
    attribute_analysis: analysis.attribute_analysis.map((item) =>
      moveIds.has(item.id)
        ? {
            ...item,
            category: softLabel,
            reason: item.reason.includes("Soft Skills")
              ? item.reason
              : `${item.reason} (Moved to Soft Skills.)`.trim(),
          }
        : item,
    ),
  };
}

/**
 * Merge skills/tools whose names share the same words (token subset).
 * Keep the more general (shortest) name and the highest relevance in the group.
 */
function collapseContainedAttributeDuplicates(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  const candidates = analysis.attribute_analysis.filter(
    (item) =>
      item.relevance_score > 0 && isSkillOrToolAttribute(biography, item),
  );
  if (candidates.length < 2) return analysis;

  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const next = parent.get(id) ?? id;
    if (next !== id) {
      const root = find(next);
      parent.set(id, root);
      return root;
    }
    return id;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const nameA = getAttributeDisplayName(
        getAttributeItemById(biography, a.category, a.id),
        a.category,
      );
      const nameB = getAttributeDisplayName(
        getAttributeItemById(biography, b.category, b.id),
        b.category,
      );
      if (!namesNearDuplicate(nameA, nameB)) continue;
      union(a.id, b.id);
    }
  }

  const groups = new Map<string, AttributeAnalysisItem[]>();
  for (const item of candidates) {
    const root = find(item.id);
    const list = groups.get(root) ?? [];
    list.push(item);
    groups.set(root, list);
  }

  const dropIds = new Set<string>();
  const keepScore = new Map<string, number>();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => {
      const nameA = tokenizeAttributeName(
        getAttributeDisplayName(
          getAttributeItemById(biography, a.category, a.id),
          a.category,
        ),
      );
      const nameB = tokenizeAttributeName(
        getAttributeDisplayName(
          getAttributeItemById(biography, b.category, b.id),
          b.category,
        ),
      );
      if (nameA.length !== nameB.length) return nameA.length - nameB.length;
      const joinedA = nameA.join(" ");
      const joinedB = nameB.join(" ");
      if (joinedA.length !== joinedB.length) {
        return joinedA.length - joinedB.length;
      }
      return b.relevance_score - a.relevance_score;
    });
    const keeper = sorted[0];
    const maxScore = Math.max(...members.map((item) => item.relevance_score));
    keepScore.set(keeper.id, maxScore);
    for (const member of sorted.slice(1)) dropIds.add(member.id);
  }

  if (dropIds.size === 0 && keepScore.size === 0) return analysis;

  return {
    ...analysis,
    attribute_analysis: analysis.attribute_analysis.map((item) => {
      if (dropIds.has(item.id)) {
        return {
          ...item,
          relevance_score: 0,
          reason: item.reason.includes("near-duplicate")
            ? item.reason
            : `${item.reason} (Merged into a more general near-duplicate skill.)`.trim(),
        };
      }
      const nextScore = keepScore.get(item.id);
      if (nextScore == null || nextScore === item.relevance_score) return item;
      return {
        ...item,
        relevance_score: nextScore,
        reason: item.reason.includes("highest score")
          ? item.reason
          : `${item.reason} (Took highest score among near-duplicate skills.)`.trim(),
      };
    }),
  };
}

const ATTRIBUTE_FOCUS_LABEL: Record<string, string> = {
  technical: "Technical Skills",
  interests: "Interests",
  awards: "Awards",
  certificates: "Certificates",
  publications: "Publications",
  references: "References",
  languages: "Languages",
};

const ATTRIBUTE_FOCUS_BY_SOURCE: Record<string, string> = {
  skills: "technical",
  tools: "technical",
  interests: "interests",
  awards: "awards",
  certificates: "certificates",
  publications: "publications",
  references: "references",
  languages: "languages",
};

function attributeFocusFromSourceType(type: string): string | null {
  const key = String(type ?? "").toLowerCase().trim();
  return ATTRIBUTE_FOCUS_BY_SOURCE[key] ?? null;
}

function attributeFocusFromLabelPart(part: string): string | null {
  const value = part.toLowerCase().trim();
  if (!value) return null;
  if (/\binterests?\b/.test(value)) return "interests";
  if (/\bawards?\b|\bhonou?rs?\b/.test(value)) return "awards";
  if (/\bcertificates?\b|\bcertifications?\b/.test(value)) return "certificates";
  if (/\bpublications?\b/.test(value)) return "publications";
  if (/\breferences?\b/.test(value)) return "references";
  if (/\blanguages?\b/.test(value)) return "languages";
  if (/\bsoft\b/.test(value)) return null;
  if (/\bskills?\b|\btools?\b|\btechnical\b/.test(value)) return "technical";
  return null;
}

function splitCompoundLabelParts(label: string): string[] {
  return label
    .split(/\s*(?:&|\/|\+|,\s+|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isCompoundMixedAttributeLabel(label: string): boolean {
  const parts = splitCompoundLabelParts(label);
  if (parts.length < 2) return false;
  const foci = parts
    .map(attributeFocusFromLabelPart)
    .filter((focus): focus is string => Boolean(focus));
  return new Set(foci).size >= 2;
}

function ensureAttributeCategory(
  analysis: HighLevelAnalysis,
  label: string,
  reason: string,
): HighLevelAnalysis {
  const existing = analysis.attribute_categories.find(
    (entry) => entry.id === label || entry.label === label,
  );
  if (existing) return analysis;
  const order =
    Math.max(0, ...analysis.attribute_categories.map((entry) => entry.order)) + 1;
  return {
    ...analysis,
    attribute_categories: [
      ...analysis.attribute_categories,
      { id: label, label, order, reason },
    ],
  };
}

/**
 * Attribute categories must cover one kind of content. Split mixed groups
 * such as "Awards & Interests" back into single-focus categories.
 */
export function splitMixedAttributeCategories(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  const itemsByCategory = new Map<string, AttributeAnalysisItem[]>();
  for (const item of analysis.attribute_analysis) {
    const list = itemsByCategory.get(item.category) ?? [];
    list.push(item);
    itemsByCategory.set(item.category, list);
  }

  const reassign = new Map<string, string>();
  let next = analysis;

  for (const [category, items] of itemsByCategory) {
    const foci = new Map<string, AttributeAnalysisItem[]>();
    for (const item of items) {
      const source = getAttributeById(biography, item.id);
      const focus = attributeFocusFromSourceType(source?.type ?? "");
      if (!focus) continue;
      const list = foci.get(focus) ?? [];
      list.push(item);
      foci.set(focus, list);
    }

    const mixedKinds = foci.size >= 2;
    const compoundLabel = isCompoundMixedAttributeLabel(category);
    if (!mixedKinds && !compoundLabel) continue;

    if (foci.size <= 1) {
      const onlyFocus = [...foci.keys()][0];
      if (!onlyFocus) continue;
      const label = ATTRIBUTE_FOCUS_LABEL[onlyFocus] ?? sourceTypeLabel(onlyFocus);
      if (label === category) continue;
      next = ensureAttributeCategory(
        next,
        label,
        `Split from “${category}” so this section covers only one kind of content.`,
      );
      for (const item of items) reassign.set(item.id, label);
      continue;
    }

    for (const [focus, members] of foci) {
      const label = ATTRIBUTE_FOCUS_LABEL[focus] ?? sourceTypeLabel(focus);
      next = ensureAttributeCategory(
        next,
        label,
        `Kept as its own section so attribute categories stay focused on one kind of content.`,
      );
      for (const item of members) reassign.set(item.id, label);
    }
  }

  if (reassign.size === 0) return next;

  const attribute_analysis = next.attribute_analysis.map((item) => {
    const category = reassign.get(item.id);
    if (!category || category === item.category) return item;
    return {
      ...item,
      category,
      reason: item.reason.includes("single-focus")
        ? item.reason
        : `${item.reason} (Moved to ${category} so categories stay single-focus.)`.trim(),
    };
  });

  const used = new Set(attribute_analysis.map((item) => item.category));
  const attribute_categories = next.attribute_categories.filter(
    (entry) => used.has(entry.id) || used.has(entry.label),
  );

  return {
    ...next,
    attribute_categories,
    attribute_analysis,
  };
}
export function applySkillListRules(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  return splitMixedAttributeCategories(
    biography,
    collapseContainedAttributeDuplicates(
      biography,
      relocateStandaloneSoftSkills(biography, analysis),
    ),
  );
}

/**
 * Suggest aggressive attribute merges: near-duplicates and family clusters
 * within skills/tools (groups of 2+).
 */
export function suggestAttributeMergeGroups(
  biography: Biography,
  analysis: HighLevelAnalysis,
): string[][] {
  const merged = getMemberIdsInAttributeMerges(analysis);
  const candidates = analysis.attribute_analysis.filter(
    (item) =>
      !merged.has(item.id) &&
      item.relevance_score > 0 &&
      isSkillOrToolAttribute(biography, item),
  );

  const buckets = new Map<string, AttributeAnalysisItem[]>();
  for (const item of candidates) {
    const key = attributeSimilarityKey(biography, item);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }

  const suggestions: string[][] = [];
  const used = new Set<string>();

  // Near-duplicate pairs across the category (even different family keys).
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (a.category !== b.category) continue;
      if (used.has(a.id) || used.has(b.id)) continue;
      const nameA = getAttributeDisplayName(
        getAttributeItemById(biography, a.category, a.id),
        a.category,
      );
      const nameB = getAttributeDisplayName(
        getAttributeItemById(biography, b.category, b.id),
        b.category,
      );
      if (!namesNearDuplicate(nameA, nameB)) continue;
      suggestions.push([a.id, b.id]);
      used.add(a.id);
      used.add(b.id);
    }
  }

  for (const members of buckets.values()) {
    const ids = members
      .map((item) => item.id)
      .filter((id) => !used.has(id));
    if (ids.length < 2) continue;
    suggestions.push(ids);
    for (const id of ids) used.add(id);
  }

  return suggestions;
}

export function applyAllSuggestedAttributeMerges(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  let next = analysis;
  for (const memberIds of suggestAttributeMergeGroups(biography, next)) {
    const first = next.attribute_analysis.find(
      (item) => item.id === memberIds[0],
    );
    next = addAttributeMergeGroup(next, memberIds, first?.category);
  }
  return next;
}

export function getSuggestedAttributeMergeLabel(
  biography: Biography,
  analysis: HighLevelAnalysis,
  memberIds: string[],
): string {
  return getAttributeMergeLabel(biography, analysis, memberIds);
}

/** Categories present in attribute analysis (for UI suggestion loops). */
export function attributeCategoriesWithItems(
  analysis: HighLevelAnalysis,
): string[] {
  const present = new Set(
    analysis.attribute_analysis.map((item) => item.category),
  );
  return getAttributeCategoryDefs(analysis)
    .map((def) => def.id)
    .filter((id) => present.has(id));
}
