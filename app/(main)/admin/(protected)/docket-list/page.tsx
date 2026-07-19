// app/(main)/admin/docket-list/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Package,
  PackagePlus,
  List,
  ArrowUpDown,
  Pencil,
  Check,
  Boxes,
  Weight,
  Wallet,
  Layers,
  Receipt,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types (mirrors the nested shape returned by GET /api/admin/docket)
// ---------------------------------------------------------------------------

interface DocketItem {
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

interface DocketBag {
  id: string;
  docket_id: string;
  bag_number: string;
  created_at: string;
  items: DocketItem[];
}

type PaymentStatus = "paid" | "unpaid" | "partial";
type PaymentCategory = "packaging" | "delivery" | "docket_charge";

interface PaymentEntry {
  total: number;
  paid: number;
  status: PaymentStatus;
}

type DocketPayments = Partial<Record<PaymentCategory, PaymentEntry>>;

type DocketStatus = "Pending" | "Dispatched" | "Out for Delivery" | "Delivered";

interface Docket {
  id: string;
  docket_number: string;
  number_of_bags: number;
  total_items: number;
  total_weight: number;
  total_charges: number;
  status: DocketStatus;
  docket_charge: number;
  payments: DocketPayments;
  created_at: string;
  updated_at: string;
  bags: DocketBag[];
}

type SortKey = "created_at" | "total_charges" | "total_weight" | "total_items";

const STATUS_OPTIONS: DocketStatus[] = ["Pending", "Dispatched", "Out for Delivery", "Delivered"];
const PAYMENT_CATEGORIES: { key: PaymentCategory; label: string }[] = [
  { key: "packaging", label: "Packaging fee" },
  { key: "delivery", label: "Delivery charge" },
  { key: "docket_charge", label: "Docket charge" },
];
const PAGE_SIZE_OPTIONS = [20, 50, 100];

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700",
  Dispatched: "bg-indigo-50 text-indigo-700",
  "Out for Delivery": "bg-blue-50 text-blue-700",
  Delivered: "bg-emerald-50 text-emerald-700",
};

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  unpaid: "bg-red-50 text-red-700",
  partial: "bg-amber-50 text-amber-700",
};

function itemTotal(item: DocketItem) {
  return (
    (Number(item.packaging_charge) || 0) +
    (Number(item.delivery_charge) || 0) +
    (Number(item.pickup_charge) || 0) +
    (Number(item.other_charges) || 0)
  );
}

function docketPaid(d: Docket) {
  return PAYMENT_CATEGORIES.reduce((s, c) => s + (d.payments?.[c.key]?.paid || 0), 0);
}

function docketPayable(d: Docket) {
  // total_charges covers packaging + delivery + pickup + other across every
  // item; docket_charge is a separate top-level fee. Pickup/other charges
  // aren't split into their own payment category, so "due" here is an
  // approximation when a docket has pickup/other charges > 0.
  return (Number(d.total_charges) || 0) + (Number(d.docket_charge) || 0);
}

function overallPaymentStatus(d: Docket): PaymentStatus {
  const paid = docketPaid(d);
  const payable = docketPayable(d);
  if (payable <= 0) return "unpaid";
  if (paid <= 0) return "unpaid";
  if (paid >= payable) return "paid";
  return "partial";
}

// ---------------------------------------------------------------------------
// Dashboard stat card
// ---------------------------------------------------------------------------

const Field = ({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={`space-y-1.5 ${className ?? ""}`}>
    <Label className="text-xs font-medium text-neutral-500">
      {label}
      {required && <span className="ml-0.5 text-blue-600">*</span>}
    </Label>
    {children}
  </div>
);

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      </div>
      <p className="text-lg font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded item breakdown — shared by mobile card & desktop row
// ---------------------------------------------------------------------------

function DocketBreakdown({
  docket,
  onItemClick,
}: {
  docket: Docket;
  onItemClick: (docket: Docket, bag: DocketBag, item: DocketItem) => void;
}) {
  return (
    <div className="space-y-3 bg-neutral-50 p-4">
      {docket.bags.map((bag) => (
        <div key={bag.id} className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
              <Package className="h-3.5 w-3.5 text-blue-600" />
              {bag.bag_number}
            </span>
            <span className="text-xs text-neutral-400">
              {bag.items.length} item{bag.items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-1.5">
            {bag.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onItemClick(docket, bag, item)}
                className="flex w-full items-center justify-between rounded-md bg-neutral-50 px-2.5 py-1.5 text-left text-xs transition hover:bg-blue-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-800">{item.name}</p>
                  <p className="text-[11px] text-neutral-400">
                    {item.parcel_type} · {Number(item.weight).toFixed(2)} kg
                  </p>
                </div>
                <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                  <span className="font-medium text-neutral-700">
                    ₹{itemTotal(item).toFixed(2)}
                  </span>
                  {item.invoice_booking_id ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      <Receipt className="h-2.5 w-2.5" />
                      ₹{Number(item.invoice_amount ?? 0).toFixed(2)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
                      No invoice
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item quick view — details, date, and the invoice entry point
// ---------------------------------------------------------------------------

function ItemQuickViewModal({
  docket,
  bag,
  item,
  onClose,
  onCreateInvoice,
}: {
  docket: Docket;
  bag: DocketBag;
  item: DocketItem;
  onClose: () => void;
  onCreateInvoice: () => void;
}) {
  const router = useRouter();
  const hasInvoice = !!item.invoice_booking_id;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">{item.name}</h2>
            <p className="text-xs text-neutral-400">
              {docket.docket_number} · {bag.bag_number}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Calendar className="h-3.5 w-3.5" />
            Added {new Date(item.created_at).toLocaleDateString("en-IN", {
              day: "2-digit", month: "short", year: "numeric",
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-neutral-50 p-2.5">
              <p className="text-neutral-400">Parcel type</p>
              <p className="font-medium text-neutral-800">{item.parcel_type}</p>
            </div>
            <div className="rounded-md bg-neutral-50 p-2.5">
              <p className="text-neutral-400">Weight</p>
              <p className="font-medium text-neutral-800">{Number(item.weight).toFixed(2)} kg</p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-neutral-500">Internal charges (costing)</p>
            <div className="space-y-1 rounded-lg border border-neutral-200 p-3 text-xs">
              <div className="flex justify-between"><span className="text-neutral-500">Packaging</span><span className="font-medium">₹{Number(item.packaging_charge).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Delivery</span><span className="font-medium">₹{Number(item.delivery_charge).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Pickup</span><span className="font-medium">₹{Number(item.pickup_charge).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Other</span><span className="font-medium">₹{Number(item.other_charges).toFixed(2)}</span></div>
              <div className="mt-1.5 flex justify-between border-t border-neutral-100 pt-1.5 font-semibold text-neutral-800">
                <span>Total (internal)</span><span>₹{itemTotal(item).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {hasInvoice ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Receipt className="h-3.5 w-3.5" />
                Invoice already created
              </div>
              <p className="text-xs text-emerald-700">
                Invoice amount: <span className="font-semibold">₹{Number(item.invoice_amount ?? 0).toFixed(2)}</span>
              </p>
              {item.invoice_created_at && (
                <p className="text-[11px] text-emerald-600">
                  Created {new Date(item.invoice_created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              )}
              <p className="mt-1 text-[11px] text-neutral-500">
                This may differ from the internal costing total above — invoices are billed separately.
              </p>
              <Button
                size="sm"
                onClick={() => router.push(`/admin/cargo/invoice/${item.invoice_booking_id}`)}
                className="mt-2 h-8 w-full bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                View / print invoice
              </Button>
            </div>
          ) : (
            <Button onClick={onCreateInvoice} className="h-9 w-full bg-blue-600 text-white hover:bg-blue-700">
              <Receipt className="mr-1.5 h-4 w-4" />
              Create invoice for this item
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create-invoice form — mirrors the full booking-page feature set (frequent
// customer picker, same-as-customer toggle, status, pickup/delivery flags,
// notes, all 7 charge fields, payment status) so invoicing an item feels
// identical to creating a normal booking. Sender/receiver and the actual
// billed amount are entered fresh since they can differ from internal
// costing; delivery_mode/status/etc default sensibly but stay editable.
// ---------------------------------------------------------------------------

interface CargoCustomer {
  id: string;
  name: string;
  phone: string;
  address: string;
  city_state: string;
  pincode: string;
}

function InvoiceCustomerCombobox({
  customers,
  value,
  onChange,
}: {
  customers: CargoCustomer[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = customers.find((c) => c.id === value);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        className="flex h-9 w-full cursor-pointer items-center justify-between rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? (
          <span className="flex-1 truncate">{selected.name} · {selected.phone}</span>
        ) : (
          <span className="text-neutral-400">Select a frequent customer (optional)</span>
        )}
        {selected ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); setOpen(false); }}
            className="ml-2 text-neutral-400 hover:text-neutral-700">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Search className="ml-2 h-3.5 w-3.5 text-neutral-400" />
        )}
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 p-2">
            <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              className="h-7 border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400"
              onClick={(e) => e.stopPropagation()} />
          </div>
          <ul className="max-h-40 overflow-y-auto py-1">
            <li className="cursor-pointer px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-50"
              onClick={() => { onChange(""); setSearch(""); setOpen(false); }}>
              — No frequent customer —
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-neutral-400">No results</li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}
                  className={`cursor-pointer px-3 py-2 text-sm hover:bg-blue-50 ${c.id === value ? "bg-blue-50 text-blue-700" : "text-neutral-700"}`}
                  onClick={() => { onChange(c.id); setSearch(""); setOpen(false); }}>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-neutral-400">{c.phone}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const DELIVERY_MODES = ["Indian Post", "Normal Cargo", "Express Cargo", "Surface(By Road)"];
const INVOICE_STATUS_OPTIONS: DocketStatus[] = ["Pending", "Dispatched", "Out for Delivery", "Delivered"];

interface InvoiceFormState {
  customer_id: string;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  sender_city_state: string;
  sender_pincode: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_city_state: string;
  receiver_pincode: string;
  delivery_mode: string;
  status: DocketStatus;
  pickup_required: boolean;
  delivery_required: boolean;
  third_party_tracking: string;
  notes: string;
  estimate_charge: string;
  docket_charge: string;
  packaging_charge: string;
  handling_charge: string;
  pickup_charge: string;
  extra_mile_delivery: string;
  final_charge: string;
  payment_status: PaymentStatus;
  amount_paid: string;
}

function sumInvoiceCharges(f: InvoiceFormState) {
  return [
    f.estimate_charge,
    f.handling_charge,
    f.docket_charge,
    f.pickup_charge,
    f.packaging_charge,
    f.extra_mile_delivery,
  ].reduce((s, v) => s + (parseFloat(v) || 0), 0);
}

function CreateItemInvoiceModal({
  docket,
  bag,
  item,
  onClose,
  onCreated,
}: {
  docket: Docket;
  bag: DocketBag;
  item: DocketItem;
  onClose: () => void;
  onCreated: (updatedItem: DocketItem) => void;
}) {
  const [customers, setCustomers] = useState<CargoCustomer[]>([]);
  const [senderSameAsCustomer, setSenderSameAsCustomer] = useState(false);
  const [receiverSameAsCustomer, setReceiverSameAsCustomer] = useState(false);

  const [form, setForm] = useState<InvoiceFormState>({
    customer_id: "",
    sender_name: "",
    sender_phone: "",
    sender_address: "",
    sender_city_state: "",
    sender_pincode: "",
    receiver_name: "",
    receiver_phone: "",
    receiver_address: "",
    receiver_city_state: "",
    receiver_pincode: "",
    delivery_mode: "Normal Cargo",
    status: "Pending",
    pickup_required: false,
    delivery_required: false,
    third_party_tracking: docket.docket_number,
    notes: `Invoiced from docket ${docket.docket_number}, ${bag.bag_number}, item "${item.name}".`,
    // Prefilled from the item/docket — still editable. Note delivery_charge
    // on the item is an extra/additional-mile fee, so it maps to "Extra
    // mile delivery" here, not the base freight charge.
    estimate_charge: "",
    docket_charge: docket.docket_charge ? String(docket.docket_charge) : "",
    packaging_charge: item.packaging_charge ? String(item.packaging_charge) : "",
    handling_charge: item.other_charges ? String(item.other_charges) : "",
    pickup_charge: item.pickup_charge ? String(item.pickup_charge) : "",
    extra_mile_delivery: item.delivery_charge ? String(item.delivery_charge) : "",
    final_charge: "",
    payment_status: "unpaid",
    amount_paid: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof InvoiceFormState, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/cargo/customers")
      .then((res) => res.json())
      .then((json) => setCustomers((json.data as CargoCustomer[]) ?? []))
      .catch((err) => console.error("Customers fetch error:", err));
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === form.customer_id) ?? null,
    [customers, form.customer_id]
  );

  const upd = <K extends keyof InvoiceFormState>(key: K, value: InvoiceFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleCustomerSelect = (customerId: string) => {
    setSenderSameAsCustomer(false);
    setReceiverSameAsCustomer(false);
    if (!customerId) {
      upd("customer_id", "");
      return;
    }
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    setForm((prev) => ({
      ...prev,
      customer_id: customerId,
      sender_name: c.name,
      sender_phone: c.phone,
      sender_address: c.address,
      sender_city_state: c.city_state ?? "",
      sender_pincode: c.pincode ?? "",
    }));
    setSenderSameAsCustomer(true);
  };

  const toggleSameAs = (which: "sender" | "receiver", checked: boolean) => {
    if (which === "sender") setSenderSameAsCustomer(checked);
    else setReceiverSameAsCustomer(checked);

    if (checked && selectedCustomer) {
      setForm((prev) => ({
        ...prev,
        [`${which}_name`]: selectedCustomer.name,
        [`${which}_phone`]: selectedCustomer.phone,
        [`${which}_address`]: selectedCustomer.address,
        [`${which}_city_state`]: selectedCustomer.city_state ?? "",
        [`${which}_pincode`]: selectedCustomer.pincode ?? "",
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [`${which}_name`]: "",
        [`${which}_phone`]: "",
        [`${which}_address`]: "",
        [`${which}_city_state`]: "",
        [`${which}_pincode`]: "",
      }));
    }
  };

  const total = sumInvoiceCharges(form);

  const validate = () => {
    const next: Partial<Record<keyof InvoiceFormState, string>> = {};
    if (!form.sender_name.trim()) next.sender_name = "Required";
    if (!/^\d{10}$/.test(form.sender_phone)) next.sender_phone = "10 digit number";
    if (!form.sender_address.trim()) next.sender_address = "Required";
    if (!form.receiver_name.trim()) next.receiver_name = "Required";
    if (!/^\d{10}$/.test(form.receiver_phone)) next.receiver_phone = "10 digit number";
    if (!form.receiver_address.trim()) next.receiver_address = "Required";
    if (!form.estimate_charge || parseFloat(form.estimate_charge) <= 0)
      next.estimate_charge = "Enter a freight charge";
    if (form.payment_status === "partial" && (!form.amount_paid || parseFloat(form.amount_paid) <= 0))
      next.amount_paid = "Enter amount paid";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast.error("Fix the highlighted fields before creating the invoice.");
      return;
    }
    setSaving(true);
    try {
      const amountPaid =
        form.payment_status === "paid" ? total
        : form.payment_status === "partial" ? parseFloat(form.amount_paid) || 0
        : 0;

      const payload = {
        customer_id: form.customer_id || null,
        sender_name: form.sender_name,
        sender_phone: form.sender_phone,
        sender_address: form.sender_address,
        sender_city_state: form.sender_city_state,
        sender_pincode: form.sender_pincode,
        receiver_name: form.receiver_name,
        receiver_phone: form.receiver_phone,
        receiver_address: form.receiver_address,
        receiver_city_state: form.receiver_city_state,
        receiver_pincode: form.receiver_pincode,
        delivery_mode: form.delivery_mode,
        status: form.status,
        pickup_required: form.pickup_required,
        delivery_required: form.delivery_required,
        third_party_tracking: form.third_party_tracking,
        notes: form.notes,
        estimate_charge: parseFloat(form.estimate_charge) || 0,
        docket_charge: form.docket_charge ? parseFloat(form.docket_charge) : undefined,
        packaging_charge: form.packaging_charge ? parseFloat(form.packaging_charge) : undefined,
        handling_charge: form.handling_charge ? parseFloat(form.handling_charge) : undefined,
        pickup_charge: form.pickup_charge ? parseFloat(form.pickup_charge) : undefined,
        extra_mile_delivery: form.extra_mile_delivery ? parseFloat(form.extra_mile_delivery) : undefined,
        final_charge: form.final_charge ? parseFloat(form.final_charge) : undefined,
        payment_status: form.payment_status,
        amount_paid: amountPaid,
      };

      const res = await fetch(`/api/admin/docket/item/${item.id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not create invoice");

      toast.success("Invoice created");
      onCreated({
        ...item,
        invoice_booking_id: json.data.item.invoice_booking_id,
        invoice_amount: json.data.item.invoice_amount,
        invoice_created_at: json.data.item.invoice_created_at,
      });
    } catch (err: any) {
      toast.error(err.message || "Could not create invoice");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "bg-white text-neutral-900 placeholder:text-neutral-400 border-neutral-300 text-sm";
  const isSenderLocked = senderSameAsCustomer && !!selectedCustomer;
  const isReceiverLocked = receiverSameAsCustomer && !!selectedCustomer;

  const PartyBlock = ({ which, title }: { which: "sender" | "receiver"; title: string }) => {
    const nameKey = `${which}_name` as const;
    const phoneKey = `${which}_phone` as const;
    const addressKey = `${which}_address` as const;
    const cityKey = `${which}_city_state` as const;
    const pinKey = `${which}_pincode` as const;
    const locked = which === "sender" ? isSenderLocked : isReceiverLocked;
    const sameChecked = which === "sender" ? senderSameAsCustomer : receiverSameAsCustomer;

    return (
      <div className={`rounded-lg border border-neutral-200 border-t-2 p-4 ${which === "sender" ? "border-t-blue-500" : "border-t-emerald-500"}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-neutral-800">{title}</h3>
          {selectedCustomer && (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
              <input type="checkbox" className="h-3.5 w-3.5 rounded border-blue-300 text-blue-600"
                checked={sameChecked} onChange={(e) => toggleSameAs(which, e.target.checked)} />
              Same as <span className="max-w-[70px] truncate font-semibold">{selectedCustomer.name}</span>
            </label>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input className={inputCls} value={form[nameKey]} readOnly={locked}
              onChange={(e) => upd(nameKey, e.target.value)} />
            {errors[nameKey] && <p className="text-xs text-red-600">{errors[nameKey]}</p>}
          </Field>
          <Field label="Phone" required>
            <Input className={inputCls} value={form[phoneKey]} inputMode="numeric" readOnly={locked}
              onChange={(e) => upd(phoneKey, e.target.value.replace(/\D/g, "").slice(0, 10))} />
            {errors[phoneKey] && <p className="text-xs text-red-600">{errors[phoneKey]}</p>}
          </Field>
          <Field label="Address" required className="sm:col-span-2">
            <Input className={inputCls} value={form[addressKey]} readOnly={locked}
              onChange={(e) => upd(addressKey, e.target.value)} />
            {errors[addressKey] && <p className="text-xs text-red-600">{errors[addressKey]}</p>}
          </Field>
          <Field label="City / State">
            <Input className={inputCls} value={form[cityKey]} readOnly={locked}
              onChange={(e) => upd(cityKey, e.target.value)} />
          </Field>
          <Field label="Pincode">
            <Input className={inputCls} value={form[pinKey]} inputMode="numeric" readOnly={locked}
              onChange={(e) => upd(pinKey, e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </Field>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Create invoice</h2>
            <p className="text-xs text-neutral-400">{item.name} · {docket.docket_number} · {bag.bag_number}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Charges below are prefilled from this item's internal costing but are fully editable — the invoiced
            amount can differ from what you're actually paying to pack/ship it.
          </p>

          {/* Frequent customer */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700">
              <Receipt className="h-4 w-4 text-blue-600" />
              Frequent customer
            </div>
            <InvoiceCustomerCombobox customers={customers} value={form.customer_id} onChange={handleCustomerSelect} />
            {form.customer_id && (
              <p className="mt-2 text-xs text-blue-600">
                ✓ Customer selected. Use the checkboxes below to fill their details into sender/receiver.
              </p>
            )}
          </div>

          {/* Sender + Receiver */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PartyBlock which="sender" title="Sender" />
            <PartyBlock which="receiver" title="Receiver" />
          </div>

          {/* Package & delivery */}
          <div className="rounded-lg border border-neutral-200 p-4">
            <h3 className="mb-3 text-sm font-medium text-neutral-800">Package & delivery</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Product name">
                <Input className={`${inputCls} opacity-70`} value={item.name} readOnly />
              </Field>
              <Field label="Weight (kg)">
                <Input className={`${inputCls} opacity-70`} value={String(item.weight)} readOnly />
              </Field>
              <Field label="Delivery mode" required>
                <Select value={form.delivery_mode} onValueChange={(v) => upd("delivery_mode", v)}>
                  <SelectTrigger className="bg-white text-neutral-900 border-neutral-300 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-neutral-900">
                    {DELIVERY_MODES.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => upd("status", v as DocketStatus)}>
                  <SelectTrigger className="bg-white text-neutral-900 border-neutral-300 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-neutral-900">
                    {INVOICE_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center gap-6 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                    checked={form.pickup_required} onChange={(e) => upd("pickup_required", e.target.checked)} />
                  Pickup required
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                    checked={form.delivery_required} onChange={(e) => upd("delivery_required", e.target.checked)} />
                  Delivery required
                </label>
              </div>
              <Field label="Third-party tracking">
                <Input className={inputCls} value={form.third_party_tracking}
                  onChange={(e) => upd("third_party_tracking", e.target.value)} />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Input className={inputCls} value={form.notes} onChange={(e) => upd("notes", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Charges */}
          <div className="rounded-lg border border-neutral-200 p-4">
            <h3 className="mb-3 text-sm font-medium text-neutral-800">Charges</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([
                ["Freight charge", "estimate_charge", true],
                ["Handling charge", "handling_charge", false],
                ["Docket charge", "docket_charge", false],
                ["Pickup charge", "pickup_charge", false],
                ["Packaging charge", "packaging_charge", false],
                ["Extra mile delivery", "extra_mile_delivery", false],
                ["Final charge (optional)", "final_charge", false],
              ] as [string, keyof InvoiceFormState, boolean][]).map(([label, key, req]) => (
                <Field key={key} label={label} required={req}>
                  <Input className={inputCls} value={form[key] as string} inputMode="decimal"
                    onChange={(e) => upd(key, e.target.value.replace(/[^0-9.]/g, "") as never)}
                    placeholder="0" />
                  {errors[key] && <p className="text-xs text-red-600">{errors[key]}</p>}
                </Field>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md bg-blue-50 px-4 py-2.5">
              <span className="text-xs font-medium uppercase tracking-wide text-blue-700">
                {form.final_charge ? "Invoice total (override)" : "Invoice total"}
              </span>
              <span className="font-mono text-sm font-semibold text-blue-800">
                ₹{(form.final_charge ? parseFloat(form.final_charge) || 0 : total).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment */}
          <div className="rounded-lg border border-neutral-200 p-4">
            <h3 className="mb-3 text-sm font-medium text-neutral-800">Payment</h3>
            <div className="flex flex-wrap gap-2">
              {(["paid", "unpaid", "partial"] as const).map((opt) => (
                <button key={opt} type="button" onClick={() => upd("payment_status", opt)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition ${
                    form.payment_status === opt
                      ? opt === "paid" ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : opt === "unpaid" ? "border-red-400 bg-red-50 text-red-700"
                        : "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                  }`}>
                  {opt === "paid" ? "✓ Paid" : opt === "unpaid" ? "✗ Unpaid" : "~ Partial"}
                </button>
              ))}
            </div>
            {form.payment_status === "partial" && (
              <div className="mt-3 max-w-xs">
                <Field label="Amount paid" required>
                  <Input className={inputCls} value={form.amount_paid} inputMode="decimal"
                    onChange={(e) => upd("amount_paid", e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="e.g. 500" />
                  {errors.amount_paid && <p className="text-xs text-red-600">{errors.amount_paid}</p>}
                </Field>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving} className="border-neutral-200 text-neutral-600">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
            ) : (
              <><Receipt className="mr-2 h-4 w-4" />Create invoice</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit modal — status + docket charge + per-category payment
// ---------------------------------------------------------------------------

type CategoryFormState = { status: PaymentStatus; paid: string };

function EditDocketModal({
  docket,
  onClose,
  onSaved,
}: {
  docket: Docket;
  onClose: () => void;
  onSaved: (updated: Docket) => void;
}) {
  const [status, setStatus] = useState<DocketStatus>(docket.status ?? "Pending");
  const [docketCharge, setDocketCharge] = useState(
    docket.docket_charge ? String(docket.docket_charge) : ""
  );
  const [categories, setCategories] = useState<Record<PaymentCategory, CategoryFormState>>(() => {
    const init = {} as Record<PaymentCategory, CategoryFormState>;
    for (const c of PAYMENT_CATEGORIES) {
      const entry = docket.payments?.[c.key];
      init[c.key] = {
        status: entry?.status ?? "unpaid",
        paid: entry?.paid ? String(entry.paid) : "",
      };
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  const categoryTotal = (key: PaymentCategory) => {
    if (key === "docket_charge") return parseFloat(docketCharge) || 0;
    return docket.payments?.[key]?.total ?? 0;
  };

  const setCategory = (key: PaymentCategory, patch: Partial<CategoryFormState>) => {
    setCategories((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const save = async () => {
    // Validate partial payments have an amount
    for (const c of PAYMENT_CATEGORIES) {
      const cat = categories[c.key];
      if (cat.status === "partial" && (!cat.paid || parseFloat(cat.paid) <= 0)) {
        toast.error(`Enter an amount paid for ${c.label}`);
        return;
      }
    }

    setSaving(true);
    try {
      const payments: DocketPayments = {};
      for (const c of PAYMENT_CATEGORIES) {
        const cat = categories[c.key];
        const total = categoryTotal(c.key);
        const paid =
          cat.status === "paid" ? total : cat.status === "partial" ? parseFloat(cat.paid) || 0 : 0;
        payments[c.key] = { total, paid, status: cat.status };
      }

      const res = await fetch(`/api/admin/docket/${docket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          docket_charge: parseFloat(docketCharge) || 0,
          payments,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not update docket");

      toast.success("Docket updated");
      onSaved({ ...docket, ...json.data });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Could not update docket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Edit docket</h2>
            <p className="font-mono text-xs text-blue-700">{docket.docket_number}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Status */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-neutral-500">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as DocketStatus)}>
              <SelectTrigger className="bg-white text-neutral-900 border-neutral-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white text-neutral-900">
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Docket charge */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-neutral-500">
              Docket charge
            </Label>
            <Input
              className="bg-white text-neutral-900 placeholder:text-neutral-400 border-neutral-300"
              value={docketCharge}
              inputMode="decimal"
              onChange={(e) => setDocketCharge(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
            />
            <p className="mt-1 text-xs text-neutral-400">
              A standalone fee for the docket itself, separate from per-item charges.
            </p>
          </div>

          {/* Payment categories */}
          <div>
            <Label className="mb-2 block text-xs font-medium text-neutral-500">Payment</Label>
            <div className="space-y-3">
              {PAYMENT_CATEGORIES.map((c) => {
                const total = categoryTotal(c.key);
                const cat = categories[c.key];
                const due = Math.max(0, total - (parseFloat(cat.paid) || 0));
                return (
                  <div key={c.key} className="rounded-lg border border-neutral-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-700">{c.label}</span>
                      <span className="text-xs text-neutral-400">Total ₹{total.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {(["paid", "unpaid", "partial"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setCategory(c.key, { status: opt })}
                          className={`flex-1 rounded-lg border py-1.5 text-xs font-medium capitalize transition ${
                            cat.status === opt
                              ? opt === "paid"
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : opt === "unpaid"
                                ? "border-red-400 bg-red-50 text-red-700"
                                : "border-amber-400 bg-amber-50 text-amber-700"
                              : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {cat.status === "partial" && (
                      <div className="mt-2">
                        <Input
                          className="h-8 bg-white text-xs text-neutral-900 border-neutral-300"
                          value={cat.paid}
                          inputMode="decimal"
                          onChange={(e) =>
                            setCategory(c.key, { paid: e.target.value.replace(/[^0-9.]/g, "") })
                          }
                          placeholder={`e.g. ${Math.round(total / 2)}`}
                        />
                        {cat.paid && (
                          <p className="mt-1 text-[11px] text-neutral-400">Due: ₹{due.toFixed(2)}</p>
                        )}
                      </div>
                    )}
                    {cat.status === "paid" && (
                      <p className="mt-2 text-[11px] text-neutral-400">
                        Will mark full ₹{total.toFixed(2)} as paid.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving} className="border-neutral-200 text-neutral-600">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
            ) : (
              <><Check className="mr-2 h-4 w-4" />Save changes</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------

function DocketCard({
  docket,
  expanded,
  onToggle,
  onStatusChange,
  updating,
  onEdit,
  onItemClick,
}: {
  docket: Docket;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: DocketStatus) => void;
  updating: boolean;
  onEdit: () => void;
  onItemClick: (docket: Docket, bag: DocketBag, item: DocketItem) => void;
}) {
  const payStatus = overallPaymentStatus(docket);
  const paid = docketPaid(docket);
  const payable = docketPayable(docket);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-4">
        <button type="button" onClick={onToggle} className="mb-2 flex w-full items-start justify-between gap-2 text-left">
          <span className="font-mono text-sm font-semibold text-blue-700">{docket.docket_number}</span>
          <span className="text-xs text-neutral-400">
            {new Date(docket.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </button>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-600">
            {docket.number_of_bags} bag{docket.number_of_bags !== 1 ? "s" : ""}
          </span>
          <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-600">
            {docket.total_items} item{docket.total_items !== 1 ? "s" : ""}
          </span>
          <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-600">
            {Number(docket.total_weight).toFixed(2)} kg
          </span>
          <button type="button" onClick={onToggle} className="ml-auto text-neutral-400">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <Select value={docket.status} onValueChange={(v) => onStatusChange(docket.id, v as DocketStatus)} disabled={updating}>
            <SelectTrigger className={`h-7 flex-1 border px-2 text-xs font-medium ${STATUS_STYLES[docket.status] ?? "bg-neutral-100 text-neutral-600"}`}>
              <div className="flex items-center gap-1">
                {updating && <Loader2 className="h-3 w-3 animate-spin" />}
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white text-neutral-900">
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PAYMENT_STYLES[payStatus]}`}>
            {payStatus}
          </span>
          <span className="ml-auto text-sm font-semibold text-neutral-900">₹{payable.toFixed(2)}</span>
        </div>

        {payStatus !== "paid" && payable > 0 && (
          <p className="mb-3 text-xs text-neutral-400">
            ₹{paid.toFixed(2)} paid · ₹{Math.max(0, payable - paid).toFixed(2)} due
          </p>
        )}

        <Button variant="outline" size="sm" onClick={onEdit}
          className="h-7 w-full border-blue-200 bg-white text-blue-700 hover:bg-blue-50">
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </div>
      {expanded && <DocketBreakdown docket={docket} onItemClick={onItemClick} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DocketListPage() {
  const router = useRouter();
  const [dockets, setDockets] = useState<Docket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingDocket, setEditingDocket] = useState<Docket | null>(null);
  const [quickViewCtx, setQuickViewCtx] = useState<{ docket: Docket; bag: DocketBag; item: DocketItem } | null>(null);
  const [invoiceFormCtx, setInvoiceFormCtx] = useState<{ docket: Docket; bag: DocketBag; item: DocketItem } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/docket");
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Could not load dockets");
        setDockets((json.data as Docket[]) ?? []);
      } catch (err: any) {
        toast.error(err.message || "Could not load dockets");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Reset to page 1 whenever a filter or page size changes
  useEffect(() => {
    setPage(1);
  }, [search, startDate, endDate, pageSize, sortKey, sortDir]);

  const filtered = useMemo(() => {
    let rows = [...dockets];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (d) =>
          d.docket_number.toLowerCase().includes(q) ||
          d.bags.some(
            (b) =>
              b.bag_number.toLowerCase().includes(q) ||
              b.items.some((it) => it.name.toLowerCase().includes(q))
          )
      );
    }
    if (startDate) rows = rows.filter((d) => new Date(d.created_at) >= new Date(startDate));
    if (endDate) rows = rows.filter((d) => new Date(d.created_at) <= new Date(`${endDate}T23:59:59`));
    rows.sort((a, b) => {
      const av = sortKey === "created_at" ? new Date(a.created_at).getTime() : Number(a[sortKey]) || 0;
      const bv = sortKey === "created_at" ? new Date(b.created_at).getTime() : Number(b[sortKey]) || 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [dockets, search, startDate, endDate, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
  };
  const hasActiveFilters = search || startDate || endDate;

  const handleStatusChange = async (id: string, status: DocketStatus) => {
    const previous = dockets;
    setDockets((rows) => rows.map((d) => (d.id === id ? { ...d, status } : d)));
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/docket/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not update status");
      toast.success(`Status → "${status}"`);
    } catch (err: any) {
      toast.error(err.message || "Could not update status");
      setDockets(previous);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDocketSaved = (updated: Docket) => {
    setDockets((rows) => rows.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  };

  const handleItemClick = (docket: Docket, bag: DocketBag, item: DocketItem) => {
    setQuickViewCtx({ docket, bag, item });
  };

  // Applies a freshly-invoiced item back into `dockets`, and keeps whichever
  // modals are open (quick view / invoice form) in sync with the same item.
  const applyItemUpdate = (updatedItem: DocketItem) => {
    setDockets((rows) =>
      rows.map((d) =>
        !d.bags.some((b) => b.id === updatedItem.bag_id)
          ? d
          : {
              ...d,
              bags: d.bags.map((b) =>
                b.id !== updatedItem.bag_id
                  ? b
                  : { ...b, items: b.items.map((it) => (it.id === updatedItem.id ? updatedItem : it)) }
              ),
            }
      )
    );
    setQuickViewCtx((cur) => (cur && cur.item.id === updatedItem.id ? { ...cur, item: updatedItem } : cur));
  };

  // ---- dashboard totals (computed over the full dataset, not the filtered view) ----
  const dash = useMemo(() => {
    const totalBags = dockets.reduce((s, d) => s + (d.number_of_bags || 0), 0);
    const totalItems = dockets.reduce((s, d) => s + (d.total_items || 0), 0);
    const totalWeight = dockets.reduce((s, d) => s + (Number(d.total_weight) || 0), 0);
    const totalPayable = dockets.reduce((s, d) => s + docketPayable(d), 0);
    const totalPaid = dockets.reduce((s, d) => s + docketPaid(d), 0);
    return {
      count: dockets.length,
      totalBags,
      totalItems,
      totalWeight,
      totalPayable,
      totalPaid,
      totalDue: Math.max(0, totalPayable - totalPaid),
    };
  }, [dockets]);

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <button type="button" onClick={() => toggleSort(k)} className="flex items-center gap-1 font-medium text-blue-800 hover:text-blue-600">
      {label}
      {sortKey === k ? (
        sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-white">
      {editingDocket && (
        <EditDocketModal
          docket={editingDocket}
          onClose={() => setEditingDocket(null)}
          onSaved={handleDocketSaved}
        />
      )}

      {quickViewCtx && !invoiceFormCtx && (
        <ItemQuickViewModal
          docket={quickViewCtx.docket}
          bag={quickViewCtx.bag}
          item={quickViewCtx.item}
          onClose={() => setQuickViewCtx(null)}
          onCreateInvoice={() => setInvoiceFormCtx(quickViewCtx)}
        />
      )}

      {invoiceFormCtx && (
        <CreateItemInvoiceModal
          docket={invoiceFormCtx.docket}
          bag={invoiceFormCtx.bag}
          item={invoiceFormCtx.item}
          onClose={() => setInvoiceFormCtx(null)}
          onCreated={(updatedItem) => {
            applyItemUpdate(updatedItem);
            setInvoiceFormCtx(null);
          }}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start gap-3 sm:items-center">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-neutral-900">Dockets</h1>
            <p className="text-sm text-neutral-500">
              {loading ? "Loading…" : `${filtered.length} of ${dockets.length} dockets`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/cargo")}
              className="border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50">
              <List className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Bookings</span>
            </Button>
            <Button onClick={() => router.push("/admin/docket")}
              className="bg-blue-600 text-white hover:bg-blue-700">
              <PackagePlus className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">New docket</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {/* Dashboard */}
        {!loading && dockets.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={Layers} label="Dockets" value={String(dash.count)} accent="text-blue-600" />
            <StatCard icon={Package} label="Bags" value={String(dash.totalBags)} accent="text-blue-600" />
            <StatCard icon={Boxes} label="Items" value={String(dash.totalItems)} accent="text-blue-600" />
            <StatCard icon={Weight} label="Weight" value={`${dash.totalWeight.toFixed(2)} kg`} accent="text-blue-600" />
            <StatCard icon={Wallet} label="Collected" value={`₹${dash.totalPaid.toFixed(0)}`} accent="text-emerald-600" />
            <StatCard icon={Wallet} label="Due" value={`₹${dash.totalDue.toFixed(0)}`} accent={dash.totalDue > 0 ? "text-red-600" : "text-emerald-600"} />
          </div>
        )}

        {/* Filters */}
        <div className="mb-5 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search docket number, bag label or item name"
                className="bg-white pl-8 text-neutral-900 placeholder:text-neutral-400 border-neutral-200" />
            </div>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}
                className="shrink-0 bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50">
                <X className="mr-1 h-3.5 w-3.5" />Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="h-8 w-auto bg-white text-xs text-neutral-900 border-neutral-200" />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="h-8 w-auto bg-white text-xs text-neutral-900 border-neutral-200" />
            <div className="ml-auto flex items-center gap-1.5 text-xs text-neutral-500">
              <span>Show</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[80px] bg-white text-xs text-neutral-900 border-neutral-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white text-neutral-900">
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>per page</span>
            </div>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          {loading ? (
            <div className="flex justify-center py-16 text-neutral-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : paged.length === 0 ? (
            <div className="py-16 text-center text-sm text-neutral-400">No dockets match these filters.</div>
          ) : (
            <div className="space-y-3">
              {paged.map((d) => (
                <DocketCard
                  key={d.id}
                  docket={d}
                  expanded={expandedId === d.id}
                  onToggle={() => setExpandedId((cur) => (cur === d.id ? null : d.id))}
                  onStatusChange={handleStatusChange}
                  updating={updatingId === d.id}
                  onEdit={() => setEditingDocket(d)}
                  onItemClick={handleItemClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50/60">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-blue-800" />
                <th className="px-3 py-2.5 text-left text-xs font-medium text-blue-800">Docket</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-blue-800">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-blue-800">Bags</th>
                <th className="px-3 py-2.5 text-left text-xs"><SortBtn label="Items" k="total_items" /></th>
                <th className="px-3 py-2.5 text-left text-xs"><SortBtn label="Weight" k="total_weight" /></th>
                <th className="px-3 py-2.5 text-left text-xs"><SortBtn label="Charges" k="total_charges" /></th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-blue-800">Payment</th>
                <th className="px-3 py-2.5 text-left text-xs"><SortBtn label="Created" k="created_at" /></th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-blue-800">Edit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-neutral-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-neutral-400">
                    No dockets match these filters.
                  </td>
                </tr>
              ) : (
                paged.map((d) => {
                  const isExpanded = expandedId === d.id;
                  const payStatus = overallPaymentStatus(d);
                  const payable = docketPayable(d);
                  return (
                    <React.Fragment key={d.id}>
                      <tr className="border-b border-neutral-100 last:border-0 transition-colors hover:bg-blue-50/30">
                        <td className="px-3 py-2.5 text-neutral-400">
                          <button type="button" onClick={() => setExpandedId((cur) => (cur === d.id ? null : d.id))}>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="block truncate font-mono text-xs font-medium text-blue-700">
                            {d.docket_number}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Select value={d.status} onValueChange={(v) => handleStatusChange(d.id, v as DocketStatus)}
                            disabled={updatingId === d.id}>
                            <SelectTrigger className={`h-6 w-full border-0 px-2 text-xs font-medium ${STATUS_STYLES[d.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                              <div className="flex items-center gap-1 min-w-0">
                                {updatingId === d.id && <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />}
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="bg-white text-neutral-900">
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-neutral-600">{d.number_of_bags}</td>
                        <td className="px-3 py-2.5 text-xs text-neutral-600">{d.total_items}</td>
                        <td className="px-3 py-2.5 text-xs text-neutral-600 whitespace-nowrap">
                          {Number(d.total_weight).toFixed(2)} kg
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-neutral-800 whitespace-nowrap">
                          ₹{payable.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PAYMENT_STYLES[payStatus]}`}>
                            {payStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-neutral-500 whitespace-nowrap">
                          {new Date(d.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="px-3 py-2.5">
                          <Button variant="outline" size="sm"
                            className="h-6 w-full border-blue-200 bg-white px-1.5 text-xs text-blue-700 hover:bg-blue-50"
                            onClick={() => setEditingDocket(d)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-neutral-100 last:border-0">
                          <td colSpan={10} className="p-0">
                            <DocketBreakdown docket={d} onItemClick={handleItemClick} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50">
                Previous
              </Button>
              <span>Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50">
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}