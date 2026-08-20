"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatImportanceSliderValue,
  getExperienceImportance,
  isExperienceIncluded,
  MAX_IMPORTANCE,
  normalizeBullets,
} from "@/lib/analysis/experience-score";
import { getMergeColorTheme } from "@/lib/analysis/merge-colors";
import {
  addAttributeMergeGroup,
  getAttributeMergeGroups,
  getAttributeMergeLabel,
  getAttributeMergeReason,
  getMemberIdsInAttributeMerges,
  removeAttributeMergeGroup,
  shouldIncludeAttributeCategory,
} from "@/lib/analysis/attribute-merges";
import {
  addMergeGroup,
  describeMergeReason,
  getMemberIdsInMerges,
  getMergeGroupsForCategory,
  getMergeReason,
  getSuggestedMergeLabel,
  removeMergeGroup,
  suggestMergeGroupsForCategory,
  updateMergeGroup,
} from "@/lib/analysis/merges";
import {
  getAttributeCategoryDefs,
  getAttributeDisplayName,
  getAttributeItemById,
  getCategoryLabel,
  getCategoryOrder,
  getCategoryReason,
  getExperienceCategoryDefs,
  getExperienceDisplayName,
  getExperienceItemById,
  groupAttributeAnalysis,
  groupExperienceAnalysis,
} from "@/lib/biography/lookup";
import { formatDate, formatDateRange, formatMergedDateRange, parseDateForSort } from "@/lib/formatting/dates";
import type {
  AttributeAnalysisItem,
  Biography,
  ExperienceAnalysisItem,
  ExperienceMergeGroup,
  GeneratedCvTexts,
  HighLevelAnalysis,
} from "@/lib/types";
import { ScoreSlider } from "@/components/ScoreSlider";
import { NumberEvidenceList } from "@/components/NumberEvidenceList";
import {
  sourceTextFromUnknown,
  validateNumbersAgainstSource,
} from "@/lib/validation/numbers";

function FoldToggle({
  folded,
  onToggle,
}: {
  folded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="mt-0.5 h-5 w-5 shrink-0 flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
      title={folded ? "Expand" : "Collapse"}
      aria-label={folded ? "Expand" : "Collapse"}
    >
      <span className="text-xs leading-none select-none">
        {folded ? "▸" : "▾"}
      </span>
    </button>
  );
}

function ExperienceEditFields({
  text,
  onChange,
}: {
  text: {
    title?: string;
    organization?: string;
    location?: string;
    dateRange?: string;
  };
  onChange: (update: {
    title?: string;
    organization?: string;
    location?: string;
    dateRange?: string;
  }) => void;
}) {
  return (
    <div className="mt-1 space-y-1">
      <input
        value={text.title ?? ""}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Title"
        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
      />
      <input
        value={text.organization ?? ""}
        onChange={(e) => onChange({ organization: e.target.value })}
        placeholder="Organization"
        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
      />
      <input
        value={text.location ?? ""}
        onChange={(e) => onChange({ location: e.target.value })}
        placeholder="Location"
        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
      />
      <input
        value={text.dateRange ?? ""}
        onChange={(e) => onChange({ dateRange: e.target.value })}
        placeholder="Date range"
        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
      />
    </div>
  );
}

function BulletRow({
  importance,
  topic,
  text,
  onImportanceChange,
  onTopicChange,
  onTextChange,
  onRemove,
}: {
  importance: number;
  topic: string;
  text: string;
  onImportanceChange: (value: number) => void;
  onTopicChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center rounded border border-zinc-100 bg-white px-2 py-1.5">
      <div className="w-36 shrink-0">
        <ScoreSlider
          side
          min={0}
          max={MAX_IMPORTANCE}
          label="Imp."
          value={importance}
          valueLabel={`${importance}`}
          onChange={onImportanceChange}
        />
      </div>
      <input
        value={topic}
        onChange={(e) => onTopicChange(e.target.value)}
        placeholder="Topic"
        className="flex-1 min-w-[8rem] rounded border border-zinc-200 bg-white px-2 py-1 text-xs"
      />
      <input
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Bullet text"
        className="flex-[2] min-w-[10rem] rounded border border-zinc-200 bg-white px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={onRemove}
        title="Remove bullet"
        className="shrink-0 px-1 text-sm leading-none text-zinc-400 hover:text-red-600"
      >
        ×
      </button>
    </div>
  );
}

interface AnalysisSectionProps {
  analysis: HighLevelAnalysis | null;
  biography: Biography | null;
  loading: boolean;
  generating?: boolean;
  onAnalyze: () => void;
  onAnalysisChange: (analysis: HighLevelAnalysis) => void;
  canAnalyze: boolean;
  generatedTexts?: GeneratedCvTexts | null;
  onGeneratedTextsChange?: (texts: GeneratedCvTexts) => void;
  onRegenerateTexts?: () => void;
  canRegenerateTexts?: boolean;
  textsStale?: boolean;
  scrollToId?: string | null;
  onScrollHandled?: () => void;
  onContentItemClick?: (id: string) => void;
  /** Bullets actually placed on the fitted CV per experience id. */
  placedBulletCounts?: Record<string, number>;
}

function sortExperienceItems(
  biography: Biography,
  items: ExperienceAnalysisItem[],
): ExperienceAnalysisItem[] {
  return [...items].sort((a, b) => {
    const sourceA = getExperienceItemById(biography, a.category, a.id);
    const sourceB = getExperienceItemById(biography, b.category, b.id);
    const endA =
      sourceA?.end_date == null ||
      sourceA.end_date === "" ||
      /^present$/i.test(String(sourceA.end_date).trim())
        ? parseDateForSort(null)
        : parseDateForSort(String(sourceA.end_date)) ||
          parseDateForSort(sourceA?.start_date as string);
    const endB =
      sourceB?.end_date == null ||
      sourceB.end_date === "" ||
      /^present$/i.test(String(sourceB.end_date).trim())
        ? parseDateForSort(null)
        : parseDateForSort(String(sourceB.end_date)) ||
          parseDateForSort(sourceB?.start_date as string);
    return endB - endA;
  });
}

function sortAttributeItems(
  biography: Biography,
  items: AttributeAnalysisItem[],
): AttributeAnalysisItem[] {
  return [...items].sort((a, b) => {
    const skillLike = /skill|tool/i.test(a.category) || /skill|tool/i.test(b.category);
    if (skillLike && b.relevance_score !== a.relevance_score) {
      return b.relevance_score - a.relevance_score;
    }

    const sourceA = getAttributeItemById(biography, a.category, a.id);
    const sourceB = getAttributeItemById(biography, b.category, b.id);
    const dateA = getAttributeSortDate(a.category, sourceA);
    const dateB = getAttributeSortDate(b.category, sourceB);
    if (dateA !== dateB) return dateB - dateA;

    const nameA = getAttributeDisplayName(sourceA, a.category);
    const nameB = getAttributeDisplayName(sourceB, b.category);
    return nameA.localeCompare(nameB);
  });
}

function getAttributeSortDate(category: string, source: unknown): number {
  if (!source || typeof source !== "object") return 0;
  const obj = source as Record<string, unknown>;
  if (category === "publications") {
    return parseDateForSort(String(obj.release_date ?? ""));
  }
  if (category === "certificates" || category === "awards") {
    return parseDateForSort(String(obj.date ?? ""));
  }
  return 0;
}

function getExperienceDateMeta(
  biography: Biography,
  item: ExperienceAnalysisItem,
): string {
  const source = getExperienceItemById(biography, item.category, item.id);
  if (!source) return "";
  return formatDateRange(
    String(source.start_date ?? ""),
    source.end_date as string | null | undefined,
  );
}

function getAttributeDateMeta(
  biography: Biography,
  item: AttributeAnalysisItem,
): string {
  const source = getAttributeItemById(biography, item.category, item.id);
  if (!source || typeof source !== "object") return "";
  const obj = source as Record<string, unknown>;
  if (item.category === "publications" && obj.release_date) {
    return formatDate(String(obj.release_date));
  }
  if (
    (item.category === "certificates" || item.category === "awards") &&
    obj.date
  ) {
    return formatDate(String(obj.date));
  }
  return "";
}

function getGroupImportance(
  group: ExperienceMergeGroup,
  members: ExperienceAnalysisItem[],
): number {
  if (group.relevance_score != null) return group.relevance_score;
  return Math.max(0, ...members.map(getExperienceImportance));
}

export function AnalysisSection({
  analysis,
  biography,
  loading,
  generating = false,
  onAnalyze,
  onAnalysisChange,
  canAnalyze,
  generatedTexts = null,
  onGeneratedTextsChange,
  onRegenerateTexts,
  canRegenerateTexts = false,
  textsStale = false,
  scrollToId = null,
  onScrollHandled,
  onContentItemClick,
  placedBulletCounts = {},
}: AnalysisSectionProps) {
  const [expandedRaw, setExpandedRaw] = useState<Set<string>>(new Set());
  const [translationsOpen, setTranslationsOpen] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<
    Record<string, Set<string>>
  >({});
  const [selectedAttributes, setSelectedAttributes] = useState<Set<string>>(
    new Set(),
  );
  const [foldedIds, setFoldedIds] = useState<Set<string>>(new Set());
  const [foldInitialized, setFoldInitialized] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const previousAnalysisRef = useRef<HighLevelAnalysis | null>(null);

  useEffect(() => {
    if (previousAnalysisRef.current != null && analysis == null) {
      setFoldInitialized(false);
      setFoldedIds(new Set());
    }
    previousAnalysisRef.current = analysis;
  }, [analysis]);

  useEffect(() => {
    if (!analysis || foldInitialized) return;
    const excluded = new Set(
      analysis.experience_analysis
        .filter((item) => item.relevance_score <= 0)
        .map((item) => item.id),
    );
    for (const group of analysis.experience_merges ?? []) {
      const members = group.member_ids
        .map((id) =>
          analysis.experience_analysis.find((entry) => entry.id === id),
        )
        .filter((item): item is ExperienceAnalysisItem => item != null);
      if (getGroupImportance(group, members) <= 0) {
        excluded.add(group.id);
      }
    }
    setFoldedIds(excluded);
    setFoldInitialized(true);
  }, [analysis, foldInitialized]);

  useEffect(() => {
    if (!scrollToId || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-content-id="${CSS.escape(scrollToId)}"]`,
    );
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-blue-400");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-blue-400");
      }, 1200);
    }
    onScrollHandled?.();
  }, [scrollToId, onScrollHandled]);

  const toggleRaw = (id: string) => {
    setExpandedRaw((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFold = (id: string) => {
    setFoldedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateExperienceText = (
    id: string,
    update: Partial<{
      title: string;
      organization: string;
      location: string;
      dateRange: string;
    }>,
  ) => {
    if (!generatedTexts || !onGeneratedTextsChange) return;
    const current = generatedTexts.experiences[id] ?? {
      summary: "",
      title: "",
    };
    onGeneratedTextsChange({
      ...generatedTexts,
      experiences: {
        ...generatedTexts.experiences,
        [id]: { ...current, ...update },
      },
    });
  };

  const updateExperienceBulletText = (
    expId: string,
    bulletId: string,
    text: string,
  ) => {
    if (!onGeneratedTextsChange) return;
    const base = generatedTexts ?? { experiences: {}, attributes: {} };
    const current = base.experiences[expId] ?? { summary: "", title: "" };
    onGeneratedTextsChange({
      ...base,
      experiences: {
        ...base.experiences,
        [expId]: {
          ...current,
          bullets: { ...(current.bullets ?? {}), [bulletId]: text },
        },
      },
    });
  };

  const updateSummaryText = (summary: string) => {
    if (!generatedTexts || !onGeneratedTextsChange) return;
    onGeneratedTextsChange({ ...generatedTexts, summary });
  };

  const updateAttributeTitle = (sectionId: string, title: string) => {
    if (!onGeneratedTextsChange) return;
    const base = generatedTexts ?? { experiences: {}, attributes: {} };
    onGeneratedTextsChange({
      ...base,
      attributes: {
        ...(base.attributes ?? {}),
        [sectionId]: {
          ...(base.attributes?.[sectionId] ?? { title: "" }),
          title,
        },
      },
    });
  };

  const updateAttributeItemText = (
    sectionId: string,
    itemId: string,
    text: string,
    fallbackTitle: string,
  ) => {
    if (!onGeneratedTextsChange) return;
    const base = generatedTexts ?? {
      experiences: {},
      attributes: {},
    };
    const section = base.attributes?.[sectionId] ?? {
      title: fallbackTitle,
      items: {},
    };
    onGeneratedTextsChange({
      ...base,
      attributes: {
        ...(base.attributes ?? {}),
        [sectionId]: {
          ...section,
          title: section.title || fallbackTitle,
          items: {
            ...(section.items ?? {}),
            [itemId]: text,
          },
        },
      },
    });
  };

  const renameExperienceCategory = (oldKey: string, title: string) => {
    if (!analysis) return;
    const label = title.trim() || oldKey;
    onAnalysisChange({
      ...analysis,
      experience_categories: analysis.experience_categories.map((entry) =>
        entry.id === oldKey || entry.label === oldKey
          ? { ...entry, id: label, label }
          : entry,
      ),
      experience_analysis: analysis.experience_analysis.map((item) =>
        item.category === oldKey ? { ...item, category: label } : item,
      ),
      experience_merges: (analysis.experience_merges ?? []).map((group) =>
        group.category === oldKey ? { ...group, category: label } : group,
      ),
    });
  };

  const toggleAttributeSelection = (id: string) => {
    setSelectedAttributes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMergeSelection = (category: string, id: string) => {
    setSelectedForMerge((prev) => {
      const next = { ...prev };
      const categorySet = new Set(next[category] ?? []);
      if (categorySet.has(id)) categorySet.delete(id);
      else categorySet.add(id);
      next[category] = categorySet;
      return next;
    });
  };

  const getCategorySelection = (category: string): Set<string> =>
    selectedForMerge[category] ?? new Set();

  const clearCategorySelection = (category: string) => {
    setSelectedForMerge((prev) => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  };

  const updateCategoryOrder = (
    categoryId: string,
    order: number,
    kind: "experience" | "attribute",
  ) => {
    if (!analysis) return;
    if (kind === "experience") {
      onAnalysisChange({
        ...analysis,
        experience_categories: analysis.experience_categories.map((entry) =>
          entry.id === categoryId ? { ...entry, order } : entry,
        ),
      });
    } else {
      onAnalysisChange({
        ...analysis,
        attribute_categories: analysis.attribute_categories.map((entry) =>
          entry.id === categoryId ? { ...entry, order } : entry,
        ),
      });
    }
  };

  const updateExperienceImportance = (id: string, score: number) => {
    if (!analysis) return;
    onAnalysisChange({
      ...analysis,
      experience_analysis: analysis.experience_analysis.map((e) =>
        e.id === id ? { ...e, relevance_score: score } : e,
      ),
    });
  };

  const updateExperienceBulletField = (
    itemId: string,
    bulletId: string,
    update: Partial<{ topic: string; importance: number }>,
  ) => {
    if (!analysis) return;
    onAnalysisChange({
      ...analysis,
      experience_analysis: analysis.experience_analysis.map((item) =>
        item.id === itemId
          ? {
              ...item,
              bullets: normalizeBullets(item.bullets, item.id).map((bullet) =>
                bullet.id === bulletId ? { ...bullet, ...update } : bullet,
              ),
            }
          : item,
      ),
    });
  };

  const addExperienceBullet = (itemId: string) => {
    if (!analysis) return;
    onAnalysisChange({
      ...analysis,
      experience_analysis: analysis.experience_analysis.map((item) =>
        item.id === itemId
          ? {
              ...item,
              bullets: normalizeBullets(
                [
                  ...normalizeBullets(item.bullets, item.id),
                  { id: "", topic: "", importance: 50, text: "" },
                ],
                item.id,
              ),
            }
          : item,
      ),
    });
  };

  const removeExperienceBullet = (itemId: string, bulletId: string) => {
    if (!analysis) return;
    onAnalysisChange({
      ...analysis,
      experience_analysis: analysis.experience_analysis.map((item) =>
        item.id === itemId
          ? {
              ...item,
              bullets: normalizeBullets(item.bullets, item.id).filter(
                (bullet) => bullet.id !== bulletId,
              ),
            }
          : item,
      ),
    });
  };

  const updateGroupBulletField = (
    groupId: string,
    bulletId: string,
    update: Partial<{ topic: string; importance: number }>,
  ) => {
    if (!analysis) return;
    const group = (analysis.experience_merges ?? []).find(
      (g) => g.id === groupId,
    );
    if (!group) return;
    const bullets = normalizeBullets(group.bullets, group.id).map((bullet) =>
      bullet.id === bulletId ? { ...bullet, ...update } : bullet,
    );
    onAnalysisChange(updateMergeGroup(analysis, groupId, { bullets }));
  };

  const addGroupBullet = (groupId: string) => {
    if (!analysis) return;
    const group = (analysis.experience_merges ?? []).find(
      (g) => g.id === groupId,
    );
    if (!group) return;
    const bullets = normalizeBullets(
      [
        ...normalizeBullets(group.bullets, group.id),
        { id: "", topic: "", importance: 50, text: "" },
      ],
      group.id,
    );
    onAnalysisChange(updateMergeGroup(analysis, groupId, { bullets }));
  };

  const removeGroupBullet = (groupId: string, bulletId: string) => {
    if (!analysis) return;
    const group = (analysis.experience_merges ?? []).find(
      (g) => g.id === groupId,
    );
    if (!group) return;
    const bullets = normalizeBullets(group.bullets, group.id).filter(
      (bullet) => bullet.id !== bulletId,
    );
    onAnalysisChange(updateMergeGroup(analysis, groupId, { bullets }));
  };

  const updateAttributeScore = (id: string, score: number) => {
    if (!analysis) return;
    onAnalysisChange({
      ...analysis,
      attribute_analysis: analysis.attribute_analysis.map((a) =>
        a.id === id ? { ...a, relevance_score: score } : a,
      ),
    });
  };

  const combineExperienceMembers = (category: string, memberIds: string[]) => {
    if (!analysis || !biography) return;
    const next = addMergeGroup(analysis, category, memberIds, {
      reason: describeMergeReason(biography, memberIds),
      biography,
    });
    const groups = next.experience_merges ?? [];
    const newGroup = groups[groups.length - 1];
    onAnalysisChange(next);
    if (newGroup && (newGroup.relevance_score ?? 0) <= 0) {
      setFoldedIds((prev) => new Set(prev).add(newGroup.id));
    }
  };

  const handleCombineSelected = (category: string) => {
    const selected = getCategorySelection(category);
    if (selected.size < 2) return;
    combineExperienceMembers(category, Array.from(selected));
    clearCategorySelection(category);
  };

  const handleUnmergeExperience = (groupId: string) => {
    if (!analysis) return;
    onAnalysisChange(removeMergeGroup(analysis, groupId));
    setFoldedIds((prev) => {
      if (!prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
  };

  const experienceGroups = useMemo(
    () => (analysis ? groupExperienceAnalysis(analysis) : null),
    [analysis],
  );
  const attributeGroups = useMemo(
    () => (analysis ? groupAttributeAnalysis(analysis) : null),
    [analysis],
  );
  const mergedMemberIds = useMemo(
    () => (analysis ? getMemberIdsInMerges(analysis) : new Set<string>()),
    [analysis],
  );
  const mergedAttributeIds = useMemo(
    () =>
      analysis ? getMemberIdsInAttributeMerges(analysis) : new Set<string>(),
    [analysis],
  );
  const attributeMerges = useMemo(
    () => (analysis ? getAttributeMergeGroups(analysis) : []),
    [analysis],
  );

  const sortedExperienceCategories = useMemo(() => {
    if (!analysis) return [];
    return getExperienceCategoryDefs(analysis)
      .filter((def) => (experienceGroups?.get(def.id)?.length ?? 0) > 0)
      .sort((a, b) => getCategoryOrder(analysis, a.id) - getCategoryOrder(analysis, b.id))
      .map((def) => def.id);
  }, [analysis, experienceGroups]);

  const sortedAttributeCategories = useMemo(() => {
    if (!analysis) return [];
    return getAttributeCategoryDefs(analysis)
      .filter((def) => (attributeGroups?.get(def.id)?.length ?? 0) > 0)
      .sort((a, b) => getCategoryOrder(analysis, a.id) - getCategoryOrder(analysis, b.id))
      .map((def) => def.id);
  }, [analysis, attributeGroups]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3 gap-3 shrink-0">
        <div>
          <h2
            data-content-id="header"
            className="text-lg font-semibold text-zinc-900 cursor-pointer"
            onClick={() => onContentItemClick?.("header")}
          >
            Resume Content
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onRegenerateTexts && (
            <button
              type="button"
              onClick={onRegenerateTexts}
              disabled={!canRegenerateTexts || generating || !textsStale}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              title={
                textsStale
                  ? "Bullets changed — regenerate AI texts"
                  : "No bullet changes since last generation"
              }
            >
              {generating ? "Generating..." : "Regenerate texts"}
            </button>
          )}
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!canAnalyze || loading || generating}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? "Analyzing..."
              : generating
                ? "Writing texts..."
                : analysis
                  ? "Re-analyze"
                  : "Analyze with AI"}
          </button>
        </div>
      </div>

      {!analysis && !loading && (
        <p className="text-sm text-zinc-500 shrink-0">
          Upload a biography and enter a job description, then click Analyze.
        </p>
      )}

      {analysis && biography && (
        <div
          ref={listRef}
          className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1 overscroll-contain"
        >
          {generatedTexts?.translations &&
            generatedTexts.translations.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                <button
                  type="button"
                  className="text-sm font-semibold text-amber-900 w-full text-left"
                  onClick={() => setTranslationsOpen((open) => !open)}
                >
                  {translationsOpen ? "Hide" : "Show"} translation mapping (
                  {generatedTexts.translations.length})
                </button>
                {translationsOpen && (
                  <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {generatedTexts.translations.map((entry, index) => (
                      <li
                        key={`${entry.original}-${index}`}
                        className="text-[11px] font-mono text-amber-950 leading-snug"
                      >
                        <span className="text-zinc-700">{entry.original}</span>
                        <span className="text-zinc-400"> → </span>
                        <span>{entry.translated}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

          {generatedTexts && (
            <div
              data-content-id="summary"
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 cursor-pointer"
              onClick={() => onContentItemClick?.("summary")}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-sm font-semibold text-zinc-700">
                  Professional summary
                </p>
                {analysis && (
                  <div
                    className="w-40 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ScoreSlider
                      label="Importance"
                      min={0}
                      max={MAX_IMPORTANCE}
                      value={analysis.summary_importance ?? 70}
                      valueLabel={`${analysis.summary_importance ?? 70}`}
                      commitOnRelease
                      onChange={(value) =>
                        onAnalysisChange({
                          ...analysis,
                          summary_importance: value,
                        })
                      }
                    />
                  </div>
                )}
              </div>
              {(analysis?.summary_importance ?? 70) <= 0 ? (
                <p className="text-xs text-zinc-500 mb-2">
                  Importance 0 — summary omitted from the resume.
                </p>
              ) : null}
              <textarea
                value={generatedTexts.summary ?? ""}
                onChange={(e) => updateSummaryText(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                rows={3}
                className="w-full rounded border border-zinc-200 bg-white p-2 text-sm text-zinc-800"
              />
              <div onClick={(e) => e.stopPropagation()}>
                <p className="text-[11px] font-medium text-zinc-500 mt-1">
                  Summary → resume coverage
                </p>
                <NumberEvidenceList
                  items={validateNumbersAgainstSource(
                    generatedTexts.summary ?? "",
                    Object.values(generatedTexts.experiences ?? {})
                      .flatMap((entry) => [
                        entry.title ?? "",
                        ...Object.values(entry.bullets ?? {}),
                      ])
                      .join("\n"),
                  )}
                  emptyLabel="No numbers in summary."
                />
              </div>
            </div>
          )}

          {!generatedTexts && analysis && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-700">
                    Professional summary
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {(analysis.summary_importance ?? 70) <= 0
                      ? "Importance 0 — summary omitted from the resume."
                      : "Included when importance is above 0."}
                  </p>
                </div>
                <div className="w-40 shrink-0">
                  <ScoreSlider
                    label="Importance"
                    min={0}
                    max={MAX_IMPORTANCE}
                    value={analysis.summary_importance ?? 70}
                    valueLabel={`${analysis.summary_importance ?? 70}`}
                    commitOnRelease
                    onChange={(value) =>
                      onAnalysisChange({
                        ...analysis,
                        summary_importance: value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-zinc-700 mb-2 uppercase tracking-wide">
              Experiences
            </h3>

            <div className="space-y-3">
              {sortedExperienceCategories.map((cat) => {
                const items = (experienceGroups?.get(cat) ?? []).filter(
                  (item) => !mergedMemberIds.has(item.id),
                );
                const categoryMerges = getMergeGroupsForCategory(analysis, cat);
                const suggestions = suggestMergeGroupsForCategory(
                  biography,
                  analysis,
                  cat,
                );
                const categorySelection = getCategorySelection(cat);

                if (items.length === 0 && categoryMerges.length === 0) {
                  return null;
                }

                const sortedItems = sortExperienceItems(biography, items);
                const visibleOnCv =
                  items.some((item) => isExperienceIncluded(item)) ||
                  categoryMerges.some((group) => {
                    const members = group.member_ids
                      .map((id) =>
                        analysis.experience_analysis.find(
                          (entry) => entry.id === id,
                        ),
                      )
                      .filter(
                        (entry): entry is ExperienceAnalysisItem =>
                          entry != null,
                      );
                    return getGroupImportance(group, members) > 0;
                  });

                return (
                  <div
                    key={cat}
                    data-content-id={`category:${cat}`}
                    className={`rounded-lg border p-2 ${
                      visibleOnCv
                        ? "border-zinc-200 bg-zinc-50"
                        : "border-zinc-100 bg-zinc-50 opacity-70"
                    }`}
                  >
                    <div className="mb-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        key={`${cat}:${getCategoryLabel(analysis, cat)}`}
                        defaultValue={getCategoryLabel(analysis, cat)}
                        onBlur={(e) =>
                          renameExperienceCategory(cat, e.target.value)
                        }
                        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm font-medium"
                        placeholder="Section title"
                      />
                      <ScoreSlider
                        compact
                        label="Order"
                        min={1}
                        max={20}
                        value={getCategoryOrder(analysis, cat)}
                        valueLabel={`Order ${getCategoryOrder(analysis, cat)}`}
                        reason={
                          visibleOnCv
                            ? getCategoryReason(analysis, cat)
                            : "All items excluded — hidden on resume"
                        }
                        commitOnRelease
                        onChange={(order) =>
                          updateCategoryOrder(cat, order, "experience")
                        }
                      />
                    </div>

                    {suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {suggestions.map((memberIds) => (
                          <button
                            key={memberIds.join("-")}
                            type="button"
                            onClick={() =>
                              combineExperienceMembers(cat, memberIds)
                            }
                            className="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] text-violet-800 hover:bg-violet-200"
                          >
                            Combine {getSuggestedMergeLabel(biography, analysis, memberIds)}
                          </button>
                        ))}
                      </div>
                    )}

                    {categorySelection.size >= 2 && (
                      <button
                        type="button"
                        onClick={() => handleCombineSelected(cat)}
                        className="mt-2 w-full rounded bg-violet-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-violet-700"
                      >
                        Combine {categorySelection.size} selected
                      </button>
                    )}

                    <div className="mt-2 space-y-1 border-t border-zinc-200 pt-2">
                      {categoryMerges.map((group) => {
                        const members = group.member_ids
                          .map((id) =>
                            analysis.experience_analysis.find(
                              (item) => item.id === id,
                            ),
                          )
                          .filter(
                            (item): item is ExperienceAnalysisItem =>
                              item != null,
                          );

                        const title = getSuggestedMergeLabel(
                          biography,
                          analysis,
                          group.member_ids,
                        );
                        const mergeReason = getMergeReason(biography, group);
                        const importance = getGroupImportance(group, members);
                        const theme = getMergeColorTheme(group.id);
                        const excludedDefault = importance <= 0;
                        const folded = foldedIds.has(group.id);
                        const rawKey = `exp-raw-${group.id}`;
                        const memberSources = members
                          .map((member) => ({
                            id: member.id,
                            data: getExperienceItemById(
                              biography,
                              member.category,
                              member.id,
                            ),
                          }))
                          .filter((entry) => entry.data != null);
                        const bullets = normalizeBullets(group.bullets, group.id);
                        const generatedBullets =
                          generatedTexts?.experiences[group.id]?.bullets;
                        const totalIncluded = bullets.filter(
                          (bullet) => bullet.importance > 0,
                        ).length;
                        const placed = placedBulletCounts[group.id];

                        return (
                          <div
                            key={group.id}
                            data-content-id={group.id}
                            className={`rounded border px-2 py-1.5 transition-shadow cursor-pointer ${theme.border} ${theme.bg} ${
                              excludedDefault ? "opacity-60" : ""
                            }`}
                            onClick={() => onContentItemClick?.(group.id)}
                          >
                            <div className="flex gap-2 items-start">
                              <FoldToggle
                                folded={folded}
                                onToggle={() => toggleFold(group.id)}
                              />
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p
                                      className={`text-xs font-semibold uppercase ${theme.text}`}
                                    >
                                      Combined
                                    </p>
                                    <p className="text-sm font-medium text-zinc-900 leading-snug">
                                      {title}
                                    </p>
                                  </div>
                                </div>

                                {!folded && (
                                  <div
                                    className="space-y-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="space-y-1">
                                      {members.map((member) => (
                                        <p
                                          key={member.id}
                                          className="text-xs text-zinc-500 whitespace-pre-wrap"
                                        >
                                          <span className="font-medium text-zinc-600">
                                            {getExperienceDisplayName(
                                              getExperienceItemById(
                                                biography,
                                                member.category,
                                                member.id,
                                              ),
                                              member.category,
                                            )}
                                            :{" "}
                                          </span>
                                          {member.reason}
                                        </p>
                                      ))}
                                    </div>

                                    <div className="flex flex-wrap gap-1">
                                      {members.map((member) => {
                                        const source = getExperienceItemById(
                                          biography,
                                          member.category,
                                          member.id,
                                        );
                                        const memberName =
                                          getExperienceDisplayName(
                                            source,
                                            member.category,
                                          );
                                        return (
                                          <span
                                            key={member.id}
                                            className={`rounded px-1.5 py-0.5 text-xs ${theme.chip}`}
                                            title={getExperienceDateMeta(
                                              biography,
                                              member,
                                            )}
                                          >
                                            {memberName}
                                          </span>
                                        );
                                      })}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => toggleRaw(rawKey)}
                                      className="text-sm text-blue-600 hover:underline"
                                    >
                                      {expandedRaw.has(rawKey) ? "Hide" : "Show"}{" "}
                                      raw data
                                    </button>
                                    {expandedRaw.has(rawKey) &&
                                      memberSources.length > 0 && (
                                        <pre className="text-xs bg-zinc-900 text-zinc-300 rounded p-2 overflow-x-auto max-h-40">
                                          {JSON.stringify(
                                            memberSources.map(
                                              (entry) => entry.data,
                                            ),
                                            null,
                                            2,
                                          )}
                                        </pre>
                                      )}

                                    {generatedTexts && (
                                      <ExperienceEditFields
                                        text={{
                                          title:
                                            generatedTexts.experiences[group.id]
                                              ?.title ?? "",
                                          organization:
                                            generatedTexts.experiences[group.id]
                                              ?.organization ?? "",
                                          location:
                                            generatedTexts.experiences[group.id]
                                              ?.location ?? "",
                                          dateRange:
                                            generatedTexts.experiences[group.id]
                                              ?.dateRange ??
                                            formatMergedDateRange(
                                              members.map((member) => {
                                                const source =
                                                  getExperienceItemById(
                                                    biography,
                                                    member.category,
                                                    member.id,
                                                  );
                                                return String(
                                                  source?.start_date ?? "",
                                                );
                                              }),
                                              members.map((member) => {
                                                const source =
                                                  getExperienceItemById(
                                                    biography,
                                                    member.category,
                                                    member.id,
                                                  );
                                                return source?.end_date as
                                                  | string
                                                  | null
                                                  | undefined;
                                              }),
                                            ),
                                        }}
                                        onChange={(update) =>
                                          updateExperienceText(group.id, update)
                                        }
                                      />
                                    )}

                                    <div className="space-y-1">
                                      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
                                        Bullets
                                      </p>
                                      {placed != null &&
                                        placed < totalIncluded && (
                                          <p className="text-[10px] text-amber-700">
                                            Only {placed} of {totalIncluded}{" "}
                                            bullets fit on the page
                                          </p>
                                        )}
                                      {bullets.map((bullet) => (
                                        <BulletRow
                                          key={bullet.id}
                                          importance={bullet.importance}
                                          topic={bullet.topic}
                                          text={
                                            generatedBullets?.[bullet.id] ??
                                            bullet.text ??
                                            ""
                                          }
                                          onImportanceChange={(value) =>
                                            updateGroupBulletField(
                                              group.id,
                                              bullet.id,
                                              { importance: value },
                                            )
                                          }
                                          onTopicChange={(value) =>
                                            updateGroupBulletField(
                                              group.id,
                                              bullet.id,
                                              { topic: value },
                                            )
                                          }
                                          onTextChange={(value) =>
                                            updateExperienceBulletText(
                                              group.id,
                                              bullet.id,
                                              value,
                                            )
                                          }
                                          onRemove={() =>
                                            removeGroupBullet(
                                              group.id,
                                              bullet.id,
                                            )
                                          }
                                        />
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addGroupBullet(group.id)
                                        }
                                        className="text-xs text-blue-600 hover:underline"
                                      >
                                        + Add bullet
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div
                                className="w-44 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ScoreSlider
                                  side
                                  min={0}
                                  max={MAX_IMPORTANCE}
                                  label="Importance"
                                  value={importance}
                                  valueLabel={formatImportanceSliderValue(
                                    importance,
                                  )}
                                  reason={mergeReason}
                                  onChange={(score) =>
                                    onAnalysisChange(
                                      updateMergeGroup(analysis, group.id, {
                                        relevance_score: score,
                                      }),
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUnmergeExperience(group.id)
                                  }
                                  className={`mt-1 text-xs ${theme.button}`}
                                >
                                  Unmerge
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {sortedItems.map((item) => {
                        const source = getExperienceItemById(
                          biography,
                          item.category,
                          item.id,
                        );
                        const name = getExperienceDisplayName(
                          source,
                          item.category,
                        );
                        const rawKey = `exp-raw-${item.id}`;
                        const importance = getExperienceImportance(item);
                        const selected = categorySelection.has(item.id);
                        const excludedDefault = !isExperienceIncluded(item);
                        const folded = foldedIds.has(item.id);
                        const bullets = normalizeBullets(item.bullets, item.id);
                        const generatedBullets =
                          generatedTexts?.experiences[item.id]?.bullets;
                        const totalIncluded = bullets.filter(
                          (bullet) => bullet.importance > 0,
                        ).length;
                        const placed = placedBulletCounts[item.id];

                        return (
                          <div
                            key={item.id}
                            data-content-id={item.id}
                            className={`rounded border px-2 py-1.5 transition-shadow cursor-pointer ${
                              excludedDefault
                                ? "border-zinc-100 bg-zinc-50 opacity-60"
                                : selected
                                  ? "border-violet-300 bg-violet-50"
                                  : "border-zinc-200 bg-white"
                            }`}
                            onClick={() => onContentItemClick?.(item.id)}
                          >
                            <div className="flex gap-2 items-start">
                              <FoldToggle
                                folded={folded}
                                onToggle={() => toggleFold(item.id)}
                              />
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <label
                                    className="inline-flex items-center gap-1 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() =>
                                        toggleMergeSelection(cat, item.id)
                                      }
                                      className="h-3.5 w-3.5 rounded border-zinc-300"
                                    />
                                    <span className="text-xs text-zinc-500">
                                      Combine
                                    </span>
                                  </label>
                                  <p className="text-sm font-medium text-zinc-900 leading-snug">
                                    {name}
                                  </p>
                                </div>

                                {!folded && (
                                  <div
                                    className="space-y-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ScoreSlider
                                      min={0}
                                      max={MAX_IMPORTANCE}
                                      label="Importance"
                                      value={importance}
                                      valueLabel={formatImportanceSliderValue(
                                        importance,
                                      )}
                                      reason={item.reason}
                                      onChange={(score) =>
                                        updateExperienceImportance(
                                          item.id,
                                          score,
                                        )
                                      }
                                    />

                                    <button
                                      type="button"
                                      onClick={() => toggleRaw(rawKey)}
                                      className="text-sm text-blue-600 hover:underline"
                                    >
                                      {expandedRaw.has(rawKey) ? "Hide" : "Show"}{" "}
                                      raw data
                                    </button>
                                    {expandedRaw.has(rawKey) &&
                                      source != null && (
                                        <pre className="text-xs bg-zinc-900 text-zinc-300 rounded p-2 overflow-x-auto max-h-24">
                                          {JSON.stringify(source, null, 2)}
                                        </pre>
                                      )}

                                    {generatedTexts && (
                                      <ExperienceEditFields
                                        text={{
                                          title:
                                            generatedTexts.experiences[item.id]
                                              ?.title ?? "",
                                          organization:
                                            generatedTexts.experiences[item.id]
                                              ?.organization ?? "",
                                          location:
                                            generatedTexts.experiences[item.id]
                                              ?.location ?? "",
                                          dateRange:
                                            generatedTexts.experiences[item.id]
                                              ?.dateRange ??
                                            getExperienceDateMeta(
                                              biography,
                                              item,
                                            ),
                                        }}
                                        onChange={(update) =>
                                          updateExperienceText(item.id, update)
                                        }
                                      />
                                    )}

                                    <div className="space-y-1">
                                      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
                                        Bullets
                                      </p>
                                      {placed != null &&
                                        placed < totalIncluded && (
                                          <p className="text-[10px] text-amber-700">
                                            Only {placed} of {totalIncluded}{" "}
                                            bullets fit on the page
                                          </p>
                                        )}
                                      {bullets.map((bullet) => (
                                        <BulletRow
                                          key={bullet.id}
                                          importance={bullet.importance}
                                          topic={bullet.topic}
                                          text={
                                            generatedBullets?.[bullet.id] ??
                                            bullet.text ??
                                            ""
                                          }
                                          onImportanceChange={(value) =>
                                            updateExperienceBulletField(
                                              item.id,
                                              bullet.id,
                                              { importance: value },
                                            )
                                          }
                                          onTopicChange={(value) =>
                                            updateExperienceBulletField(
                                              item.id,
                                              bullet.id,
                                              { topic: value },
                                            )
                                          }
                                          onTextChange={(value) =>
                                            updateExperienceBulletText(
                                              item.id,
                                              bullet.id,
                                              value,
                                            )
                                          }
                                          onRemove={() =>
                                            removeExperienceBullet(
                                              item.id,
                                              bullet.id,
                                            )
                                          }
                                        />
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addExperienceBullet(item.id)
                                        }
                                        className="text-xs text-blue-600 hover:underline"
                                      >
                                        + Add bullet
                                      </button>
                                    </div>

                                    {generatedTexts && (
                                      <div>
                                        <p className="text-[11px] font-medium text-zinc-500 mb-0.5">
                                          Numbers check
                                        </p>
                                        <NumberEvidenceList
                                          items={validateNumbersAgainstSource(
                                            [
                                              generatedTexts.experiences[
                                                item.id
                                              ]?.title ?? "",
                                              generatedTexts.experiences[
                                                item.id
                                              ]?.dateRange ?? "",
                                              ...Object.values(
                                                generatedTexts.experiences[
                                                  item.id
                                                ]?.bullets ?? {},
                                              ),
                                            ].join("\n"),
                                            sourceTextFromUnknown(source),
                                          )}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div data-content-id="attributes">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                Attributes
              </h3>
              {selectedAttributes.size >= 2 && analysis && (
                <button
                  type="button"
                  onClick={() => {
                    onAnalysisChange(
                      addAttributeMergeGroup(analysis, [...selectedAttributes]),
                    );
                    setSelectedAttributes(new Set());
                  }}
                  className="rounded bg-violet-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-violet-700"
                >
                  Combine {selectedAttributes.size} selected
                </button>
              )}
            </div>

            {attributeMerges.length > 0 && (
              <div className="space-y-1 mb-3">
                {attributeMerges.map((group) => {
                  const title =
                    generatedTexts?.attributes?.[group.id]?.title ??
                    group.title ??
                    getAttributeMergeLabel(
                      biography,
                      analysis,
                      group.member_ids,
                    );
                  const rawKey = `attr-raw-${group.id}`;
                  const memberSources = group.member_ids
                    .map((id) => {
                      const item = analysis.attribute_analysis.find(
                        (entry) => entry.id === id,
                      );
                      if (!item) return null;
                      return getAttributeItemById(
                        biography,
                        item.category,
                        item.id,
                      );
                    })
                    .filter(Boolean);
                  const memberItems = group.member_ids
                    .map((id) =>
                      analysis.attribute_analysis.find(
                        (entry) => entry.id === id,
                      ),
                    )
                    .filter(
                      (entry): entry is AttributeAnalysisItem => entry != null,
                    );
                  const mergeReason = getAttributeMergeReason(
                    biography,
                    analysis,
                    group,
                  );

                  return (
                    <div
                      key={group.id}
                      data-content-id={group.id}
                      className="rounded border border-violet-200 bg-violet-50 px-2 py-1.5 cursor-pointer"
                      onClick={() => onContentItemClick?.(group.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="min-w-0 flex-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            value={title}
                            onChange={(e) =>
                              updateAttributeTitle(group.id, e.target.value)
                            }
                            className="w-full rounded border border-violet-200 bg-white px-2 py-1 text-sm"
                            placeholder="Attribute row title"
                          />
                          <div className="mt-1 space-y-1">
                            {memberItems.map((item) => {
                              const source = getAttributeItemById(
                                biography,
                                item.category,
                                item.id,
                              );
                              const fallback = getAttributeDisplayName(
                                source,
                                item.category,
                              );
                              const value =
                                generatedTexts?.attributes?.[group.id]?.items?.[
                                  item.id
                                ] ?? fallback;
                              return (
                                <input
                                  key={item.id}
                                  value={value}
                                  onChange={(e) =>
                                    updateAttributeItemText(
                                      group.id,
                                      item.id,
                                      e.target.value,
                                      title,
                                    )
                                  }
                                  className="w-full rounded border border-violet-100 bg-white px-2 py-1 text-xs"
                                  placeholder="Attribute item"
                                />
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleRaw(rawKey)}
                            className="text-sm text-blue-600 hover:underline mt-1"
                          >
                            {expandedRaw.has(rawKey) ? "Hide" : "Show"} raw data
                          </button>
                          {expandedRaw.has(rawKey) &&
                            memberSources.length > 0 && (
                              <pre className="mt-1 text-xs bg-zinc-900 text-zinc-300 rounded p-2 overflow-x-auto max-h-40">
                                {JSON.stringify(memberSources, null, 2)}
                              </pre>
                            )}
                        </div>
                        <div
                          className="w-44 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="text-xs text-zinc-500 leading-snug whitespace-pre-wrap">
                            {mergeReason}
                          </p>
                          <button
                            type="button"
                            className="text-[10px] text-violet-700 hover:underline mt-1"
                            onClick={() =>
                              onAnalysisChange(
                                removeAttributeMergeGroup(analysis, group.id),
                              )
                            }
                          >
                            Unmerge
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3">
              {sortedAttributeCategories.map((cat) => {
                const items = (attributeGroups?.get(cat) ?? []).filter(
                  (item) => !mergedAttributeIds.has(item.id),
                );
                const sortedItems = sortAttributeItems(biography, items);
                const maxImportance = Math.max(
                  ...items.map((item) => item.relevance_score),
                  0,
                );
                const categoryIncluded =
                  maxImportance > 0 &&
                  shouldIncludeAttributeCategory(analysis, cat);
                const visibleOnCv = categoryIncluded;
                const sectionId = `cat:${cat}`;
                const sectionTitle =
                  generatedTexts?.attributes?.[sectionId]?.title ??
                  getCategoryLabel(analysis, cat);

                return (
                  <div
                    key={cat}
                    data-content-id={sectionId}
                    className={`rounded-lg border p-2 ${
                      visibleOnCv
                        ? "border-zinc-200 bg-zinc-50"
                        : "border-zinc-100 bg-zinc-50 opacity-70"
                    }`}
                  >
                    <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={sectionTitle}
                        onChange={(e) =>
                          updateAttributeTitle(sectionId, e.target.value)
                        }
                        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm font-medium"
                        placeholder="Attribute row title"
                      />
                    </div>
                    <ScoreSlider
                      compact
                      label="Order"
                      min={1}
                      max={20}
                      value={getCategoryOrder(analysis, cat)}
                      valueLabel={`Order ${getCategoryOrder(analysis, cat)}`}
                      reason={
                        visibleOnCv
                          ? getCategoryReason(analysis, cat) ||
                            `Shown (max item importance ${maxImportance})`
                          : maxImportance <= 0
                            ? "Hidden — all items importance 0"
                            : "Hidden — category max score is not higher than any other attribute item"
                      }
                      commitOnRelease
                      onChange={(order) =>
                        updateCategoryOrder(cat, order, "attribute")
                      }
                    />

                    <div className="mt-2 space-y-1 border-t border-zinc-200 pt-2">
                      {sortedItems.map((item) => {
                        const source = getAttributeItemById(
                          biography,
                          item.category,
                          item.id,
                        );
                        const name = getAttributeDisplayName(
                          source,
                          item.category,
                        );
                        const displayName =
                          generatedTexts?.attributes?.[sectionId]?.items?.[
                            item.id
                          ] ?? name;
                        const rawKey = `attr-raw-${item.id}`;
                        const dateMeta = getAttributeDateMeta(
                          biography,
                          item,
                        );
                        const selected = selectedAttributes.has(item.id);

                        return (
                          <div
                            key={item.id}
                            data-content-id={item.id}
                            className={`rounded border px-2 py-1.5 transition-shadow cursor-pointer ${
                              item.relevance_score <= 0
                                ? "border-zinc-100 bg-zinc-50 opacity-60"
                                : selected
                                  ? "border-violet-300 bg-violet-50"
                                  : "border-zinc-200 bg-white"
                            }`}
                            onClick={() => onContentItemClick?.(item.id)}
                          >
                            <div className="flex gap-3 items-start">
                              <div className="min-w-0 flex-1">
                                <label
                                  className="inline-flex items-center gap-1.5 mb-0.5 cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() =>
                                      toggleAttributeSelection(item.id)
                                    }
                                    className="h-3.5 w-3.5 rounded border-zinc-300"
                                  />
                                  <span className="text-xs text-zinc-500">
                                    Combine
                                  </span>
                                </label>
                                <div onClick={(e) => e.stopPropagation()}>
                                  <input
                                    value={displayName}
                                    onChange={(e) =>
                                      updateAttributeItemText(
                                        sectionId,
                                        item.id,
                                        e.target.value,
                                        sectionTitle,
                                      )
                                    }
                                    className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm font-medium text-zinc-900"
                                    placeholder="Attribute name"
                                  />
                                </div>
                                {dateMeta && (
                                  <p className="text-sm text-zinc-500">
                                    {dateMeta}
                                  </p>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRaw(rawKey);
                                  }}
                                  className="text-sm text-blue-600 hover:underline mt-0.5"
                                >
                                  {expandedRaw.has(rawKey) ? "Hide" : "Show"}{" "}
                                  raw data
                                </button>
                                {expandedRaw.has(rawKey) &&
                                  source != null && (
                                    <pre
                                      className="mt-1 text-xs bg-zinc-900 text-zinc-300 rounded p-2 overflow-x-auto max-h-24"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {JSON.stringify(source, null, 2)}
                                    </pre>
                                  )}
                              </div>
                              <div
                                className="w-40 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ScoreSlider
                                  side
                                  min={0}
                                  max={MAX_IMPORTANCE}
                                  label="Importance"
                                  value={item.relevance_score}
                                  valueLabel={formatImportanceSliderValue(
                                    item.relevance_score,
                                  )}
                                  reason={item.reason}
                                  onChange={(score) =>
                                    updateAttributeScore(item.id, score)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
