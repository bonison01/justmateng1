// app/(main)/admin/(protected)/staff/layout.tsx
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";

// Deliberately admin-only. "staff" is excluded from SECTION_KEYS in
// lib/permissions.ts, so no role can ever grant a staff member access
// here — otherwise a staff member could create new staff accounts or
// grant themselves broader permissions.
export default async function StaffAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/admin/login?redirect=/admin/staff");
  }

  return <>{children}</>;
}