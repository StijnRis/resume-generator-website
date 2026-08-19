"use client";

import { useMemo, useState } from "react";

import {
  attributeTypeOrder,
  experienceTypeOrder,
  extractAttributeCards,
  extractExperienceCards,
} from "@/lib/biography/cards";
import type { Biography } from "@/lib/types";
import { sourceTypeLabel } from "@/lib/types";

interface BiographyCardsProps {
  biography: Biography;
}

function groupCardsByCategory<T extends { category: string }>(
  cards: T[],
  categoryOrder: readonly string[],
): { category: string; label: string; cards: T[] }[] {
  const byCategory = new Map<string, T[]>();
  for (const card of cards) {
    const list = byCategory.get(card.category) ?? [];
    list.push(card);
    byCategory.set(card.category, list);
  }

  return categoryOrder
    .filter((category) => (byCategory.get(category)?.length ?? 0) > 0)
    .map((category) => ({
      category,
      label: sourceTypeLabel(category),
      cards: byCategory.get(category) ?? [],
    }));
}

export function BiographyCards({ biography }: BiographyCardsProps) {
  const experienceCards = useMemo(
    () => extractExperienceCards(biography),
    [biography],
  );
  const attributeCards = useMemo(
    () => extractAttributeCards(biography),
    [biography],
  );

  const experienceGroups = useMemo(
    () =>
      groupCardsByCategory(experienceCards, experienceTypeOrder(biography)),
    [biography, experienceCards],
  );
  const attributeGroups = useMemo(
    () => groupCardsByCategory(attributeCards, attributeTypeOrder(biography)),
    [biography, attributeCards],
  );

  if (experienceCards.length === 0 && attributeCards.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {experienceGroups.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-800 mb-3">
            Experiences ({experienceCards.length})
          </h3>
          <div className="space-y-4">
            {experienceGroups.map((group) => (
              <div key={group.category}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  {group.label} ({group.cards.length})
                </h4>
                <div className="space-y-2">
                  {group.cards.map((card) => (
                    <CollapsibleCard
                      key={card.key}
                      title={card.title}
                      meta={[card.dateRange, card.location].filter(Boolean)}
                      raw={card.raw}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {attributeGroups.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-800 mb-3">
            Attributes ({attributeCards.length})
          </h3>
          <div className="space-y-4">
            {attributeGroups.map((group) => (
              <div key={group.category}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  {group.label} ({group.cards.length})
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.cards.map((card) => (
                    <CollapsibleCard
                      key={card.key}
                      title={card.title}
                      meta={[card.dateLabel, card.location].filter(Boolean)}
                      raw={card.raw}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleCard({
  title,
  meta,
  raw,
}: {
  title: string;
  meta: string[];
  raw: unknown;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full text-left p-3 flex items-start justify-between gap-2"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>
          {meta.length > 0 && (
            <p className="text-xs text-zinc-600 mt-0.5">{meta.join(" · ")}</p>
          )}
        </div>
        <span className="text-zinc-400 text-xs shrink-0 mt-0.5">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <pre className="text-[10px] bg-white border border-zinc-200 rounded p-2 overflow-x-auto max-h-40 text-zinc-700">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      )}
    </article>
  );
}
