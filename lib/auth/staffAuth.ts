// lib/auth/staffAuth.ts
//
// Changed from earlier version: a staff member can now have MULTIPLE
// roles (via staff_role_assignments), and their access is the UNION of
// every section any of those roles grants. `StaffSessionPayload.roleId`
// is dropped — role membership is looked up fresh from the DB on every
// request instead of being baked into the JWT, which is actually a nice
// side effect: it means admins can add/remove BOTH individual role
// assignments and change what a role grants, and it takes effect on the
// staff member's very next request either way, with no token reissue.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { SectionKey } from "@/lib/permissions";

export const STAFF_SESSION_COOKIE_NAME = "staff_session";

const staffSessionSecretEnv = process.env.STAFF_SESSION_SECRET;

if (!staffSessionSecretEnv) {
  throw new Error(
    "STAFF_SESSION_SECRET is not set. Add it to your .env file (a long random string, separate from " +
      "whatever secret signs the admin cookie), then restart the dev server — Next.js only reads .env " +
      "changes on startup, not on hot reload."
  );
}

const secret = new TextEncoder().encode(staffSessionSecretEnv);

export interface StaffSessionPayload {
  staffId: string;
  // Deprecated: role membership is no longer read from the token — see
  // the file header. Kept optional so any old token still in the wild
  // (or a login route you haven't updated yet) doesn't break decoding.
  roleId?: string | null;
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

export async function verifyStaffToken(token: string): Promise<StaffSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as StaffSessionPayload;
  } catch {
    return null;
  }
}

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

// Fetches every role_id assigned to this staff member. Centralized here
// since both requireStaffSection and getStaffAllowedSections need it.
async function getAssignedRoleIds(staffId: string): Promise<string[]> {
  const { data } = await supabase
    .from("staff_role_assignments")
    .select("role_id")
    .eq("staff_id", staffId);
  return (data ?? []).map((r) => r.role_id as string);
}

export async function requireStaffSection(
  section: SectionKey
): Promise<{ ok: true } | { ok: false; reason: StaffAuthFailureReason }> {
  const session = await getStaffSession();
  if (!session) return { ok: false, reason: "no_session" };

  const { data: staff } = await supabase
    .from("staff")
    .select("status")
    .eq("id", session.staffId)
    .single();

  if (!staff || staff.status !== "active") {
    return { ok: false, reason: "disabled" };
  }

  const roleIds = await getAssignedRoleIds(session.staffId);
  if (!roleIds.length) return { ok: false, reason: "no_role" };

  const { data: perm } = await supabase
    .from("staff_role_permissions")
    .select("section")
    .in("role_id", roleIds)
    .eq("section", section)
    .limit(1)
    .maybeSingle();

  return perm ? { ok: true } : { ok: false, reason: "forbidden" };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Union of every section granted by ANY role this staff member holds.
export async function getStaffAllowedSections(): Promise<SectionKey[]> {
  const session = await getStaffSession();
  if (!session) return [];

  const { data: staff } = await supabase
    .from("staff")
    .select("status")
    .eq("id", session.staffId)
    .single();

  if (!staff || staff.status !== "active") return [];

  const roleIds = await getAssignedRoleIds(session.staffId);
  if (!roleIds.length) return [];

  const { data: perms } = await supabase
    .from("staff_role_permissions")
    .select("section")
    .in("role_id", roleIds);

  // Dedup — the same section can appear via more than one assigned role.
  return Array.from(new Set((perms ?? []).map((p) => p.section as SectionKey)));
}