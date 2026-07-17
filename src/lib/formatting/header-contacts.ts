import type { Basics, Biography, Location, Profile } from "@/lib/types";
import { formatLocationObject } from "@/lib/formatting/location";

export const CV_HEADER_DEFAULTS = {
  email: "email@example.com",
  phone: "+00 000 000 000",
  linkedin: "linkedin.com/in/username",
  github: "github.com/username",
  location: "City, Country",
} as const;

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function findProfile(
  profiles: Profile[] | undefined,
  networkMatch: string,
): Profile | undefined {
  if (!Array.isArray(profiles)) return undefined;
  return profiles.find((profile) =>
    String(profile.network ?? "").toLowerCase().includes(networkMatch),
  );
}

function displayProfileUrl(
  profile: Profile | undefined,
  network: "linkedin" | "github",
  fallback: string,
): string {
  if (!profile) return fallback;

  const url = nonEmpty(profile.url);
  if (url) {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }

  const username = nonEmpty(profile.username);
  if (username) {
    if (username.includes(`${network}.com`)) return username;
    return network === "linkedin"
      ? `linkedin.com/in/${username.replace(/^\/+/, "")}`
      : `github.com/${username.replace(/^\/+/, "")}`;
  }

  return fallback;
}

export function getLinkedInDisplay(profiles: Profile[] | undefined): string {
  return displayProfileUrl(
    findProfile(profiles, "linkedin"),
    "linkedin",
    CV_HEADER_DEFAULTS.linkedin,
  );
}

export function getGitHubDisplay(profiles: Profile[] | undefined): string {
  return displayProfileUrl(
    findProfile(profiles, "github"),
    "github",
    CV_HEADER_DEFAULTS.github,
  );
}

function upsertProfile(
  profiles: Profile[],
  network: "LinkedIn" | "GitHub",
  value: string,
): Profile[] {
  const trimmed = value.trim();
  if (!trimmed) return profiles;

  const host = network === "LinkedIn" ? "linkedin.com/in" : "github.com";
  const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  const username =
    trimmed
      .replace(new RegExp(`^https?:\\/\\/(www\\.)?${host.replace(".", "\\.")}\\/?`, "i"), "")
      .replace(/\/$/, "") || trimmed;

  const next: Profile = { network, username, url };
  const key = network.toLowerCase();
  const without = profiles.filter(
    (profile) => !String(profile.network ?? "").toLowerCase().includes(key),
  );
  return [...without, next];
}

/** Apply Settings contact fields onto a biography (non-empty settings win). */
export function applyContactSettings(
  biography: Biography,
  contacts: {
    email?: string;
    phone?: string;
    linkedin?: string;
    github?: string;
  },
): Biography {
  const email = nonEmpty(contacts.email);
  const phone = nonEmpty(contacts.phone);
  const linkedin = nonEmpty(contacts.linkedin);
  const github = nonEmpty(contacts.github);

  let profiles = biography.basics.profiles ?? [];
  if (linkedin) profiles = upsertProfile(profiles, "LinkedIn", linkedin);
  if (github) profiles = upsertProfile(profiles, "GitHub", github);

  return {
    ...biography,
    basics: {
      ...biography.basics,
      email: email ?? biography.basics.email,
      phone: phone ?? biography.basics.phone,
      profiles,
    },
  };
}

export function getHeaderContactLine(basics: Basics): {
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  location: string;
} {
  const locationText = basics.location
    ? formatLocationObject(basics.location as Location)
    : "";

  return {
    email: nonEmpty(basics.email) ?? CV_HEADER_DEFAULTS.email,
    phone: nonEmpty(basics.phone) ?? CV_HEADER_DEFAULTS.phone,
    linkedin: getLinkedInDisplay(basics.profiles),
    github: getGitHubDisplay(basics.profiles),
    location: nonEmpty(locationText) ?? CV_HEADER_DEFAULTS.location,
  };
}
