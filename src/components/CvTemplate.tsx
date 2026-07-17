"use client";

import {
  CV_PAGE_HEIGHT_MM,
  CV_PAGE_PADDING_MM,
  CV_PAGE_WIDTH_MM,
  renderBlock,
  type CvPage,
} from "@/lib/cv/measure-fit";
import type { RenderedCv } from "@/lib/types";

interface CvTemplateProps {
  cv: RenderedCv;
  pages?: CvPage[];
  isPlaceholder?: boolean;
  onExperienceClick?: (id: string) => void;
}

export function CvTemplate({
  cv,
  pages = [],
  isPlaceholder = false,
  onExperienceClick,
}: CvTemplateProps) {
  if (!pages || pages.length === 0) {
    return (
      <div
        className="cv-document"
        style={{
          width: `${CV_PAGE_WIDTH_MM}mm`,
          minHeight: `${CV_PAGE_HEIGHT_MM}mm`,
        }}
      />
    );
  }

  return (
    <div className="cv-document" style={{ width: `${CV_PAGE_WIDTH_MM}mm` }}>
      {pages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="cv-page cv-template"
          style={{
            width: `${CV_PAGE_WIDTH_MM}mm`,
            height: `${CV_PAGE_HEIGHT_MM}mm`,
            maxHeight: `${CV_PAGE_HEIGHT_MM}mm`,
            padding: `${CV_PAGE_PADDING_MM}mm`,
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
            color: "#18181b",
            fontFamily: "'Georgia', 'Times New Roman', serif",
            fontSize: "10.5pt",
            lineHeight: 1.4,
            overflow: "hidden",
            marginBottom: pageIndex < pages.length - 1 ? "16px" : 0,
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            opacity: isPlaceholder ? 0.9 : 1,
          }}
        >
          {page.blocks.map((block, blockIndex) => (
            <div key={`${pageIndex}-${blockIndex}`}>
              {renderBlock(cv, block, isPlaceholder, onExperienceClick)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
