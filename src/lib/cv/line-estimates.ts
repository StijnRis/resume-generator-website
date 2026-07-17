import type { RenderedCv } from "@/lib/types";

function estimateLines(text: string, charsPerLine = 72): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

export function estimateExperienceLines(
  entry: RenderedCv["experiences"][0],
): number {
  let lines = 2.5;
  lines += entry.bulletPoints.length * 1.55;
  return lines;
}

export function estimateAttributeLines(itemCount: number): number {
  if (itemCount === 0) return 0;
  return 1.2 + Math.ceil(itemCount / 8);
}

export function estimateSummaryLines(summary: string | undefined): number {
  if (!summary) return 3;
  return Math.max(3, 2.5 + estimateLines(summary));
}

export const CATEGORY_HEADER_LINES = 3.5;
