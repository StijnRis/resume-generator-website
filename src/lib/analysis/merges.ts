import { v4 as uuidv4 } from "uuid";

import {
  getExperienceBulletCount,
  getExperienceImportance,
  normalizeBullets,
  rankBulletsForFit,
} from "@/lib/analysis/experience-score";
import { getExperiences } from "@/lib/biography/flat";
import {
  getExperienceDisplayName,
  getExperienceItemById,
} from "@/lib/biography/lookup";
import type {
  Biography,
  BiographyExperience,
  ExperienceAnalysisItem,
  ExperienceBulletCandidate,
  ExperienceMergeGroup,
  HighLevelAnalysis,
} from "@/lib/types";

export type CvExperienceUnit =
  | { type: "single"; item: ExperienceAnalysisItem }
  | {
      type: "merged";
      group: ExperienceMergeGroup;
      items: ExperienceAnalysisItem[];
    };

export interface CodeExperienceMerge {
  member_ids: string[];
  reason: string;
}

const EXPERIENCE_STOP_WORDS = new Set([
  "at",
  "the",
  "and",
  "of",
  "in",
  "for",
  "a",
  "an",
  "to",
  "on",
  "as",
  "with",
  "by",
]);

const GENERIC_EXPERIENCE_TOKENS = new Set([
  "hackathon",
  "hackathons",
  "intern",
  "internship",
  "volunteer",
  "volunteering",
  "competition",
  "contest",
  "workshop",
  "conference",
  "project",
  "projects",
  "research",
  "student",
  "assistant",
  "event",
  "events",
  "role",
  "member",
  "participant",
]);

function tokenizeExperienceText(value: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of value
    .toLowerCase()
    .replace(/[._/\-]+/g, " ")
    .replace(/[^a-z0-9+# ]+/g, " ")
    .split(/\s+/)) {
    if (
      token.length < 2 ||
      EXPERIENCE_STOP_WORDS.has(token) ||
      seen.has(token)
    ) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function isTokenSubset(shorter: string[], longer: string[]): boolean {
  if (shorter.length === 0) return false;
  const longerSet = new Set(longer);
  return shorter.every((token) => longerSet.has(token));
}

function tokensEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((token, index) => token === right[index]);
}

function experienceTitleText(source: BiographyExperience): string {
  return String(
    source.title ?? source.position ?? source.role ?? source.degree ?? "",
  );
}

function experienceTitleTokens(source: BiographyExperience): string[] {
  return tokenizeExperienceText(experienceTitleText(source));
}

function experienceOrgTokens(source: BiographyExperience): string[] {
  return tokenizeExperienceText(String(source.organization ?? ""));
}

function experienceIdentifyingTokens(source: BiographyExperience): string[] {
  return tokenizeExperienceText(
    `${experienceTitleText(source)} ${String(source.organization ?? "")}`,
  );
}

function titleWithoutOrgIsGeneric(source: BiographyExperience): boolean {
  const title = experienceTitleTokens(source);
  if (title.length === 0) return true;
  return title.every((token) => GENERIC_EXPERIENCE_TOKENS.has(token));
}

function organizationsCompatible(
  left: BiographyExperience,
  right: BiographyExperience,
): boolean {
  const orgA = experienceOrgTokens(left);
  const orgB = experienceOrgTokens(right);
  if (orgA.length === 0 && orgB.length === 0) return true;
  if (orgA.length === 0 || orgB.length === 0) return false;
  return isTokenSubset(orgA, orgB) || isTokenSubset(orgB, orgA);
}

function displayNameForExperience(
  biography: Biography,
  item: BiographyExperience,
): string {
  return getExperienceDisplayName(
    item as unknown as Record<string, unknown>,
    item.type,
  );
}

function subsetReason(
  biography: Biography,
  shorter: BiographyExperience,
  longer: BiographyExperience,
  duplicate: boolean,
): string {
  const shortName = displayNameForExperience(biography, shorter);
  const longName = displayNameForExperience(biography, longer);
  if (duplicate) {
    return `Combined duplicate entries with the same title and organization (“${longName}”).`;
  }
  return `Combined because “${shortName}” is a subset of “${longName}”.`;
}

/**
 * True when one experience is the same as, or a token-subset of, the other
 * (same source type; organizations must be compatible).
 */
export function experienceIsSubsetOfOther(
  left: BiographyExperience,
  right: BiographyExperience,
): boolean {
  if (!left.id || !right.id || left.id === right.id) return false;
  if (String(left.type ?? "") !== String(right.type ?? "")) return false;
  if (!organizationsCompatible(left, right)) return false;

  const tokensA = experienceIdentifyingTokens(left);
  const tokensB = experienceIdentifyingTokens(right);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const equal = tokensEqual(tokensA, tokensB);
  const aSubsetB = equal || isTokenSubset(tokensA, tokensB);
  const bSubsetA = equal || isTokenSubset(tokensB, tokensA);
  if (!aSubsetB && !bSubsetA) return false;

  const bothOrgsEmpty =
    experienceOrgTokens(left).length === 0 &&
    experienceOrgTokens(right).length === 0;
  if (equal && bothOrgsEmpty && titleWithoutOrgIsGeneric(left)) {
    return false;
  }
  if (
    !equal &&
    bothOrgsEmpty &&
    (titleWithoutOrgIsGeneric(left) || titleWithoutOrgIsGeneric(right))
  ) {
    return false;
  }

  return true;
}

function pairSubsetReason(
  biography: Biography,
  left: BiographyExperience,
  right: BiographyExperience,
): string | null {
  if (!experienceIsSubsetOfOther(left, right)) return null;
  const tokensA = experienceIdentifyingTokens(left);
  const tokensB = experienceIdentifyingTokens(right);
  const duplicate = tokensEqual(tokensA, tokensB);
  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [left, right] : [right, left];
  return subsetReason(biography, shorter, longer, duplicate);
}

/**
 * Code-level experience merges: only exact duplicates or cases where one
 * item’s title/org tokens are a subset of the other’s. Never clusters
 * entire families (all hackathons, all internships, all sports).
 */
export function detectExperienceSubsetMerges(
  biography: Biography,
): CodeExperienceMerge[] {
  const items = getExperiences(biography).filter((item) => item.id);
  if (items.length < 2) return [];

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

  const byType = new Map<string, BiographyExperience[]>();
  for (const item of items) {
    const list = byType.get(item.type) ?? [];
    list.push(item);
    byType.set(item.type, list);
  }

  for (const group of byType.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (experienceIsSubsetOfOther(group[i], group[j])) {
          union(group[i].id!, group[j].id!);
        }
      }
    }
  }

  const clusters = new Map<string, BiographyExperience[]>();
  for (const item of items) {
    const root = find(item.id!);
    const list = clusters.get(root) ?? [];
    list.push(item);
    clusters.set(root, list);
  }

  const suggestions: CodeExperienceMerge[] = [];
  const used = new Set<string>();

  for (const members of clusters.values()) {
    const unique = members.filter(
      (item, index) =>
        item &&
        item.id &&
        members.findIndex((other) => other?.id === item.id) === index,
    );
    if (unique.length < 2) continue;
    if (unique.some((item) => used.has(item.id!))) continue;

    const longest = [...unique].sort(
      (a, b) =>
        experienceIdentifyingTokens(b).length -
        experienceIdentifyingTokens(a).length,
    )[0];
    const allSubsetOfLongest = unique.every(
      (item) =>
        item.id === longest.id || experienceIsSubsetOfOther(item, longest),
    );

    if (allSubsetOfLongest) {
      const shorter =
        unique.find((item) => item.id !== longest.id) ?? unique[0];
      const duplicate = unique.every((item) =>
        tokensEqual(
          experienceIdentifyingTokens(item),
          experienceIdentifyingTokens(longest),
        ),
      );
      suggestions.push({
        member_ids: unique.map((item) => item.id!),
        reason: subsetReason(biography, shorter, longest, duplicate),
      });
      for (const item of unique) used.add(item.id!);
      continue;
    }

    // Not a nested chain: merge closest subset pairs only (never a star of
    // unrelated supersets that only share a generic shorter item).
    const pairs: {
      left: BiographyExperience;
      right: BiographyExperience;
      extra: number;
    }[] = [];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        if (!experienceIsSubsetOfOther(unique[i], unique[j])) continue;
        const extra = Math.abs(
          experienceIdentifyingTokens(unique[i]).length -
            experienceIdentifyingTokens(unique[j]).length,
        );
        pairs.push({ left: unique[i], right: unique[j], extra });
      }
    }
    pairs.sort((a, b) => a.extra - b.extra);
    for (const pair of pairs) {
      if (used.has(pair.left.id!) || used.has(pair.right.id!)) continue;
      const reason = pairSubsetReason(biography, pair.left, pair.right);
      if (!reason) continue;
      suggestions.push({
        member_ids: [pair.left.id!, pair.right.id!],
        reason,
      });
      used.add(pair.left.id!);
      used.add(pair.right.id!);
    }
  }

  return suggestions;
}

export function describeMergeReason(
  biography: Biography,
  memberIds: string[],
): string {
  const detected = detectExperienceSubsetMerges(biography).find((group) => {
    if (group.member_ids.length !== memberIds.length) return false;
    const wanted = new Set(memberIds);
    return group.member_ids.every((id) => wanted.has(id));
  });
  if (detected) return detected.reason;

  const names = memberIds
    .map((id) => {
      const source = getExperiences(biography).find((item) => item.id === id);
      if (!source) return null;
      return displayNameForExperience(biography, source);
    })
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) {
    return `Combined ${memberIds.length} related experiences.`;
  }
  if (names.length <= 4) {
    return `Combined related experiences: ${names.join("; ")}.`;
  }
  return `Combined ${names.length} related experiences (${names.slice(0, 2).join("; ")} and others).`;
}

export function getMergeReason(
  biography: Biography,
  group: Pick<ExperienceMergeGroup, "member_ids" | "reason">,
): string {
  const existing = String(group.reason ?? "").trim();
  if (existing) return existing;
  return describeMergeReason(biography, group.member_ids);
}

export function suggestMergeGroupsForCategory(
  biography: Biography,
  analysis: HighLevelAnalysis,
  category: string,
): string[][] {
  const mergedIds = getMemberIdsInMerges(analysis);
  const inCategory = new Set(
    analysis.experience_analysis
      .filter((item) => item.category === category && !mergedIds.has(item.id))
      .map((item) => item.id),
  );

  return detectExperienceSubsetMerges(biography)
    .map((group) => group.member_ids.filter((id) => inCategory.has(id)))
    .filter((memberIds) => memberIds.length >= 2);
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
  return unit.items.flatMap((item) => normalizeBullets(item.bullets, item.id));
}

export function isUnitIncluded(unit: CvExperienceUnit): boolean {
  return getUnitImportance(unit) > 0;
}

export function getUnitCvId(unit: CvExperienceUnit): string {
  return unit.type === "single" ? unit.item.id : unit.group.id;
}

function pickSupersetMember(
  biography: Biography,
  members: ExperienceAnalysisItem[],
): ExperienceAnalysisItem {
  return [...members].sort((a, b) => {
    const sourceA = getExperienceItemById(biography, a.category, a.id);
    const sourceB = getExperienceItemById(biography, b.category, b.id);
    const tokensA = sourceA
      ? experienceIdentifyingTokens(sourceA as unknown as BiographyExperience)
      : [];
    const tokensB = sourceB
      ? experienceIdentifyingTokens(sourceB as unknown as BiographyExperience)
      : [];
    if (tokensA.length !== tokensB.length)
      return tokensB.length - tokensA.length;
    return getExperienceImportance(b) - getExperienceImportance(a);
  })[0];
}

function bulletsForMergedMembers(
  biography: Biography,
  members: ExperienceAnalysisItem[],
  options?: { cap?: number; preferSuperset?: boolean },
): ExperienceBulletCandidate[] {
  if (options?.preferSuperset) {
    const superset = pickSupersetMember(biography, members);
    const primary = normalizeBullets(superset.bullets, superset.id);
    if (!options.cap || primary.length >= Math.min(3, options.cap)) {
      const ranked = rankBulletsForFit(primary);
      return options.cap ? ranked.slice(0, options.cap) : primary;
    }
  }

  const seenTopics = new Set<string>();
  const unique: ExperienceBulletCandidate[] = [];
  for (const item of members) {
    for (const bullet of rankBulletsForFit(
      normalizeBullets(item.bullets, item.id),
    )) {
      const topicKey = bullet.topic.trim().toLowerCase();
      if (!topicKey || seenTopics.has(topicKey)) continue;
      seenTopics.add(topicKey);
      unique.push(bullet);
    }
  }
  if (options?.cap) return unique.slice(0, options.cap);
  return unique;
}

export function createMergeGroup(
  category: string,
  memberIds: string[],
  reason?: string,
): ExperienceMergeGroup {
  return {
    id: `merge-${uuidv4()}`,
    category,
    member_ids: memberIds,
    ...(reason ? { reason } : {}),
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
  options?: {
    reason?: string;
    biography?: Biography;
    capBullets?: number;
    preferSupersetBullets?: boolean;
  },
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

  const reason =
    options?.reason?.trim() ||
    (options?.biography
      ? describeMergeReason(options.biography, memberIds)
      : `Combined ${memberIds.length} related experiences.`);

  const group: ExperienceMergeGroup = {
    ...createMergeGroup(category, memberIds, reason),
    relevance_score: Math.max(...members.map(getExperienceImportance)),
    bullets:
      options?.biography &&
      (options.capBullets || options.preferSupersetBullets)
        ? bulletsForMergedMembers(options.biography, members, {
            cap: options.capBullets,
            preferSuperset: options.preferSupersetBullets,
          })
        : members.flatMap((item) => normalizeBullets(item.bullets)),
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
  update: Partial<
    Pick<ExperienceMergeGroup, "relevance_score" | "bullets" | "reason">
  >,
): HighLevelAnalysis {
  return {
    ...analysis,
    experience_merges: (analysis.experience_merges ?? []).map((group) =>
      group.id === groupId ? { ...group, ...update } : group,
    ),
  };
}

function majorityCategory(
  analysis: HighLevelAnalysis,
  memberIds: string[],
): string | null {
  const counts = new Map<string, number>();
  for (const id of memberIds) {
    const item = analysis.experience_analysis.find((entry) => entry.id === id);
    if (!item) continue;
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [category, count] of counts) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

function alignMembersToCategory(
  analysis: HighLevelAnalysis,
  memberIds: string[],
  category: string,
): HighLevelAnalysis {
  return {
    ...analysis,
    experience_analysis: analysis.experience_analysis.map((item) =>
      memberIds.includes(item.id) && item.category !== category
        ? { ...item, category }
        : item,
    ),
  };
}

function existingGroupCovering(
  analysis: HighLevelAnalysis,
  memberIds: string[],
): ExperienceMergeGroup | undefined {
  const wanted = new Set(memberIds);
  return (analysis.experience_merges ?? []).find(
    (group) =>
      memberIds.every((id) => group.member_ids.includes(id)) &&
      group.member_ids.every((id) => wanted.has(id)),
  );
}

/**
 * Apply subset/duplicate code merges after analysis, without overwriting an
 * AI merge that already has the same members. Fills missing reasons.
 */
export function applyExperienceSubsetMerges(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  let next = analysis;

  for (const suggestion of detectExperienceSubsetMerges(biography)) {
    const existing = existingGroupCovering(next, suggestion.member_ids);
    if (existing) {
      if (!String(existing.reason ?? "").trim()) {
        next = updateMergeGroup(next, existing.id, {
          reason: suggestion.reason,
        });
      }
      continue;
    }

    const alreadyMerged = suggestion.member_ids.filter((id) =>
      getMemberIdsInMerges(next).has(id),
    );
    if (alreadyMerged.length > 0) continue;

    const category = majorityCategory(next, suggestion.member_ids);
    if (!category) continue;
    next = alignMembersToCategory(next, suggestion.member_ids, category);
    next = addMergeGroup(next, category, suggestion.member_ids, {
      reason: suggestion.reason,
      biography,
      capBullets: 5,
      preferSupersetBullets: true,
    });
  }

  next = {
    ...next,
    experience_merges: (next.experience_merges ?? []).map((group) => ({
      ...group,
      reason: getMergeReason(biography, group),
    })),
  };

  return next;
}

/** @deprecated Use applyExperienceSubsetMerges — code merge is subset-only. */
export function applyAllSuggestedMerges(
  biography: Biography,
  analysis: HighLevelAnalysis,
): HighLevelAnalysis {
  return applyExperienceSubsetMerges(biography, analysis);
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
