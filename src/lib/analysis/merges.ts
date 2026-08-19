import { v4 as uuidv4 } from "uuid";

import {
  getExperienceBulletCount,
  getExperienceImportance,
  normalizeBullets,
} from "@/lib/analysis/experience-score";
import {
  getExperienceDisplayName,
  getExperienceItemById,
} from "@/lib/biography/lookup";
import type {
  Biography,
  ExperienceAnalysisItem,
  ExperienceBulletCandidate,
  ExperienceMergeGroup,
  HighLevelAnalysis,
} from "@/lib/types";

export type CvExperienceUnit =
  | { type: "single"; item: ExperienceAnalysisItem }
  | { type: "merged"; group: ExperienceMergeGroup; items: ExperienceAnalysisItem[] };

function normalizeMergeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

const EVENT_FAMILY_PATTERNS: { family: string; pattern: RegExp }[] = [
  { family: "hackathon", pattern: /\bhackathons?\b|\bcode\s*jam\b|\bhack\s*night\b|\bjunction\b|\bhack[\s-]?the\b/i },
  { family: "conference", pattern: /\bconferences?\b|\bsummit\b|\bmeetup\b|\bnetworking\b/i },
  { family: "competition", pattern: /\bcompetitions?\b|\bcontest\b|\bchallenge\b|\bolympiads?\b|\bctf\b/i },
  { family: "workshop", pattern: /\bworkshops?\b|\btraining\b|\bbootcamp\b/i },
  { family: "running", pattern: /\brun(ning)?\b|\bmarathon\b|\b5k\b|\b10k\b|\brace\b/i },
  { family: "mun", pattern: /\bmodel\s*united\b|\bmodel\s*un\b|\bmun\b/i },
  { family: "shadow", pattern: /\bshadow\b/i },
];

const ROLE_FAMILY_PATTERNS: { family: string; pattern: RegExp }[] = [
  { family: "intern", pattern: /\bintern(ship)?\b|\bstagiair\b/i },
  { family: "student-assistant", pattern: /\bstudent\s*assistant\b|\bteaching\s*assistant\b|\bta\b|\btutor/i },
  { family: "mentor", pattern: /\bmentor(ship)?\b|\bonboard/i },
  { family: "teacher", pattern: /\bteacher\b|\btaught\b|\bworkshop\b|\bfacilitat/i },
  { family: "software-engineer", pattern: /\bsoftware\s*engineer\b|\bdeveloper\b|\bprogrammer\b/i },
  { family: "research", pattern: /\bresearch(er)?\b|\blab\s*assistant\b/i },
];

const NON_HACKATHON_EVENT_FAMILIES = new Set([
  "running",
  "mun",
  "shadow",
  "conference",
  "workshop",
]);

function experienceSourceType(
  biography: Biography,
  item: ExperienceAnalysisItem,
): string {
  const source = getExperienceItemById(biography, item.category, item.id);
  return String(source?.type ?? item.category ?? "").toLowerCase();
}

function detectFamily(
  text: string,
  patterns: { family: string; pattern: RegExp }[],
): string | null {
  for (const entry of patterns) {
    if (entry.pattern.test(text)) return entry.family;
  }
  return null;
}

/**
 * Exact duplicate key (same title + organization).
 */
export function getExperienceMergeKey(
  biography: Biography,
  item: ExperienceAnalysisItem,
): string {
  const source = getExperienceItemById(biography, item.category, item.id);
  const title = getExperienceDisplayName(source, item.category);
  const organization = String(source?.organization ?? source?.title ?? "");
  return `exact|${normalizeMergeKey(title)}|${normalizeMergeKey(organization)}`;
}

/**
 * Broader similarity key for related roles/events that are worth combining
 * on a CV (hackathons, repeat internships at one employer, etc.).
 * Returns null when combining would not clearly help.
 */
export function getExperienceSimilarityKey(
  biography: Biography,
  item: ExperienceAnalysisItem,
): string | null {
  const source = getExperienceItemById(biography, item.category, item.id);
  if (!source) return null;

  const title = String(source.title ?? source.position ?? source.role ?? "");
  const organization = String(source.organization ?? "");
  const sourceType = experienceSourceType(biography, item);
  const blob = `${title} ${sourceType} ${organization} ${String(source.project_type ?? "")}`;

  if (sourceType === "events" || sourceType === "extracurriculars") {
    const family = detectFamily(blob, EVENT_FAMILY_PATTERNS);
    if (family && NON_HACKATHON_EVENT_FAMILIES.has(family)) {
      return `similar|${sourceType}|${family}`;
    }
    if (family) return `similar|${sourceType}|${family}`;
    return `similar|${sourceType}|hackathon-cluster`;
  }

  if (sourceType === "sports") {
    return "similar|sports|all";
  }

  if (sourceType === "work" || sourceType === "volunteer") {
    const roleFamily = detectFamily(
      `${title} ${String(source.position ?? "")} ${String(source.role ?? "")}`,
      ROLE_FAMILY_PATTERNS,
    );
    if (organization && roleFamily) {
      return `similar|${sourceType}|${normalizeMergeKey(organization)}|${roleFamily}`;
    }
    if (roleFamily) {
      return `similar|${sourceType}|role|${roleFamily}`;
    }
    if (organization) {
      return `similar|${sourceType}|org|${normalizeMergeKey(organization)}`;
    }
  }

  if (sourceType === "research") {
    const family = detectFamily(blob, ROLE_FAMILY_PATTERNS);
    return `similar|research|${family ?? "all"}`;
  }

  if (sourceType === "projects") {
    const family = detectFamily(blob, EVENT_FAMILY_PATTERNS);
    if (family) return `similar|projects|${family}`;
  }

  if (organization) {
    return `similar|${sourceType}|org|${normalizeMergeKey(organization)}`;
  }

  return null;
}

function shouldSuggestMerge(
  biography: Biography,
  analysis: HighLevelAnalysis,
  memberIds: string[],
): boolean {
  if (memberIds.length < 2) return false;

  const members = memberIds
    .map((id) => analysis.experience_analysis.find((item) => item.id === id))
    .filter((item): item is ExperienceAnalysisItem => item != null);

  if (members.length < 2) return false;

  // Combining many short/low-bullet items always helps space.
  const avgBullets =
    members.reduce((sum, item) => sum + getExperienceBulletCount(item), 0) /
    members.length;
  if (avgBullets <= 3) return true;

  const sourceTypes = members.map((item) =>
    experienceSourceType(biography, item),
  );
  if (
    sourceTypes.every(
      (type) =>
        type === "events" ||
        type === "extracurriculars" ||
        type === "sports" ||
        type === "research",
    )
  ) {
    return true;
  }

  // Same employer repeats are usually better as one line on a CV.
  const orgs = members.map((item) => {
    const source = getExperienceItemById(biography, item.category, item.id);
    return normalizeMergeKey(String(source?.organization ?? ""));
  });
  if (orgs[0] && orgs.every((org) => org === orgs[0])) return true;

  return members.length >= 2;
}

export function suggestMergeGroupsForCategory(
  biography: Biography,
  analysis: HighLevelAnalysis,
  category: string,
): string[][] {
  const mergedIds = getMemberIdsInMerges(analysis);
  const items = analysis.experience_analysis.filter(
    (item) => item.category === category && !mergedIds.has(item.id),
  );

  const byKey = new Map<string, string[]>();

  const add = (key: string, id: string) => {
    const list = byKey.get(key) ?? [];
    if (!list.includes(id)) list.push(id);
    byKey.set(key, list);
  };

  for (const item of items) {
    add(getExperienceMergeKey(biography, item), item.id);
    const similar = getExperienceSimilarityKey(biography, item);
    if (similar) add(similar, item.id);
  }

  const seen = new Set<string>();
  const suggestions: string[][] = [];

  for (const memberIds of byKey.values()) {
    if (memberIds.length < 2) continue;
    if (!shouldSuggestMerge(biography, analysis, memberIds)) continue;

    const signature = [...memberIds].sort().join("|");
    if (seen.has(signature)) continue;
    seen.add(signature);
    suggestions.push(memberIds);
  }

  suggestions.sort((a, b) => b.length - a.length);
  const used = new Set<string>();
  const disjoint: string[][] = [];
  for (const memberIds of suggestions) {
    const free = memberIds.filter((id) => !used.has(id));
    if (free.length < 2) continue;
    if (!shouldSuggestMerge(biography, analysis, free)) continue;
    disjoint.push(free);
    for (const id of free) used.add(id);
  }

  return disjoint;
}

export function getMergeMap(
  analysis: HighLevelAnalysis,
): Map<string, ExperienceMergeGroup> {
  const map = new Map<string, ExperienceMergeGroup>();
  for (const group of analysis.experience_merges ?? []) {
    for (const memberId of group.member_ids) {
      map.set(memberId, group);
    }
  }
  return map;
}

export function getMemberIdsInMerges(analysis: HighLevelAnalysis): Set<string> {
  const ids = new Set<string>();
  for (const group of analysis.experience_merges ?? []) {
    for (const memberId of group.member_ids) {
      ids.add(memberId);
    }
  }
  return ids;
}

export function getMergeGroupCategory(
  analysis: HighLevelAnalysis,
  group: ExperienceMergeGroup,
): string | null {
  if (group.category) return group.category;
  const first = analysis.experience_analysis.find(
    (item) => item.id === group.member_ids[0],
  );
  return first?.category ?? null;
}

export function getMergeGroupsForCategory(
  analysis: HighLevelAnalysis,
  category: string,
): ExperienceMergeGroup[] {
  return (analysis.experience_merges ?? []).filter(
    (group) => getMergeGroupCategory(analysis, group) === category,
  );
}

export function buildExperienceUnits(
  analysis: HighLevelAnalysis,
): CvExperienceUnit[] {
  const mergeMap = getMergeMap(analysis);
  const renderedGroups = new Set<string>();
  const units: CvExperienceUnit[] = [];

  for (const item of analysis.experience_analysis) {
    const group = mergeMap.get(item.id);
    if (group) {
      if (renderedGroups.has(group.id)) continue;
      renderedGroups.add(group.id);

      const items = group.member_ids
        .map((memberId) =>
          analysis.experience_analysis.find((entry) => entry.id === memberId),
        )
        .filter((entry): entry is ExperienceAnalysisItem => entry != null);

      if (items.length > 0) {
        units.push({ type: "merged", group, items });
      }
      continue;
    }

    units.push({ type: "single", item });
  }

  return units;
}

export function getUnitImportance(unit: CvExperienceUnit): number {
  if (unit.type === "single") {
    return getExperienceImportance(unit.item);
  }
  if (unit.group.relevance_score != null) {
    return getExperienceImportance({
      relevance_score: unit.group.relevance_score,
    });
  }
  return Math.max(...unit.items.map(getExperienceImportance));
}

export function getUnitBulletCount(unit: CvExperienceUnit): number {
  if (unit.type === "single") {
    return getExperienceBulletCount(unit.item);
  }
  if (unit.group.bullets != null) {
    return getExperienceBulletCount({ bullets: unit.group.bullets });
  }
  return Math.max(0, ...unit.items.map(getExperienceBulletCount));
}

/** Bullet candidates for a unit (merged groups prefer their own bullet list). */
export function getUnitBullets(
  unit: CvExperienceUnit,
): ExperienceBulletCandidate[] {
  if (unit.type === "single") {
    return normalizeBullets(unit.item.bullets, unit.item.id);
  }
  if (unit.group.bullets != null) {
    return normalizeBullets(unit.group.bullets, unit.group.id);
  }
  return unit.items.flatMap((item) =>
    normalizeBullets(item.bullets, item.id),
  );
}

export function isUnitIncluded(unit: CvExperienceUnit): boolean {
  return getUnitImportance(unit) > 0;
}

export function getUnitCvId(unit: CvExperienceUnit): string {
  return unit.type === "single" ? unit.item.id : unit.group.id;
}

export function createMergeGroup(
  category: string,
  memberIds: string[],
): ExperienceMergeGroup {
  return {
    id: `merge-${uuidv4()}`,
    category,
    member_ids: memberIds,
  };
}

export function removeMemberFromMerges(
  analysis: HighLevelAnalysis,
  memberId: string,
): HighLevelAnalysis {
  const merges = (analysis.experience_merges ?? [])
    .map((group) => ({
      ...group,
      member_ids: group.member_ids.filter((id) => id !== memberId),
    }))
    .filter((group) => group.member_ids.length >= 2);

  return { ...analysis, experience_merges: merges };
}

export function addMergeGroup(
  analysis: HighLevelAnalysis,
  category: string,
  memberIds: string[],
): HighLevelAnalysis {
  if (memberIds.length < 2) return analysis;

  const members = memberIds
    .map((id) => analysis.experience_analysis.find((item) => item.id === id))
    .filter((item): item is ExperienceAnalysisItem => item != null);

  if (members.length < 2) return analysis;
  if (!members.every((item) => item.category === category)) return analysis;

  let next = analysis;
  for (const memberId of memberIds) {
    next = removeMemberFromMerges(next, memberId);
  }

  const group: ExperienceMergeGroup = {
    ...createMergeGroup(category, memberIds),
    relevance_score: Math.max(...members.map(getExperienceImportance)),
    bullets: members.flatMap((item) => normalizeBullets(item.bullets)),
  };

  return {
    ...next,
    experience_merges: [...(next.experience_merges ?? []), group],
  };
}

export function removeMergeGroup(
  analysis: HighLevelAnalysis,
  groupId: string,
): HighLevelAnalysis {
  return {
    ...analysis,
    experience_merges: (analysis.experience_merges ?? []).filter(
      (group) => group.id !== groupId,
    ),
  };
}

export function updateMergeGroup(
  analysis: HighLevelAnalysis,
  groupId: string,
  update: Partial<Pick<ExperienceMergeGroup, "relevance_score" | "bullets">>,
): HighLevelAnalysis {
  return {
    ...analysis,
    experience_merges: (analysis.experience_merges ?? []).map((group) =>
      group.id === groupId ? { ...group, ...update } : group,
    ),
  };
}

/** Auto-apply all code-detected merge suggestions (e.g. before generate-cv). */
export function applyAllSuggestedMerges(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  let next = analysis;
  const categories = new Set(
    next.experience_analysis.map((item) => item.category),
  );
  for (const category of categories) {
    for (const memberIds of suggestMergeGroupsForCategory(
      biography,
      next,
      category,
    )) {
      next = addMergeGroup(next, category, memberIds);
    }
  }
  return next;
}

export function getSuggestedMergeLabel(
  biography: Biography,
  analysis: HighLevelAnalysis,
  memberIds: string[],
): string {
  const first = analysis.experience_analysis.find(
    (item) => item.id === memberIds[0],
  );
  if (!first) return `Combine ${memberIds.length} entries`;

  const source = getExperienceItemById(biography, first.category, first.id);
  const name = getExperienceDisplayName(source, first.category);
  return `${memberIds.length}× ${name}`;
}
