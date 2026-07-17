export type ExperienceCategoryKey =
  | "work"
  | "education"
  | "volunteer"
  | "extracurriculars"
  | "events"
  | "research"
  | "projects";

export type AttributeCategoryKey =
  | "skills"
  | "tools"
  | "interests"
  | "certificates"
  | "awards"
  | "publications"
  | "references"
  | "languages";

export type BiographyCategoryKey = ExperienceCategoryKey | AttributeCategoryKey;

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
}

export interface ExperienceBase {
  id?: string;
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
}

export interface WorkExperience extends ExperienceBase {
  organization: string;
  position: string;
}

export interface EducationExperience extends ExperienceBase {
  organization: string;
  area: string;
  degree: string;
  grade?: number | null;
  grade_scale?: number | null;
  courses?: unknown[];
}

export interface VolunteerExperience extends ExperienceBase {
  organization: string;
  role: string;
}

export interface ExtracurricularExperience extends ExperienceBase {
  organization: string;
}

export interface ResearchExperience extends ExperienceBase {
  organization: string;
}

export interface ProjectExperience extends ExperienceBase {
  roles?: string[];
  type?: string | null;
}

export interface EventItem extends ExperienceBase {
  organization: string;
}

export interface Skill {
  id?: string;
  name: string;
  level: string;
  keywords?: string[];
}

export interface ToolItem {
  id?: string;
  name: string;
}

export interface CertificateItem {
  id?: string;
  name: string;
  date: string;
  issuer: string;
  url?: string | null;
  summary?: string | null;
}

export interface AwardItem {
  id?: string;
  title: string;
  url?: string | null;
  awarder: string;
  date: string;
  highlights?: string[];
  summary?: string | null;
}

export interface PublicationItem {
  id?: string;
  name: string;
  publisher: string;
  release_date: string;
  url?: string | null;
  summary?: string | null;
}

export interface ReferenceItem {
  id?: string;
  name: string;
  reference: string;
  position?: string | null;
  contact?: string | null;
}

export interface LanguageItem {
  id?: string;
  language: string;
  fluency: "native" | "fluent" | "intermediate" | "basic";
}

export interface InterestItem {
  id?: string;
  value: string;
}

export interface Biography {
  basics: Basics;
  label: string;
  summary: string;
  work?: WorkExperience[];
  education?: EducationExperience[];
  volunteer?: VolunteerExperience[];
  extracurriculars?: ExtracurricularExperience[];
  events?: EventItem[];
  skills?: Skill[];
  tools?: ToolItem[];
  interests?: (string | InterestItem)[];
  research?: ResearchExperience[];
  projects?: ProjectExperience[];
  certificates?: CertificateItem[];
  awards?: AwardItem[];
  publications?: PublicationItem[];
  references?: ReferenceItem[];
  languages?: LanguageItem[];
}

export interface CategoryAnalysisItem {
  category: BiographyCategoryKey;
  relevance_score: number;
  reason: string;
}

export interface ExperienceAnalysisItem {
  category: ExperienceCategoryKey;
  id: string;
  relevance_score: number;
  reason: string;
  suggested_bullet_points: number;
}

export interface AttributeAnalysisItem {
  category: AttributeCategoryKey;
  id: string;
  relevance_score: number;
  reason: string;
}

export interface ExperienceMergeGroup {
  id: string;
  category?: ExperienceCategoryKey;
  member_ids: string[];
  relevance_score?: number;
  suggested_bullet_points?: number;
}

export interface AttributeMergeGroup {
  id: string;
  category?: AttributeCategoryKey;
  member_ids: string[];
  relevance_score?: number;
  /** Optional AI/user title for the merged attribute row. */
  title?: string;
}

export interface HighLevelAnalysis {
  category_analysis: CategoryAnalysisItem[];
  experience_analysis: ExperienceAnalysisItem[];
  attribute_analysis: AttributeAnalysisItem[];
  experience_merges?: ExperienceMergeGroup[];
  attribute_merges?: AttributeMergeGroup[];
}

export interface DynamicExperience {
  id: string;
  title: string;
  details: { detail: string }[];
}

export interface ExperienceCategory {
  category: string;
  experiences: DynamicExperience[];
}

export interface AttributeCategory {
  category: string;
  attributes: { id: string; item: string }[];
}

export interface DynamicGeneralResume {
  summary: string;
  experience_categories: ExperienceCategory[];
  attribute_categories: AttributeCategory[];
}

export interface ExperienceTextGeneration {
  summary: string;
  bullet_points: string[];
}

export interface BatchedExperienceText {
  id: string;
  summary: string;
  bullet_points: string[];
  /** Short combined title for merged entries. */
  title?: string;
  /** Optional short organization/context for merged entries. */
  organization?: string;
  /** Generic location when member locations differ. */
  location?: string;
}

export interface BatchedCvTextGeneration {
  summary: string;
  experiences: BatchedExperienceText[];
  attributes?: { id: string; title: string }[];
  ui_labels?: {
    at: string;
    attributes_heading: string;
    present: string;
    starting: string;
    expected: string;
    sections: Partial<Record<ExperienceCategoryKey, string>>;
  };
}

export interface GeneratedCvExperienceText {
  summary: string;
  bullet_points: string[];
  title?: string;
  organization?: string;
  location?: string;
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
  /** Original → translated strings for copied biography fields / UI labels. */
  translations?: TranslationMapping[];
  language?: string;
  /** Localized CV chrome: "at", section headings, date words. */
  uiLabels?: {
    at?: string;
    attributesHeading?: string;
    present?: string;
    starting?: string;
    expected?: string;
    sectionTitles?: Partial<Record<ExperienceCategoryKey, string>>;
  };
}

export type BiographyKeyMapping = Record<string, string>;

export interface GenerationSettings {
  jobDescription: string;
  anonymousMode: boolean;
  pageCount: number;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  /** ISO 639-3 style code (e.g. eng, nld). */
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

export interface CvExperienceEntry {
  id: string;
  category: ExperienceCategoryKey;
  title: string;
  subtitle: string;
  dateRange: string;
  location: string;
  partTime?: boolean;
  summary?: string;
  bulletPoints: string[];
  /** Bullets before page-fit truncation (for UI). */
  requestedBulletCount?: number;
  relevanceScore: number;
  sortDate: number;
  sourceIds?: string[];
  merged?: boolean;
}

export interface CvAttributeEntry {
  id: string;
  category: AttributeCategoryKey;
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
  }[];
  /** Section order numbers (1 = first) keyed by biography category. */
  categoryOrders?: Partial<Record<BiographyCategoryKey, number>>;
  /** Localized connector / headings used while rendering. */
  uiLabels?: {
    at?: string;
    attributesHeading?: string;
    sectionTitles?: Partial<Record<ExperienceCategoryKey, string>>;
  };
}

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

export const CATEGORY_LABELS: Record<BiographyCategoryKey, string> = {
  work: "Work Experience",
  education: "Education",
  volunteer: "Volunteering",
  extracurriculars: "Extracurriculars",
  events: "Events",
  research: "Research",
  projects: "Projects",
  skills: "Skills",
  tools: "Tools",
  interests: "Interests",
  certificates: "Certificates",
  awards: "Awards",
  publications: "Publications",
  references: "References",
  languages: "Languages",
};
