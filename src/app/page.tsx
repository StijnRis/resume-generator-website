"use client";

import { useCallback, useMemo, useState } from "react";

import { AnalysisSection } from "@/components/AnalysisSection";
import { CvPreviewSection } from "@/components/CvPreviewSection";
import { SettingsSection } from "@/components/SettingsSection";
import { applyAnonymousMode } from "@/lib/biography/anonymous";
import { ensureSkillsFromDocument } from "@/lib/biography/harvest-skills";
import { injectBiographyIds } from "@/lib/biography/inject-ids";
import {
  buildAnalyzeUserPayload,
  summarizeBiographyForDebug,
} from "@/lib/biography/llm-payload";
import { completeAnalysis } from "@/lib/analysis/complete-analysis";
import { applyEducationPriority } from "@/lib/analysis/education-priority";
import { applyInterestPriority } from "@/lib/analysis/interest-priority";
import {
  buildExperienceUnits,
  getUnitBullets,
  getUnitCvId,
  isUnitIncluded,
} from "@/lib/analysis/merges";
import { expandAnalysisForPageBudget } from "@/lib/analysis/page-budget";
import {
  normalizeAnalysis,
  rankBulletsForFit,
} from "@/lib/analysis/experience-score";
import { applyContactSettings, emptyContactDetails } from "@/lib/formatting/header-contacts";
import {
  applyTranslationMappings,
  collectTranslatableCvStrings,
  uiLabelTranslationMappings,
} from "@/lib/cv/copied-strings";
import { apiCall, useDebug } from "@/lib/debug/context";
import { ANALYSIS_PROMPT, BATCH_CV_GENERATION_PROMPT } from "@/lib/llm/prompts";
import type {
  Biography,
  GenerationSettings,
  GeneratedCvTexts,
  HighLevelAnalysis,
  TranslationMapping,
} from "@/lib/types";

function bulletBudgetKey(analysis: HighLevelAnalysis): string {
  const units = buildExperienceUnits(analysis).filter(isUnitIncluded);
  return units
    .map((unit) => {
      const id = getUnitCvId(unit);
      const bullets = rankBulletsForFit(getUnitBullets(unit))
        .map((bullet) => `${bullet.id}:${bullet.importance}:${bullet.topic}`)
        .join("~");
      return `${id}:${bullets}`;
    })
    .sort()
    .join("|");
}

export default function HomePage() {
  const debug = useDebug();

  const [settings, setSettings] = useState<GenerationSettings>({
    jobDescription: "",
    anonymousMode: false,
    pageCount: 2,
    contacts: emptyContactDetails(),
    language: "eng",
  });

  const [biography, setBiography] = useState<Biography | null>(null);
  const [conversionMessage, setConversionMessage] = useState<string | null>(
    null,
  );

  const [analysis, setAnalysis] = useState<HighLevelAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatedTexts, setGeneratedTexts] = useState<GeneratedCvTexts | null>(
    null,
  );
  const [generating, setGenerating] = useState(false);
  const [generatedBudgetKey, setGeneratedBudgetKey] = useState<string | null>(
    null,
  );
  const [contentScrollToId, setContentScrollToId] = useState<string | null>(
    null,
  );
  const [cvScrollToId, setCvScrollToId] = useState<string | null>(null);
  const [placedBulletCounts, setPlacedBulletCounts] = useState<
    Record<string, number>
  >({});

  const effectiveBiography = useMemo(() => {
    if (!biography) return null;
    if (settings.anonymousMode) {
      const base = applyAnonymousMode(biography);
      const urlContacts = settings.contacts.filter((entry) => {
        const value = entry.value.trim();
        return /linkedin\.com|github\.com/i.test(value);
      });
      // Apply URL contacts onto profiles, but rebuild header from anonymous
      // basics so email/phone placeholders stay on the resume.
      const withProfiles = applyContactSettings(base, urlContacts);
      const { header_contacts: _ignored, ...basicsWithoutHeader } =
        withProfiles.basics;
      return {
        ...withProfiles,
        basics: {
          ...basicsWithoutHeader,
          header_contacts: undefined,
        },
      };
    }
    return applyContactSettings(biography, settings.contacts);
  }, [biography, settings]);

  const canAnalyze =
    !!effectiveBiography && settings.jobDescription.trim().length > 0;

  const textsStale = useMemo(() => {
    if (!analysis || !generatedTexts || !generatedBudgetKey) return false;
    return bulletBudgetKey(analysis) !== generatedBudgetKey;
  }, [analysis, generatedTexts, generatedBudgetKey]);

  const canRegenerateTexts = canAnalyze && !!analysis && !!generatedTexts;

  const injectIdsAndStore = useCallback(async (bio: Biography) => {
    const withSkills = ensureSkillsFromDocument(bio);
    const withIds = await injectBiographyIds(withSkills);
    setBiography(withIds);
    return withIds;
  }, []);

  const handleBiographyChange = useCallback(
    async (bio: Biography, _json: string) => {
      await injectIdsAndStore(bio);
      setAnalysis(null);
      setGeneratedTexts(null);
      setGeneratedBudgetKey(null);
    },
    [injectIdsAndStore],
  );

  const generateTexts = useCallback(
    async (bio: Biography, nextAnalysis: HighLevelAnalysis) => {
      setGenerating(true);
      try {
        const generateBody = {
          jobDescription: settings.jobDescription,
          biography: bio,
          analysis: nextAnalysis,
          language: settings.language,
        };

        const result = await apiCall<GeneratedCvTexts>(
          "/api/llm/generate-cv",
          generateBody,
          debug,
          {
            systemPrompt: BATCH_CV_GENERATION_PROMPT,
            userPrompt: `${summarizeBiographyForDebug(bio)}\n\nSee server response debug.userPrompt for the full experiences_to_generate payload.`,
          },
        );

        let nextTexts: GeneratedCvTexts = {
          ...result,
          language: settings.language,
        };

        // Ensure target language: translate all resume strings when not English.
        if (settings.language !== "eng") {
          const strings = collectTranslatableCvStrings(
            bio,
            nextAnalysis,
            nextTexts,
          );
          if (strings.length > 0) {
            const translated = await apiCall<{
              translations: TranslationMapping[];
              language: string;
            }>(
              "/api/llm/translate",
              { language: settings.language, strings },
              debug,
            );
            nextTexts = applyTranslationMappings(
              nextTexts,
              translated.translations,
              settings.language,
            );
          } else {
            const uiMaps = uiLabelTranslationMappings(nextTexts.uiLabels);
            nextTexts = {
              ...nextTexts,
              translations: uiMaps,
              language: settings.language,
            };
          }
        }

        setGeneratedTexts(nextTexts);
        setGeneratedBudgetKey(bulletBudgetKey(nextAnalysis));
      } finally {
        setGenerating(false);
      }
    },
    [debug, settings.jobDescription, settings.language],
  );

  const translateCopiedStrings = useCallback(
    async (
      bio: Biography,
      nextAnalysis: HighLevelAnalysis,
      texts: GeneratedCvTexts,
      language: string,
    ) => {
      const strings = collectTranslatableCvStrings(bio, nextAnalysis, texts);
      if (strings.length === 0) {
        setGeneratedTexts({
          ...texts,
          language,
          translations: [],
        });
        return;
      }

      const result = await apiCall<{
        translations: TranslationMapping[];
        language: string;
      }>("/api/llm/translate", { language, strings }, debug);

      setGeneratedTexts(
        applyTranslationMappings(texts, result.translations, language),
      );
    },
    [debug],
  );

  const handleSettingsChange = useCallback(
    async (next: GenerationSettings) => {
      const previousLanguage = settings.language;
      setSettings(next);

      if (
        next.language !== previousLanguage &&
        biography &&
        analysis &&
        generatedTexts
      ) {
        try {
          await translateCopiedStrings(
            biography,
            analysis,
            generatedTexts,
            next.language,
          );
        } catch {
          // Logged in debug panel
        }
      }
    },
    [
      settings.language,
      biography,
      analysis,
      generatedTexts,
      translateCopiedStrings,
    ],
  );

  const handleAnalyze = useCallback(async () => {
    if (!biography || !settings.jobDescription.trim()) return;

    setAnalyzing(true);
    try {
      const withIds = await injectIdsAndStore(biography);

      const bioForApi = settings.anonymousMode
        ? applyAnonymousMode(withIds)
        : withIds;
      const analyzeUserPayload = buildAnalyzeUserPayload(
        settings.jobDescription,
        bioForApi,
        settings.pageCount,
      );
      const analyzeBody = {
        jobDescription: settings.jobDescription,
        biography: bioForApi,
        pageCount: settings.pageCount,
      };

      const result = await apiCall<{
        analysis: HighLevelAnalysis;
        llmAnalysis?: HighLevelAnalysis;
        debug?: { systemPrompt?: string; userPrompt?: string };
      }>(
        "/api/llm/analyze",
        analyzeBody,
        debug,
        {
          systemPrompt: ANALYSIS_PROMPT,
          userPrompt: JSON.stringify(analyzeUserPayload, null, 2),
        },
      );

      const llmAnalysis = normalizeAnalysis(
        result.llmAnalysis ?? result.analysis,
      );
      const nextAnalysis = expandAnalysisForPageBudget(
        bioForApi,
        applyInterestPriority(
          bioForApi,
          applyEducationPriority(
            bioForApi,
            completeAnalysis(bioForApi, llmAnalysis),
          ),
        ),
        settings.pageCount,
      );
      setAnalysis(nextAnalysis);
      setAnalyzing(false);

      await generateTexts(bioForApi, nextAnalysis);
    } catch {
      setAnalyzing(false);
    }
  }, [
    biography,
    settings.jobDescription,
    settings.anonymousMode,
    settings.pageCount,
    debug,
    injectIdsAndStore,
    generateTexts,
  ]);

  const handleRegenerateTexts = useCallback(async () => {
    if (!biography || !analysis || !settings.jobDescription.trim()) return;

    try {
      const withIds = await injectIdsAndStore(biography);
      const bioForApi = settings.anonymousMode
        ? applyAnonymousMode(withIds)
        : withIds;
      await generateTexts(bioForApi, analysis);
    } catch {
      // Error logged in debug panel
    }
  }, [
    biography,
    analysis,
    settings.jobDescription,
    settings.anonymousMode,
    injectIdsAndStore,
    generateTexts,
  ]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Resume Generator</h1>

      <SettingsSection
        settings={settings}
        onChange={handleSettingsChange}
        biography={biography}
        onBiographyChange={handleBiographyChange}
        conversionMessage={conversionMessage}
        onConversionMessage={setConversionMessage}
      />

      <div className="grid gap-4 lg:grid-cols-2 items-stretch h-[calc(100vh-6rem)] min-h-[560px]">
        <AnalysisSection
          analysis={analysis}
          biography={biography}
          loading={analyzing}
          generating={generating}
          onAnalyze={handleAnalyze}
          onAnalysisChange={setAnalysis}
          canAnalyze={canAnalyze}
          generatedTexts={generatedTexts}
          onGeneratedTextsChange={setGeneratedTexts}
          onRegenerateTexts={handleRegenerateTexts}
          canRegenerateTexts={canRegenerateTexts}
          textsStale={textsStale}
          scrollToId={contentScrollToId}
          onScrollHandled={() => setContentScrollToId(null)}
          onContentItemClick={setCvScrollToId}
          placedBulletCounts={placedBulletCounts}
        />

        <CvPreviewSection
          biography={effectiveBiography}
          analysis={analysis}
          generatedTexts={generatedTexts}
          loading={generating}
          pageCount={settings.pageCount}
          compact
          onExperienceClick={setContentScrollToId}
          scrollToId={cvScrollToId}
          onScrollHandled={() => setCvScrollToId(null)}
          onPlacedBulletCountsChange={setPlacedBulletCounts}
        />
      </div>
    </div>
  );
}
