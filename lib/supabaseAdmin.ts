// lib/supabaseAdmin.ts
//
// A second Supabase client, separate from lib/supabaseClient.ts, using the
// SERVICE ROLE key instead of the anon key. This bypasses Row Level
// Security entirely — that's intentional and safe here because:
//
// 1. It's only ever imported from API routes (Node runtime), never from
//    a 'use client' component — the service role key must never reach
//    the browser bundle.
// 2. Every call site that uses it (staff/role management, staff login,
//    requireStaffSection) already checks getAdminSession() or a staff
//    session token BEFORE touching the database — the authorization
//    happens in application code, not in RLS, for these tables.
//
// This is why sql/001_staff_rbac.sql enables RLS on staff, staff_roles,
// and staff_role_permissions with zero policies: the anon-key client
// (lib/supabaseClient.ts) is meant to be fully locked out of them, and
// this admin client is the one sanctioned way in.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase admin environment variables are missing");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});