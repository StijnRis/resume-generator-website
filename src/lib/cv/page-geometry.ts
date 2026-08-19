export const CV_PAGE_WIDTH_MM = 210;
export const CV_PAGE_HEIGHT_MM = 297;
/** 1 inch margins on A4. */
export const CV_PAGE_PADDING_MM = 25.4;
export const CV_PAGE_CONTENT_HEIGHT_MM =
  CV_PAGE_HEIGHT_MM - CV_PAGE_PADDING_MM * 2;

export const CATEGORY_LABELS_FOR_CV: Record<string, string> = {
  work: "Work Experience",
  education: "Education",
  volunteer: "Volunteering",
  extracurriculars: "Extracurriculars",
  events: "Events",
  research: "Research",
  projects: "Projects",
};
