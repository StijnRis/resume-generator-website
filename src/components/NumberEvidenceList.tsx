"use client";

import type { NumberEvidenceItem } from "@/lib/validation/numbers";

interface NumberEvidenceListProps {
  items: NumberEvidenceItem[];
  emptyLabel?: string;
}

export function NumberEvidenceList({
  items,
  emptyLabel = "No numbers in generated text.",
}: NumberEvidenceListProps) {
  if (items.length === 0) {
    return <p className="text-[11px] text-zinc-400 mt-1">{emptyLabel}</p>;
  }

  const unmatched = items.filter((item) => !item.matched).length;

  return (
    <div className="mt-1 space-y-1">
      {unmatched > 0 && (
        <p className="text-[11px] font-medium text-amber-700">
          {unmatched} number{unmatched === 1 ? "" : "s"} not found in source
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item, index) => (
          <li
            key={`${item.generated}-${index}`}
            className={`text-[11px] leading-snug font-mono ${
              item.matched ? "text-zinc-600" : "text-amber-800"
            }`}
          >
            <span className={item.matched ? "" : "font-semibold"}>
              {item.generatedContext}
            </span>
            <span className="text-zinc-400"> → </span>
            {item.matched && item.sourceContext ? (
              <span>{item.sourceContext}</span>
            ) : (
              <span className="italic">not in source</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
