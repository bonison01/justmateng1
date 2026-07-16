// app/api/admin/cargo/bookings/route.ts
//
// GET: returns all cargo bookings for the admin dashboard.
// POST: creates a new booking (multipart/form-data — see bookingPage),
// including optional photo upload to Storage and payment logging.
// Both use the Supabase SERVICE ROLE key (bypasses RLS) — safe here
// because this route itself re-checks the session first.
//
// AUTH: requireAdmin(req) only recognizes admin sessions — it predates
// the staff/role system and has no idea requireStaffSection exists. So
// a staff member with "cargo" access gets past the page-level layout
// guard (cargo/layout.tsx) just fine, then hits this route and is
// rejected as "not authenticated" the moment it tries to load data.
// The fix: if requireAdmin fails, fall back to checking for a valid
// staff session with "cargo" in their role before giving up. This
// leaves requireAdmin and its existing behavior completely untouched —
// admins hit the exact same code path as before.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { requireStaffSection } from "@/lib/auth/staffAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Returns null if either an admin session or a staff session with
// "cargo" access is present. Returns the original 401 response
// otherwise, so callers can `return` it unchanged.
async function requireCargoAccess(req: NextRequest) {
  const adminAuth = await requireAdmin(req);
  if (!("error" in adminAuth)) return null;

  const staffResult = await requireStaffSection("cargo");
  if (staffResult.ok) return null;

  return adminAuth.error;
}

export async function GET(req: NextRequest) {
  const authError = await requireCargoAccess(req);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from("cargo_bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin cargo bookings fetch error:", error);
    return NextResponse.json({ message: error.message || "Could not load bookings." }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const authError = await requireCargoAccess(req);
  if (authError) return authError;

  try {
    const formData = await req.formData();

    // Pull the JSON payload (everything except the file) out of one field.
    const payloadRaw = formData.get("payload");
    if (typeof payloadRaw !== "string") {
      return NextResponse.json({ message: "Missing booking payload." }, { status: 400 });
    }
    const payload = JSON.parse(payloadRaw);
    const photoFile = formData.get("photo") as File | null;
    const trackingId = payload.tracking_id as string;

    let photo_url = "";
    if (photoFile && photoFile.size > 0) {
      const arrayBuffer = await photoFile.arrayBuffer();
      const path = `bookings/${trackingId}-${photoFile.name}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("cargo-photos")
        .upload(path, Buffer.from(arrayBuffer), {
          upsert: true,
          contentType: photoFile.type || undefined,
        });
      if (uploadError) {
        console.error("Photo upload error:", uploadError);
        return NextResponse.json({ message: uploadError.message }, { status: 500 });
      }
      const { data: publicUrl } = supabaseAdmin.storage.from("cargo-photos").getPublicUrl(path);
      photo_url = publicUrl.publicUrl;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("cargo_bookings")
      .insert({ ...payload, photo_url })
      .select()
      .single();

    if (insertError) {
      console.error("Booking insert error:", insertError);
      return NextResponse.json({ message: insertError.message }, { status: 500 });
    }

    // Log a payment record if relevant — same conditions as before.
    if (payload.customer_id && payload.amount_paid > 0) {
      const note =
        payload.payment_status === "partial" ? "Partial payment at booking" : "Paid at booking";
      await supabaseAdmin.from("cargo_payments").insert({
        customer_id: payload.customer_id,
        booking_id: inserted.id,
        amount: payload.amount_paid,
        note,
      });
    }

    return NextResponse.json({ data: inserted });
  } catch (err) {
    console.error("Booking create error:", err);
    return NextResponse.json({ message: "Could not create booking." }, { status: 500 });
  }
}