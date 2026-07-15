// app/(main)/admin/(protected)/edufest/layout.tsx
// Copied from cargo/layout.tsx — see that file for the full explanation.

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { requireStaffSection } from "@/lib/auth/staffAuth";

export default async function EdufestLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (admin) return <>{children}</>;

  const result = await requireStaffSection("edufest");
  if (!result.ok) {
    const destination = result.reason === "no_session" ? "/staff/login?redirect=/admin/edufest" : "/admin/dashboard";
    redirect(destination);
  }

  return <>{children}</>;
}