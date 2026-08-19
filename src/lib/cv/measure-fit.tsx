"use client";

import type { CSSProperties, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CV_PAGE_CONTENT_HEIGHT_MM,
  CV_PAGE_HEIGHT_MM,
  CV_PAGE_PADDING_MM,
  CV_PAGE_WIDTH_MM,
  CATEGORY_LABELS_FOR_CV,
} from "@/lib/cv/page-geometry";
import { orderExperiencesForDisplay } from "@/lib/cv/display-order";
import { getHeaderContactLine } from "@/lib/formatting/header-contacts";
import { formatTitleWithPartTime } from "@/lib/biography/lookup";
import type {
  CvBulletPoint,
  CvExperienceEntry,
  HighLevelAnalysis,
  RenderedCv,
} from "@/lib/types";

export type CvPageBlock =
  | { type: "header" }
  | { type: "summary" }
  | { type: "category"; label: string; categoryKey: string }
  | { type: "experience"; entry: CvExperienceEntry }
  | { type: "attributes-heading" }
  | {
      type: "attribute-row";
      id: string;
      category: string;
      items: { id: string; text: string }[];
    };

export type CvPage = { blocks: CvPageBlock[] };

const C = {
  text: "#18181b",
  muted: "#52525b",
  border: "#27272a",
  borderLight: "#a1a1aa",
  placeholder: "#a1a1aa",
  white: "#ffffff",
};

let mmToPxRatio: number | null = null;

export function getMmToPx(): number {
  if (mmToPxRatio !== null) return mmToPxRatio;

  const probe = document.createElement("div");
  probe.style.width = "100mm";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  mmToPxRatio = probe.getBoundingClientRect().width / 100;
  document.body.removeChild(probe);
  return mmToPxRatio;
}

export function getPageContentHeightPx(): number {
  return getMmToPx() * CV_PAGE_CONTENT_HEIGHT_MM;
}

function groupExperiences(
  experiences: CvExperienceEntry[],
): Map<string, CvExperienceEntry[]> {
  const map = new Map<string, CvExperienceEntry[]>();

  for (const exp of experiences) {
    const list = map.get(exp.category) ?? [];
    list.push(exp);
    map.set(exp.category, list);
  }

  for (const items of map.values()) {
    items.sort((a, b) => {
      const dateDiff = b.sortDate - a.sortDate;
      if (dateDiff !== 0) return dateDiff;
      return a.title.localeCompare(b.title);
    });
  }

  return map;
}

function buildBlockList(cv: RenderedCv): CvPageBlock[] {
  const blocks: CvPageBlock[] = [{ type: "header" }];
  if (cv.summary) blocks.push({ type: "summary" });

  // Experience categories first — ordered independently (1 = first).
  type ExpPiece = { order: number; blocks: CvPageBlock[] };
  const experiencePieces: ExpPiece[] = [];
  const byCategory = groupExperiences(cv.experiences);

  for (const [category, entries] of byCategory) {
    const label =
      cv.uiLabels?.sectionTitles?.[category] ??
      CATEGORY_LABELS_FOR_CV[category] ??
      category;
    experiencePieces.push({
      order: cv.categoryOrders?.[category] ?? 99,
      blocks: [
        { type: "category", label, categoryKey: category },
        ...entries.map(
          (entry): CvPageBlock => ({ type: "experience", entry }),
        ),
      ],
    });
  }

  experiencePieces.sort((a, b) => a.order - b.order);
  for (const piece of experiencePieces) {
    blocks.push(...piece.blocks);
  }

  // Attribute categories always at the bottom — one ATTRIBUTES header, then rows.
  if (cv.attributeSections.length > 0) {
    blocks.push({ type: "attributes-heading" });

    const attributePieces = [...cv.attributeSections].sort(
      (a, b) => (a.order ?? 99) - (b.order ?? 99),
    );

    for (const section of attributePieces) {
      blocks.push({
        type: "attribute-row",
        id: section.id,
        category: section.category,
        items: section.items,
      });
    }
  }

  return blocks;
}

interface MeasureSession {
  container: HTMLDivElement;
  capacityPx: number;
  isPlaceholder: boolean;
  heightCache: Map<string, number>;
}

function blockCacheKey(block: CvPageBlock): string {
  switch (block.type) {
    case "header":
      return "header";
    case "summary":
      return "summary";
    case "category":
      return `category:${block.categoryKey}:${block.label}`;
    case "experience":
      return `experience:${block.entry.id}:${block.entry.bulletPoints.length}`;
    case "attributes-heading":
      return "attributes-heading";
    case "attribute-row":
      return `attribute:${block.id}:${block.category}:${block.items.map((item) => item.id).join(",")}`;
    default:
      return "unknown";
  }
}

function createMeasureSession(isPlaceholder: boolean): MeasureSession {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = `${CV_PAGE_WIDTH_MM - CV_PAGE_PADDING_MM * 2}mm`;
  container.style.visibility = "hidden";
  container.style.pointerEvents = "none";
  container.style.fontFamily = "'Georgia', 'Times New Roman', serif";
  container.style.fontSize = "10.5pt";
  container.style.lineHeight = "1.4";
  container.style.color = C.text;
  document.body.appendChild(container);

  return {
    container,
    capacityPx: getPageContentHeightPx(),
    isPlaceholder,
    heightCache: new Map(),
  };
}

function destroyMeasureSession(session: MeasureSession): void {
  session.container.remove();
}

function measureNode(session: MeasureSession, node: ReactNode): number {
  session.container.innerHTML = renderToStaticMarkup(<>{node}</>);
  return session.container.scrollHeight;
}

function measureBlock(
  session: MeasureSession,
  cv: RenderedCv,
  block: CvPageBlock,
): number {
  const key = blockCacheKey(block);
  const cached = session.heightCache.get(key);
  if (cached != null) return cached;

  const height = measureNode(
    session,
    <div style={{ width: "100%" }}>
      {renderBlock(cv, block, session.isPlaceholder)}
    </div>,
  );
  session.heightCache.set(key, height);
  return height;
}

function packBlocksIntoPages(
  session: MeasureSession,
  cv: RenderedCv,
  blocks: CvPageBlock[],
): CvPage[] {
  const pages: CvPage[] = [{ blocks: [] }];
  let used = 0;

  const heightOf = (block: CvPageBlock) => measureBlock(session, cv, block);

  const startNewPage = () => {
    pages.push({ blocks: [] });
    used = 0;
  };

  const pushBlock = (block: CvPageBlock, height: number) => {
    pages[pages.length - 1].blocks.push(block);
    used += height;
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const height = heightOf(block);
    const pageHasContent = pages[pages.length - 1].blocks.length > 0;

    if (block.type === "category" || block.type === "attributes-heading") {
      const next = blocks[i + 1];
      const pairedHeight =
        next &&
        ((block.type === "category" && next.type === "experience") ||
          (block.type === "attributes-heading" && next.type === "attribute-row"))
          ? heightOf(next)
          : 0;

      if (pageHasContent && used + height + pairedHeight > session.capacityPx) {
        startNewPage();
      }
      pushBlock(block, height);
      continue;
    }

    if (pageHasContent && used + height > session.capacityPx) {
      const currentPage = pages[pages.length - 1];
      const last = currentPage.blocks[currentPage.blocks.length - 1];

      if (last?.type === "category" || last?.type === "attributes-heading") {
        const orphan = currentPage.blocks.pop()!;
        const orphanHeight = heightOf(orphan);
        used = Math.max(0, used - orphanHeight);
        if (currentPage.blocks.length === 0) {
          pages.pop();
        }
        startNewPage();
        pushBlock(orphan, orphanHeight);
      } else {
        startNewPage();
      }
    }

    pushBlock(block, height);
  }

  return pages.filter((page) => page.blocks.length > 0);
}

/**
 * Sort all content by importance, then greedily keep a piece if it still fits.
 * If a piece overflows, skip it and try the next (smaller) piece.
 */
export function fitCvByMeasurement(
  draft: RenderedCv,
  analysis: HighLevelAnalysis,
  pageCount: number,
  isPlaceholder: boolean,
): RenderedCv {
  if (typeof document === "undefined") return draft;

  const session = createMeasureSession(isPlaceholder);
  try {
  const summaryImportance = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        draft.summaryImportance ?? analysis.summary_importance ?? 70,
      ),
    ),
  );
  const summaryText = summaryImportance > 0 ? draft.summary : "";

  const packedAttributes = draft.attributeSections
    .map((section) => ({
      ...section,
      items: packAttributeItemsToOneLine(
        session,
        section.category,
        section.items,
      ),
      relevanceScore: section.relevanceScore ?? 0,
    }))
    .filter(
      (section) =>
        section.items.length > 0 && (section.relevanceScore ?? 0) > 0,
    );

  type FillPiece =
    | { type: "summary"; importance: number }
    | { type: "experience"; id: string; importance: number }
    | {
        type: "bullet";
        experienceId: string;
        bulletId: string;
        importance: number;
      }
    | { type: "attribute"; id: string; importance: number };

  const pieces: FillPiece[] = [];
  if (summaryText && summaryImportance > 0) {
    pieces.push({ type: "summary", importance: summaryImportance });
  }
  for (const experience of draft.experiences) {
    if (experience.relevanceScore <= 0) continue;
    pieces.push({
      type: "experience",
      id: experience.id,
      importance: experience.relevanceScore,
    });
    for (const bullet of experience.bulletPoints) {
      if (bullet.importance <= 0) continue;
      pieces.push({
        type: "bullet",
        experienceId: experience.id,
        bulletId: bullet.id,
        importance: bullet.importance,
      });
    }
  }
  for (const section of packedAttributes) {
    pieces.push({
      type: "attribute",
      id: section.id,
      importance: section.relevanceScore ?? 0,
    });
  }

  pieces.sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    const rank = { experience: 0, bullet: 1, summary: 2, attribute: 3 };
    return rank[a.type] - rank[b.type];
  });

  const fits = (
    experiences: CvExperienceEntry[],
    attributeSections: RenderedCv["attributeSections"],
    summary: string,
  ): boolean => {
    const candidate: RenderedCv = {
      ...draft,
      summary,
      summaryImportance,
      experiences: orderExperiencesForDisplay(experiences, analysis),
      attributeSections,
    };
    return (
      packBlocksIntoPages(session, candidate, buildBlockList(candidate))
        .length <= pageCount
    );
  };

  const upsertExperience = (
    list: CvExperienceEntry[],
    source: CvExperienceEntry,
    bullets: CvBulletPoint[],
  ): CvExperienceEntry[] => {
    const next: CvExperienceEntry = {
      ...source,
      bulletPoints: [...bullets].sort((a, b) => b.importance - a.importance),
      requestedBulletCount:
        source.requestedBulletCount ?? source.bulletPoints.length,
    };
    const index = list.findIndex((entry) => entry.id === source.id);
    if (index < 0) return [...list, next];
    return list.map((entry, i) => (i === index ? next : entry));
  };

    let summary = "";
    let experiences: CvExperienceEntry[] = [];
    let attributeSections: RenderedCv["attributeSections"] = [];

    for (const piece of pieces) {
      let nextSummary = summary;
      let nextExperiences = experiences;
      let nextAttributes = attributeSections;

      if (piece.type === "summary") {
        nextSummary = summaryText;
      } else if (piece.type === "experience") {
        if (experiences.some((entry) => entry.id === piece.id)) continue;
        const source = draft.experiences.find((entry) => entry.id === piece.id);
        if (!source) continue;
        nextExperiences = upsertExperience(experiences, source, []);
      } else if (piece.type === "bullet") {
        const source = draft.experiences.find(
          (entry) => entry.id === piece.experienceId,
        );
        if (!source) continue;
        const bullet = source.bulletPoints.find(
          (entry) => entry.id === piece.bulletId,
        );
        if (!bullet) continue;
        const current = experiences.find(
          (entry) => entry.id === piece.experienceId,
        );
        if (current?.bulletPoints.some((entry) => entry.id === bullet.id)) {
          continue;
        }
        nextExperiences = upsertExperience(experiences, source, [
          ...(current?.bulletPoints ?? []),
          bullet,
        ]);
      } else {
        if (attributeSections.some((section) => section.id === piece.id)) {
          continue;
        }
        const section = packedAttributes.find(
          (entry) => entry.id === piece.id,
        );
        if (!section) continue;
        nextAttributes = [...attributeSections, section];
      }

      if (fits(nextExperiences, nextAttributes, nextSummary)) {
        summary = nextSummary;
        experiences = nextExperiences;
        attributeSections = nextAttributes;
      }
    }

    return {
      ...draft,
      summary,
      summaryImportance,
      experiences: orderExperiencesForDisplay(experiences, analysis),
      attributeSections,
    };
  } finally {
    destroyMeasureSession(session);
  }
}

/** Pack as many items as fit on a single non-wrapping line after "Label: ". */
function packAttributeItemsToOneLine(
  session: MeasureSession,
  category: string,
  items: { id: string; text: string }[],
): { id: string; text: string }[] {
  if (items.length === 0) return [];

  let accepted: { id: string; text: string }[] = [];

  for (const item of items) {
    const trial = [...accepted, item];
    session.container.innerHTML = renderToStaticMarkup(
      <p
        style={{
          fontSize: "10pt",
          margin: 0,
          whiteSpace: "nowrap",
          width: "max-content",
        }}
      >
        <span style={{ fontWeight: 700 }}>{category}:</span>{" "}
        {trial.map((entry) => entry.text).join(", ")}
      </p>,
    );

    const overflows =
      accepted.length > 0 &&
      session.container.scrollWidth > session.container.clientWidth + 1;

    if (overflows) break;
    accepted = trial;
  }

  return accepted;
}

export function paginateCv(
  cv: RenderedCv,
  isPlaceholder: boolean,
): CvPage[] {
  if (typeof document === "undefined") {
    return [{ blocks: buildBlockList(cv) }];
  }

  const session = createMeasureSession(isPlaceholder);
  try {
    return packBlocksIntoPages(session, cv, buildBlockList(cv));
  } finally {
    destroyMeasureSession(session);
  }
}

/** Fit content to the page budget, then produce page slices for preview/print. */
export function fitAndPaginateCv(
  draft: RenderedCv,
  analysis: HighLevelAnalysis,
  pageCount: number,
  isPlaceholder: boolean,
): { cv: RenderedCv; pages: CvPage[] } {
  const cv = fitCvByMeasurement(draft, analysis, pageCount, isPlaceholder);
  const pages = paginateCv(cv, isPlaceholder).slice(0, Math.max(1, pageCount));
  return { cv, pages };
}

export function renderBlock(
  cv: RenderedCv,
  block: CvPageBlock,
  isPlaceholder: boolean,
  onItemClick?: (id: string) => void,
): ReactNode {
  switch (block.type) {
    case "header":
      return <CvHeader cv={cv} onClick={onItemClick ? () => onItemClick("header") : undefined} />;
    case "summary":
      return (
        <CvSummary
          summary={cv.summary}
          isPlaceholder={isPlaceholder}
          onClick={onItemClick ? () => onItemClick("summary") : undefined}
        />
      );
    case "category":
      return (
        <CvSectionHeading
          onClick={
            onItemClick
              ? () => onItemClick(`category:${block.categoryKey}`)
              : undefined
          }
          dataCvId={`category:${block.categoryKey}`}
        >
          {block.label}
        </CvSectionHeading>
      );
    case "experience":
      return (
        <CvExperienceBlock
          entry={block.entry}
          isPlaceholder={isPlaceholder}
          atLabel={cv.uiLabels?.at ?? "at"}
          onClick={
            onItemClick ? () => onItemClick(block.entry.id) : undefined
          }
        />
      );
    case "attributes-heading":
      return (
        <CvSectionHeading
          onClick={onItemClick ? () => onItemClick("attributes") : undefined}
          dataCvId="attributes"
        >
          {cv.uiLabels?.attributesHeading ?? "Attributes"}
        </CvSectionHeading>
      );
    case "attribute-row":
      return (
        <p
          style={{
            fontSize: "10pt",
            margin: "0 0 4px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "clip",
          }}
        >
          <span
            style={{
              fontWeight: 700,
              cursor: onItemClick ? "pointer" : undefined,
            }}
            data-cv-id={block.id}
            onClick={
              onItemClick
                ? (event) => {
                    event.stopPropagation();
                    onItemClick(block.id);
                  }
                : undefined
            }
          >
            {block.category}:
          </span>{" "}
          {block.items.map((item, index) => (
            <span key={item.id}>
              {index > 0 ? ", " : null}
              <span
                data-cv-id={item.id}
                onClick={
                  onItemClick
                    ? (event) => {
                        event.stopPropagation();
                        onItemClick(item.id);
                      }
                    : undefined
                }
                style={{
                  cursor: onItemClick ? "pointer" : undefined,
                }}
                role={onItemClick ? "button" : undefined}
                tabIndex={onItemClick ? 0 : undefined}
                onKeyDown={
                  onItemClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onItemClick(item.id);
                        }
                      }
                    : undefined
                }
              >
                {item.text}
              </span>
            </span>
          ))}
        </p>
      );
    default:
      return null;
  }
}

function CvHeader({
  cv,
  onClick,
}: {
  cv: RenderedCv;
  onClick?: () => void;
}) {
  const contacts = getHeaderContactLine(cv.basics);

  return (
    <header
      data-cv-id="header"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        borderBottom: `2px solid ${C.border}`,
        paddingBottom: "4px",
        marginBottom: "6px",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      <h1
        style={{
          fontSize: "18pt",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        {cv.basics.name || "Full Name"}
      </h1>
      {contacts.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "nowrap",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: "9pt",
            color: C.muted,
            marginTop: "2px",
            overflow: "hidden",
            whiteSpace: "nowrap",
            width: "100%",
            gap: "8px",
          }}
        >
          {contacts.map((contact, index) => (
            <span key={`${index}-${contact}`}>{contact}</span>
          ))}
        </div>
      )}
    </header>
  );
}

function CvSummary({
  summary,
  isPlaceholder,
  onClick,
}: {
  summary: string;
  isPlaceholder: boolean;
  onClick?: () => void;
}) {
  const placeholder = isPlaceholder && summary.startsWith("[");
  return (
    <section
      data-cv-id="summary"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        marginBottom: "12px",
        // Reserve ~3 lines of body text for the professional summary.
        minHeight: "calc(3 * 10pt * 1.4)",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      <p
        style={{
          fontSize: "10pt",
          margin: 0,
          color: placeholder ? C.placeholder : C.text,
          fontStyle: placeholder ? "italic" : "normal",
        }}
      >
        {summary}
      </p>
    </section>
  );
}

function CvSectionHeading({
  children,
  onClick,
  dataCvId,
}: {
  children: ReactNode;
  onClick?: () => void;
  dataCvId?: string;
}) {
  return (
    <h2
      data-cv-id={dataCvId}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        ...sectionHeadingStyle,
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      {children}
    </h2>
  );
}

function CvExperienceBlock({
  entry,
  isPlaceholder,
  atLabel = "at",
  onClick,
}: {
  entry: CvExperienceEntry;
  isPlaceholder: boolean;
  atLabel?: string;
  onClick?: () => void;
}) {
  const titleText = formatTitleWithPartTime(entry.title, !!entry.partTime);

  return (
    <div
      className="cv-entry"
      data-cv-id={entry.id}
      style={{
        marginBottom: "12px",
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "8px",
        }}
      >
        <h3 style={{ fontSize: "10pt", margin: 0, fontWeight: 400 }}>
          <span style={{ fontWeight: 700 }}>{titleText}</span>
          {entry.subtitle ? (
            <>
              {" "}
              {atLabel}{" "}
              <span style={{ fontStyle: "italic", fontWeight: 400 }}>
                {entry.subtitle}
              </span>
            </>
          ) : null}
        </h3>
        <span
          style={{
            fontSize: "9pt",
            color: C.muted,
            whiteSpace: "nowrap",
            flexShrink: 0,
            textAlign: "right",
          }}
        >
          {entry.dateRange}
        </span>
      </div>
      {entry.bulletPoints.length > 0 && (
        <ul
          style={{
            listStyleType: "disc",
            margin: "4px 0 0",
            paddingLeft: "20px",
          }}
        >
          {entry.bulletPoints.map((bullet) => (
            <li
              key={bullet.id}
              style={{
                fontSize: "10pt",
                marginBottom: "2px",
                color:
                  isPlaceholder && bullet.text.startsWith("[")
                    ? C.placeholder
                    : C.text,
                fontStyle:
                  isPlaceholder && bullet.text.startsWith("[")
                    ? "italic"
                    : "normal",
              }}
            >
              {bullet.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const sectionHeadingStyle: CSSProperties = {
  fontSize: "9pt",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  borderBottom: `1px solid ${C.borderLight}`,
  paddingBottom: "2px",
  margin: "0 0 8px",
};

export {
  CV_PAGE_HEIGHT_MM,
  CV_PAGE_PADDING_MM,
  CV_PAGE_WIDTH_MM,
};
