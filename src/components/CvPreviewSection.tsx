"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CvTemplate } from "@/components/CvTemplate";
import { buildFinalCv, buildPlaceholderCv } from "@/lib/cv/assemble";
import { CV_PAGE_HEIGHT_MM, CV_PAGE_WIDTH_MM } from "@/lib/cv/page-geometry";
import { getMmToPx } from "@/lib/cv/measure-fit";
import { downloadCvPdf } from "@/lib/cv/pdf-export";
import { useMeasuredCvFit } from "@/hooks/use-measured-cv-fit";
import type {
  Biography,
  GeneratedCvTexts,
  HighLevelAnalysis,
  RenderedCv,
} from "@/lib/types";

interface CvPreviewSectionProps {
  biography: Biography | null;
  analysis: HighLevelAnalysis | null;
  generatedTexts: GeneratedCvTexts | null;
  loading?: boolean;
  pageCount: number;
  onExperienceClick?: (id: string) => void;
  scrollToId?: string | null;
  onScrollHandled?: () => void;
  onPlacedBulletCountsChange?: (counts: Record<string, number>) => void;
  compact?: boolean;
}

export function CvPreviewSection({
  biography,
  analysis,
  generatedTexts,
  loading = false,
  pageCount,
  onExperienceClick,
  scrollToId = null,
  onScrollHandled,
  onPlacedBulletCountsChange,
  compact = false,
}: CvPreviewSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(1);
  const [mmToPx, setMmToPx] = useState(3.7795275591);

  const draftCv: RenderedCv | null = useMemo(() => {
    if (!biography || !analysis) return null;
    if (generatedTexts) {
      return buildFinalCv(biography, analysis, generatedTexts);
    }
    return buildPlaceholderCv(biography, analysis);
  }, [biography, analysis, generatedTexts]);

  const isPlaceholder = !generatedTexts;

  const {
    fittedCv: displayCv,
    pages = [],
    measuring,
  } = useMeasuredCvFit(draftCv, analysis, pageCount, isPlaceholder);

  useEffect(() => {
    if (!onPlacedBulletCountsChange) return;
    if (!displayCv) {
      onPlacedBulletCountsChange({});
      return;
    }
    const counts: Record<string, number> = {};
    for (const entry of displayCv.experiences) {
      counts[entry.id] = entry.bulletPoints.length;
    }
    onPlacedBulletCountsChange(counts);
  }, [displayCv, onPlacedBulletCountsChange]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const updateScale = () => {
      const mm = getMmToPx();
      setMmToPx(mm);
      const pageWidthPx = mm * CV_PAGE_WIDTH_MM;
      const pageHeightPx = mm * CV_PAGE_HEIGHT_MM;
      const availableWidth = Math.max(0, el.clientWidth - 8);
      const availableHeight = Math.max(0, el.clientHeight - 8);
      if (pageWidthPx <= 0 || availableWidth <= 0) {
        setScale(1);
        return;
      }
      const next = Math.min(
        1,
        availableWidth / pageWidthPx,
        availableHeight / pageHeightPx,
      );
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayCv, pages.length]);

  useEffect(() => {
    if (!scrollToId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-cv-id="${CSS.escape(scrollToId)}"]`,
    );
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-blue-400", "rounded-sm");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-blue-400", "rounded-sm");
      }, 1200);
    }
    onScrollHandled?.();
  }, [scrollToId, onScrollHandled]);

  const handleDownloadPdf = async () => {
    const element = scrollRef.current?.querySelector(".cv-document");
    if (!element || !(element instanceof HTMLElement) || !displayCv) return;

    setDownloading(true);
    try {
      const safeName = displayCv.basics.name
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^\w\-]+/g, "");
      await downloadCvPdf(element, `resume_${safeName || "resume"}.pdf`);
    } catch (error) {
      console.error("[CvPreviewSection] PDF download failed:", error);
    } finally {
      setDownloading(false);
    }
  };

  const pageWidthPx = mmToPx * CV_PAGE_WIDTH_MM;
  const pageHeightPx = mmToPx * CV_PAGE_HEIGHT_MM;
  const pageGapPx = 16;
  const pageCountVisible = Math.max(1, pages.length);
  const naturalHeight =
    pageCountVisible * pageHeightPx +
    Math.max(0, pageCountVisible - 1) * pageGapPx;

  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm h-full flex flex-col min-h-0 ${
        compact ? "p-3" : "p-6"
      }`}
    >
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Resume</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {loading
              ? "Generating texts..."
              : measuring
                ? "Updating layout..."
                : displayCv
                  ? `Updates live · up to ${pageCount} page${pageCount === 1 ? "" : "s"}`
                  : "Run Analyze to preview the resume"}
          </p>
        </div>
        {displayCv && (
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            {downloading ? "Opening print..." : "Print / Save PDF"}
          </button>
        )}
      </div>

      {!displayCv && !measuring && (
        <p className="text-sm text-zinc-500">
          Complete Analyze to see a resume preview here.
        </p>
      )}

      <div ref={measureRef} className="flex-1 min-h-0 overflow-hidden">
        {displayCv && (pages?.length ?? 0) > 0 && (
          <div
            ref={scrollRef}
            className="h-full overflow-auto bg-zinc-100 rounded-lg p-2"
          >
            <div
              style={{
                width: pageWidthPx * scale,
                height: naturalHeight * scale,
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  width: pageWidthPx,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <CvTemplate
                  cv={displayCv}
                  pages={pages ?? []}
                  isPlaceholder={isPlaceholder}
                  onExperienceClick={onExperienceClick}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
