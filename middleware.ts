// middleware.ts
// Place this file at the project root (same level as package.json),
// NOT inside /app. This REPLACES your existing middleware.ts.
//
// Runs on Next.js's Edge runtime, before any /admin/* page, or any
// /api/admin/* route, executes.

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth/adminAuth";
import { verifyStaffToken, STAFF_SESSION_COOKIE_NAME } from "@/lib/auth/staffAuth";

// Paths that must stay reachable WITHOUT a session — login and signup
// (both the pages and their API routes), or nobody could ever get in.
const PUBLIC_PATHS = [
  "/admin/login",
  "/admin/signup",
  "/api/admin/login",
  "/api/admin/signup",
];

// Areas that require an ADMIN session specifically — a valid staff
// session is not enough here, even though staff pass the generic check
// below for everything else under /admin and /api/admin. This mirrors
// SECTION_KEYS in lib/permissions.ts, which deliberately excludes
// "staff" and "team": those manage other people's accounts and
// permissions, so no role can ever grant a staff member access to them.
const ADMIN_ONLY_PATHS = [
  "/admin/staff", // staff & roles management UI
  "/api/admin/staff", // covers /api/admin/staff and /api/admin/staff/[id]
  "/api/admin/staff-roles", // covers /api/admin/staff-roles and its [id] route
  "/admin/team",
  "/api/admin/team",
];

function matchesAny(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function denyOrRedirect(req: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }
  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicPath = matchesAny(pathname, PUBLIC_PATHS);
  if (isPublicPath) {
    return NextResponse.next();
  }

  const adminToken = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const adminSession = adminToken ? await verifyAdminSession(adminToken) : null;

  // A valid admin session always passes, everywhere under /admin and
  // /api/admin — admins are never restricted by section.
  if (adminSession) {
    return NextResponse.next();
  }

  // No admin session past this point. Admin-only areas stop here — a
  // staff session, even a valid one, does not grant entry.
  if (matchesAny(pathname, ADMIN_ONLY_PATHS)) {
    return denyOrRedirect(req, pathname);
  }

  const staffToken = req.cookies.get(STAFF_SESSION_COOKIE_NAME)?.value;
  const staffSession = staffToken ? await verifyStaffToken(staffToken) : null;

  if (staffSession) {
    // Middleware only confirms a valid session exists — cheap, Edge-safe,
    // no DB round trip. Which specific sections this staff member can
    // reach (based on their role) is checked separately, server-side, in
    // each section's own layout.tsx via requireStaffSection(). See
    // app/(main)/admin/(protected)/cargo/layout.tsx for that pattern.
    return NextResponse.next();
  }

  return denyOrRedirect(req, pathname);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};