import {
  buildAttributeUnits,
  getAttributeUnitImportance,
} from "@/lib/analysis/attribute-merges";
import {
  buildExperienceUnits,
  getUnitCvId,
  isUnitIncluded,
} from "@/lib/analysis/merges";
import {
  getAttributeItemById,
  getAttributeRowItems,
  getExperienceItemById,
  getExperienceOrganization,
} from "@/lib/biography/lookup";
import { formatLocationObject, formatLocationString } from "@/lib/formatting/location";
import {
  applyMapToUiLabels,
  DEFAULT_UI_LABELS,
  englishUiLabelStrings,
  mergeUiLabels,
} from "@/lib/formatting/ui-labels";
import type {
  Biography,
  GeneratedCvTexts,
  HighLevelAnalysis,
  TranslationMapping,
} from "@/lib/types";

function addString(values: Set<string>, value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (trimmed) values.add(trimmed);
}

/** Biography strings that appear on the CV without LLM rewriting. */
export function collectCopiedCvStrings(
  biography: Biography,
  analysis: HighLevelAnalysis,
  texts: GeneratedCvTexts | null,
): string[] {
  const values = new Set<string>();

  addString(values, formatLocationObject(biography.basics.location));

  const experienceUnits = buildExperienceUnits(analysis).filter(isUnitIncluded);
  for (const unit of experienceUnits) {
    const cvId = getUnitCvId(unit);
    const generated = texts?.experiences[cvId];
    const items = unit.type === "single" ? [unit.item] : unit.items;
    for (const item of items) {
      const source = getExperienceItemById(biography, item.category, item.id);
      if (!generated?.organization) {
        addString(values, getExperienceOrganization(source, item.category));
      }
      // Always include experience location (shown on CV; usually copied).
      addString(
        values,
        generated?.location ||
          formatLocationString(String(source?.location ?? "")),
      );
    }
  }

  const attributeUnits = buildAttributeUnits(analysis).filter(
    (unit) => getAttributeUnitImportance(unit) > 0,
  );
  for (const unit of attributeUnits) {
    const items = unit.type === "single" ? [unit.item] : unit.items;
    for (const item of items) {
      const source = getAttributeItemById(biography, item.category, item.id);
      for (const label of getAttributeRowItems(source, item.category)) {
        addString(values, label);
      }
    }
  }

  return [...values];
}

/** English → localized UI chrome pairs for the translation mapping panel. */
export function uiLabelTranslationMappings(
  uiLabels?: GeneratedCvTexts["uiLabels"] | null,
): TranslationMapping[] {
  const merged = mergeUiLabels(uiLabels);
  const out: TranslationMapping[] = [];
  const add = (original: string, translated: string) => {
    const from = original.trim();
    const to = translated.trim();
    if (from && to && from !== to) {
      out.push({ original: from, translated: to });
    }
  };

  add(DEFAULT_UI_LABELS.at, merged.at);
  add(DEFAULT_UI_LABELS.attributesHeading, merged.attributesHeading);
  add(DEFAULT_UI_LABELS.present, merged.present);
  add(DEFAULT_UI_LABELS.starting, merged.starting);
  add(DEFAULT_UI_LABELS.expected, merged.expected);

  return out;
}

/** All CV strings that should move with a language change (generated + copied + UI). */
export function collectTranslatableCvStrings(
  biography: Biography,
  analysis: HighLevelAnalysis,
  texts: GeneratedCvTexts,
): string[] {
  const values = new Set<string>(
    collectCopiedCvStrings(biography, analysis, texts),
  );

  for (const label of englishUiLabelStrings()) addString(values, label);
  const labels = mergeUiLabels(texts.uiLabels);
  addString(values, labels.at);
  addString(values, labels.attributesHeading);
  addString(values, labels.present);
  addString(values, labels.starting);
  addString(values, labels.expected);

  for (const def of [
    ...(analysis.experience_categories ?? []),
    ...(analysis.attribute_categories ?? []),
  ]) {
    addString(values, def.label);
  }

  addString(values, texts.summary);
  for (const entry of Object.values(texts.experiences ?? {})) {
    addString(values, entry.title);
    addString(values, entry.organization);
    addString(values, entry.location);
    addString(values, entry.dateRange);
    addString(values, entry.summary);
    for (const bullet of Object.values(entry.bullets ?? {})) {
      addString(values, bullet);
    }
  }
  for (const entry of Object.values(texts.attributes ?? {})) {
    addString(values, entry.title);
    for (const label of Object.values(entry.items ?? {})) {
      addString(values, label);
    }
  }

  return [...values];
}

export function applyTranslationMappings(
  texts: GeneratedCvTexts,
  mappings: TranslationMapping[],
  language: string,
): GeneratedCvTexts {
  const map = new Map(
    mappings.map((entry) => [entry.original, entry.translated]),
  );
  const t = (value?: string) => {
    if (!value) return value;
    return map.get(value) ?? value;
  };

  const experiences: GeneratedCvTexts["experiences"] = {};
  for (const [id, entry] of Object.entries(texts.experiences ?? {})) {
    const bullets: Record<string, string> = {};
    for (const [bulletId, bullet] of Object.entries(entry.bullets ?? {})) {
      bullets[bulletId] = t(bullet) ?? bullet;
    }
    experiences[id] = {
      ...entry,
      title: t(entry.title),
      organization: t(entry.organization),
      location: t(entry.location),
      dateRange: t(entry.dateRange),
      summary: t(entry.summary) ?? "",
      bullets,
    };
  }

  const attributes: GeneratedCvTexts["attributes"] = {};
  for (const [id, entry] of Object.entries(texts.attributes ?? {})) {
    const items: Record<string, string> = {};
    for (const [itemId, label] of Object.entries(entry.items ?? {})) {
      items[itemId] = t(label) ?? label;
    }
    attributes[id] = {
      title: t(entry.title) ?? entry.title,
      items: Object.keys(items).length > 0 ? items : entry.items,
    };
  }

  const uiLabels = applyMapToUiLabels(mergeUiLabels(texts.uiLabels), map);

  return {
    ...texts,
    summary: t(texts.summary),
    experiences,
    attributes,
    uiLabels,
    translations: mappings,
    language,
  };
}
