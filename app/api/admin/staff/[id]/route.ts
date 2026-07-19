// app/api/admin/staff/[id]/route.ts
//
// RECONSTRUCTION — same caveat as staff/route.ts. Diff against your real
// file. PATCH now accepts `roleIds: string[]` (replaces the full set of
// assigned roles) alongside your existing `status` and `password` fields.

import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getAdminSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/staffAuth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    // --- status toggle ---
    if (typeof body.status === "string") {
      if (body.status !== "active" && body.status !== "disabled") {
        return NextResponse.json({ message: "Invalid status." }, { status: 400 });
      }
      const { error } = await supabase.from("staff").update({ status: body.status }).eq("id", id);
      if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    }

    // --- password reset ---
    if (typeof body.password === "string") {
      if (body.password.length < 8) {
        return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
      }
      const passwordHash = await hashPassword(body.password);
      const { error } = await supabase.from("staff").update({ password_hash: passwordHash }).eq("id", id);
      if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    }

    // --- role assignments: replace-all semantics, same pattern as
    //     staff-roles/[id]'s section-permissions PATCH ---
    if (Array.isArray(body.roleIds)) {
      const validRoleIds: string[] = body.roleIds.filter(
        (r: unknown): r is string => typeof r === "string" && r.length > 0
      );

      const { error: deleteErr } = await supabase
        .from("staff_role_assignments")
        .delete()
        .eq("staff_id", id);

      if (deleteErr) {
        console.error("Clear staff role assignments error:", deleteErr);
        return NextResponse.json({ message: deleteErr.message }, { status: 400 });
      }

      if (validRoleIds.length) {
        const { error: insertErr } = await supabase
          .from("staff_role_assignments")
          .insert(validRoleIds.map((role_id) => ({ staff_id: id, role_id })));

        if (insertErr) {
          console.error("Insert staff role assignments error:", insertErr);
          return NextResponse.json({ message: insertErr.message }, { status: 400 });
        }
      }
    }
    // Backward-compat: a lone `roleId` (singular) is treated as "replace
    // with just this one role" — remove this block once nothing on the
    // frontend sends the old singular field anymore.
    else if (body.roleId !== undefined) {
      const { error: deleteErr } = await supabase
        .from("staff_role_assignments")
        .delete()
        .eq("staff_id", id);
      if (deleteErr) return NextResponse.json({ message: deleteErr.message }, { status: 400 });

      if (body.roleId) {
        const { error: insertErr } = await supabase
          .from("staff_role_assignments")
          .insert({ staff_id: id, role_id: body.roleId });
        if (insertErr) return NextResponse.json({ message: insertErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ message: "Staff account updated." });
  } catch (err) {
    console.error("Update staff error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    // staff_role_assignments rows cascade-delete via the FK's
    // "on delete cascade", so no manual cleanup needed there.
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });

    return NextResponse.json({ message: "Staff account deleted." });
  } catch (err) {
    console.error("Delete staff error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}