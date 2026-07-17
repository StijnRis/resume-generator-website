import { formatLocationString } from "@/lib/formatting/location";

function normalizeLocationKey(location: string): string {
  return formatLocationString(location).toLowerCase().trim();
}

/** If all non-empty locations match, return that location; otherwise null. */
export function getSharedLocation(
  locations: (string | null | undefined)[],
): string | null {
  const normalized = locations
    .map((location) => formatLocationString(String(location ?? "")))
    .filter(Boolean);

  if (normalized.length === 0) return null;

  const firstKey = normalizeLocationKey(normalized[0]);
  if (normalized.every((location) => normalizeLocationKey(location) === firstKey)) {
    return normalized[0];
  }

  return null;
}

/** If all non-empty organizations match, return that org; otherwise null. */
export function getSharedOrganization(
  organizations: (string | null | undefined)[],
): string | null {
  const normalized = organizations
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (normalized.length === 0) return null;

  const firstKey = normalized[0].toLowerCase();
  if (normalized.every((value) => value.toLowerCase() === firstKey)) {
    return normalized[0];
  }

  return null;
}
