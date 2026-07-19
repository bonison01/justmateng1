// app/api/admin/cargo/docket/item/[itemId]/invoice/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Request payload — sender/receiver are collected fresh at invoice time
// (docket items don't carry customer info), and every charge is editable
// because the invoiced amount is allowed to differ from the internal
// packaging/delivery/pickup costs recorded against the item.
// ---------------------------------------------------------------------------

interface InvoicePayload {
  customer_id?: string | null;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  sender_city_state?: string;
  sender_pincode: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_city_state?: string;
  receiver_pincode: string;
  delivery_mode: string;
  status?: string;
  pickup_required?: boolean;
  delivery_required?: boolean;
  third_party_tracking?: string;
  notes?: string;
  estimate_charge: number;
  docket_charge?: number;
  packaging_charge?: number;
  handling_charge?: number;
  pickup_charge?: number;
  extra_mile_delivery?: number;
  final_charge?: number;
  payment_status?: "paid" | "unpaid" | "partial";
  amount_paid?: number;
}

const VALID_BOOKING_STATUSES = ["Pending", "Dispatched", "Out for Delivery", "Delivered"];

interface ItemRow {
  id: string;
  bag_id: string;
  name: string;
  weight: number;
  packaging_charge: number;
  delivery_charge: number;
  pickup_charge: number;
  other_charges: number;
  invoice_booking_id: string | null;
}

interface BagRow {
  id: string;
  docket_id: string;
  bag_number: string;
}

interface DocketRow {
  id: string;
  docket_number: string;
  docket_charge: number;
}

function generateTrackingId(docketNumber: string, itemId: string) {
  return `DKT-${docketNumber}-${itemId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { itemId } = await params;
  if (!itemId) {
    return NextResponse.json({ message: "Missing item id" }, { status: 400 });
  }

  const body = (await req.json()) as InvoicePayload;

  if (!body.sender_name?.trim() || !body.receiver_name?.trim()) {
    return NextResponse.json(
      { message: "Sender and receiver names are required" },
      { status: 400 }
    );
  }
  if (!/^\d{10}$/.test(body.sender_phone) || !/^\d{10}$/.test(body.receiver_phone)) {
    return NextResponse.json({ message: "Enter valid 10 digit phone numbers" }, { status: 400 });
  }
  if (!body.sender_address?.trim() || !body.receiver_address?.trim()) {
    return NextResponse.json({ message: "Sender and receiver address are required" }, { status: 400 });
  }
  if (!body.estimate_charge || body.estimate_charge <= 0) {
    return NextResponse.json({ message: "Enter a freight charge" }, { status: 400 });
  }

  // 1. Load the item
  const { data: item, error: itemErr } = await supabaseAdmin
    .from("cargo_docket_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (itemErr || !item) {
    console.error("Docket item lookup error:", itemErr);
    return NextResponse.json({ message: "Item not found" }, { status: 404 });
  }
  const itemRow = item as ItemRow;

  if (itemRow.invoice_booking_id) {
    return NextResponse.json(
      { message: "An invoice already exists for this item" },
      { status: 409 }
    );
  }

  // 2. Load the bag, then the docket (for the docket number / tracking ref)
  const { data: bag, error: bagErr } = await supabaseAdmin
    .from("cargo_docket_bags")
    .select("*")
    .eq("id", itemRow.bag_id)
    .single();
  if (bagErr || !bag) {
    console.error("Docket bag lookup error:", bagErr);
    return NextResponse.json({ message: "Bag not found for this item" }, { status: 404 });
  }
  const bagRow = bag as BagRow;

  const { data: docket, error: docketErr } = await supabaseAdmin
    .from("cargo_dockets")
    .select("*")
    .eq("id", bagRow.docket_id)
    .single();
  if (docketErr || !docket) {
    console.error("Docket lookup error:", docketErr);
    return NextResponse.json({ message: "Docket not found for this item" }, { status: 404 });
  }
  const docketRow = docket as DocketRow;

  const trackingId = generateTrackingId(docketRow.docket_number, itemRow.id);
  const status =
    body.status && VALID_BOOKING_STATUSES.includes(body.status) ? body.status : "Pending";
  const paymentStatus =
    body.payment_status === "paid" || body.payment_status === "partial" ? body.payment_status : "unpaid";

  const invoiceAmount =
    body.final_charge ??
    [
      body.estimate_charge,
      body.docket_charge ?? docketRow.docket_charge ?? 0,
      body.packaging_charge ?? 0,
      body.handling_charge ?? 0,
      body.pickup_charge ?? 0,
      body.extra_mile_delivery ?? 0,
    ].reduce((s, v) => s + (Number(v) || 0), 0);

  const amountPaid =
    paymentStatus === "paid" ? invoiceAmount
    : paymentStatus === "partial" ? Number(body.amount_paid) || 0
    : 0;

  // 3. Create the invoice as a normal cargo_bookings row so it reuses your
  // existing invoice page/template unchanged.
  const { data: booking, error: bookingErr } = await supabaseAdmin
    .from("cargo_bookings")
    .insert({
      customer_id: body.customer_id || null,
      tracking_id: trackingId,
      sender_name: body.sender_name,
      sender_phone: body.sender_phone,
      sender_address: body.sender_address,
      sender_city_state: body.sender_city_state ?? "",
      sender_pincode: body.sender_pincode ?? "",
      receiver_name: body.receiver_name,
      receiver_phone: body.receiver_phone,
      receiver_address: body.receiver_address,
      receiver_city_state: body.receiver_city_state ?? "",
      receiver_pincode: body.receiver_pincode ?? "",
      product_name: itemRow.name,
      weight_estimate: itemRow.weight,
      delivery_mode: body.delivery_mode || "Normal Cargo",
      pickup_required: body.pickup_required ?? false,
      delivery_required: body.delivery_required ?? false,
      notes: body.notes ?? `Invoiced from docket ${docketRow.docket_number}, bag ${bagRow.bag_number}.`,
      status,
      third_party_tracking: body.third_party_tracking ?? docketRow.docket_number,
      handling_charge: body.handling_charge ?? null,
      docket_charge: body.docket_charge ?? docketRow.docket_charge ?? null,
      pickup_charge: body.pickup_charge ?? null,
      packaging_charge: body.packaging_charge ?? null,
      extra_mile_delivery: body.extra_mile_delivery ?? null,
      estimate_charge: body.estimate_charge,
      final_charge: body.final_charge ?? null,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
      photo_url: null,
    })
    .select()
    .single();

  if (bookingErr) {
    console.error("Item invoice create error:", bookingErr);
    return NextResponse.json({ message: bookingErr.message }, { status: 500 });
  }

  // 4. Link the item back to the invoice
  const { data: updatedItem, error: updateErr } = await supabaseAdmin
    .from("cargo_docket_items")
    .update({
      invoice_booking_id: booking.id,
      invoice_amount: invoiceAmount,
      invoice_created_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .select()
    .single();

  if (updateErr) {
    console.error("Docket item invoice link error:", updateErr);
    return NextResponse.json({ message: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ data: { booking, item: updatedItem } }, { status: 201 });
}