export interface ParsedDateParts {
  normalized: string;
  annotation: string | null;
}

function normalizeDateCore(trimmed: string): string {
  if (!trimmed) return "";

  const yearMonth = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (yearMonth) {
    const [, year, month] = yearMonth;
    return `${year}-${month.padStart(2, "0")}`;
  }

  const yearMonthDay = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yearMonthDay) {
    const [, year, month, day] = yearMonthDay;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) return yearOnly[1];

  const datePrefix = trimmed.match(/^(\d{4}(?:-\d{1,2}(?:-\d{1,2})?)?)/);
  if (datePrefix) return normalizeDateCore(datePrefix[1]);

  return trimmed;
}

export function parseDateParts(
  dateStr: string | null | undefined,
): ParsedDateParts {
  if (dateStr == null) {
    return { normalized: "", annotation: null };
  }

  const trimmed = String(dateStr).trim();
  if (!trimmed) {
    return { normalized: "", annotation: null };
  }

  const annotationMatch = trimmed.match(/\s*\(([^)]+)\)\s*$/i);
  const annotation = annotationMatch?.[1]?.trim() ?? null;
  const withoutAnnotation = trimmed.replace(/\s*\([^)]*\)\s*$/i, "").trim();

  return {
    normalized: normalizeDateCore(withoutAnnotation),
    annotation,
  };
}

export function normalizeDateString(
  dateStr: string | null | undefined,
): string {
  return parseDateParts(dateStr).normalized;
}

import { monthNamesForLanguage, type CvUiLabels } from "@/lib/formatting/ui-labels";

export interface DateFormatOptions {
  language?: string | null;
  labels?: Pick<CvUiLabels, "present" | "starting" | "expected"> | null;
}

function presentWord(options?: DateFormatOptions | null): string {
  return options?.labels?.present?.trim() || "present";
}

function startingWord(options?: DateFormatOptions | null): string {
  return options?.labels?.starting?.trim() || "Starting";
}

function expectedWord(options?: DateFormatOptions | null): string {
  return options?.labels?.expected?.trim() || "exp.";
}

function formatAnnotation(
  annotation: string | null,
  options?: DateFormatOptions | null,
): string | null {
  if (!annotation) return null;
  if (/^expected$/i.test(annotation.trim())) return expectedWord(options);
  return annotation.trim();
}

function formatNormalizedDate(
  normalized: string,
  options?: DateFormatOptions | null,
): string {
  if (!normalized) return presentWord(options);

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (isoMatch) {
    const [, year, month] = isoMatch;
    const monthNames = monthNamesForLanguage(options?.language);
    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${monthNames[monthIndex]} ${year}`;
    }
    return year;
  }

  const yearOnly = normalized.match(/^(\d{4})$/);
  if (yearOnly) return yearOnly[1];

  return normalized;
}

export function formatDate(
  dateStr: string | null | undefined,
  options?: DateFormatOptions | null,
): string {
  const { normalized, annotation } = parseDateParts(dateStr);
  if (!normalized) return presentWord(options);

  const formatted = formatNormalizedDate(normalized, options);
  const note = formatAnnotation(annotation, options);
  return note ? `${formatted} (${note})` : formatted;
}

/** True when the date is after the current month (month-precision). */
export function isFutureDate(dateStr: string | null | undefined): boolean {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const yearMonth = normalized.match(/^(\d{4})-(\d{2})/);
  if (yearMonth) {
    const year = parseInt(yearMonth[1], 10);
    const month = parseInt(yearMonth[2], 10);
    return year > currentYear || (year === currentYear && month > currentMonth);
  }

  const yearOnly = normalized.match(/^(\d{4})$/);
  if (yearOnly) {
    return parseInt(yearOnly[1], 10) > currentYear;
  }

  return false;
}

/** True when the date is empty/null or after the current month. */
export function isFutureOrPresentDate(
  dateStr: string | null | undefined,
): boolean {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return true;
  return isFutureDate(dateStr);
}

/** Ongoing / current role: no end date, or end is present/future. */
export function isOngoingExperience(
  endDate?: string | null,
): boolean {
  return isFutureOrPresentDate(endDate);
}

function extractYear(normalized: string): number | null {
  const match = normalized.match(/^(\d{4})/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function yearMonthKey(normalized: string): string | null {
  const ym = normalized.match(/^(\d{4})-(\d{2})/);
  if (ym) return `${ym[1]}-${ym[2]}`;
  const yearOnly = normalized.match(/^(\d{4})$/);
  if (yearOnly) return yearOnly[1];
  return null;
}

/** Month-precision span; open-ended / Present uses the current month. */
function dateSpanMonths(
  startDate: string,
  endDate?: string | null,
): number | null {
  const startNorm = normalizeDateString(startDate);
  const startParts = startNorm.match(/^(\d{4})(?:-(\d{2}))?/);
  if (!startParts) return null;

  const startYear = parseInt(startParts[1], 10);
  const startMonth = startParts[2] ? parseInt(startParts[2], 10) : 1;

  const openEnded =
    endDate == null ||
    endDate === "" ||
    /^present$/i.test(String(endDate).trim()) ||
    isFutureOrPresentDate(endDate);

  let endYear: number;
  let endMonth: number;
  if (openEnded) {
    const now = new Date();
    endYear = now.getFullYear();
    endMonth = now.getMonth() + 1;
  } else {
    const endNorm = normalizeDateString(endDate);
    const endParts = endNorm.match(/^(\d{4})(?:-(\d{2}))?/);
    if (!endParts) return null;
    endYear = parseInt(endParts[1], 10);
    endMonth = endParts[2] ? parseInt(endParts[2], 10) : 12;
  }

  return (endYear - startYear) * 12 + (endMonth - startMonth);
}

export function formatDateRange(
  startDate: string,
  endDate?: string | null,
  options?: DateFormatOptions | null,
): string {
  const startNorm = normalizeDateString(startDate);

  // Upcoming / future start → "Starting Mon YYYY"
  if (startNorm && isFutureDate(startDate)) {
    return `${startingWord(options)} ${formatDate(startDate, options)}`;
  }

  const openEnded =
    endDate == null ||
    endDate === "" ||
    /^present$/i.test(String(endDate).trim()) ||
    isFutureOrPresentDate(endDate);
  const endNorm = openEnded ? "" : normalizeDateString(endDate);

  // Same month (or same year-only) → single date, no range
  const startKey = yearMonthKey(startNorm);
  const endKey = yearMonthKey(endNorm);
  if (!openEnded && startKey && endKey && startKey === endKey) {
    return formatDate(startDate, options);
  }

  const spanMonths = dateSpanMonths(startDate, endDate);

  // Longer than 1 year (Present counted from today) → years only
  if (spanMonths != null && spanMonths > 12) {
    const startYear = extractYear(startNorm);
    if (startYear != null) {
      const endLabel = openEnded
        ? presentWord(options)
        : String(extractYear(endNorm) ?? formatDate(endDate, options));
      return `${startYear} – ${endLabel}`;
    }
  }

  const start = formatDate(startDate, options);
  const end = openEnded ? presentWord(options) : formatDate(endDate, options);
  return `${start} – ${end}`;
}

export function parseDateForSort(dateStr: string | null | undefined): number {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return Date.now();

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (isoMatch) {
    const day = isoMatch[3] ?? "01";
    return new Date(`${isoMatch[1]}-${isoMatch[2]}-${day}`).getTime();
  }

  const yearMatch = normalized.match(/^(\d{4})$/);
  if (yearMatch) {
    return new Date(`${yearMatch[1]}-01-01`).getTime();
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatMergedDateRange(
  starts: string[],
  ends: (string | null | undefined)[],
  options?: DateFormatOptions | null,
): string {
  const normalizedStarts = starts
    .map(normalizeDateString)
    .filter(Boolean)
    .sort();
  const normalizedEnds = ends
    .map((end) => normalizeDateString(end))
    .filter(Boolean)
    .sort();

  if (normalizedStarts.length === 0) return "";

  const earliestStart = normalizedStarts[0];
  const hasOpenOrFutureEnd = ends.some(
    (end) => !normalizeDateString(end) || isFutureOrPresentDate(end),
  );
  const latestEnd = hasOpenOrFutureEnd
    ? null
    : normalizedEnds.length > 0
      ? normalizedEnds[normalizedEnds.length - 1]
      : normalizedStarts[normalizedStarts.length - 1];

  return formatDateRange(earliestStart, latestEnd, options);
}
