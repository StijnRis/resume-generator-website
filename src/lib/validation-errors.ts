import type { ErrorObject } from "ajv";

export interface ValidationErrorItem {
  path: string;
  message: string;
}

export function formatValidationErrorItem(error: ErrorObject): ValidationErrorItem {
  const basePath = error.instancePath
    ? error.instancePath.replace(/^\//, "").replace(/\//g, ".")
    : "";

  if (error.keyword === "required" && error.params?.missingProperty) {
    const missing = String(error.params.missingProperty);
    return {
      path: basePath ? `${basePath}.${missing}` : missing,
      message: "Required field is missing",
    };
  }

  if (error.keyword === "additionalProperties" && error.params?.additionalProperty) {
    const extra = String(error.params.additionalProperty);
    return {
      path: basePath || "(root)",
      message: `Unknown property "${extra}" is not allowed`,
    };
  }

  if (error.keyword === "enum" && Array.isArray(error.params?.allowedValues)) {
    return {
      path: basePath || "(root)",
      message: `Must be one of: ${error.params.allowedValues.join(", ")}`,
    };
  }

  // Skip noisy composite anyOf/oneOf errors when specific errors exist
  if (error.keyword === "anyOf" || error.keyword === "oneOf") {
    return {
      path: basePath || "(root)",
      message: "Value does not match expected structure",
      _skipIfSpecific: true,
    } as ValidationErrorItem & { _skipIfSpecific?: boolean };
  }

  if (error.keyword === "type") {
    return {
      path: basePath || "(root)",
      message: `Expected ${String(error.params?.type ?? "a different type")}`,
      _skipIfSpecific: true,
    } as ValidationErrorItem & { _skipIfSpecific?: boolean };
  }

  return {
    path: basePath || "(root)",
    message: error.message ?? "Invalid value",
  };
}

export function dedupeValidationErrors(
  items: ValidationErrorItem[],
): ValidationErrorItem[] {
  const seen = new Set<string>();
  const result: ValidationErrorItem[] = [];
  const hasSpecific = items.some(
    (item) =>
      !item.message.includes("does not match expected structure") &&
      !item.message.startsWith("Expected "),
  );

  for (const item of items) {
    const extended = item as ValidationErrorItem & { _skipIfSpecific?: boolean };
    if (hasSpecific && extended._skipIfSpecific) continue;

    const key = `${item.path}::${item.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ path: item.path, message: item.message });
  }

  return result;
}

export function formatValidationErrorsList(
  errors: ErrorObject[] | null | undefined,
): ValidationErrorItem[] {
  if (!errors?.length) {
    return [{ path: "(root)", message: "Unknown validation error" }];
  }

  return dedupeValidationErrors(errors.map(formatValidationErrorItem));
}

export function formatValidationErrorsText(
  errors: ErrorObject[] | null | undefined,
): string {
  return formatValidationErrorsList(errors)
    .map((item) => `${item.path}: ${item.message}`)
    .join("; ");
}
