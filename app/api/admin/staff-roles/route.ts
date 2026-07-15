// app/api/admin/staff-roles/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getAdminSession } from "@/lib/auth/session";
import { isSectionKey } from "@/lib/permissions";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { data: roles, error } = await supabase
      .from("staff_roles")
      .select("id, name, description, staff_role_permissions(section)")
      .order("name");

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({
      roles: (roles ?? []).map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        sections: (r.staff_role_permissions as { section: string }[]).map(p => p.section),
      })),
    });
  } catch (err) {
    console.error("List staff roles error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { name, description, sections } = await req.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ message: "Role name is required." }, { status: 400 });
    }

    const validSections: string[] = Array.isArray(sections)
      ? sections.filter((s: unknown): s is string => typeof s === "string" && isSectionKey(s))
      : [];

    const { data: role, error } = await supabase
      .from("staff_roles")
      .insert({ name, description: description ?? null, created_by: admin.adminId })
      .select("id")
      .single();

    if (error || !role) {
      console.error("Create staff role error:", error);
      const message = error?.code === "23505" ? "A role with that name already exists." : error?.message;
      return NextResponse.json({ message: message ?? "Failed to create role." }, { status: 400 });
    }

    if (validSections.length) {
      const { error: permError } = await supabase
        .from("staff_role_permissions")
        .insert(validSections.map(section => ({ role_id: role.id, section })));

      if (permError) {
        // Role was created but permissions failed — clean up so we don't
        // leave a role with no sections silently attached to staff.
        console.error("Create staff role permissions error:", permError);
        await supabase.from("staff_roles").delete().eq("id", role.id);
        return NextResponse.json({ message: permError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ message: "Role created.", roleId: role.id });
  } catch (err) {
    // Without this catch, any thrown error here (bad JSON body, a
    // missing env var, an admin session shaped differently than
    // expected) skips past every NextResponse.json above and the client
    // gets a 500 with an EMPTY body — the "Unexpected end of JSON
    // input" failure mode. Logging server-side is what surfaces the
    // real cause in your terminal instead of a silent client failure.
    console.error("Create staff role error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}