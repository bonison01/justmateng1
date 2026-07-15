// app/api/admin/staff-roles/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getAdminSession } from "@/lib/auth/session";
import { isSectionKey } from "@/lib/permissions";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { name, description, sections } = await req.json();

    if (name !== undefined || description !== undefined) {
      const update: Record<string, unknown> = {};
      if (name !== undefined) update.name = name;
      if (description !== undefined) update.description = description;

      const { error } = await supabase.from("staff_roles").update(update).eq("id", params.id);
      if (error) {
        const message = error.code === "23505" ? "A role with that name already exists." : error.message;
        return NextResponse.json({ message }, { status: 400 });
      }
    }

    // Replace the full section set for this role in one go, rather than
    // diffing — simpler and the checkbox-grid UI already sends the
    // complete desired set on every save.
    if (Array.isArray(sections)) {
      const validSections: string[] = sections.filter(
        (s: unknown): s is string => typeof s === "string" && isSectionKey(s)
      );

      const { error: deleteError } = await supabase
        .from("staff_role_permissions")
        .delete()
        .eq("role_id", params.id);
      if (deleteError) {
        return NextResponse.json({ message: deleteError.message }, { status: 400 });
      }

      if (validSections.length) {
        const { error: insertError } = await supabase
          .from("staff_role_permissions")
          .insert(validSections.map(section => ({ role_id: params.id, section })));
        if (insertError) {
          return NextResponse.json({ message: insertError.message }, { status: 400 });
        }
      }
    }

    return NextResponse.json({ message: "Role updated." });
  } catch (err) {
    console.error("Update staff role error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    // Staff pointing at this role fall back to role_id = null via the
    // foreign key's ON DELETE SET NULL — which requireStaffSection()
    // treats as "no_role" (fully locked out). Deleting a role revokes
    // access rather than silently leaving it open.
    const { error } = await supabase.from("staff_roles").delete().eq("id", params.id);
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Role deleted." });
  } catch (err) {
    console.error("Delete staff role error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}