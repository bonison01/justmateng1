// app/api/admin/cargo/docket/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

interface DocketPatchPayload {
  status?: string;
  docket_charge?: number;
  payments?: DocketPayments;
}

const VALID_STATUSES = ["Pending", "Dispatched", "Out for Delivery", "Delivered"];
const VALID_PAYMENT_STATUSES = ["paid", "unpaid", "partial"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: "Missing docket id" }, { status: 400 });
  }

  const body = (await req.json()) as DocketPatchPayload;
  const update: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }
    update.status = body.status;
  }

  if (body.docket_charge !== undefined) {
    if (typeof body.docket_charge !== "number" || body.docket_charge < 0) {
      return NextResponse.json({ message: "Invalid docket charge" }, { status: 400 });
    }
    update.docket_charge = body.docket_charge;
  }

  if (body.payments !== undefined) {
    for (const [key, entry] of Object.entries(body.payments)) {
      if (!entry) continue;
      if (!VALID_PAYMENT_STATUSES.includes(entry.status)) {
        return NextResponse.json(
          { message: `Invalid payment status for "${key}"` },
          { status: 400 }
        );
      }
      if (entry.status === "partial" && (!entry.paid || entry.paid <= 0)) {
        return NextResponse.json(
          { message: `Enter an amount paid for "${key}"` },
          { status: 400 }
        );
      }
    }
    update.payments = body.payments;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("cargo_dockets")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Docket update error:", error);
    return NextResponse.json(
      { message: error.message || "Could not update docket" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}