import {
  isRecognizedBiographyShape,
  normalizeUploadedBiography,
} from "@/lib/biography/normalize-upload";
import { getExperiences } from "@/lib/biography/flat";
import { validateWithSchema } from "@/lib/validation";
import type { Biography } from "@/lib/types";
import type { ValidationErrorItem } from "@/lib/validation-errors";

function getExperienceDateWarnings(
  biography: Biography,
): ValidationErrorItem[] {
  const warnings: ValidationErrorItem[] = [];
  const items = getExperiences(biography);

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const base = `${item.type}[${index}]`;
    const start = String(item.start_date ?? "").trim();
    const end = item.end_date;
    const hasEnd =
      end !== undefined && end !== null && String(end).trim().length > 0;

    if (!start) {
      warnings.push({
        path: `${base}.start_date`,
        message: "Missing start date",
      });
    }
    if (!hasEnd) {
      warnings.push({
        path: `${base}.end_date`,
        message: "Missing end date",
      });
    }
  }

  return warnings;
}

export function isValidBiography(data: unknown): boolean {
  if (isRecognizedBiographyShape(data)) {
    return true;
  }
  return validateWithSchema<Biography>("biography", data).valid;
}

export function prepareBiographyFromUpload(
  data: unknown,
): { biography: Biography; schemaValid: boolean } | null {
  if (!isRecognizedBiographyShape(data)) {
    return null;
  }

  const schemaValid = validateWithSchema<Biography>("biography", data).valid;
  return {
    biography: normalizeUploadedBiography(data),
    schemaValid,
  };
}

export function getBiographyValidationErrorItems(data: unknown) {
  const result = validateWithSchema<Biography>("biography", data);
  const schemaErrors = result.valid ? [] : (result.errorItems ?? []);
  if (!isRecognizedBiographyShape(data))
    return schemaErrors.length ? schemaErrors : null;

  const dateWarnings = getExperienceDateWarnings(
    normalizeUploadedBiography(data),
  );
  const combined = [...schemaErrors, ...dateWarnings];
  return combined.length ? combined : null;
}

export function getBiographyValidationErrors(data: unknown): string | null {
  const items = getBiographyValidationErrorItems(data);
  if (!items?.length) return null;
  return items.map((item) => `${item.path}: ${item.message}`).join("; ");
}
