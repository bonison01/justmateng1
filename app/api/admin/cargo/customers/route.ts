// app/api/admin/cargo/customers/route.ts
//
// This endpoint is shared: it's used by the docket-list page's invoice
// modal (frequent-customer picker), and very likely also by the main
// cargo booking page. Rather than pick one section, it accepts a staff
// member with EITHER "cargo" or "docket_list" — whichever page they got
// here from. If that's too permissive for your intent, narrow it to a
// single section by removing one of the two requireStaffSection calls.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { requireStaffSection } from "@/lib/auth/staffAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAccess(req: NextRequest) {
  const adminAuth = await requireAdmin(req);
  if (!("error" in adminAuth)) return null;

  const cargoResult = await requireStaffSection("cargo");
  if (cargoResult.ok) return null;

  const docketListResult = await requireStaffSection("docket_list");
  if (docketListResult.ok) return null;

  return adminAuth.error;
}

// GET: list all customers, enriched with booking/payment stats
// (the aggregation logic that used to live in the page's load() fn).
export async function GET(req: NextRequest) {
  const authError = await requireAccess(req);
  if (authError) return authError;

  const { data: cData, error: cErr } = await supabaseAdmin
    .from("cargo_customers")
    .select("*")
    .order("name");

  if (cErr) {
    console.error("Customers fetch error:", cErr);
    return NextResponse.json({ message: cErr.message }, { status: 500 });
  }

  const { data: bData, error: bErr } = await supabaseAdmin
    .from("cargo_bookings")
    .select("customer_id,estimate_charge,final_charge,amount_paid,payment_status")
    .not("customer_id", "is", null);

  if (bErr) {
    console.error("Bookings stats fetch error:", bErr);
    return NextResponse.json({ message: bErr.message }, { status: 500 });
  }

  const bookingMap = new Map<
    string,
    { total_billed: number; total_paid: number; count: number }
  >();
  for (const b of bData ?? []) {
    if (!b.customer_id) continue;
    const cur = bookingMap.get(b.customer_id) ?? { total_billed: 0, total_paid: 0, count: 0 };
    const charge = b.final_charge ?? b.estimate_charge;
    cur.total_billed += charge;
    cur.total_paid += b.amount_paid ?? 0;
    cur.count += 1;
    bookingMap.set(b.customer_id, cur);
  }

  const enriched = (cData ?? []).map((c) => {
    const stats = bookingMap.get(c.id) ?? { total_billed: 0, total_paid: 0, count: 0 };
    return {
      ...c,
      total_billed: stats.total_billed,
      total_paid: stats.total_paid,
      outstanding: Math.max(0, stats.total_billed - stats.total_paid),
      booking_count: stats.count,
    };
  });

  return NextResponse.json({ data: enriched });
}

// POST: create a new frequent customer.
export async function POST(req: NextRequest) {
  const authError = await requireAccess(req);
  if (authError) return authError;

  const body = await req.json();
  const { name, phone, address, city_state, pincode } = body;

  if (!name?.trim() || !phone?.trim() || !address?.trim()) {
    return NextResponse.json(
      { message: "Name, phone and address are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("cargo_customers")
    .insert({ name, phone, address, city_state, pincode })
    .select()
    .single();

  if (error) {
    console.error("Customer create error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}