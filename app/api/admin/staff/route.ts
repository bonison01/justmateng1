// app/api/admin/staff/route.ts
//
// RECONSTRUCTION — I don't have your real staff/route.ts, so this is
// built to match the style of your staff-roles/route.ts (getAdminSession,
// supabaseAdmin as supabase, try/catch with console.error + generic 500).
// Diff against your actual file before replacing it.

import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getAdminSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/staffAuth";
import { isSectionKey } from "@/lib/permissions"; // not used directly here, but staff-roles imports it the same way

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { data, error } = await supabase
      .from("staff")
      .select("id, name, email_or_phone, status, staff_role_assignments(staff_roles(id, name))")
      .order("name");

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    const staff = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      email_or_phone: row.email_or_phone,
      status: row.status,
      // Flatten the join: staff_role_assignments(staff_roles(id,name))[]
      // -> roles: {id,name}[], dropping any orphaned assignment rows.
      roles: (row.staff_role_assignments ?? [])
        .map((a: any) => a.staff_roles)
        .filter(Boolean),
    }));

    return NextResponse.json({ staff });
  } catch (err) {
    console.error("List staff error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { name, emailOrPhone, password, roleIds } = await req.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }
    if (!emailOrPhone || typeof emailOrPhone !== "string") {
      return NextResponse.json({ message: "Email or phone is required." }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
    }

    const validRoleIds: string[] = Array.isArray(roleIds)
      ? roleIds.filter((r: unknown): r is string => typeof r === "string" && r.length > 0)
      : [];

    const passwordHash = await hashPassword(password);

    const { data: staff, error } = await supabase
      .from("staff")
      .insert({
        name,
        email_or_phone: emailOrPhone,
        password_hash: passwordHash,
        status: "active",
        created_by: admin.adminId,
      })
      .select("id")
      .single();

    if (error || !staff) {
      console.error("Create staff error:", error);
      const message = error?.code === "23505" ? "An account with that email/phone already exists." : error?.message;
      return NextResponse.json({ message: message ?? "Failed to create staff account." }, { status: 400 });
    }

    if (validRoleIds.length) {
      const { error: assignErr } = await supabase
        .from("staff_role_assignments")
        .insert(validRoleIds.map((role_id) => ({ staff_id: staff.id, role_id })));

      if (assignErr) {
        console.error("Assign staff roles error:", assignErr);
        // Staff account exists but role assignment failed — don't leave
        // an account with zero access silently; surface it instead of
        // rolling back, since the account itself is still valid.
        return NextResponse.json(
          { message: "Staff account created, but assigning roles failed: " + assignErr.message },
          { status: 207 }
        );
      }
    }

    return NextResponse.json({ message: "Staff account created.", staffId: staff.id });
  } catch (err) {
    console.error("Create staff error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}