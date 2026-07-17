import Ajv, { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

import biographySchema from "./schemas/biography.json";
import biographyMappingSchema from "./schemas/biography-mapping.json";
import batchedCvTextSchema from "./schemas/batched-cv-text.json";
import experienceTextSchema from "./schemas/experience-text.json";
import relevanceSchema from "./schemas/relevance.json";
import resumeSchema from "./schemas/resume.json";
import translateSchema from "./schemas/translate.json";
import {
  formatValidationErrorsList,
  formatValidationErrorsText,
  type ValidationErrorItem,
} from "./validation-errors";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validators = {
  biography: ajv.compile(biographySchema),
  biographyMapping: ajv.compile(biographyMappingSchema),
  relevance: ajv.compile(relevanceSchema),
  resume: ajv.compile(resumeSchema),
  experienceText: ajv.compile(experienceTextSchema),
  batchedCvText: ajv.compile(batchedCvTextSchema),
  translate: ajv.compile(translateSchema),
};

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: ErrorObject[] | null;
  errorItems?: ValidationErrorItem[];
  errorMessage?: string;
}

export function validateWithSchema<T>(
  schemaName: keyof typeof validators,
  data: unknown,
): ValidationResult<T> {
  const validate = validators[schemaName] as ValidateFunction;
  const valid = validate(data);

  if (valid) {
    return { valid: true, data: data as T };
  }

  return {
    valid: false,
    errors: validate.errors,
    errorItems: formatValidationErrorsList(validate.errors),
    errorMessage: formatValidationErrorsText(validate.errors),
  };
}

export function parseAndValidateJson<T>(
  schemaName: keyof typeof validators,
  raw: string,
): ValidationResult<T> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return validateWithSchema<T>(schemaName, parsed);
  } catch (error) {
    return {
      valid: false,
      errorMessage:
        error instanceof Error ? error.message : "Invalid JSON payload",
    };
  }
}
