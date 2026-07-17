import { franc } from "franc";

/** ISO 639-3 codes used by franc, with UI labels. */
export const CV_LANGUAGES = [
  { code: "eng", label: "English" },
  { code: "nld", label: "Dutch" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "spa", label: "Spanish" },
  { code: "ita", label: "Italian" },
  { code: "por", label: "Portuguese" },
  { code: "pol", label: "Polish" },
  { code: "swe", label: "Swedish" },
  { code: "dan", label: "Danish" },
  { code: "nor", label: "Norwegian" },
  { code: "fin", label: "Finnish" },
  { code: "ces", label: "Czech" },
  { code: "ron", label: "Romanian" },
  { code: "hun", label: "Hungarian" },
  { code: "tur", label: "Turkish" },
  { code: "rus", label: "Russian" },
  { code: "ukr", label: "Ukrainian" },
  { code: "ara", label: "Arabic" },
  { code: "zho", label: "Chinese" },
  { code: "jpn", label: "Japanese" },
  { code: "kor", label: "Korean" },
] as const;

const FRANC_TO_CODE: Record<string, string> = {
  eng: "eng",
  nld: "nld",
  fra: "fra",
  deu: "deu",
  spa: "spa",
  ita: "ita",
  por: "por",
  pol: "pol",
  swe: "swe",
  dan: "dan",
  nob: "nor",
  nno: "nor",
  nor: "nor",
  fin: "fin",
  ces: "ces",
  ron: "ron",
  hun: "hun",
  tur: "tur",
  rus: "rus",
  ukr: "ukr",
  ara: "ara",
  cmn: "zho",
  zho: "zho",
  jpn: "jpn",
  kor: "kor",
};

export function languageLabel(code: string): string {
  const found = CV_LANGUAGES.find((entry) => entry.code === code);
  return found?.label ?? code;
}

export function detectLanguageFromText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 20) return "eng";

  const detected = franc(trimmed, { minLength: 20 });
  if (!detected || detected === "und") return "eng";
  return FRANC_TO_CODE[detected] ?? detected;
}

export function isKnownLanguage(code: string): boolean {
  return CV_LANGUAGES.some((entry) => entry.code === code);
}
