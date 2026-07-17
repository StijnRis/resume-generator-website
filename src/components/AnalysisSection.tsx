"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatExperienceSliderValue,
  formatImportanceSliderValue,
  getExperienceBulletCount,
  getExperienceImportance,
  isExperienceIncluded,
  MAX_EXPERIENCE_BULLETS,
  MAX_IMPORTANCE,
} from "@/lib/analysis/experience-score";
import { getMergeColorTheme } from "@/lib/analysis/merge-colors";
import {
  addAttributeMergeGroup,
  getAttributeMergeGroups,
  getAttributeMergeLabel,
  getMemberIdsInAttributeMerges,
  removeAttributeMergeGroup,
} from "@/lib/analysis/attribute-merges";
import {
  addMergeGroup,
  getMemberIdsInMerges,
  getMergeGroupsForCategory,
  getSuggestedMergeLabel,
  removeMergeGroup,
  suggestMergeGroupsForCategory,
  updateMergeGroup,
} from "@/lib/analysis/merges";
import {
  CATEGORY_LABELS,
  groupAttributeAnalysis,
  groupExperienceAnalysis,
  getAttributeDisplayName,
  getAttributeItemById,
  getCategoryOrder,
  getCategoryReason,
  getExperienceDisplayName,
  getExperienceItemById,
} from "@/lib/biography/lookup";
import { formatDate, formatDateRange, parseDateForSort } from "@/lib/formatting/dates";
import type {
  AttributeAnalysisItem,
  AttributeCategoryKey,
  Biography,
  BiographyCategoryKey,
  ExperienceAnalysisItem,
  ExperienceCategoryKey,
  GeneratedCvTexts,
  HighLevelAnalysis,
} from "@/lib/types";
import { ScoreSlider } from "@/components/ScoreSlider";
import { NumberEvidenceList } from "@/components/NumberEvidenceList";
import {
  sourceTextFromUnknown,
  validateNumbersAgainstSource,
} from "@/lib/validation/numbers";

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

const EXPERIENCE_CATEGORY_ORDER: ExperienceCategoryKey[] = [
  "work",
  "education",
  "volunteer",
  "extracurriculars",
  "events",
  "research",
  "projects",
];

const ATTRIBUTE_CATEGORY_ORDER: AttributeCategoryKey[] = [
  "skills",
  "tools",
  "interests",
  "certificates",
  "awards",
  "publications",
  "references",
  "languages",
];

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

function getAttributeSortDate(
  category: AttributeCategoryKey,
  source: unknown,
): number {
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
  const [expandedLlm, setExpandedLlm] = useState<Set<string>>(new Set());
  const [translationsOpen, setTranslationsOpen] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<
    Record<string, Set<string>>
  >({});
  const [selectedAttributes, setSelectedAttributes] = useState<Set<string>>(
    new Set(),
  );
  const listRef = useRef<HTMLDivElement>(null);

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

  const toggleLlm = (id: string) => {
    setExpandedLlm((prev) => {
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
      summary: string;
      bullet_points: string[];
      organization: string;
      location: string;
    }>,
  ) => {
    if (!generatedTexts || !onGeneratedTextsChange) return;
    const current = generatedTexts.experiences[id] ?? {
      summary: "",
      bullet_points: [],
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

  const updateSummaryText = (summary: string) => {
    if (!generatedTexts || !onGeneratedTextsChange) return;
    onGeneratedTextsChange({ ...generatedTexts, summary });
  };

  const updateAttributeTitle = (sectionId: string, title: string) => {
    if (!generatedTexts || !onGeneratedTextsChange) return;
    onGeneratedTextsChange({
      ...generatedTexts,
      attributes: {
        ...(generatedTexts.attributes ?? {}),
        [sectionId]: {
          ...(generatedTexts.attributes?.[sectionId] ?? { title: "" }),
          title,
        },
      },
    });
  };

  const updateSectionTitle = (
    category: ExperienceCategoryKey,
    title: string,
  ) => {
    if (!generatedTexts || !onGeneratedTextsChange) return;
    onGeneratedTextsChange({
      ...generatedTexts,
      uiLabels: {
        ...(generatedTexts.uiLabels ?? {}),
        sectionTitles: {
          ...(generatedTexts.uiLabels?.sectionTitles ?? {}),
          [category]: title,
        },
      },
    });
  };

  const ensureExperienceText = (id: string) => {
    if (!generatedTexts || !onGeneratedTextsChange) return;
    if (generatedTexts.experiences[id]) return;
    onGeneratedTextsChange({
      ...generatedTexts,
      experiences: {
        ...generatedTexts.experiences,
        [id]: { summary: "", bullet_points: [], title: "" },
      },
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

  const toggleMergeSelection = (category: ExperienceCategoryKey, id: string) => {
    setSelectedForMerge((prev) => {
      const next = { ...prev };
      const categorySet = new Set(next[category] ?? []);
      if (categorySet.has(id)) categorySet.delete(id);
      else categorySet.add(id);
      next[category] = categorySet;
      return next;
    });
  };

  const getCategorySelection = (category: ExperienceCategoryKey): Set<string> =>
    selectedForMerge[category] ?? new Set();

  const clearCategorySelection = (category: ExperienceCategoryKey) => {
    setSelectedForMerge((prev) => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  };

  const updateCategoryOrder = (category: string, order: number) => {
    if (!analysis) return;
    const exists = analysis.category_analysis.some(
      (c) => c.category === category,
    );
    onAnalysisChange({
      ...analysis,
      category_analysis: exists
        ? analysis.category_analysis.map((c) =>
            c.category === category ? { ...c, relevance_score: order } : c,
          )
        : [
            ...analysis.category_analysis,
            {
              category: category as BiographyCategoryKey,
              relevance_score: order,
              reason: "",
            },
          ],
    });
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

  const updateExperienceBullets = (id: string, bullets: number) => {
    if (!analysis) return;
    onAnalysisChange({
      ...analysis,
      experience_analysis: analysis.experience_analysis.map((e) =>
        e.id === id ? { ...e, suggested_bullet_points: bullets } : e,
      ),
    });
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

  const handleCombineSelected = (category: ExperienceCategoryKey) => {
    if (!analysis) return;
    const selected = getCategorySelection(category);
    if (selected.size < 2) return;
    onAnalysisChange(
      addMergeGroup(analysis, category, Array.from(selected)),
    );
    clearCategorySelection(category);
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
    return EXPERIENCE_CATEGORY_ORDER.filter((cat) => {
      const items = experienceGroups?.get(cat) ?? [];
      return items.length > 0;
    }).sort(
      (a, b) => getCategoryOrder(analysis, a) - getCategoryOrder(analysis, b),
    );
  }, [analysis, experienceGroups]);

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
          <p className="text-sm text-zinc-500 mt-0.5">
            Importance: 0 = excluded, 1–100 = page priority. Adjust sliders to
            update the CV live. Regenerate texts when bullet counts change.
          </p>
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
                  ? "Bullet counts changed — regenerate AI texts"
                  : "No bullet-count changes since last generation"
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
          Importance scoring and CV texts are generated in one step.
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
              <p className="text-sm font-semibold text-zinc-700 mb-1">
                Professional summary
              </p>
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
                        ...(entry.bullet_points ?? []),
                      ])
                      .join("\n"),
                  )}
                  emptyLabel="No numbers in summary."
                />
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
                  categoryMerges.some(
                    (group) =>
                      (group.relevance_score ??
                        Math.max(
                          0,
                          ...group.member_ids.map((id) => {
                            const member = analysis.experience_analysis.find(
                              (entry) => entry.id === id,
                            );
                            return member
                              ? getExperienceImportance(member)
                              : 0;
                          }),
                        )) > 0,
                  );

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
                        value={
                          generatedTexts?.uiLabels?.sectionTitles?.[cat] ??
                          CATEGORY_LABELS[cat]
                        }
                        onChange={(e) =>
                          updateSectionTitle(cat, e.target.value)
                        }
                        disabled={!generatedTexts}
                        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm font-medium disabled:bg-zinc-50 disabled:text-zinc-500"
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
                            : "All items excluded — hidden on CV"
                        }
                        commitOnRelease
                        onChange={(order) => updateCategoryOrder(cat, order)}
                      />
                    </div>

                    {suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {suggestions.map((memberIds) => (
                          <button
                            key={memberIds.join("-")}
                            type="button"
                            onClick={() =>
                              onAnalysisChange(
                                addMergeGroup(analysis, cat, memberIds),
                              )
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
                        const importance =
                          group.relevance_score ??
                          Math.max(...members.map(getExperienceImportance));
                        const bullets =
                          group.suggested_bullet_points ??
                          Math.max(...members.map(getExperienceBulletCount));
                        const theme = getMergeColorTheme(group.id);
                        const excluded = importance <= 0;
                        const llmKey = `exp-llm-${group.id}`;

                        return (
                          <div
                            key={group.id}
                            data-content-id={group.id}
                            className={`rounded border px-2 py-1.5 transition-shadow cursor-pointer ${theme.border} ${theme.bg} ${
                              excluded ? "opacity-60" : ""
                            }`}
                            onClick={() => onContentItemClick?.(group.id)}
                          >
                            <div className="flex gap-3 items-start">
                              <div className="min-w-0 flex-1">
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
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAnalysisChange(
                                        removeMergeGroup(analysis, group.id),
                                      );
                                    }}
                                    className={`text-xs shrink-0 ${theme.button}`}
                                  >
                                    Unmerge
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {members.map((member) => {
                                    const source = getExperienceItemById(
                                      biography,
                                      member.category,
                                      member.id,
                                    );
                                    const memberName = getExperienceDisplayName(
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
                                {generatedTexts && (
                                  <div
                                    className="mt-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        ensureExperienceText(group.id);
                                        toggleLlm(llmKey);
                                      }}
                                      className="text-sm text-emerald-700 hover:underline"
                                    >
                                      {expandedLlm.has(llmKey)
                                        ? "Hide"
                                        : "Show"}{" "}
                                      data
                                    </button>
                                    {expandedLlm.has(llmKey) && (
                                      <div className="mt-1 space-y-1">
                                        <input
                                          value={
                                            generatedTexts.experiences[
                                              group.id
                                            ]?.title ?? ""
                                          }
                                          onChange={(e) =>
                                            updateExperienceText(group.id, {
                                              title: e.target.value,
                                            })
                                          }
                                          placeholder="Title"
                                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
                                        />
                                        <input
                                          value={
                                            generatedTexts.experiences[
                                              group.id
                                            ]?.organization ?? ""
                                          }
                                          onChange={(e) =>
                                            updateExperienceText(group.id, {
                                              organization: e.target.value,
                                            })
                                          }
                                          placeholder="Organization"
                                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
                                        />
                                        <input
                                          value={
                                            generatedTexts.experiences[
                                              group.id
                                            ]?.location ?? ""
                                          }
                                          onChange={(e) =>
                                            updateExperienceText(group.id, {
                                              location: e.target.value,
                                            })
                                          }
                                          placeholder="Location"
                                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
                                        />
                                        <textarea
                                          value={(
                                            generatedTexts.experiences[
                                              group.id
                                            ]?.bullet_points ?? []
                                          ).join("\n")}
                                          onChange={(e) =>
                                            updateExperienceText(group.id, {
                                              bullet_points: e.target.value
                                                .split("\n")
                                                .filter(Boolean),
                                            })
                                          }
                                          placeholder="Bullet points (one per line)"
                                          rows={Math.max(bullets, 1)}
                                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div
                                className="w-40 shrink-0 space-y-1"
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
                                  onChange={(score) =>
                                    onAnalysisChange(
                                      updateMergeGroup(analysis, group.id, {
                                        relevance_score: score,
                                      }),
                                    )
                                  }
                                />
                                <ScoreSlider
                                  side
                                  min={0}
                                  max={MAX_EXPERIENCE_BULLETS}
                                  label="Bullets"
                                  value={bullets}
                                  valueLabel={
                                    placedBulletCounts[group.id] != null &&
                                    placedBulletCounts[group.id] < bullets
                                      ? `${placedBulletCounts[group.id]}/${bullets} on CV`
                                      : formatExperienceSliderValue(bullets)
                                  }
                                  reason={
                                    placedBulletCounts[group.id] != null &&
                                    placedBulletCounts[group.id] < bullets
                                      ? `Only ${placedBulletCounts[group.id]} of ${bullets} bullets fit on the page`
                                      : undefined
                                  }
                                  onChange={(score) =>
                                    onAnalysisChange(
                                      updateMergeGroup(analysis, group.id, {
                                        suggested_bullet_points: score,
                                      }),
                                    )
                                  }
                                />
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
                        const llmKey = `exp-llm-${item.id}`;
                        const bulletCount = getExperienceBulletCount(item);
                        const importance = getExperienceImportance(item);
                        const selected = categorySelection.has(item.id);
                        const excluded = !isExperienceIncluded(item);

                        return (
                          <div
                            key={item.id}
                            data-content-id={item.id}
                            className={`rounded border px-2 py-1.5 transition-shadow cursor-pointer ${
                              excluded
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
                                <p className="text-sm text-zinc-500">
                                  {getExperienceDateMeta(biography, item)}
                                </p>
                                <div
                                  className="flex flex-wrap gap-3 mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleRaw(rawKey)}
                                    className="text-sm text-blue-600 hover:underline"
                                  >
                                    {expandedRaw.has(rawKey) ? "Hide" : "Show"}{" "}
                                    raw data
                                  </button>
                                  {generatedTexts && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        ensureExperienceText(item.id);
                                        toggleLlm(llmKey);
                                      }}
                                      className="text-sm text-emerald-700 hover:underline"
                                    >
                                      {expandedLlm.has(llmKey)
                                        ? "Hide"
                                        : "Show"}{" "}
                                      data
                                    </button>
                                  )}
                                </div>
                                {expandedRaw.has(rawKey) && source != null && (
                                  <pre
                                    className="mt-1 text-xs bg-zinc-900 text-zinc-300 rounded p-2 overflow-x-auto max-h-24"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {JSON.stringify(source, null, 2)}
                                  </pre>
                                )}
                                {expandedLlm.has(llmKey) && generatedTexts && (
                                  <div
                                    className="mt-1 space-y-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      value={
                                        generatedTexts.experiences[item.id]
                                          ?.title ?? ""
                                      }
                                      onChange={(e) =>
                                        updateExperienceText(item.id, {
                                          title: e.target.value,
                                        })
                                      }
                                      placeholder="Title"
                                      className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
                                    />
                                    <input
                                      value={
                                        generatedTexts.experiences[item.id]
                                          ?.organization ?? ""
                                      }
                                      onChange={(e) =>
                                        updateExperienceText(item.id, {
                                          organization: e.target.value,
                                        })
                                      }
                                      placeholder="Organization"
                                      className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
                                    />
                                    <input
                                      value={
                                        generatedTexts.experiences[item.id]
                                          ?.location ?? ""
                                      }
                                      onChange={(e) =>
                                        updateExperienceText(item.id, {
                                          location: e.target.value,
                                        })
                                      }
                                      placeholder="Location"
                                      className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
                                    />
                                    <textarea
                                      value={(
                                        generatedTexts.experiences[item.id]
                                          ?.bullet_points ?? []
                                      ).join("\n")}
                                      onChange={(e) =>
                                        updateExperienceText(item.id, {
                                          bullet_points: e.target.value
                                            .split("\n")
                                            .filter(
                                              (line) => line.trim().length > 0,
                                            ),
                                        })
                                      }
                                      rows={Math.max(
                                        2,
                                        (
                                          generatedTexts.experiences[item.id]
                                            ?.bullet_points ?? []
                                        ).length,
                                      )}
                                      placeholder="One bullet per line"
                                      className="w-full rounded border border-zinc-200 bg-white p-2 text-sm"
                                    />
                                    <NumberEvidenceList
                                      items={validateNumbersAgainstSource(
                                        [
                                          generatedTexts.experiences[item.id]
                                            ?.title ?? "",
                                          ...(generatedTexts.experiences[
                                            item.id
                                          ]?.bullet_points ?? []),
                                        ].join("\n"),
                                        sourceTextFromUnknown(source),
                                      )}
                                    />
                                  </div>
                                )}
                              </div>
                              <div
                                className="w-40 shrink-0 space-y-1"
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
                                  onChange={(score) =>
                                    updateExperienceImportance(item.id, score)
                                  }
                                />
                                <ScoreSlider
                                  side
                                  min={0}
                                  max={MAX_EXPERIENCE_BULLETS}
                                  label="Bullets"
                                  value={bulletCount}
                                  valueLabel={
                                    placedBulletCounts[item.id] != null &&
                                    placedBulletCounts[item.id] < bulletCount
                                      ? `${placedBulletCounts[item.id]}/${bulletCount} on CV`
                                      : formatExperienceSliderValue(bulletCount)
                                  }
                                  reason={
                                    placedBulletCounts[item.id] != null &&
                                    placedBulletCounts[item.id] < bulletCount
                                      ? `Only ${placedBulletCounts[item.id]} of ${bulletCount} bullets fit on the page`
                                      : item.reason
                                  }
                                  onChange={(score) =>
                                    updateExperienceBullets(item.id, score)
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
                  return (
                    <div
                      key={group.id}
                      data-content-id={group.id}
                      className="rounded border border-violet-200 bg-violet-50 px-2 py-1.5 cursor-pointer"
                      onClick={() => onContentItemClick?.(group.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            value={title}
                            onChange={(e) =>
                              updateAttributeTitle(group.id, e.target.value)
                            }
                            className="w-full rounded border border-violet-200 bg-white px-2 py-1 text-sm"
                            placeholder="Attribute row title"
                          />
                          <p className="text-[11px] text-violet-800 mt-1">
                            {getAttributeMergeLabel(
                              biography,
                              analysis,
                              group.member_ids,
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-[10px] text-violet-700 hover:underline shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAnalysisChange(
                              removeAttributeMergeGroup(analysis, group.id),
                            );
                          }}
                        >
                          Unmerge
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3">
              {ATTRIBUTE_CATEGORY_ORDER.filter((cat) => {
                const items = attributeGroups?.get(cat) ?? [];
                return items.length > 0;
              })
                .sort(
                  (a, b) =>
                    getCategoryOrder(analysis, a) -
                    getCategoryOrder(analysis, b),
                )
                .map((cat) => {
                  const items = (attributeGroups?.get(cat) ?? []).filter(
                    (item) => !mergedAttributeIds.has(item.id),
                  );
                  const sortedItems = sortAttributeItems(biography, items);
                  const maxImportance = Math.max(
                    ...items.map((item) => item.relevance_score),
                    0,
                  );
                  const visibleOnCv = maxImportance > 0;
                  const sectionId = `cat:${cat}`;
                  const sectionTitle =
                    generatedTexts?.attributes?.[sectionId]?.title ??
                    CATEGORY_LABELS[cat];

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
                            : "Hidden — all items importance 0"
                        }
                        commitOnRelease
                        onChange={(order) => updateCategoryOrder(cat, order)}
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
                                  <p className="text-sm font-medium text-zinc-900 leading-snug">
                                    {name}
                                  </p>
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
