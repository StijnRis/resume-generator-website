import { v4 as uuidv4 } from "uuid";

import {
  getAttributeDisplayName,
  getAttributeItemById,
} from "@/lib/biography/lookup";
import type {
  AttributeAnalysisItem,
  AttributeMergeGroup,
  Biography,
  HighLevelAnalysis,
} from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

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

  const group: AttributeMergeGroup = {
    id: uuidv4(),
    category: category ?? members[0].category,
    member_ids: unique,
    relevance_score: Math.max(...members.map((item) => item.relevance_score)),
  };

  return {
    ...analysis,
    attribute_merges: [...(analysis.attribute_merges ?? []), group],
  };
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
  unit: CvAttributeUnit,
): string {
  if (unit.type === "merged") {
    if (unit.group.title?.trim()) return unit.group.title.trim();
    const cat = unit.group.category ?? unit.items[0]?.category;
    return cat ? CATEGORY_LABELS[cat] ?? cat : "Attributes";
  }
  return CATEGORY_LABELS[unit.item.category] ?? unit.item.category;
}
