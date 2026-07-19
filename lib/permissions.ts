// lib/permissions.ts
//
// Canonical list of admin sections that a staff role can be granted
// access to. Keep this in sync with SECTIONS in
// app/(main)/admin/(protected)/dashboard/page.tsx whenever a new admin
// section folder is added.
//
// "staff" (this feature) and "team" (admin account approval) are
// deliberately excluded — those manage other people's accounts and
// permissions, and stay admin-only. They must never be assignable to a
// staff role, otherwise a staff member could grant themselves more
// access than an admin intended.

export const SECTION_KEYS = [
  "cargo",
  "businesses_verify",
  "edufest",
  "event_banners",
  "events_list",
  "docket",
  "docket_list",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  cargo: "Cargo",
  businesses_verify: "Businesses Verify",
  edufest: "Edufest",
  event_banners: "Event Banners",
  events_list: "Events List",
  docket: "Docket",
  docket_list: "Docket List",
};

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}