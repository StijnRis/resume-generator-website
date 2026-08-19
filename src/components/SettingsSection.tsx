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
import {
  contactsFromBiography,
  ensureReservedContacts,
} from "@/lib/formatting/header-contacts";
import { formatContactValueIfPhone } from "@/lib/formatting/phone";
import {
  CV_LANGUAGES,
  detectLanguageFromText,
  languageLabel,
} from "@/lib/language";
import type {
  Biography,
  BiographyKeyMapping,
  GenerationSettings,
} from "@/lib/types";
import type { ValidationErrorItem } from "@/lib/validation-errors";

interface SettingsSectionProps {
  settings: GenerationSettings;
  onChange: (settings: GenerationSettings) => void;
  biography: Biography | null;
  onBiographyChange: (bio: Biography, json: string) => void;
  conversionMessage: string | null;
  onConversionMessage: (msg: string | null) => void;
}

export function SettingsSection({
  settings,
  onChange,
  biography,
  onBiographyChange,
  conversionMessage,
  onConversionMessage,
}: SettingsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debug = useDebug();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formatErrors, setFormatErrors] = useState<ValidationErrorItem[] | null>(
    null,
  );
  const [biographyOpen, setBiographyOpen] = useState(false);

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
          onChange({
            ...settings,
            contacts: contactsFromBiography(prepared.biography),
          });
          setBiographyOpen(false);

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
        onChange({
          ...settings,
          contacts: contactsFromBiography(reprepared.biography),
        });
        setBiographyOpen(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to process file";
        console.error("[SettingsSection] Upload failed:", err);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [debug, onBiographyChange, onChange, onConversionMessage, settings],
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">Settings</h2>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="job-description"
            className="block text-sm font-medium text-zinc-700 mb-1"
          >
            Job Description
          </label>
          <textarea
            id="job-description"
            rows={6}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="Paste the job description here..."
            value={settings.jobDescription}
            onChange={(e) => {
              const jobDescription = e.target.value;
              const previous = settings.jobDescription.trim();
              const next = jobDescription.trim();
              // Only auto-detect when the JD first becomes substantial, so a
              // manual language override is not wiped on every keystroke.
              const shouldDetect =
                previous.length < 20 && next.length >= 20;
              onChange({
                ...settings,
                jobDescription,
                ...(shouldDetect
                  ? { language: detectLanguageFromText(jobDescription) }
                  : {}),
              });
            }}
          />
        </div>

        <div>
          <label
            htmlFor="cv-language"
            className="block text-sm font-medium text-zinc-700 mb-1"
          >
            Resume language
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="cv-language"
              className="w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
              value={settings.language}
              onChange={(e) =>
                onChange({ ...settings, language: e.target.value })
              }
            >
              {CV_LANGUAGES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.label}
                </option>
              ))}
              {!CV_LANGUAGES.some((entry) => entry.code === settings.language) && (
                <option value={settings.language}>
                  {languageLabel(settings.language)}
                </option>
              )}
            </select>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...settings,
                  language: detectLanguageFromText(settings.jobDescription),
                })
              }
              className="text-xs text-blue-600 hover:underline"
            >
              Detect from job description
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-700 mb-2">Biography</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {loading ? "Processing..." : "Upload biography.json"}
            </button>
            {biography && (
              <button
                type="button"
                onClick={() => setBiographyOpen((open) => !open)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                {biographyOpen ? "Hide parsed biography" : "Show parsed biography"}
              </button>
            )}
            {biography && !biographyOpen && (
              <span className="text-sm text-zinc-500">
                Biography loaded ({biography.basics.name || "unnamed"})
              </span>
            )}
          </div>

          {formatErrors && formatErrors.length > 0 && (
            <div className="mt-3">
              <ValidationErrorList
                title={
                  conversionMessage?.includes("AI is converting")
                    ? "Your file wasn't in the expected format:"
                    : "Format notes (biography still loaded):"
                }
                errors={formatErrors}
                footer={conversionMessage ?? undefined}
              />
            </div>
          )}

          {!formatErrors && conversionMessage && (
            <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              {conversionMessage}
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {biography && biographyOpen && (
            <div className="mt-4 border-t border-zinc-200 pt-4">
              <BiographyCards biography={biography} />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-zinc-700">Contact details</p>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...settings,
                  contacts: [
                    ...ensureReservedContacts(settings.contacts),
                    { id: crypto.randomUUID(), kind: "other", value: "" },
                  ],
                })
              }
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              + Add contact
            </button>
          </div>
          <div className="space-y-2">
            {ensureReservedContacts(settings.contacts).map((contact) => {
              const reserved =
                contact.kind === "email" ||
                contact.kind === "phone" ||
                contact.kind === "linkedin";
              const label =
                contact.kind === "email"
                  ? "Email"
                  : contact.kind === "phone"
                    ? "Phone"
                    : contact.kind === "linkedin"
                      ? "LinkedIn"
                      : "Other";
              const placeholder =
                contact.kind === "email"
                  ? "email@example.com"
                  : contact.kind === "phone"
                    ? "+31 6 12 34 56 78"
                    : contact.kind === "linkedin"
                      ? "linkedin.com/in/…"
                      : "github.com/… or any contact";
              return (
                <div key={contact.id} className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-xs font-medium text-zinc-600">
                    {label}
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder={placeholder}
                    value={contact.value}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      onChange({
                        ...settings,
                        contacts: ensureReservedContacts(settings.contacts).map(
                          (entry) =>
                            entry.id === contact.id
                              ? { ...entry, value: nextValue }
                              : entry,
                        ),
                      });
                    }}
                    onBlur={(e) => {
                      const formatted = formatContactValueIfPhone(
                        e.target.value,
                      );
                      if (formatted === e.target.value) return;
                      onChange({
                        ...settings,
                        contacts: ensureReservedContacts(settings.contacts).map(
                          (entry) =>
                            entry.id === contact.id
                              ? { ...entry, value: formatted }
                              : entry,
                        ),
                      });
                    }}
                  />
                  {!reserved && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...settings,
                          contacts: ensureReservedContacts(
                            settings.contacts,
                          ).filter((entry) => entry.id !== contact.id),
                        })
                      }
                      className="shrink-0 rounded-lg border border-zinc-200 px-2 py-2 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                      aria-label="Remove contact"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.anonymousMode}
            onChange={(e) =>
              onChange({ ...settings, anonymousMode: e.target.checked })
            }
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-zinc-700">
            Anonymous mode
          </span>
        </label>

        <div>
          <label
            htmlFor="page-count"
            className="block text-sm font-medium text-zinc-700 mb-1"
          >
            Page count
          </label>
          <input
            id="page-count"
            type="number"
            min={1}
            max={5}
            value={settings.pageCount}
            onChange={(e) =>
              onChange({
                ...settings,
                pageCount: Math.min(
                  5,
                  Math.max(1, parseInt(e.target.value, 10) || 1),
                ),
              })
            }
            className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>
    </section>
  );
}
