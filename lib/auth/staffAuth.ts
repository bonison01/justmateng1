// lib/auth/staffAuth.ts
//
// Mirrors your existing adminAuth.ts (httpOnly session cookie, verified
// server-side). Two things are deliberately different from the admin
// version:
//
// 1. A separate signing secret (STAFF_SESSION_SECRET), so an admin
//    token can never be replayed as a staff token or vice versa, even
//    if one secret were ever compromised.
//
// 2. Section-level authorization (requireStaffSection) is NOT done in
//    middleware. Middleware runs on the Edge runtime and only confirms
//    "is there a valid session" — it doesn't hit the database. The
//    "which sections can this staff member reach" check runs
//    server-side at the top of each protected section's layout/page,
//    so a role change made by an admin takes effect on the staff
//    member's very next request, not just their next login.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { SectionKey } from "@/lib/permissions";

export const STAFF_SESSION_COOKIE_NAME = "staff_session";

const secret = new TextEncoder().encode(process.env.STAFF_SESSION_SECRET!);

export interface StaffSessionPayload {
  staffId: string;
  roleId: string | null;
}

export async function createStaffSession(payload: StaffSessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const store = await cookies();
  store.set(STAFF_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

// Edge-safe core verifier — takes a raw token rather than reading cookies
// itself, matching verifyAdminSession(token)'s signature in your
// adminAuth.ts. This is what middleware.ts calls directly.
export async function verifyStaffToken(token: string): Promise<StaffSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as StaffSessionPayload;
  } catch {
    return null;
  }
}

// Convenience wrapper for server components, layouts, and API routes
// (Node runtime, where next/headers cookies() is available) — reads the
// cookie, then calls verifyStaffToken. Not used by middleware.ts, which
// reads req.cookies directly to stay Edge-compatible.
export async function getStaffSession(): Promise<StaffSessionPayload | null> {
  const store = await cookies();
  const token = store.get(STAFF_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyStaffToken(token);
}

export async function clearStaffSession() {
  const store = await cookies();
  store.set(STAFF_SESSION_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export type StaffAuthFailureReason = "no_session" | "no_role" | "disabled" | "forbidden";

// Authorization check for a single admin section. Call this at the top
// of each protected section's layout.tsx or page.tsx — see
// app/(main)/admin/(protected)/cargo/layout.tsx for the pattern.
export async function requireStaffSection(
  section: SectionKey
): Promise<{ ok: true } | { ok: false; reason: StaffAuthFailureReason }> {
  const session = await getStaffSession();
  if (!session) return { ok: false, reason: "no_session" };
  if (!session.roleId) return { ok: false, reason: "no_role" };

  const { data: staff } = await supabase
    .from("staff")
    .select("status")
    .eq("id", session.staffId)
    .single();

  if (!staff || staff.status !== "active") {
    return { ok: false, reason: "disabled" };
  }

  const { data: perm } = await supabase
    .from("staff_role_permissions")
    .select("section")
    .eq("role_id", session.roleId)
    .eq("section", section)
    .maybeSingle();

  return perm ? { ok: true } : { ok: false, reason: "forbidden" };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}