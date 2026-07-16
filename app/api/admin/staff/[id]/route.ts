// app/api/admin/staff/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getAdminSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/staffAuth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { name, roleId, status, password } = await req.json();
    const update: Record<string, unknown> = {};

    if (name !== undefined) update.name = name;
    if (roleId !== undefined) update.role_id = roleId || null;
    if (status !== undefined) {
      if (status !== "active" && status !== "disabled") {
        return NextResponse.json({ message: "Status must be 'active' or 'disabled'." }, { status: 400 });
      }
      update.status = status;
    }
    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
      }
      update.password_hash = await hashPassword(password);
    }

    const { error } = await supabase.from("staff").update(update).eq("id", id);

    if (error) {
      console.error("Update staff error (Supabase):", error);
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Staff account updated." });
  } catch (err) {
    // This is the route the role dropdown in staff/page.tsx calls on
    // every change — if this throws without being caught, the dropdown
    // just silently fails to save with no visible error.
    console.error("Update staff error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { error } = await supabase.from("staff").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Staff account deleted." });
  } catch (err) {
    console.error("Delete staff error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}