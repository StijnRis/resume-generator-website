"use client";

import { useEffect, useRef, useState } from "react";

import {
  fitAndPaginateCv,
  type CvPage,
} from "@/lib/cv/measure-fit";
import type { HighLevelAnalysis, RenderedCv } from "@/lib/types";

interface UseMeasuredCvFitResult {
  fittedCv: RenderedCv | null;
  pages: CvPage[];
  measuring: boolean;
}

export function useMeasuredCvFit(
  draft: RenderedCv | null,
  analysis: HighLevelAnalysis | null,
  pageCount: number,
  isPlaceholder: boolean,
): UseMeasuredCvFitResult {
  const [fittedCv, setFittedCv] = useState<RenderedCv | null>(null);
  const [pages, setPages] = useState<CvPage[]>([]);
  const [measuring, setMeasuring] = useState(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!draft || !analysis) {
      setFittedCv(null);
      setPages([]);
      setMeasuring(false);
      return;
    }

    const runId = ++runIdRef.current;
    setFittedCv(null);
    setPages([]);
    setMeasuring(true);

    // Defer so measurement never runs inside React render/commit.
    const timer = window.setTimeout(() => {
      const result = fitAndPaginateCv(
        draft,
        analysis,
        pageCount,
        isPlaceholder,
      );

      if (runId !== runIdRef.current) return;

      setFittedCv(result.cv);
      setPages(result.pages ?? []);
      setMeasuring(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      runIdRef.current += 1;
    };
  }, [draft, analysis, pageCount, isPlaceholder]);

  return {
    fittedCv: measuring ? null : fittedCv,
    pages: measuring ? [] : (pages ?? []),
    measuring,
  };
}
