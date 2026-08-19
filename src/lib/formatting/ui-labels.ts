const MONTHS: Record<string, string[]> = {
  eng: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  nld: [
    "jan",
    "feb",
    "mrt",
    "apr",
    "mei",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "dec",
  ],
  fra: [
    "janv.",
    "févr.",
    "mars",
    "avr.",
    "mai",
    "juin",
    "juil.",
    "août",
    "sept.",
    "oct.",
    "nov.",
    "déc.",
  ],
  deu: [
    "Jan.",
    "Feb.",
    "März",
    "Apr.",
    "Mai",
    "Juni",
    "Juli",
    "Aug.",
    "Sep.",
    "Okt.",
    "Nov.",
    "Dez.",
  ],
  spa: [
    "ene.",
    "feb.",
    "mar.",
    "abr.",
    "may.",
    "jun.",
    "jul.",
    "ago.",
    "sept.",
    "oct.",
    "nov.",
    "dic.",
  ],
  ita: [
    "gen.",
    "feb.",
    "mar.",
    "apr.",
    "mag.",
    "giu.",
    "lug.",
    "ago.",
    "set.",
    "ott.",
    "nov.",
    "dic.",
  ],
  por: [
    "jan.",
    "fev.",
    "mar.",
    "abr.",
    "mai.",
    "jun.",
    "jul.",
    "ago.",
    "set.",
    "out.",
    "nov.",
    "dez.",
  ],
};

export interface CvUiLabels {
  at: string;
  attributesHeading: string;
  present: string;
  starting: string;
  expected: string;
  sectionTitles: Record<string, string>;
}

export const DEFAULT_UI_LABELS: CvUiLabels = {
  at: "at",
  attributesHeading: "Attributes",
  present: "present",
  starting: "Starting",
  expected: "exp.",
  sectionTitles: {},
};

/** English source strings to send through the translate API. */
export function englishUiLabelStrings(): string[] {
  return [
    DEFAULT_UI_LABELS.at,
    DEFAULT_UI_LABELS.attributesHeading,
    DEFAULT_UI_LABELS.present,
    DEFAULT_UI_LABELS.starting,
    DEFAULT_UI_LABELS.expected,
  ];
}

export function mergeUiLabels(
  partial?: Partial<CvUiLabels> | null,
): CvUiLabels {
  return {
    at: partial?.at?.trim() || DEFAULT_UI_LABELS.at,
    attributesHeading:
      partial?.attributesHeading?.trim() || DEFAULT_UI_LABELS.attributesHeading,
    present: partial?.present?.trim() || DEFAULT_UI_LABELS.present,
    starting: partial?.starting?.trim() || DEFAULT_UI_LABELS.starting,
    expected: partial?.expected?.trim() || DEFAULT_UI_LABELS.expected,
    sectionTitles: {
      ...DEFAULT_UI_LABELS.sectionTitles,
      ...(partial?.sectionTitles ?? {}),
    },
  };
}

export function applyMapToUiLabels(
  labels: CvUiLabels,
  map: Map<string, string>,
): CvUiLabels {
  const t = (value: string) => map.get(value) ?? value;
  const sectionTitles: CvUiLabels["sectionTitles"] = {};
  for (const [key, value] of Object.entries(labels.sectionTitles)) {
    if (value) {
      sectionTitles[key] = t(value);
    }
  }
  return {
    at: t(labels.at),
    attributesHeading: t(labels.attributesHeading),
    present: t(labels.present),
    starting: t(labels.starting),
    expected: t(labels.expected),
    sectionTitles,
  };
}

export function monthNamesForLanguage(language?: string | null): string[] {
  if (!language) return MONTHS.eng;
  return MONTHS[language] ?? MONTHS.eng;
}
