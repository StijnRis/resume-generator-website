export interface NumberOccurrence {
  raw: string;
  normalized: string;
  start: number;
  end: number;
}

export interface NumberEvidenceItem {
  generated: string;
  generatedContext: string;
  source: string | null;
  sourceContext: string | null;
  matched: boolean;
}

const NUMBER_PATTERN =
  /(?:\$\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|\d+(?:\.\d+)?%?|\d+\+/g;

export function normalizeNumberToken(raw: string): string {
  return raw
    .replace(/\$/g, "")
    .replace(/%/g, "")
    .replace(/\+/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function extractNumbers(text: string): NumberOccurrence[] {
  if (!text) return [];
  const results: NumberOccurrence[] = [];
  const re = new RegExp(NUMBER_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) != null) {
    const raw = match[0];
    const normalized = normalizeNumberToken(raw);
    if (!normalized) continue;
    // Skip lone years that are clearly part of ISO-ish dates (handled loosely).
    results.push({
      raw,
      normalized,
      start: match.index,
      end: match.index + raw.length,
    });
  }
  return results;
}

export function contextSnippet(
  text: string,
  start: number,
  end: number,
  pad = 14,
): string {
  const from = Math.max(0, start - pad);
  const to = Math.min(text.length, end + pad);
  const prefix = from > 0 ? "…" : "";
  const suffix = to < text.length ? "…" : "";
  const before = text.slice(from, start).replace(/\s+/g, " ");
  const token = text.slice(start, end);
  const after = text.slice(end, to).replace(/\s+/g, " ");
  return `${prefix}${before}[${token}]${after}${suffix}`.trim();
}

function findNormalizedInText(
  text: string,
  normalized: string,
): NumberOccurrence | null {
  if (!text || !normalized) return null;
  const candidates = extractNumbers(text);
  const exact = candidates.find((c) => c.normalized === normalized);
  if (exact) return exact;

  // Allow generated "5+" / "5%" to match source "5".
  const loose = candidates.find(
    (c) =>
      c.normalized === normalized ||
      normalized.startsWith(c.normalized) ||
      c.normalized.startsWith(normalized),
  );
  return loose ?? null;
}

export function sourceTextFromUnknown(source: unknown): string {
  if (source == null) return "";
  if (typeof source === "string") return source;
  try {
    return JSON.stringify(source);
  } catch {
    return String(source);
  }
}

export function validateNumbersAgainstSource(
  generatedText: string,
  sourceText: string,
): NumberEvidenceItem[] {
  const generated = extractNumbers(generatedText);
  const seen = new Set<string>();
  const items: NumberEvidenceItem[] = [];

  for (const hit of generated) {
    const key = `${hit.normalized}@${hit.start}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const sourceHit = findNormalizedInText(sourceText, hit.normalized);
    items.push({
      generated: hit.raw,
      generatedContext: contextSnippet(generatedText, hit.start, hit.end),
      source: sourceHit?.raw ?? null,
      sourceContext: sourceHit
        ? contextSnippet(sourceText, sourceHit.start, sourceHit.end)
        : null,
      matched: sourceHit != null,
    });
  }

  return items;
}

export function biographySourceText(biography: unknown): string {
  return sourceTextFromUnknown(biography);
}
