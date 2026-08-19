import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

const PHONE_CANDIDATE =
  /^[+()]?(?=.*\d.*\d.*\d.*\d.*\d.*\d.*\d.*\d)[\d\s()./\-]{7,22}$/;

/** True when the value looks like a phone number (not email/URL). */
export function looksLikePhoneNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/@/.test(trimmed)) return false;
  if (/https?:\/\//i.test(trimmed) || /\.(com|org|net|io)\b/i.test(trimmed)) {
    return false;
  }
  return PHONE_CANDIDATE.test(trimmed);
}

/**
 * Format a phone number for CV display using libphonenumber-js.
 * Prefer international format when valid; otherwise as-you-type.
 */
export function formatPhoneNumber(
  value: string,
  defaultCountry: CountryCode = "NL",
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const parsed =
    parsePhoneNumberFromString(trimmed) ??
    parsePhoneNumberFromString(trimmed, defaultCountry);

  if (parsed?.isValid()) {
    return parsed.formatInternational();
  }

  const formatter = trimmed.startsWith("+")
    ? new AsYouType()
    : new AsYouType(defaultCountry);
  const formatted = formatter.input(trimmed);
  return formatted || trimmed;
}

/** Format only when the value is detected as a phone number. */
export function formatContactValueIfPhone(value: string): string {
  if (!looksLikePhoneNumber(value)) return value;
  return formatPhoneNumber(value);
}
