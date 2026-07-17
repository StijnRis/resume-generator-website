export interface MergeColorTheme {
  border: string;
  bg: string;
  text: string;
  chip: string;
  button: string;
}

const MERGE_COLOR_THEMES: MergeColorTheme[] = [
  {
    border: "border-sky-300",
    bg: "bg-sky-50",
    text: "text-sky-800",
    chip: "bg-sky-200 text-sky-900",
    button: "text-sky-800 hover:underline",
  },
  {
    border: "border-amber-300",
    bg: "bg-amber-50",
    text: "text-amber-900",
    chip: "bg-amber-200 text-amber-950",
    button: "text-amber-900 hover:underline",
  },
  {
    border: "border-emerald-300",
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    chip: "bg-emerald-200 text-emerald-950",
    button: "text-emerald-900 hover:underline",
  },
  {
    border: "border-rose-300",
    bg: "bg-rose-50",
    text: "text-rose-900",
    chip: "bg-rose-200 text-rose-950",
    button: "text-rose-900 hover:underline",
  },
  {
    border: "border-indigo-300",
    bg: "bg-indigo-50",
    text: "text-indigo-900",
    chip: "bg-indigo-200 text-indigo-950",
    button: "text-indigo-900 hover:underline",
  },
  {
    border: "border-teal-300",
    bg: "bg-teal-50",
    text: "text-teal-900",
    chip: "bg-teal-200 text-teal-950",
    button: "text-teal-900 hover:underline",
  },
  {
    border: "border-orange-300",
    bg: "bg-orange-50",
    text: "text-orange-900",
    chip: "bg-orange-200 text-orange-950",
    button: "text-orange-900 hover:underline",
  },
  {
    border: "border-fuchsia-300",
    bg: "bg-fuchsia-50",
    text: "text-fuchsia-900",
    chip: "bg-fuchsia-200 text-fuchsia-950",
    button: "text-fuchsia-900 hover:underline",
  },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getMergeColorTheme(groupId: string): MergeColorTheme {
  const index = hashString(groupId) % MERGE_COLOR_THEMES.length;
  return MERGE_COLOR_THEMES[index];
}
