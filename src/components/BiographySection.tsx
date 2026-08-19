"use client";

import { useCallback, useRef, useState } from "react";

import { BiographyCards } from "@/components/BiographyCards";
import { ValidationErrorList } from "@/components/ValidationErrorList";
import { applyBiographyMapping } from "@/lib/biography/transform";
import {
  getBiographyValidationErrorItems,
  prepareBiographyFromUpload,
} from "@/lib/biography/validate";
import { apiCall, useDebug } from "@/lib/debug/context";
import type { Biography, BiographyKeyMapping } from "@/lib/types";
import type { ValidationErrorItem } from "@/lib/validation-errors";

interface BiographySectionProps {
  biography: Biography | null;
  biographyJson: string;
  onBiographyChange: (bio: Biography, json: string) => void;
  conversionMessage: string | null;
  onConversionMessage: (msg: string | null) => void;
}

export function BiographySection({
  biography,
  onBiographyChange,
  conversionMessage,
  onConversionMessage,
}: BiographySectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debug = useDebug();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formatErrors, setFormatErrors] = useState<
    ValidationErrorItem[] | null
  >(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      setFormatErrors(null);
      onConversionMessage(null);

      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;

        const prepared = prepareBiographyFromUpload(parsed);
        if (prepared) {
          const formatted = JSON.stringify(parsed, null, 2);
          onBiographyChange(prepared.biography, formatted);

          if (!prepared.schemaValid) {
            const warnings = getBiographyValidationErrorItems(parsed) ?? [];
            if (warnings.length > 0) {
              setFormatErrors(warnings);
              onConversionMessage(
                "Biography loaded. Some optional fields differ from the strict schema but your data was accepted.",
              );
            }
          }
          return;
        }

        const validationErrors = getBiographyValidationErrorItems(parsed) ?? [];
        setFormatErrors(validationErrors);
        onConversionMessage("AI is converting it for you...");

        const result = await apiCall<{ mapping: BiographyKeyMapping }>(
          "/api/llm/convert-biography",
          { sourceJson: parsed },
          debug,
        );

        const converted = applyBiographyMapping(parsed, result.mapping);
        const reprepared = prepareBiographyFromUpload(converted);

        if (!reprepared) {
          throw new Error(
            "Conversion produced an unrecognized biography. Please upload a different file.",
          );
        }

        setFormatErrors(null);
        onConversionMessage(
          "AI converted your biography to the expected format.",
        );
        const formatted = JSON.stringify(converted, null, 2);
        onBiographyChange(reprepared.biography, formatted);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to process file";
        console.error("[BiographySection] Upload failed:", err);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [debug, onBiographyChange, onConversionMessage],
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">Biography</h2>

      <div className="space-y-4">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {loading ? "Processing..." : "Upload biography.json"}
          </button>
        </div>

        {formatErrors && formatErrors.length > 0 && (
          <ValidationErrorList
            title={
              conversionMessage?.includes("AI is converting")
                ? "Your file wasn't in the expected format:"
                : "Format notes (biography still loaded):"
            }
            errors={formatErrors}
            footer={conversionMessage ?? undefined}
          />
        )}

        {!formatErrors && conversionMessage && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
            {conversionMessage}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {biography && <BiographyCards biography={biography} />}
      </div>
    </section>
  );
}
