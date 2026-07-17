function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function collectStringArray(
  records: Record<string, unknown>[],
  field: string,
): string[] {
  const values: string[] = [];
  for (const record of records) {
    const raw = record[field];
    if (!Array.isArray(raw)) continue;
    for (const entry of raw) {
      const text = String(entry ?? "").trim();
      if (text) values.push(text);
    }
  }
  return uniqueStrings(values);
}

/** Combine member biography records into one payload for the generate-CV LLM. */
export function mergeExperienceDataForLlm(
  records: Record<string, unknown>[],
): Record<string, unknown> {
  if (records.length === 0) return {};
  if (records.length === 1) return { ...records[0] };

  const first = records[0];
  const highlights = collectStringArray(records, "highlights");
  const skills = collectStringArray(records, "skills");
  const tools = collectStringArray(records, "tools");
  const summaries = uniqueStrings(
    records
      .map((record) => String(record.summary ?? "").trim())
      .filter(Boolean),
  );

  return {
    merged: true,
    member_count: records.length,
    title: first.title ?? first.position ?? first.role ?? first.degree,
    organization: first.organization,
    highlights,
    skills,
    tools,
    summary: summaries.join("\n\n"),
    members: records.map((record) => ({
      title: record.title ?? record.position ?? record.role ?? record.degree,
      organization: record.organization,
      start_date: record.start_date,
      end_date: record.end_date,
      location: record.location,
      highlights: Array.isArray(record.highlights) ? record.highlights : [],
      skills: Array.isArray(record.skills) ? record.skills : [],
      tools: Array.isArray(record.tools) ? record.tools : [],
      summary: record.summary ?? "",
    })),
  };
}
