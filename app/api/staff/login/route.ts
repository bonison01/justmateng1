// app/api/staff/login/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { verifyPassword, createStaffSession } from "@/lib/auth/staffAuth";

export async function POST(req: Request) {
  try {
    const { emailOrPhone, password } = await req.json();

    if (!emailOrPhone || !password) {
      return NextResponse.json(
        { message: "Email/phone and password are required." },
        { status: 400 }
      );
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("id, password_hash, role_id, status")
      .eq("email_or_phone", emailOrPhone)
      .single();

    // Same generic message whether the account doesn't exist, is
    // disabled, or the password is wrong — don't let the error reveal
    // which one it was. Also covers a row that exists but somehow has
    // no password_hash, so bcrypt never gets called with undefined.
    if (!staff || staff.status !== "active" || !staff.password_hash) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const valid = await verifyPassword(password, staff.password_hash);
    if (!valid) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    await createStaffSession({ staffId: staff.id, roleId: staff.role_id });

    return NextResponse.json({ message: "Logged in." });
  } catch (err) {
    // Without this catch, any thrown error (bad JSON body, a missing
    // env var, an unexpected DB shape) skips straight past
    // NextResponse.json and the client gets a 500 with an EMPTY body —
    // which is what causes "Unexpected end of JSON input" client-side
    // and silently hides the actual error. Logging it server-side here
    // is what lets you see what really went wrong in your terminal.
    console.error("Staff login error:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}