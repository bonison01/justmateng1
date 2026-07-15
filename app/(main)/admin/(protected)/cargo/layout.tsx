// app/(main)/admin/(protected)/cargo/layout.tsx
//
// PATTERN TO COPY into every other section under app/(main)/admin/(protected)/
// that appears in SECTION_KEYS (businesses_verify, edufest, event_banners,
// events_list) — swap the `requireStaffSection("cargo")` argument and the
// redirect query string for each one.
//
// Order of checks matters: an admin session always wins outright (admins
// can reach every section regardless of role), and only falls through to
// the staff permission check if there's no admin session.

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { requireStaffSection } from "@/lib/auth/staffAuth";

export default async function CargoLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (admin) return <>{children}</>;

  const result = await requireStaffSection("cargo");
  if (!result.ok) {
    // no_session -> not logged in at all, send to staff login.
    // no_role / disabled / forbidden -> logged in but not permitted here.
    const destination = result.reason === "no_session" ? "/staff/login?redirect=/admin/cargo" : "/admin/dashboard";
    redirect(destination);
  }

  return <>{children}</>;
}