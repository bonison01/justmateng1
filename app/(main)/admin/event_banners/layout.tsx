// app/(main)/admin/(protected)/event_banners/layout.tsx
// Copied from cargo/layout.tsx — see that file for the full explanation.

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { requireStaffSection } from "@/lib/auth/staffAuth";

export default async function EventBannersLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (admin) return <>{children}</>;

  const result = await requireStaffSection("event_banners");
  if (!result.ok) {
    const destination = result.reason === "no_session" ? "/staff/login?redirect=/admin/event_banners" : "/admin/dashboard";
    redirect(destination);
  }

  return <>{children}</>;
}