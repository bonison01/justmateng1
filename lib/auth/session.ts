// lib/auth/session.ts
//
// verifyAdminSession(token) in adminAuth.ts takes a raw token rather than
// reading cookies itself (needed so middleware.ts can call it on the Edge
// runtime with req.cookies). This wrapper is for the other call sites —
// API routes and server component layouts — where next/headers cookies()
// is available and it's simpler to just ask "is there an admin session"
// without re-reading the cookie name/token dance every time.

import { cookies } from "next/headers";
import { verifyAdminSession, ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth/adminAuth";

export async function getAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminSession(token);
}