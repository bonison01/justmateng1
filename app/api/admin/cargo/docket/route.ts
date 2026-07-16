// app/api/admin/cargo/docket/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Request payload shapes (what the frontend form sends)
// ---------------------------------------------------------------------------

interface DocketItemPayload {
  name: string;
  weight: number;
  packaging_charge: number;
  delivery_charge: number;
  pickup_charge: number;
  parcel_type: string;
  other_charges: number;
}

interface DocketBagPayload {
  bag_number: string;
  items: DocketItemPayload[];
}

interface DocketPayload {
  docket_number: string;
  number_of_bags: number;
  total_items: number;
  total_weight: number;
  total_charges: number;
  docket_charge?: number;
  bags: DocketBagPayload[];
}

// ---------------------------------------------------------------------------
// DB row shapes — supabaseAdmin isn't given a generated <Database> type
// here (matching cargo_bookings' route), so .select() results come back
// untyped. These interfaces + casts keep everything below explicit.
// ---------------------------------------------------------------------------

interface PaymentEntry {
  total: number;
  paid: number;
  status: "paid" | "unpaid" | "partial";
}

interface DocketPayments {
  packaging?: PaymentEntry;
  delivery?: PaymentEntry;
  docket_charge?: PaymentEntry;
}

interface DocketRow {
  id: string;
  docket_number: string;
  number_of_bags: number;
  total_items: number;
  total_weight: number;
  total_charges: number;
  status: string;
  docket_charge: number;
  payments: DocketPayments;
  created_at: string;
  updated_at: string;
}

interface BagRow {
  id: string;
  docket_id: string;
  bag_number: string;
  created_at: string;
}

interface ItemRow {
  id: string;
  bag_id: string;
  name: string;
  weight: number;
  packaging_charge: number;
  delivery_charge: number;
  pickup_charge: number;
  parcel_type: string;
  other_charges: number;
  invoice_booking_id: string | null;
  invoice_amount: number | null;
  invoice_created_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// GET /api/admin/cargo/docket — list dockets with nested bags/items
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { data: dockets, error: docketsErr } = await supabaseAdmin
    .from("cargo_dockets")
    .select("*")
    .order("created_at", { ascending: false });

  if (docketsErr) {
    console.error("Admin cargo dockets fetch error:", docketsErr);
    return NextResponse.json(
      { message: docketsErr.message || "Could not load dockets." },
      { status: 500 }
    );
  }

  const docketRows = (dockets ?? []) as DocketRow[];
  if (!docketRows.length) return NextResponse.json({ data: [] });

  const docketIds: string[] = docketRows.map((d: DocketRow) => d.id);

  const { data: bags, error: bagsErr } = await supabaseAdmin
    .from("cargo_docket_bags")
    .select("*")
    .in("docket_id", docketIds);

  if (bagsErr) {
    console.error("Admin cargo docket bags fetch error:", bagsErr);
    return NextResponse.json(
      { message: bagsErr.message || "Could not load docket bags." },
      { status: 500 }
    );
  }
  const bagRows = (bags ?? []) as BagRow[];

  const bagIds: string[] = bagRows.map((b: BagRow) => b.id);
  let itemRows: ItemRow[] = [];
  if (bagIds.length) {
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("cargo_docket_items")
      .select("*")
      .in("bag_id", bagIds);

    if (itemsErr) {
      console.error("Admin cargo docket items fetch error:", itemsErr);
      return NextResponse.json(
        { message: itemsErr.message || "Could not load docket items." },
        { status: 500 }
      );
    }
    itemRows = (items ?? []) as ItemRow[];
  }

  const data = docketRows.map((d: DocketRow) => ({
    ...d,
    bags: bagRows
      .filter((b: BagRow) => b.docket_id === d.id)
      .map((b: BagRow) => ({
        ...b,
        items: itemRows.filter((it: ItemRow) => it.bag_id === b.id),
      })),
  }));

  return NextResponse.json({ data });
}

// ---------------------------------------------------------------------------
// POST /api/admin/cargo/docket — create a docket with its bags and items
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = (await req.json()) as DocketPayload;

  if (!body.docket_number?.trim()) {
    return NextResponse.json({ message: "Docket number is required" }, { status: 400 });
  }
  if (!body.bags?.length) {
    return NextResponse.json({ message: "At least one bag is required" }, { status: 400 });
  }
  for (const bag of body.bags) {
    if (!bag.bag_number?.trim()) {
      return NextResponse.json({ message: "Every bag needs a bag number" }, { status: 400 });
    }
    if (!bag.items?.length) {
      return NextResponse.json(
        { message: `Bag "${bag.bag_number}" needs at least one item` },
        { status: 400 }
      );
    }
    for (const item of bag.items) {
      if (!item.name?.trim()) {
        return NextResponse.json({ message: "Every item needs a name" }, { status: 400 });
      }
    }
  }

  // Sum packaging/delivery charges across every item in the docket so the
  // edit modal can track payment against those two categories separately.
  const allItems: DocketItemPayload[] = body.bags.flatMap((b: DocketBagPayload) => b.items);
  const totalPackaging = allItems.reduce(
    (s: number, it: DocketItemPayload) => s + (Number(it.packaging_charge) || 0),
    0
  );
  const totalDelivery = allItems.reduce(
    (s: number, it: DocketItemPayload) => s + (Number(it.delivery_charge) || 0),
    0
  );
  const docketCharge = Number(body.docket_charge) || 0;

  const payments: DocketPayments = {
    packaging: { total: totalPackaging, paid: 0, status: "unpaid" },
    delivery: { total: totalDelivery, paid: 0, status: "unpaid" },
    docket_charge: { total: docketCharge, paid: 0, status: "unpaid" },
  };

  // 1. Insert the docket
  const { data: docket, error: docketErr } = await supabaseAdmin
    .from("cargo_dockets")
    .insert({
      docket_number: body.docket_number,
      number_of_bags: body.number_of_bags,
      total_items: body.total_items,
      total_weight: body.total_weight,
      total_charges: body.total_charges,
      status: "Pending",
      docket_charge: docketCharge,
      payments,
    })
    .select()
    .single();

  if (docketErr) {
    console.error("Docket create error:", docketErr);
    if (docketErr.code === "23505") {
      return NextResponse.json({ message: "That docket number already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: docketErr.message }, { status: 500 });
  }
  const docketRow = docket as DocketRow;

  // 2. Insert bags for this docket
  const { data: insertedBags, error: bagsErr } = await supabaseAdmin
    .from("cargo_docket_bags")
    .insert(
      body.bags.map((b: DocketBagPayload) => ({
        docket_id: docketRow.id,
        bag_number: b.bag_number,
      }))
    )
    .select();

  if (bagsErr) {
    console.error("Docket bags create error:", bagsErr);
    return NextResponse.json({ message: bagsErr.message }, { status: 500 });
  }
  const bagRows = (insertedBags ?? []) as BagRow[];

  // 3. Insert items, matched back to their bag by position
  const itemsToInsert = body.bags.flatMap((bag: DocketBagPayload, i: number) =>
    bag.items.map((item: DocketItemPayload) => ({
      bag_id: bagRows[i].id,
      name: item.name,
      weight: item.weight,
      packaging_charge: item.packaging_charge,
      delivery_charge: item.delivery_charge,
      pickup_charge: item.pickup_charge,
      parcel_type: item.parcel_type,
      other_charges: item.other_charges,
    }))
  );

  const { data: insertedItems, error: itemsErr } = await supabaseAdmin
    .from("cargo_docket_items")
    .insert(itemsToInsert)
    .select();

  if (itemsErr) {
    console.error("Docket items create error:", itemsErr);
    return NextResponse.json({ message: itemsErr.message }, { status: 500 });
  }
  const itemRows = (insertedItems ?? []) as ItemRow[];

  // 4. Shape the nested response
  const bagsWithItems = bagRows.map((b: BagRow) => ({
    ...b,
    items: itemRows.filter((it: ItemRow) => it.bag_id === b.id),
  }));

  return NextResponse.json(
    { data: { ...docketRow, bags: bagsWithItems } },
    { status: 201 }
  );
}