// app/(main)/admin/staff-roles/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getAdminSession } from "@/lib/auth/session";
import { isSectionKey } from "@/lib/permissions";

export async function GET() {
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
}

export async function POST(req: Request) {
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
    const message = error?.code === "23505" ? "A role with that name already exists." : error?.message;
    return NextResponse.json({ message: message ?? "Failed to create role." }, { status: 400 });
  }

  if (validSections.length) {
    const { error: permError } = await supabase
      .from("staff_role_permissions")
      .insert(validSections.map(section => ({ role_id: role.id, section })));

    if (permError) {
      await supabase.from("staff_roles").delete().eq("id", role.id);
      return NextResponse.json({ message: permError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ message: "Role created.", roleId: role.id });
}