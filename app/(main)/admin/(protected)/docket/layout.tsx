// app/(main)/admin/(protected)/docket/layout.tsx
// Same pattern as cargo/layout.tsx — deliberately a top-level section,
// NOT nested under cargo/, so a role can grant "docket" without also
// granting "cargo" (nesting would force every docket page through
// cargo's layout guard first, making that impossible).

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { requireStaffSection } from "@/lib/auth/staffAuth";

export default async function DocketLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (admin) return <>{children}</>;

  const result = await requireStaffSection("docket");
  if (!result.ok) {
    const destination = result.reason === "no_session" ? "/staff/login?redirect=/admin/docket" : "/admin/dashboard";
    redirect(destination);
  }

  return <>{children}</>;
}