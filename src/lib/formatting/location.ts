import type { Location } from "@/lib/types";

export function formatLocationString(location: string): string {
  return location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function formatLocationObject(location: Location): string {
  const parts = [location.city, location.region, location.country].filter(
    (p) => p && p.trim(),
  );
  return parts.join(", ");
}

export function formatCountryCode(code: string): string {
  return code.trim().toUpperCase();
}
