import type {
  Basics,
  Biography,
  ContactDetail,
  ContactKind,
  Location,
  Profile,
} from "@/lib/types";
import { formatLocationObject } from "@/lib/formatting/location";
import {
  formatContactValueIfPhone,
  looksLikePhoneNumber,
} from "@/lib/formatting/phone";
import { v4 as uuidv4 } from "uuid";

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
    String(profile.network ?? "")
      .toLowerCase()
      .includes(networkMatch),
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
      .replace(
        new RegExp(
          `^https?:\\/\\/(www\\.)?${host.replace(".", "\\.")}\\/?`,
          "i",
        ),
        "",
      )
      .replace(/\/$/, "") || trimmed;

  const next: Profile = { network, username, url };
  const key = network.toLowerCase();
  const without = profiles.filter(
    (profile) =>
      !String(profile.network ?? "")
        .toLowerCase()
        .includes(key),
  );
  return [...without, next];
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function looksLikeLinkedIn(value: string): boolean {
  return /linkedin\.com/i.test(value) || /^in\/[\w-]+$/i.test(value.trim());
}

function looksLikeGitHub(value: string): boolean {
  return /github\.com/i.test(value);
}

function normalizeContactDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (looksLikePhoneNumber(trimmed)) return formatContactValueIfPhone(trimmed);
  if (looksLikeLinkedIn(trimmed) || looksLikeGitHub(trimmed)) {
    return trimmed.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
  return trimmed;
}

/** Build default editable contact rows from biography basics. */
export function contactsFromBiography(biography: Biography): ContactDetail[] {
  const email = nonEmpty(biography.basics.email) ?? "";
  const phone = nonEmpty(biography.basics.phone)
    ? formatContactValueIfPhone(biography.basics.phone)
    : "";
  const linkedinDisplay = getLinkedInDisplay(biography.basics.profiles);
  const linkedin =
    linkedinDisplay && linkedinDisplay !== CV_HEADER_DEFAULTS.linkedin
      ? linkedinDisplay
      : "";

  const extras: ContactDetail[] = [];
  const github = getGitHubDisplay(biography.basics.profiles);
  if (github && github !== CV_HEADER_DEFAULTS.github) {
    extras.push({ id: uuidv4(), kind: "other", value: github });
  }

  const locationText = biography.basics.location
    ? formatLocationObject(biography.basics.location as Location)
    : "";
  if (nonEmpty(locationText)) {
    extras.push({ id: uuidv4(), kind: "other", value: locationText });
  }

  return ensureReservedContacts([
    { id: uuidv4(), kind: "email", value: email },
    { id: uuidv4(), kind: "phone", value: phone },
    { id: uuidv4(), kind: "linkedin", value: linkedin },
    ...extras,
  ]);
}

/** Empty starter contact rows: email, phone, LinkedIn. */
export function emptyContactDetails(): ContactDetail[] {
  return ensureReservedContacts([]);
}

const RESERVED_KINDS: ContactKind[] = ["email", "phone", "linkedin"];

function inferContactKind(value: string): ContactKind | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (looksLikeEmail(trimmed)) return "email";
  if (looksLikePhoneNumber(trimmed)) return "phone";
  if (looksLikeLinkedIn(trimmed)) return "linkedin";
  return "other";
}

/** Always keep one email, one phone, and one LinkedIn field. */
export function ensureReservedContacts(
  contacts: ContactDetail[],
): ContactDetail[] {
  const unused = [...contacts];
  const take = (kind: ContactKind): ContactDetail => {
    const byKind = unused.findIndex((entry) => entry.kind === kind);
    if (byKind >= 0) {
      const [entry] = unused.splice(byKind, 1);
      return { ...entry, kind, value: entry.value };
    }
    const inferred = unused.findIndex(
      (entry) => inferContactKind(entry.value) === kind,
    );
    if (inferred >= 0) {
      const [entry] = unused.splice(inferred, 1);
      return { ...entry, kind, value: entry.value };
    }
    return { id: `reserved-${kind}`, kind, value: "" };
  };

  const reserved = RESERVED_KINDS.map(take);
  const extras = unused.map((entry) => {
    const kind: ContactKind =
      entry.kind === "email" ||
      entry.kind === "phone" ||
      entry.kind === "linkedin"
        ? "other"
        : (entry.kind ?? "other");
    return { ...entry, kind };
  });
  return [...reserved, ...extras];
}

/**
 * Apply Settings contact fields onto a biography.
 * Non-empty contact values win; phone numbers are auto-formatted.
 * Sets basics.header_contacts to the ordered display list.
 */
export function applyContactSettings(
  biography: Biography,
  contacts:
    | ContactDetail[]
    | {
        email?: string;
        phone?: string;
        linkedin?: string;
        github?: string;
      },
): Biography {
  // Legacy shape support (tests / older callers).
  if (!Array.isArray(contacts)) {
    const email = nonEmpty(contacts.email);
    const phone = nonEmpty(contacts.phone);
    const linkedin = nonEmpty(contacts.linkedin);
    const github = nonEmpty(contacts.github);

    let profiles = biography.basics.profiles ?? [];
    if (linkedin) profiles = upsertProfile(profiles, "LinkedIn", linkedin);
    if (github) profiles = upsertProfile(profiles, "GitHub", github);

    const header: string[] = [];
    if (email) header.push(email);
    if (phone) header.push(formatContactValueIfPhone(phone));
    if (linkedin) {
      header.push(linkedin.replace(/^https?:\/\//i, "").replace(/\/$/, ""));
    }
    if (github) {
      header.push(github.replace(/^https?:\/\//i, "").replace(/\/$/, ""));
    }
    const locationText = biography.basics.location
      ? formatLocationObject(biography.basics.location as Location)
      : "";
    if (nonEmpty(locationText)) header.push(locationText);

    return {
      ...biography,
      basics: {
        ...biography.basics,
        email: email ?? biography.basics.email,
        phone: phone
          ? formatContactValueIfPhone(phone)
          : biography.basics.phone,
        profiles,
        header_contacts: header,
      },
    };
  }

  const ordered = ensureReservedContacts(contacts);
  const displayValues = ordered
    .map((entry) => normalizeContactDisplay(entry.value))
    .filter(Boolean);

  let email = biography.basics.email;
  let phone = biography.basics.phone;
  let profiles = biography.basics.profiles ?? [];

  for (const entry of ordered) {
    const raw = normalizeContactDisplay(entry.value);
    if (!raw) continue;
    if (entry.kind === "email") {
      email = raw;
      continue;
    }
    if (entry.kind === "phone") {
      phone = formatContactValueIfPhone(raw);
      continue;
    }
    if (entry.kind === "linkedin") {
      profiles = upsertProfile(profiles, "LinkedIn", raw);
      continue;
    }
    if (looksLikeEmail(raw)) {
      email = raw;
      continue;
    }
    if (looksLikePhoneNumber(raw)) {
      phone = formatContactValueIfPhone(raw);
      continue;
    }
    if (looksLikeLinkedIn(raw)) {
      profiles = upsertProfile(profiles, "LinkedIn", raw);
      continue;
    }
    if (looksLikeGitHub(raw)) {
      profiles = upsertProfile(profiles, "GitHub", raw);
    }
  }

  return {
    ...biography,
    basics: {
      ...biography.basics,
      email,
      phone,
      profiles,
      header_contacts: displayValues,
    },
  };
}

export function getHeaderContactLine(basics: Basics): string[] {
  if (Array.isArray(basics.header_contacts)) {
    return basics.header_contacts.map((value) => value.trim()).filter(Boolean);
  }

  const locationText = basics.location
    ? formatLocationObject(basics.location as Location)
    : "";

  return [
    nonEmpty(basics.email) ?? CV_HEADER_DEFAULTS.email,
    nonEmpty(basics.phone)
      ? formatContactValueIfPhone(basics.phone)
      : CV_HEADER_DEFAULTS.phone,
    getLinkedInDisplay(basics.profiles),
    getGitHubDisplay(basics.profiles),
    nonEmpty(locationText) ?? CV_HEADER_DEFAULTS.location,
  ];
}
