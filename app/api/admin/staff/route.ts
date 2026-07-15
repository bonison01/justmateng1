// app/api/admin/staff/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getAdminSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/staffAuth";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { data, error } = await supabase
      .from("staff")
      .select("id, name, email_or_phone, status, created_at, staff_roles(id, name)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ staff: data ?? [] });
  } catch (err) {
    console.error("List staff error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { name, emailOrPhone, password, roleId } = await req.json();

    if (!name || !emailOrPhone || !password) {
      return NextResponse.json(
        { message: "Name, email/phone, and password are required." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
    }

    const password_hash = await hashPassword(password);

    const { data, error } = await supabase
      .from("staff")
      .insert({
        name,
        email_or_phone: emailOrPhone,
        password_hash,
        role_id: roleId || null,
        created_by: admin.adminId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Create staff error:", error);
      const message = error.code === "23505" ? "That email or phone is already registered." : error.message;
      return NextResponse.json({ message }, { status: 400 });
    }

    return NextResponse.json({ message: "Staff account created.", staffId: data.id });
  } catch (err) {
    console.error("Create staff error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}