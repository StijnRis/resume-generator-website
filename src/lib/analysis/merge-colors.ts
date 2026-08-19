export interface MergeColorTheme {
  border: string;
  bg: string;
  text: string;
  chip: string;
  button: string;
}

/** Single shared theme so every combined group looks the same. */
const MERGE_COLOR_THEME: MergeColorTheme = {
  border: "border-violet-300",
  bg: "bg-violet-50",
  text: "text-violet-800",
  chip: "bg-violet-200 text-violet-950",
  button: "text-violet-800 hover:underline",
};

export function getMergeColorTheme(_groupId?: string): MergeColorTheme {
  return MERGE_COLOR_THEME;
}
