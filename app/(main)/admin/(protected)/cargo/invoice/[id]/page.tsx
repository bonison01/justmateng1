///Users/apple/Documents/justmateng1/app/(main)/admin/(protected)/cargo/invoice/[id]/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import InvoiceTemplate, { InvoiceBooking } from "../../InvoiceTemplate";

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [booking, setBooking] = useState<InvoiceBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBooking = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/cargo/bookings/${id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Could not load this booking");
        setBooking(json.data as InvoiceBooking);
      } catch (err: any) {
        setError(err.message || "Could not load this booking");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchBooking();
  }, [id]);

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={() => window.print()}
          disabled={!booking}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Download className="mr-1.5 h-4 w-4" />
          Download invoice
        </Button>
      </div>

      <div className="py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : error ? (
          <p className="text-center text-sm text-red-600">
            Could not load this booking: {error}
          </p>
        ) : booking ? (
          // ↓ this id is what the print CSS targets
          <div id="invoice-print-area">
            <InvoiceTemplate booking={booking} />
          </div>
        ) : (
          <p className="text-center text-sm text-neutral-500">Booking not found.</p>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5in;
          }

          /* Hide everything on the page */
          body * {
            visibility: hidden;
          }

          /* Then reveal only the invoice */
          #invoice-print-area,
          #invoice-print-area * {
            visibility: visible;
          }

          /* Pin it to the top-left so nothing else shifts it */
          #invoice-print-area {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}