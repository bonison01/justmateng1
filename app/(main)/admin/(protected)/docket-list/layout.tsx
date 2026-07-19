// app/(main)/admin/(protected)/docket-list/layout.tsx
// Independent permission from "docket" — a role can be granted one
// without the other, e.g. someone who can only view the docket list
// but not create/edit individual dockets, or vice versa.

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { requireStaffSection } from "@/lib/auth/staffAuth";

export default async function DocketListLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (admin) return <>{children}</>;

  const result = await requireStaffSection("docket_list");
  if (!result.ok) {
    const destination =
      result.reason === "no_session" ? "/staff/login?redirect=/admin/docket-list" : "/admin/dashboard";
    redirect(destination);
  }

  return <>{children}</>;
}