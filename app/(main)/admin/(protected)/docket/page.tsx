// app/(main)/admin/docket/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Plus,
  Trash2,
  PackagePlus,
  Package,
  List,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const PARCEL_TYPES = ["General", "Fragile", "Document", "Perishable", "Electronics", "Other"] as const;
type ParcelType = (typeof PARCEL_TYPES)[number];

interface DocketItem {
  id: string;
  name: string;
  weight: string;
  packaging_charge: string;
  delivery_charge: string;
  pickup_charge: string;
  parcel_type: ParcelType;
  other_charges: string;
}

interface DocketBag {
  id: string;
  bag_number: string;
  items: DocketItem[];
}

type ItemErrors = Partial<Record<keyof DocketItem, string>>;
type BagErrors = { bag_number?: string; items: Record<string, ItemErrors> };

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function emptyItem(): DocketItem {
  return {
    id: nextId("item"),
    name: "",
    weight: "",
    packaging_charge: "",
    delivery_charge: "",
    pickup_charge: "",
    parcel_type: "General",
    other_charges: "",
  };
}

function emptyBag(bagNumber: string): DocketBag {
  return {
    id: nextId("bag"),
    bag_number: bagNumber,
    items: [emptyItem()],
  };
}

function itemTotal(item: DocketItem) {
  return (
    (parseFloat(item.packaging_charge) || 0) +
    (parseFloat(item.delivery_charge) || 0) +
    (parseFloat(item.pickup_charge) || 0) +
    (parseFloat(item.other_charges) || 0)
  );
}

function bagTotal(bag: DocketBag) {
  return bag.items.reduce((s, it) => s + itemTotal(it), 0);
}

function bagWeight(bag: DocketBag) {
  return bag.items.reduce((s, it) => s + (parseFloat(it.weight) || 0), 0);
}

// ---------------------------------------------------------------------------
// Small building blocks
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
      {required && <span className="ml-0.5 text-emerald-600">*</span>}
    </Label>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Item row
// ---------------------------------------------------------------------------

function ItemRow({
  item,
  index,
  errors,
  canRemove,
  onChange,
  onRemove,
}: {
  item: DocketItem;
  index: number;
  errors: ItemErrors | undefined;
  canRemove: boolean;
  onChange: <K extends keyof DocketItem>(key: K, value: DocketItem[K]) => void;
  onRemove: () => void;
}) {
  const inputCls = "h-10 sm:h-9 bg-white text-neutral-900 placeholder:text-neutral-400 border-neutral-300 text-sm sm:text-xs";
  const total = itemTotal(item);

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-500">Item {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="-mr-1 rounded-md p-2 text-neutral-400 active:bg-red-50 active:text-red-600 sm:p-1 sm:hover:bg-red-50 sm:hover:text-red-600"
            aria-label="Remove item"
          >
            <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2.5 md:grid-cols-4">
        <Field label="Item name" required className="sm:col-span-2">
          <Input className={inputCls} value={item.name}
            onChange={(e) => onChange("name", e.target.value)} placeholder="e.g. Woolen shawl" />
          {errors?.name && <p className="text-[11px] text-red-600">{errors.name}</p>}
        </Field>
        <Field label="Weight (kg)" required>
          <Input className={inputCls} value={item.weight} inputMode="decimal"
            onChange={(e) => onChange("weight", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" />
          {errors?.weight && <p className="text-[11px] text-red-600">{errors.weight}</p>}
        </Field>
        <Field label="Parcel type">
          <Select value={item.parcel_type} onValueChange={(v) => onChange("parcel_type", v as ParcelType)}>
            <SelectTrigger className="h-10 sm:h-9 bg-white text-sm sm:text-xs text-neutral-900 border-neutral-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white text-neutral-900">
              {PARCEL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Packaging charge">
          <Input className={inputCls} value={item.packaging_charge} inputMode="decimal"
            onChange={(e) => onChange("packaging_charge", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" />
        </Field>
        <Field label="Delivery charge">
          <Input className={inputCls} value={item.delivery_charge} inputMode="decimal"
            onChange={(e) => onChange("delivery_charge", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" />
        </Field>
        <Field label="Pickup charge">
          <Input className={inputCls} value={item.pickup_charge} inputMode="decimal"
            onChange={(e) => onChange("pickup_charge", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" />
        </Field>
        <Field label="Other charges">
          <Input className={inputCls} value={item.other_charges} inputMode="decimal"
            onChange={(e) => onChange("other_charges", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" />
        </Field>
      </div>

      <div className="mt-2.5 flex justify-end border-t border-neutral-200/70 pt-2">
        <span className="text-xs font-medium text-neutral-500">
          Item total: <span className="text-neutral-800">₹{total.toFixed(2)}</span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bag card
// ---------------------------------------------------------------------------

function BagCard({
  bag,
  index,
  errors,
  canRemove,
  collapsed,
  onToggleCollapse,
  onBagNumberChange,
  onAddItem,
  onRemoveItem,
  onItemChange,
  onRemoveBag,
}: {
  bag: DocketBag;
  index: number;
  errors: BagErrors | undefined;
  canRemove: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onBagNumberChange: (value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onItemChange: <K extends keyof DocketItem>(itemId: string, key: K, value: DocketItem[K]) => void;
  onRemoveBag: () => void;
}) {
  const total = bagTotal(bag);
  const weight = bagWeight(bag);

  return (
    <div className="rounded-xl border border-neutral-200 border-t-2 border-t-blue-500 bg-white p-3.5 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-h-[36px] items-center gap-2 rounded-md text-sm font-medium text-neutral-900 active:opacity-70"
        >
          <Package className="h-4 w-4 shrink-0 text-blue-600" />
          Bag {index + 1}
          {collapsed ? <ChevronDown className="h-4 w-4 text-neutral-400" /> : <ChevronUp className="h-4 w-4 text-neutral-400" />}
        </button>
        <div className="flex items-center gap-2.5 text-xs text-neutral-500 sm:gap-3">
          <span className="hidden sm:inline">{bag.items.length} item{bag.items.length !== 1 ? "s" : ""}</span>
          <span>{weight.toFixed(2)} kg</span>
          <span className="font-medium text-neutral-800">₹{total.toFixed(2)}</span>
          {canRemove && (
            <button
              type="button"
              onClick={onRemoveBag}
              className="rounded-md p-2 text-neutral-400 active:bg-red-50 active:text-red-600 sm:p-1 sm:hover:bg-red-50 sm:hover:text-red-600"
              aria-label="Remove bag"
            >
              <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 sm:max-w-xs">
        <Field label="Bag number / label" required>
          <Input
            className="h-10 sm:h-9 bg-white text-neutral-900 placeholder:text-neutral-400 border-neutral-300 text-sm sm:text-xs"
            value={bag.bag_number}
            onChange={(e) => onBagNumberChange(e.target.value)}
            placeholder={`e.g. BAG-${index + 1}`}
          />
          {errors?.bag_number && <p className="text-[11px] text-red-600">{errors.bag_number}</p>}
        </Field>
      </div>

      {!collapsed && (
        <div className="space-y-2.5">
          {bag.items.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              index={i}
              errors={errors?.items[item.id]}
              canRemove={bag.items.length > 1}
              onChange={(key, value) => onItemChange(item.id, key, value)}
              onRemove={() => onRemoveItem(item.id)}
            />
          ))}

          <button
            type="button"
            onClick={onAddItem}
            className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 py-2 text-xs font-medium text-neutral-500 active:border-blue-400 active:text-blue-700 sm:hover:border-blue-400 sm:hover:text-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add item to this bag
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success modal
// ---------------------------------------------------------------------------

function SuccessModal({
  docketNumber,
  onNewDocket,
  onDashboard,
}: {
  docketNumber: string;
  onNewDocket: () => void;
  onDashboard: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <CheckCircle2 className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-base font-semibold text-neutral-900">Docket created!</h2>
          <p className="mt-1 font-mono text-sm text-blue-700">{docketNumber}</p>
        </div>
        <div className="space-y-2">
          <Button className="w-full bg-blue-600 font-bold text-white hover:bg-blue-700" onClick={onNewDocket}>
            <Plus className="mr-2 h-4 w-4" />
            Create another docket
          </Button>
          <Button
            variant="outline"
            className="w-full border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            onClick={onDashboard}
          >
            <List className="mr-2 h-4 w-4" />
            Back to bookings
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NewDocketPage() {
  const router = useRouter();
  const [docketNumber, setDocketNumber] = useState("");
  const [bags, setBags] = useState<DocketBag[]>([emptyBag("BAG-1")]);
  const [collapsedBags, setCollapsedBags] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [docketNumberError, setDocketNumberError] = useState<string | undefined>();
  const [bagErrors, setBagErrors] = useState<Record<string, BagErrors>>({});
  const [successDocket, setSuccessDocket] = useState<string | null>(null);

  const grandTotal = useMemo(() => bags.reduce((s, b) => s + bagTotal(b), 0), [bags]);
  const grandWeight = useMemo(() => bags.reduce((s, b) => s + bagWeight(b), 0), [bags]);
  const totalItems = useMemo(() => bags.reduce((s, b) => s + b.items.length, 0), [bags]);

  // ---- bag / item mutation helpers ----

  const addBag = () => {
    setBags((prev) => {
      // Collapse every existing bag so the newly added one is the only
      // thing expanded — keeps multi-bag dockets short to scroll on mobile.
      setCollapsedBags((prevCollapsed) => {
        const next = { ...prevCollapsed };
        prev.forEach((b) => { next[b.id] = true; });
        return next;
      });
      return [...prev, emptyBag(`BAG-${prev.length + 1}`)];
    });
  };

  const removeBag = (bagId: string) => {
    setBags((prev) => (prev.length > 1 ? prev.filter((b) => b.id !== bagId) : prev));
  };

  const toggleCollapse = (bagId: string) => {
    setCollapsedBags((prev) => ({ ...prev, [bagId]: !prev[bagId] }));
  };

  const setBagNumber = (bagId: string, value: string) => {
    setBags((prev) => prev.map((b) => (b.id === bagId ? { ...b, bag_number: value } : b)));
  };

  const addItem = (bagId: string) => {
    setBags((prev) =>
      prev.map((b) => (b.id === bagId ? { ...b, items: [...b.items, emptyItem()] } : b))
    );
  };

  const removeItem = (bagId: string, itemId: string) => {
    setBags((prev) =>
      prev.map((b) =>
        b.id === bagId && b.items.length > 1
          ? { ...b, items: b.items.filter((it) => it.id !== itemId) }
          : b
      )
    );
  };

  const setItemField = <K extends keyof DocketItem>(
    bagId: string,
    itemId: string,
    key: K,
    value: DocketItem[K]
  ) => {
    setBags((prev) =>
      prev.map((b) =>
        b.id === bagId
          ? {
              ...b,
              items: b.items.map((it) => (it.id === itemId ? { ...it, [key]: value } : it)),
            }
          : b
      )
    );
  };

  // ---- validation ----

  const validate = () => {
    let ok = true;
    if (!docketNumber.trim()) {
      setDocketNumberError("Docket number is required");
      ok = false;
    } else {
      setDocketNumberError(undefined);
    }

    const nextBagErrors: Record<string, BagErrors> = {};
    for (const bag of bags) {
      const itemErrs: Record<string, ItemErrors> = {};
      for (const item of bag.items) {
        const e: ItemErrors = {};
        if (!item.name.trim()) e.name = "Required";
        if (!item.weight || parseFloat(item.weight) <= 0) e.weight = "Enter weight";
        if (Object.keys(e).length) itemErrs[item.id] = e;
      }
      const be: BagErrors = { items: itemErrs };
      if (!bag.bag_number.trim()) be.bag_number = "Required";
      if (be.bag_number || Object.keys(itemErrs).length) nextBagErrors[bag.id] = be;
    }
    setBagErrors(nextBagErrors);
    if (Object.keys(nextBagErrors).length) ok = false;

    return ok;
  };

  const resetForm = () => {
    setDocketNumber("");
    setBags([emptyBag("BAG-1")]);
    setCollapsedBags({});
    setDocketNumberError(undefined);
    setBagErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Fix the highlighted fields before saving the docket.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        docket_number: docketNumber,
        number_of_bags: bags.length,
        total_items: totalItems,
        total_weight: grandWeight,
        total_charges: grandTotal,
        bags: bags.map((b) => ({
          bag_number: b.bag_number,
          items: b.items.map((it) => ({
            name: it.name,
            weight: parseFloat(it.weight) || 0,
            packaging_charge: parseFloat(it.packaging_charge) || 0,
            delivery_charge: parseFloat(it.delivery_charge) || 0,
            pickup_charge: parseFloat(it.pickup_charge) || 0,
            parcel_type: it.parcel_type,
            other_charges: parseFloat(it.other_charges) || 0,
          })),
        })),
      };

      const res = await fetch("/api/admin/docket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not save docket");

      setSuccessDocket(docketNumber);
    } catch (err: any) {
      toast.error(err.message || "Could not save docket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {successDocket && (
        <SuccessModal
          docketNumber={successDocket}
          onNewDocket={() => {
            setSuccessDocket(null);
            resetForm();
          }}
          onDashboard={() => router.push("/admin/cargo")}
        />
      )}

      <form id="docket-form" onSubmit={handleSubmit} className="mx-auto max-w-4xl px-3 pb-28 pt-5 sm:px-4 sm:py-8 sm:pb-8">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6 sm:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-base font-medium text-neutral-900 sm:text-lg">
              <PackagePlus className="h-5 w-5 text-blue-600" />
              New docket
            </h1>
            <p className="text-xs text-neutral-500 sm:text-sm">Record bags and the items packed inside each</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/cargo")}
              className="border-emerald-200 bg-white text-xs text-emerald-700 hover:bg-emerald-50 sm:text-sm"
            >
              <List className="mr-1.5 h-4 w-4" />
              View bookings
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/docket-list")}
              className="border-blue-200 bg-white text-xs text-blue-700 hover:bg-blue-50 sm:text-sm"
            >
              <Package className="mr-1.5 h-4 w-4" />
              Docket list
            </Button>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {/* Docket number */}
          <div className="rounded-lg border border-neutral-200 p-3.5 sm:p-4">
            <div className="sm:max-w-xs">
              <Field label="Docket number" required>
                <Input
                  className="h-10 bg-white text-neutral-900 placeholder:text-neutral-400 border-neutral-300 sm:h-9"
                  value={docketNumber}
                  onChange={(e) => {
                    setDocketNumber(e.target.value);
                    if (docketNumberError) setDocketNumberError(undefined);
                  }}
                  placeholder="e.g. DKT-000123"
                />
                {docketNumberError && <p className="text-xs text-red-600">{docketNumberError}</p>}
              </Field>
            </div>
          </div>

          {/* Bags */}
          <div className="space-y-3.5 sm:space-y-4">
            {bags.map((bag, i) => (
              <BagCard
                key={bag.id}
                bag={bag}
                index={i}
                errors={bagErrors[bag.id]}
                canRemove={bags.length > 1}
                collapsed={!!collapsedBags[bag.id]}
                onToggleCollapse={() => toggleCollapse(bag.id)}
                onBagNumberChange={(v) => setBagNumber(bag.id, v)}
                onAddItem={() => addItem(bag.id)}
                onRemoveItem={(itemId) => removeItem(bag.id, itemId)}
                onItemChange={(itemId, key, value) => setItemField(bag.id, itemId, key, value)}
                onRemoveBag={() => removeBag(bag.id)}
              />
            ))}

            <button
              type="button"
              onClick={addBag}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-500 active:border-blue-400 active:text-blue-700 sm:hover:border-blue-400 sm:hover:text-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add another bag
            </button>
          </div>

          {/* Summary — also mirrored in the sticky bar on mobile */}
          <div className="hidden rounded-lg border border-blue-100 bg-blue-50/60 p-4 sm:block">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-blue-700">Bags</p>
                <p className="text-sm font-semibold text-neutral-900">{bags.length}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-blue-700">Items</p>
                <p className="text-sm font-semibold text-neutral-900">{totalItems}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-blue-700">Weight</p>
                <p className="text-sm font-semibold text-neutral-900">{grandWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-blue-700">Total charges</p>
                <p className="text-sm font-semibold text-neutral-900">₹{grandTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop footer */}
        <div className="mt-6 hidden items-center justify-end gap-3 sm:flex">
          <p className="mr-auto text-xs text-neutral-400">* required fields</p>
          <Button type="submit" disabled={submitting} className="bg-blue-600 text-white hover:bg-blue-700">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save docket"
            )}
          </Button>
        </div>
      </form>

      {/* Sticky mobile action bar — keeps the running total and save button
          reachable without scrolling back down through every bag/item */}
      <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-neutral-200 bg-white/95 px-3 py-3 backdrop-blur sm:hidden">
        <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
          <span>{bags.length} bag{bags.length !== 1 ? "s" : ""} · {totalItems} item{totalItems !== 1 ? "s" : ""} · {grandWeight.toFixed(2)} kg</span>
          <span className="text-sm font-semibold text-neutral-900">₹{grandTotal.toFixed(2)}</span>
        </div>
        <Button
          type="submit"
          form="docket-form"
          disabled={submitting}
          className="h-11 w-full bg-blue-600 text-white hover:bg-blue-700"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save docket"
          )}
        </Button>
      </div>
    </div>
  );
}