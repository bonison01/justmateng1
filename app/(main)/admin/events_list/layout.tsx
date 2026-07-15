// app/(main)/admin/(protected)/events_list/layout.tsx
// Copied from cargo/layout.tsx — see that file for the full explanation.

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { requireStaffSection } from "@/lib/auth/staffAuth";

export default async function EventsListLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (admin) return <>{children}</>;

  const result = await requireStaffSection("events_list");
  if (!result.ok) {
    const destination = result.reason === "no_session" ? "/staff/login?redirect=/admin/events_list" : "/admin/dashboard";
    redirect(destination);
  }

  return <>{children}</>;
}