export type ExperienceSourceType = string;
export type AttributeSourceType = string;

/** Known source keys that may appear on uploaded biography JSON. */
export const KNOWN_EXPERIENCE_SOURCE_TYPES = [
  "work",
  "education",
  "volunteer",
  "extracurriculars",
  "events",
  "research",
  "projects",
  "experience",
  "sports",
] as const;

export const KNOWN_ATTRIBUTE_SOURCE_TYPES = [
  "skills",
  "tools",
  "interests",
  "certificates",
  "awards",
  "publications",
  "references",
  "languages",
] as const;

/** @deprecated Prefer dynamic AI category ids (string). Kept for label fallbacks. */
export type ExperienceCategoryKey =
  | "work"
  | "education"
  | "volunteer"
  | "extracurriculars"
  | "events"
  | "research"
  | "projects";

/** @deprecated Prefer dynamic AI category ids (string). */
export type AttributeCategoryKey =
  | "skills"
  | "tools"
  | "interests"
  | "certificates"
  | "awards"
  | "publications"
  | "references"
  | "languages";

export type BiographyCategoryKey = string;

export interface Location {
  city: string;
  region: string;
  country: string;
  country_code: string;
}

export interface Profile {
  network: string;
  username: string;
  url: string;
}

export interface Basics {
  name: string;
  email: string;
  image: string;
  phone: string;
  location: Location;
  profiles: Profile[];
  /**
   * Ordered contact strings for the CV header line.
   * When set (even empty), replaces the default email/phone/LinkedIn/GitHub/location composition.
   */
  header_contacts?: string[];
}

export type ContactKind = "email" | "phone" | "linkedin" | "other";

/** One editable contact line shown under the name on the resume. */
export interface ContactDetail {
  id: string;
  value: string;
  kind?: ContactKind;
}

/** Flat experience item; `type` is the original JSON key / source bucket. */
export interface BiographyExperience {
  id?: string;
  type: ExperienceSourceType;
  title: string;
  hours_per_week?: number | null;
  start_date: string;
  end_date?: string | null;
  location: string;
  url?: string | null;
  summary?: string | null;
  highlights?: string[];
  skills?: string[];
  tools?: string[];
  organization?: string;
  position?: string;
  role?: string;
  degree?: string;
  area?: string;
  grade?: number | null;
  grade_scale?: number | null;
  courses?: unknown[];
  roles?: string[];
  /** Original project `type` field when the source was projects. */
  project_type?: string | null;
  goal?: string;
  reference?: string;
}

/** Flat attribute item; `type` is the original JSON key / source bucket. */
export interface BiographyAttribute {
  id?: string;
  type: AttributeSourceType;
  name?: string;
  title?: string;
  value?: string;
  level?: string;
  keywords?: string[];
  language?: string;
  fluency?: string;
  date?: string;
  issuer?: string;
  awarder?: string;
  publisher?: string;
  release_date?: string;
  reference?: string;
  position?: string;
  contact?: string;
  url?: string | null;
  summary?: string | null;
  highlights?: string[];
}

export interface Biography {
  basics: Basics;
  label: string;
  summary: string;
  experiences: BiographyExperience[];
  attributes: BiographyAttribute[];
}

/** AI-defined CV section category (dynamic). */
export interface DynamicCategoryDefinition {
  /** Same as label; used as the category key on analysis items. */
  id: string;
  /** Resume heading; analysis items refer to this exact string. */
  label: string;
  /** Section order: 1 = first. */
  order: number;
  reason: string;
}

/** One candidate bullet for an experience (topic + show-importance). */
export interface ExperienceBulletCandidate {
  id: string;
  /** What the bullet should be about. */
  topic: string;
  /** 0 = never show; 100 = always prefer. Used by page-fit. */
  importance: number;
  /** Generated or user-edited bullet text. */
  text?: string;
}

export interface ExperienceAnalysisItem {
  /** Dynamic AI category id. */
  category: string;
  id: string;
  relevance_score: number;
  reason: string;
  bullets: ExperienceBulletCandidate[];
}

export interface AttributeAnalysisItem {
  /** Dynamic AI category id. */
  category: string;
  id: string;
  relevance_score: number;
  reason: string;
}

export interface ExperienceMergeGroup {
  id: string;
  category?: string;
  member_ids: string[];
  relevance_score?: number;
  /** Why these items were combined (shown beside the merged row). */
  reason?: string;
  bullets?: ExperienceBulletCandidate[];
}

export interface AttributeMergeGroup {
  id: string;
  category?: string;
  member_ids: string[];
  relevance_score?: number;
  /** Why these items were combined (shown beside the merged row). */
  reason?: string;
  /** Optional AI/user title for the merged attribute row. */
  title?: string;
}

export interface HighLevelAnalysis {
  experience_categories: DynamicCategoryDefinition[];
  attribute_categories: DynamicCategoryDefinition[];
  experience_analysis: ExperienceAnalysisItem[];
  attribute_analysis: AttributeAnalysisItem[];
  /** 0 = omit summary; 1–100 = keep priority vs other content. */
  summary_importance?: number;
  experience_merges?: ExperienceMergeGroup[];
  attribute_merges?: AttributeMergeGroup[];
}

export interface BatchedExperienceText {
  id: string;
  summary: string;
  bullets: { id: string; text: string }[];
  title?: string;
  organization?: string;
  location?: string;
}

export interface BatchedCvTextGeneration {
  summary: string;
  experiences: BatchedExperienceText[];
  attributes?: { id: string; title: string }[];
  ui_labels?: {
    at: string;
    present: string;
    starting: string;
    expected: string;
  };
}

export interface GeneratedCvExperienceText {
  summary: string;
  title?: string;
  organization?: string;
  location?: string;
  /** Editable date range shown on the CV (overrides biography dates when set). */
  dateRange?: string;
  /** Bullet text keyed by bullet id. */
  bullets?: Record<string, string>;
}

export interface GeneratedCvAttributeText {
  title: string;
  /** Translated/copied item labels keyed by attribute item id. */
  items?: Record<string, string>;
}

export interface TranslationMapping {
  original: string;
  translated: string;
}

export interface GeneratedCvTexts {
  summary?: string;
  experiences: Record<string, GeneratedCvExperienceText>;
  attributes?: Record<string, GeneratedCvAttributeText>;
  translations?: TranslationMapping[];
  language?: string;
  uiLabels?: {
    at?: string;
    attributesHeading?: string;
    present?: string;
    starting?: string;
    expected?: string;
    sectionTitles?: Record<string, string>;
  };
}

export type BiographyKeyMapping = Record<string, string>;

export interface GenerationSettings {
  jobDescription: string;
  anonymousMode: boolean;
  pageCount: number;
  contacts: ContactDetail[];
  language: string;
}

export interface DebugLogEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  request: unknown;
  response: unknown | null;
  error?: string;
  status: "pending" | "success" | "error";
  events: { timestamp: string; message: string }[];
  systemPrompt?: string;
  userPrompt?: string;
}

export interface CvBulletPoint {
  id: string;
  text: string;
  importance: number;
  topic: string;
}

export interface CvExperienceEntry {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  dateRange: string;
  location: string;
  partTime?: boolean;
  summary?: string;
  bulletPoints: CvBulletPoint[];
  requestedBulletCount?: number;
  relevanceScore: number;
  sortDate: number;
  sourceIds?: string[];
  merged?: boolean;
}

export interface CvAttributeEntry {
  id: string;
  category: string;
  label: string;
  relevanceScore: number;
}

export interface RenderedCv {
  basics: Basics;
  label: string;
  summary: string;
  experiences: CvExperienceEntry[];
  attributeSections: {
    id: string;
    category: string;
    items: { id: string; text: string }[];
    order?: number;
    /** Max item importance in this section (for page-fit competition). */
    relevanceScore?: number;
  }[];
  /** 0 = omit; used by page-fit. */
  summaryImportance?: number;
  categoryOrders?: Record<string, number>;
  uiLabels?: {
    at?: string;
    attributesHeading?: string;
    sectionTitles?: Record<string, string>;
  };
}

/** Display labels for known source types (parsed biography grouping). */
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  work: "Work Experience",
  education: "Education",
  volunteer: "Volunteering",
  extracurriculars: "Extracurriculars",
  events: "Events",
  research: "Research",
  projects: "Projects",
  experience: "Experience",
  sports: "Sports",
  skills: "Skills",
  tools: "Tools",
  interests: "Interests",
  certificates: "Certificates",
  awards: "Awards",
  publications: "Publications",
  references: "References",
  languages: "Languages",
};

/** @deprecated Use SOURCE_TYPE_LABELS. */
export const CATEGORY_LABELS = SOURCE_TYPE_LABELS;

export const EXPERIENCE_CATEGORIES: ExperienceCategoryKey[] = [
  "work",
  "education",
  "volunteer",
  "extracurriculars",
  "events",
  "research",
  "projects",
];

export const ATTRIBUTE_CATEGORIES: AttributeCategoryKey[] = [
  "skills",
  "tools",
  "interests",
  "certificates",
  "awards",
  "publications",
  "references",
  "languages",
];

export function sourceTypeLabel(type: string): string {
  return (
    SOURCE_TYPE_LABELS[type] ??
    type.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
