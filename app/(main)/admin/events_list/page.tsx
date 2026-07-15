//app/(main)/admin/events_list/page.tsx
"use client";

/**
 * ── EVENT COVER PHOTOS: SETUP ───────────────────────────────────────
 * This page adds a "Media" tab to the event editor for uploading a
 * cover photo per event. It's a brand-new module — do this once:
 *
 * 1) DB column (Supabase SQL editor):
 *      alter table events add column if not exists image_url text;
 *
 * 2) Storage bucket (Supabase SQL editor or Dashboard → Storage):
 *      insert into storage.buckets (id, name, public)
 *      values ('event-photos', 'event-photos', true)
 *      on conflict (id) do nothing;
 *
 * 3) Storage policies (SQL editor) — public read, authenticated write.
 *    Adjust the write policy to match your auth model (e.g. restrict
 *    to admins) before shipping to production:
 *      create policy "Public read event photos"
 *        on storage.objects for select
 *        using (bucket_id = 'event-photos');
 *      create policy "Authenticated upload event photos"
 *        on storage.objects for insert
 *        with check (bucket_id = 'event-photos' and auth.role() = 'authenticated');
 *      create policy "Authenticated update event photos"
 *        on storage.objects for update
 *        using (bucket_id = 'event-photos' and auth.role() = 'authenticated');
 *      create policy "Authenticated delete event photos"
 *        on storage.objects for delete
 *        using (bucket_id = 'event-photos' and auth.role() = 'authenticated');
 *
 * Once the bucket exists, the Media tab in the edit drawer below just
 * works — pick a file, it uploads, gets a public URL, and that URL is
 * saved to events.image_url. The public discovery page automatically
 * uses it for cards, the event modal, and the homepage hero carousel.
 *
 * ── "Upload succeeds but nothing shows up in the DB" ────────────────
 * If the file uploads fine (Media tab shows the preview, "Save
 * Changes" shows "✓ Saved!") but the row in `events` never actually
 * changes, the almost-certain cause is Row Level Security silently
 * blocking the UPDATE. Supabase does NOT return an error when RLS
 * blocks a write — it just updates 0 rows and reports success. Check:
 *
 *   select relrowsecurity from pg_class where relname = 'events';
 *   select * from pg_policies where tablename = 'events';
 *
 * If RLS is enabled and there's no UPDATE policy permitting the role
 * this page authenticates as (commonly `anon`, since this page uses
 * the public anon key with no Supabase Auth session), add one. Only
 * do the permissive anon version below if `/admin` is already gated
 * some other way — otherwise anyone with your anon key can edit events:
 *
 *   create policy "Allow event updates"
 *     on events for update
 *     using (true) with check (true);
 *
 * (swap `using (true)` for a real auth check once you have one, e.g.
 * `using (auth.role() = 'authenticated')`.) The same applies to INSERT
 * if creating new events ever silently "succeeds" without appearing.
 * ─────────────────────────────────────────────────────────────────────
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EVENT_PHOTOS_BUCKET = "event-photos";

async function uploadEventImage(file: File, eventId: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${eventId}/cover-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(EVENT_PHOTOS_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(EVENT_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

type CategoryId = "all" | "education" | "concerts" | "business" | "medical" | "sports" | "cultural" | "workshops" | "exhibitions";
type EventStatus = "draft" | "upcoming" | "open" | "ongoing" | "past" | "postponed" | "cancelled";

interface DBEvent {
  id: string; title: string; subtitle?: string; category: CategoryId; status: EventStatus;
  tags: string[]; featured: boolean; accent_color: string; description: string;
  organizer_name: string; date_start: string; date_end?: string; time_start?: string;
  venue: string; city: string; fee_label: string; capacity?: number; attendees_count?: number;
  sponsors: string[]; register_href?: string;
  // ── public event page path ──
  page_href?: string;
  // ── cover photo (Supabase Storage public URL) ──
  image_url?: string;
  // ── Contact fields ──
  contact_phone?: string; contact_email?: string; contact_name?: string;
  website_url?: string; maps_url?: string; social_instagram?: string; social_facebook?: string;
  lineup: any[]; schedule: any[]; prizes: any[];
}

const CATEGORIES = [
  { id: "all",         label: "All",         icon: "◈", accent: "#374151" },
  { id: "education",   label: "Education",   icon: "🎓", accent: "#14710f" },
  { id: "concerts",    label: "Concerts",    icon: "🎵", accent: "#7c3d94" },
  { id: "business",    label: "Business",    icon: "💼", accent: "#1a56a8" },
  { id: "medical",     label: "Medical",     icon: "🏥", accent: "#b91c1c" },
  { id: "sports",      label: "Sports",      icon: "🏆", accent: "#b45309" },
  { id: "cultural",    label: "Cultural",    icon: "🎭", accent: "#0e7490" },
  { id: "workshops",   label: "Workshops",   icon: "🔧", accent: "#c2410c" },
  { id: "exhibitions", label: "Exhibitions", icon: "🖼️", accent: "#4338ca" },
] as const;

const STATUS_OPTIONS = [
  { id: "draft", label: "Draft" }, { id: "upcoming", label: "Upcoming" },
  { id: "open", label: "Open" }, { id: "ongoing", label: "Ongoing" },
  { id: "past", label: "Past" }, { id: "postponed", label: "Postponed" },
  { id: "cancelled", label: "Cancelled" },
];

const CATEGORY_OPTIONS = CATEGORIES.filter(c => c.id !== "all");

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot?: boolean }> = {
  draft:     { label: "Draft",     color: "#9ca3af", bg: "#f3f4f6" },
  upcoming:  { label: "Upcoming",  color: "#1a56a8", bg: "#eff6ff" },
  open:      { label: "Open Now",  color: "#14710f", bg: "#f0fdf4", dot: true },
  ongoing:   { label: "Live Now",  color: "#b91c1c", bg: "#fef2f2", dot: true },
  past:      { label: "Past",      color: "#6b7280", bg: "#f9fafb" },
  postponed: { label: "Postponed", color: "#92400e", bg: "#fffbeb" },
  cancelled: { label: "Cancelled", color: "#6b7280", bg: "#f3f4f6" },
};

// ── SHARED UI PRIMITIVES ──────────────────────────────────────────
function EInput({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#111827", background: "#fff", fontFamily: "inherit" }} />
    </div>
  );
}

function ETextarea({ label, value, onChange, rows = 3, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        style={{ width: "100%", padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#111827", background: "#fff", fontFamily: "inherit", resize: "vertical" }} />
    </div>
  );
}

function ESelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[];
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#111827", background: "#fff", fontFamily: "inherit" }}>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

function timeAgo(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.round(Math.abs(diff) / 86400000);
  if (diff > 0) return days === 0 ? "Today" : `in ${days}d`;
  if (days === 0) return "Today";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function StatusBadge({ status }: { status: EventStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, border: `1px solid ${m.color}25` }}>
      {m.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, animation: "livepulse 1.8s ease-in-out infinite", flexShrink: 0 }} />}
      {m.label}
    </span>
  );
}

// ── EVENT THUMBNAIL (photo if present, category glyph fallback) ──
function EventThumb({ event, size = 44, radius = 11 }: { event: DBEvent; size?: number; radius?: number }) {
  const cat = CATEGORIES.find(c => c.id === event.category);
  if (event.image_url) {
    return (
      <img src={event.image_url} alt={event.title}
        style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: event.accent_color + "14", border: `1.5px solid ${event.accent_color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.45), flexShrink: 0 }}>
      {cat?.icon}
    </div>
  );
}

// ── EDIT DRAWER ───────────────────────────────────────────────────
function EditDrawer({ event, onClose, onSaved }: { event: DBEvent; onClose: () => void; onSaved: (updated: DBEvent) => void }) {
  const [tab, setTab] = useState<"basic" | "media" | "details" | "meta" | "contact">("basic");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Media / cover photo
  const [imageUrl, setImageUrl] = useState(event.image_url || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Contact fields
  const [contactPhone, setContactPhone] = useState(event.contact_phone || "");
  const [contactEmail, setContactEmail] = useState(event.contact_email || "");
  const [contactName, setContactName] = useState(event.contact_name || "");
  const [websiteUrl, setWebsiteUrl] = useState(event.website_url || "");
  const [mapsUrl, setMapsUrl] = useState(event.maps_url || "");
  const [socialInstagram, setSocialInstagram] = useState(event.social_instagram || "");
  const [socialFacebook, setSocialFacebook] = useState(event.social_facebook || "");

  // Basic fields
  const [title, setTitle] = useState(event.title);
  const [subtitle, setSubtitle] = useState(event.subtitle || "");
  const [status, setStatus] = useState<EventStatus>(event.status);
  const [category, setCategory] = useState(event.category === "all" ? "education" : event.category);
  const [accentColor, setAccentColor] = useState(event.accent_color);
  const [description, setDescription] = useState(event.description);
  const [organizerName, setOrganizerName] = useState(event.organizer_name);
  const [tagsInput, setTagsInput] = useState((event.tags || []).join(", "));
  const [sponsorsInput, setSponsorsInput] = useState((event.sponsors || []).join(", "));
  const [registerHref, setRegisterHref] = useState(event.register_href || "");
  const [pageHref, setPageHref] = useState(event.page_href || "");
  const [featured, setFeatured] = useState(event.featured);
  const [dateStart, setDateStart] = useState(event.date_start);
  const [dateEnd, setDateEnd] = useState(event.date_end || "");
  const [timeStart, setTimeStart] = useState(event.time_start || "");
  const [venue, setVenue] = useState(event.venue);
  const [city, setCity] = useState(event.city);
  const [feeLabel, setFeeLabel] = useState(event.fee_label);
  const [capacity, setCapacity] = useState(event.capacity ? String(event.capacity) : "");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleFileChosen = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setUploadError("Please choose an image file."); return; }
    if (file.size > 8 * 1024 * 1024) { setUploadError("Image must be under 8MB."); return; }
    setUploading(true); setUploadError(null);
    try {
      const url = await uploadEventImage(file, event.id);
      setImageUrl(url);
    } catch (e: any) {
      setUploadError(e.message || "Upload failed. Has the 'event-photos' storage bucket been created?");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { setSaveError("Title is required."); return; }
    setSaving(true); setSaveError(null);
    try {
      const updates = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        status,
        category,
        accent_color: accentColor,
        description: description.trim(),
        organizer_name: organizerName.trim(),
        tags: tagsInput.split(",").map(t => t.trim()).filter(Boolean),
        sponsors: sponsorsInput.split(",").map(s => s.trim()).filter(Boolean),
        register_href: registerHref.trim() || null,
        page_href: pageHref.trim() || null,
        image_url: imageUrl.trim() || null,
        featured,
        date_start: dateStart,
        date_end: dateEnd || null,
        time_start: timeStart || null,
        venue: venue.trim(),
        city: city.trim(),
        fee_label: feeLabel.trim(),
        capacity: capacity ? parseInt(capacity) : null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_name: contactName.trim() || null,
        website_url: websiteUrl.trim() || null,
        maps_url: mapsUrl.trim() || null,
        social_instagram: socialInstagram.trim() || null,
        social_facebook: socialFacebook.trim() || null,
        updated_at: new Date().toISOString(),
      };
      // .select() forces Supabase to return the row(s) actually changed. This
      // matters because a blocked Row Level Security policy does NOT surface
      // as an error on .update() — it silently updates 0 rows and returns
      // success. Checking data.length is the only way to catch that here.
      const { data, error } = await supabase.from("events").update(updates).eq("id", event.id).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "The update didn't change any rows. This almost always means Row Level Security is blocking the write for the current key/role — see the RLS setup notes at the top of this file."
        );
      }
      setSaved(true);
      onSaved({ ...event, ...updates, tags: updates.tags, sponsors: updates.sponsors } as DBEvent);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const ACCENT_COLORS = ["#14710f", "#7c3d94", "#1a56a8", "#b91c1c", "#b45309", "#0e7490", "#c2410c", "#4338ca", "#0f766e", "#a21caf"];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", justifyContent: "flex-end", backdropFilter: "blur(4px)" }}
    >
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}
        style={{ width: "min(560px, 100vw)", height: "100%", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.18)" }}
      >
        {/* Header */}
        <div style={{ padding: "18px 22px 0", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <EventThumb event={{ ...event, image_url: imageUrl }} size={38} radius={9} />
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>Edit Event</h2>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>{event.title}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {saved && <span style={{ fontSize: 12, color: "#14710f", fontWeight: 700 }}>✓ Saved!</span>}
              <button onClick={handleSave} disabled={saving || saved}
                style={{ padding: "8px 18px", background: saved ? "#14710f" : saving ? "#6b7280" : "#111827", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, marginBottom: -1, overflowX: "auto" }}>
            {([
              { id: "basic", label: "Basic Info" },
              { id: "media", label: `Media${imageUrl ? " ✓" : ""}` },
              { id: "details", label: "Date & Venue" },
              { id: "meta", label: "Settings" },
              { id: "contact", label: "Contact" },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: tab === t.id ? "2px solid #6366f1" : "2px solid transparent", color: tab === t.id ? "#4338ca" : "#6b7280", fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
          {saveError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#991b1b", fontSize: 12 }}>{saveError}</div>
          )}

          <AnimatePresence mode="wait">

            {/* ── BASIC INFO ── */}
            {tab === "basic" && (
              <motion.div key="basic" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <EInput label="Event Title *" value={title} onChange={setTitle} placeholder="Event title" />
                <EInput label="Subtitle / Tagline" value={subtitle} onChange={setSubtitle} placeholder="Short description" />
                <ETextarea label="Description" value={description} onChange={setDescription} rows={5} placeholder="Full event description…" />
                <EInput label="Organiser Name *" value={organizerName} onChange={setOrganizerName} placeholder="Organisation name" />

                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "14px 14px 4px", marginBottom: 14 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#14710f" }}>
                    🔗 Event Page Links
                  </p>
                  <EInput
                    label="Public Event Page Path"
                    value={pageHref}
                    onChange={setPageHref}
                    placeholder="/events/matengfest or https://mateng.in/events/edufest"
                  />
                  <EInput
                    label="Registration Link"
                    value={registerHref}
                    onChange={setRegisterHref}
                    placeholder="/register or https://…"
                  />
                  {(pageHref || registerHref) && (
                    <div style={{ marginBottom: 10, padding: "8px 10px", background: "#fff", borderRadius: 7, border: "1px solid #d1fae5", fontSize: 11, color: "#065f46" }}>
                      <span style={{ fontWeight: 700 }}>Preview → </span>
                      Learn More button will go to:{" "}
                      <span style={{ fontFamily: "monospace", color: "#14710f" }}>
                        {pageHref || registerHref}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <EInput label="Tags (comma-separated)" value={tagsInput} onChange={setTagsInput} placeholder="NEET, Quiz, Outdoor" />
                  <EInput label="Sponsors (comma-separated)" value={sponsorsInput} onChange={setSponsorsInput} placeholder="Sponsor A, Sponsor B" />
                </div>
              </motion.div>
            )}

            {/* ── MEDIA (cover photo) ── */}
            {tab === "media" && (
              <motion.div key="media" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
                  This photo is used on the event card, the event detail view, and — for upcoming or open events —
                  it can appear automatically in the homepage hero carousel.
                </p>

                {/* Preview */}
                <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 8", borderRadius: 12, overflow: "hidden", background: "#f3f4f6", border: "1px solid #e5e7eb", marginBottom: 14 }}>
                  {imageUrl ? (
                    <img src={imageUrl} alt="Cover preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "#9ca3af" }}>
                      <span style={{ fontSize: 28 }}>🖼️</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>No cover photo yet</span>
                    </div>
                  )}
                  {uploading && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ width: 16, height: 16, border: "2px solid #d1d5db", borderTopColor: "#111827", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Uploading…</span>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => handleFileChosen(e.target.files?.[0])}
                  style={{ display: "none" }}
                />

                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ flex: 1, padding: "10px", background: "#111827", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}
                  >
                    {imageUrl ? "Replace Photo" : "Upload Photo"}
                  </button>
                  {imageUrl && (
                    <button
                      onClick={() => { setImageUrl(""); setUploadError(null); }}
                      disabled={uploading}
                      style={{ padding: "10px 16px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {uploadError && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#991b1b", fontSize: 12 }}>
                    {uploadError}
                  </div>
                )}

                <div style={{ height: 1, background: "#f3f4f6", margin: "18px 0" }} />

                <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Or paste an image URL</p>
                <EInput label="Image URL" value={imageUrl} onChange={setImageUrl} placeholder="https://…" />
                <p style={{ margin: "-6px 0 0", fontSize: 11, color: "#9ca3af" }}>Uploads go to the <code>event-photos</code> storage bucket — see the setup notes at the top of this file if uploads fail.</p>
              </motion.div>
            )}

            {/* ── DATE & VENUE ── */}
            {tab === "details" && (
              <motion.div key="details" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <EInput label="Start Date *" value={dateStart} onChange={setDateStart} type="date" />
                  <EInput label="End Date" value={dateEnd} onChange={setDateEnd} type="date" />
                  <EInput label="Start Time" value={timeStart} onChange={setTimeStart} type="time" />
                  <EInput label="Capacity" value={capacity} onChange={setCapacity} type="number" placeholder="2000" />
                </div>
                <EInput label="Venue *" value={venue} onChange={setVenue} placeholder="Manipur University, Imphal" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <EInput label="City" value={city} onChange={setCity} placeholder="Imphal" />
                  <EInput label="Fee Label" value={feeLabel} onChange={setFeeLabel} placeholder="Free or ₹200" />
                </div>
              </motion.div>
            )}

            {/* ── SETTINGS / META ── */}
            {tab === "meta" && (
              <motion.div key="meta" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <ESelect label="Status" value={status} onChange={v => setStatus(v as EventStatus)} options={STATUS_OPTIONS} />
                <ESelect label="Category" value={category} onChange={v => setCategory(v as any)} options={CATEGORY_OPTIONS.map(c => ({ id: c.id, label: `${c.icon} ${c.label}` }))} />

                {/* Accent Color */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Accent Color</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                      style={{ width: 40, height: 36, border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                    <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                      style={{ flex: 1, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#111827", fontFamily: "inherit" }} />
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ACCENT_COLORS.map(c => (
                      <button key={c} onClick={() => setAccentColor(c)}
                        style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: accentColor === c ? "3px solid #111827" : "2px solid transparent", cursor: "pointer", padding: 0 }} />
                    ))}
                  </div>
                </div>

                {/* Featured toggle */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Featured Event</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => setFeatured(!featured)}
                      style={{ width: 44, height: 24, borderRadius: 12, background: featured ? "#14710f" : "#d1d5db", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: featured ? 22 : 4, transition: "left 0.2s" }} />
                    </button>
                    <span style={{ fontSize: 13, color: "#374151" }}>{featured ? "Yes — shown in featured strip" : "No"}</span>
                  </div>
                </div>

                {/* Live preview chip */}
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px 16px", border: "1px solid #e5e7eb" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Preview</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <EventThumb event={{ ...event, image_url: imageUrl, accent_color: accentColor, category: category as CategoryId }} size={36} radius={9} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: accentColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          {CATEGORY_OPTIONS.find(c => c.id === category)?.label}
                        </span>
                        {featured && <span style={{ fontSize: 9, fontWeight: 700, color: "#d97706" }}>★ Featured</span>}
                      </div>
                      <StatusBadge status={status} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── CONTACT ── */}
            {tab === "contact" && (
              <motion.div key="contact" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ marginBottom: 20, padding: "12px 14px", background: "#f0f9ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#1a56a8", fontWeight: 600 }}>
                    ℹ️ Contact details are shown to attendees in the event detail view.
                  </p>
                </div>

                <EInput label="Contact Person Name" value={contactName} onChange={setContactName} placeholder="e.g. Ananya Sharma" />
                <EInput label="Phone Number" value={contactPhone} onChange={setContactPhone} placeholder="+91 70855 71865" />
                <EInput label="Email Address" value={contactEmail} onChange={setContactEmail} placeholder="events@mateng.in" type="email" />

                <div style={{ height: 1, background: "#f3f4f6", margin: "20px 0" }} />

                <EInput label="Website / Event Page URL" value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://mateng.in/events/edufest" />
                <EInput label="Google Maps URL" value={mapsUrl} onChange={setMapsUrl} placeholder="https://maps.google.com/…" />

                <div style={{ height: 1, background: "#f3f4f6", margin: "20px 0" }} />

                <EInput label="Instagram Handle or URL" value={socialInstagram} onChange={setSocialInstagram} placeholder="@mateng.in or https://instagram.com/…" />
                <EInput label="Facebook Page URL" value={socialFacebook} onChange={setSocialFacebook} placeholder="https://facebook.com/mateng" />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid #f3f4f6", background: "#fff", flexShrink: 0, display: "flex", gap: 10 }}>
          <button onClick={handleSave} disabled={saving || saved}
            style={{ flex: 1, padding: "11px", background: saved ? "#14710f" : saving ? "#6b7280" : "#111827", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} style={{ padding: "11px 18px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── DETAIL DRAWER ─────────────────────────────────────────────────
function EventDrawer({ event, onClose, onEdit }: { event: DBEvent; onClose: () => void; onEdit: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "lineup" | "schedule" | "prizes">("overview");
  const cat = CATEGORIES.find(c => c.id === event.category);
  const tabs = [
    { id: "overview", label: "Overview" },
    ...(event.lineup?.length > 0 ? [{ id: "lineup", label: "Lineup" }] : []),
    ...(event.schedule?.length > 0 ? [{ id: "schedule", label: "Schedule" }] : []),
    ...(event.prizes?.length > 0 ? [{ id: "prizes", label: "Prizes" }] : []),
  ] as const;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const hasContact = event.contact_name || event.contact_phone || event.contact_email ||
    event.website_url || event.maps_url || event.social_instagram || event.social_facebook;

  const learnMoreHref = event.page_href || event.register_href || null;
  const isExternal = learnMoreHref?.startsWith("http");

  const handleLearnMore = () => {
    if (!learnMoreHref) return;
    if (isExternal) window.open(learnMoreHref, "_blank", "noopener,noreferrer");
    else router.push(learnMoreHref);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, top: 80, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", justifyContent: "flex-end", backdropFilter: "blur(4px)" }}
    >
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}
        style={{ width: "min(520px, 100vw)", height: "100%", background: "#fff", overflowY: "auto", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.18)" }}
      >
        {/* Cover photo */}
        {event.image_url && (
          <div style={{ position: "relative", height: 170, flexShrink: 0, backgroundImage: `url(${event.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.5) 100%)" }} />
          </div>
        )}

        {/* Header */}
        <div style={{ padding: "20px 22px 0", borderBottom: "1px solid #f3f4f6", position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ flex: 1, marginRight: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18 }}>{cat?.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: event.accent_color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{cat?.label}</span>
                <StatusBadge status={event.status} />
                {event.featured && <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", padding: "2px 7px", borderRadius: 999 }}>★ Featured</span>}
              </div>
              <h2 style={{ margin: "0 0 3px", fontSize: 20, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>{event.title}</h2>
              {event.subtitle && <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{event.subtitle}</p>}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={onEdit}
                style={{ padding: "6px 14px", background: "#f0f9ff", color: "#1a56a8", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                ✏️ Edit
              </button>
              <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, marginBottom: -1 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                style={{ padding: "8px 14px", background: "none", border: "none", borderBottom: tab === t.id ? `2px solid ${event.accent_color}` : "2px solid transparent", color: tab === t.id ? event.accent_color : "#6b7280", fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "22px", flex: 1 }}>
          {tab === "overview" && <>
            <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.8, color: "#374151" }}>{event.description}</p>

            {/* Info grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {([
                ["📅 Date", event.date_start + (event.date_end ? ` – ${event.date_end}` : "")],
                ["⏰ Time", event.time_start || "All Day"],
                ["📍 Venue", event.venue],
                ["🏙 City", event.city],
                ["🎟 Fee", event.fee_label],
                ["🏢 Organiser", event.organizer_name],
                event.capacity ? ["👥 Capacity", event.capacity.toLocaleString()] : null,
              ].filter(Boolean) as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>{k}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 600, color: "#111827" }}>{v}</p>
                </div>
              ))}
            </div>

            {/* Tags */}
            {event.tags?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {event.tags.map(t => <span key={t} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: event.accent_color + "14", color: event.accent_color }}>{t}</span>)}
              </div>
            )}

            {/* Sponsors */}
            {event.sponsors?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Sponsors</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {event.sponsors.map(s => <span key={s} style={{ padding: "4px 12px", background: "#f3f4f6", borderRadius: 6, fontSize: 12, color: "#374151", fontWeight: 500 }}>{s}</span>)}
                </div>
              </div>
            )}

            {/* Event Page Link indicator */}
            {learnMoreHref && (
              <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
                <span style={{ fontSize: 14 }}>🔗</span>
                <span style={{ fontSize: 12, color: "#14710f", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {learnMoreHref}
                </span>
                <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, flexShrink: 0, background: "#fff", border: "1px solid #d1fae5", borderRadius: 6, padding: "2px 7px" }}>
                  {event.page_href ? "page" : "register"}
                </span>
              </div>
            )}

            {/* No photo yet — nudge to Media tab */}
            {!event.image_url && (
              <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#fffbeb", border: "1px dashed #fde68a", borderRadius: 10 }}>
                <span style={{ fontSize: 14 }}>🖼️</span>
                <span style={{ fontSize: 12, color: "#92400e", fontWeight: 600, flex: 1 }}>No cover photo yet — add one so this event can appear in the homepage hero.</span>
                <button onClick={onEdit} style={{ fontSize: 11, fontWeight: 700, color: "#92400e", background: "#fff", border: "1px solid #fde68a", borderRadius: 6, padding: "3px 9px", cursor: "pointer", flexShrink: 0 }}>Add photo</button>
              </div>
            )}

            {/* Contact & Links */}
            {hasContact && (
              <div style={{ background: "#f9fafb", borderRadius: 12, padding: "14px 16px", border: "1px solid #f3f4f6" }}>
                <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Contact & Links</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                  {event.contact_name && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>👤</span>
                      <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{event.contact_name}</span>
                    </div>
                  )}

                  {event.contact_phone && (
                    <a href={`tel:${event.contact_phone}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>📞</span>
                      <span style={{ fontSize: 13, color: "#1a56a8", fontWeight: 600 }}>{event.contact_phone}</span>
                    </a>
                  )}

                  {event.contact_email && (
                    <a href={`mailto:${event.contact_email}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>✉️</span>
                      <span style={{ fontSize: 13, color: "#1a56a8", fontWeight: 600 }}>{event.contact_email}</span>
                    </a>
                  )}

                  {event.website_url && (
                    <a href={event.website_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>🌐</span>
                      <span style={{ fontSize: 13, color: "#1a56a8", fontWeight: 600 }}>{event.website_url.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}

                  {event.maps_url && (
                    <a href={event.maps_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>📍</span>
                      <span style={{ fontSize: 13, color: "#1a56a8", fontWeight: 600 }}>View on Google Maps</span>
                    </a>
                  )}

                  {(event.social_instagram || event.social_facebook) && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                      {event.social_instagram && (
                        <a
                          href={event.social_instagram.startsWith("http") ? event.social_instagram : `https://instagram.com/${event.social_instagram.replace("@", "")}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, color: "#374151", fontWeight: 600, textDecoration: "none" }}>
                          <span style={{ fontSize: 14 }}>📷</span> Instagram
                        </a>
                      )}
                      {event.social_facebook && (
                        <a href={event.social_facebook} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, color: "#374151", fontWeight: 600, textDecoration: "none" }}>
                          <span style={{ fontSize: 14 }}>👥</span> Facebook
                        </a>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}
          </>}

          {tab === "lineup" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {event.lineup.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#f9fafb", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: (item.avatar_color || "#374151") + "22", border: `1.5px solid ${item.avatar_color || "#374151"}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: item.avatar_color || "#374151", flexShrink: 0 }}>
                    {item.avatar_initials || item.name?.slice(0, 2).toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827" }}>{item.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>{[item.sub_role, item.genre, item.company, item.origin ? `From ${item.origin}` : null].filter(Boolean).join(" · ")}</p>
                    {item.topic && <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", background: event.accent_color + "14", color: event.accent_color, borderRadius: 999, fontSize: 11, fontWeight: 600 }}>"{item.topic}"</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "schedule" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {event.schedule.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 14, paddingBottom: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: event.accent_color, marginTop: 4, flexShrink: 0 }} />
                    {i < event.schedule.length - 1 && <div style={{ width: 1, flex: 1, background: "#e5e7eb", marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: event.accent_color, letterSpacing: "0.05em" }}>{item.slot_label}</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>{item.title}</p>
                    {item.speaker_name && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>by {item.speaker_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "prizes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {event.prizes.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: i === 0 ? "#fffbeb" : "#f9fafb", borderRadius: 10, padding: "12px 16px", border: `1px solid ${i === 0 ? "#fde68a" : "#f3f4f6"}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: i === 0 ? "#fbbf24" : i === 1 ? "#d1d5db" : i === 2 ? "#fb923c" : event.accent_color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: i === 0 ? "#92400e" : i === 1 ? "#374151" : "#9a3412", flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827" }}>{item.rank_label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>{item.reward}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: Learn More + Edit */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid #f3f4f6", background: "#fff", display: "flex", gap: 10 }}>
          {learnMoreHref ? (
            <button
              onClick={handleLearnMore}
              style={{ flex: 1, padding: "11px", background: event.accent_color, color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              {isExternal ? "🌐" : "→"} Learn More
            </button>
          ) : (
            <button
              onClick={onEdit}
              title="Set 'Public Event Page Path' in Basic Info to enable"
              style={{ flex: 1, padding: "11px", background: "#f3f4f6", color: "#9ca3af", borderRadius: 10, fontWeight: 600, fontSize: 13, border: "1px dashed #d1d5db", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              + Set Event Page Path
            </button>
          )}
          <button
            onClick={onEdit}
            style={{ padding: "11px 18px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0 }}
          >
            ✏️ Edit
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── EVENT ROW ─────────────────────────────────────────────────────
function EventRow({ event, onSelect, onEdit, onDelete }: { event: DBEvent; onSelect: () => void; onEdit: () => void; onDelete: (id: string) => void }) {
  const cat = CATEGORIES.find(c => c.id === event.category);
  return (
    <motion.div
      layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      onClick={onSelect}
      whileHover={{ backgroundColor: "#f8fafc" }}
      style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: "1px solid #f3f4f6", cursor: "pointer", transition: "background 0.12s" }}
    >
      <EventThumb event={event} size={44} radius={11} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>{event.title}</span>
          {event.featured && <span style={{ fontSize: 9, fontWeight: 700, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>★</span>}
          {event.image_url && (
            <span style={{ fontSize: 9, fontWeight: 600, color: "#4338ca", background: "#eef2ff", border: "1px solid #c7d2fe", padding: "1px 7px", borderRadius: 999, flexShrink: 0 }}>🖼️ Photo</span>
          )}
          {event.page_href && (
            <span style={{ fontSize: 9, fontWeight: 600, color: "#14710f", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "1px 7px", borderRadius: 999, flexShrink: 0, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              🔗 {event.page_href}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{cat?.label}</span>
          <span style={{ fontSize: 11, color: "#d1d5db" }}>·</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>📍 {event.venue}, {event.city}</span>
          <span style={{ fontSize: 11, color: "#d1d5db" }}>·</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>📅 {event.date_start}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
        {(event.tags || []).slice(0, 2).map(t => (
          <span key={t} style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600, background: event.accent_color + "12", color: event.accent_color }}>{t}</span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
        <StatusBadge status={event.status} />
        <span style={{ fontSize: 10, color: "#9ca3af" }}>{timeAgo(event.date_start)}</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <button onClick={onEdit}
          style={{ padding: "6px 11px", background: "#f0f9ff", color: "#1a56a8", border: "1px solid #bfdbfe", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          ✏️ Edit
        </button>
        <button onClick={() => onDelete(event.id)}
          style={{ padding: "6px 11px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
          onMouseLeave={e => (e.currentTarget.style.background = "#fef2f2")}
        >
          🗑 Delete
        </button>
      </div>
      <span style={{ fontSize: 16, color: "#d1d5db", flexShrink: 0 }}>›</span>
    </motion.div>
  );
}

// ── EVENT CARD ────────────────────────────────────────────────────
function EventCard({ event, onSelect, onEdit, onDelete }: { event: DBEvent; onSelect: () => void; onEdit: () => void; onDelete: (id: string) => void }) {
  const cat = CATEGORIES.find(c => c.id === event.category);
  return (
    <motion.div
      layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -3, boxShadow: "0 12px 36px rgba(0,0,0,0.11)" }}
      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", ...(event.image_url ? {} : { borderTop: `3px solid ${event.accent_color}` }) }}
    >
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 5, zIndex: 2 }}>
        <button onClick={e => { e.stopPropagation(); onEdit(); }}
          style={{ padding: "4px 9px", background: "rgba(255,255,255,0.95)", color: "#1a56a8", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          ✏️
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(event.id); }}
          style={{ padding: "4px 9px", background: "rgba(255,255,255,0.95)", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          🗑
        </button>
      </div>

      {event.image_url && (
        <div onClick={onSelect} style={{ cursor: "pointer", height: 118, backgroundImage: `url(${event.image_url})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 100%)" }} />
        </div>
      )}

      <div onClick={onSelect} style={{ cursor: "pointer", padding: "16px 18px 12px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingRight: event.image_url ? 0 : 72 }}>
          <span style={{ fontSize: 20 }}>{cat?.icon}</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: event.accent_color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{cat?.label}</span>
          {event.featured && <span style={{ fontSize: 9, fontWeight: 700, color: "#d97706" }}>★</span>}
        </div>
        <StatusBadge status={event.status} />
        <h3 style={{ margin: "8px 0 3px", fontSize: 15, fontWeight: 800, color: "#111827", lineHeight: 1.25 }}>{event.title}</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{event.subtitle}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[["📅", event.date_start + (event.date_end ? ` – ${event.date_end}` : "")], ["📍", event.venue], ["🎟", event.fee_label]].map(([icon, val]) => (
            <div key={String(icon)} style={{ display: "flex", gap: 6 }}>
              <span style={{ fontSize: 11, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: 11, color: "#374151" }}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {(event.tags || []).slice(0, 3).map(t => <span key={t} style={{ padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 600, background: event.accent_color + "12", color: event.accent_color }}>{t}</span>)}
        </div>
      </div>
      <div onClick={onSelect} style={{ cursor: "pointer", padding: "10px 18px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(event.date_start)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: event.accent_color }}>View details →</span>
      </div>
    </motion.div>
  );
}

// ── SKELETON ──────────────────────────────────────────────────────
function Skeleton({ view }: { view: "list" | "grid" }) {
  if (view === "list") return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 16, alignItems: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: 11, background: "#f3f4f6", flexShrink: 0, animation: "shimmer 1.4s infinite" }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, width: "45%", background: "#f3f4f6", borderRadius: 4, marginBottom: 8, animation: "shimmer 1.4s infinite" }} />
        <div style={{ height: 11, width: "65%", background: "#f3f4f6", borderRadius: 4, animation: "shimmer 1.4s infinite" }} />
      </div>
      <div style={{ width: 64, height: 22, background: "#f3f4f6", borderRadius: 999, animation: "shimmer 1.4s infinite" }} />
    </div>
  );
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ height: 118, background: "#f3f4f6", animation: "shimmer 1.4s infinite" }} />
      <div style={{ padding: "16px 18px" }}>
        {[70, 130, 40, 40, 40].map((w, i) => <div key={i} style={{ height: i === 0 ? 16 : 12, width: `${w}%`, background: "#f3f4f6", borderRadius: 4, marginBottom: 10, animation: "shimmer 1.4s infinite" }} />)}
      </div>
    </div>
  );
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────
function ConfirmDialog({ eventTitle, onConfirm, onCancel }: { eventTitle: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onCancel()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        style={{ background: "#fff", borderRadius: 16, padding: "28px 28px 24px", maxWidth: 400, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}
      >
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>🗑</div>
        <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 800, color: "#111827" }}>Delete Event?</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
          You're about to permanently delete <strong style={{ color: "#111827" }}>"{eventTitle}"</strong>. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Yes, Delete</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function EventsListPage() {
  const router = useRouter();
  const [events, setEvents] = useState<DBEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DBEvent | null>(null);
  const [editing, setEditing] = useState<DBEvent | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryId>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "status">("date");
  const [view, setView] = useState<"list" | "grid">("list");
  const [deleteTarget, setDeleteTarget] = useState<DBEvent | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase.from("events_full").select("*").then(({ data, error }) => {
      if (error) setError(error.message);
      else setEvents((data || []) as DBEvent[]);
      setLoading(false);
    });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("events").delete().eq("id", deleteTarget.id);
    if (error) { alert("Delete failed: " + error.message); return; }
    setEvents(prev => prev.filter(e => e.id !== deleteTarget.id));
    if (selected?.id === deleteTarget.id) setSelected(null);
    if (editing?.id === deleteTarget.id) setEditing(null);
    setDeleteTarget(null);
  }, [deleteTarget, selected, editing]);

  const handleSaved = useCallback((updated: DBEvent) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
    if (selected?.id === updated.id) setSelected(updated);
  }, [selected]);

  const openEdit = useCallback((ev: DBEvent) => {
    setSelected(null);
    setTimeout(() => setEditing(ev), 50);
  }, []);

  const filtered = useMemo(() => {
    let res = events.filter(ev => {
      const matchCat = categoryFilter === "all" || ev.category === categoryFilter;
      const matchStatus = statusFilter === "all" || ev.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || [ev.title, ev.subtitle || "", ev.organizer_name, ev.venue, ev.city, ...(ev.tags || [])].some(s => s.toLowerCase().includes(q));
      return matchCat && matchStatus && matchSearch;
    });
    if (sortBy === "date") res = res.sort((a, b) => a.date_start.localeCompare(b.date_start));
    if (sortBy === "name") res = res.sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "status") res = res.sort((a, b) => a.status.localeCompare(b.status));
    return res;
  }, [events, categoryFilter, statusFilter, search, sortBy]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: events.length };
    CATEGORIES.forEach(cat => { c[cat.id] = events.filter(e => e.category === cat.id).length; });
    return c;
  }, [events]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: events.length };
    Object.keys(STATUS_META).forEach(s => { c[s] = events.filter(e => e.status === s).length; });
    return c;
  }, [events]);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes livepulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus,textarea:focus,select:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px #eef2ff !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
        button { font-family: inherit; }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

        {/* Top bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => router.push("/events")} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 20, padding: 4 }}>←</button>
              <div>
                <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>Events</h1>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Admin · All Events · View, Edit & Delete</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, padding: 3, gap: 2 }}>
                {(["list", "grid"] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: view === v ? "#fff" : "transparent", color: view === v ? "#111827" : "#9ca3af", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
                    {v === "list" ? "≡ List" : "⊞ Grid"}
                  </button>
                ))}
              </div>
              <button onClick={() => router.push("/listing/events")}
                style={{ padding: "7px 18px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                + Add Event
              </button>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ background: "#fff", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px", display: "flex", gap: 28, flexWrap: "wrap" }}>
            {[
              { label: "Total Events", value: events.length, color: "#111827" },
              { label: "Active / Live", value: events.filter(e => e.status === "open" || e.status === "ongoing").length, color: "#14710f" },
              { label: "Upcoming", value: events.filter(e => e.status === "upcoming").length, color: "#1a56a8" },
              { label: "Draft", value: statusCounts.draft || 0, color: "#9ca3af" },
              { label: "With Photo", value: events.filter(e => !!e.image_url).length, color: "#4338ca" },
              { label: "With Page Path", value: events.filter(e => !!e.page_href).length, color: "#14710f" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color }}>{value}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 64px" }}>

          {/* Filters */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9ca3af" }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title, organiser, venue, tags…"
                style={{ width: "100%", padding: "10px 36px 10px 36px", border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 13, color: "#111827", background: "#f9fafb", fontFamily: "inherit" }} />
              {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}>✕</button>}
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {CATEGORIES.map(cat => {
                const active = categoryFilter === cat.id;
                return (
                  <button key={cat.id} onClick={() => setCategoryFilter(cat.id as CategoryId)}
                    style={{ padding: "5px 12px", borderRadius: 999, border: `1.5px solid ${active ? cat.accent : "#e5e7eb"}`, background: active ? cat.accent + "12" : "#fff", color: active ? cat.accent : "#6b7280", fontSize: 11, fontWeight: active ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.12s" }}>
                    <span>{cat.icon}</span>{cat.label}
                    <span style={{ fontSize: 10, fontWeight: 700, background: active ? cat.accent + "20" : "#f3f4f6", color: active ? cat.accent : "#9ca3af", padding: "0 5px", borderRadius: 999 }}>{counts[cat.id] || 0}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status:</span>
              {["all", "open", "upcoming", "ongoing", "past", "postponed", "draft", "cancelled"].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${statusFilter === s ? "#111827" : "#e5e7eb"}`, background: statusFilter === s ? "#111827" : "#fff", color: statusFilter === s ? "#fff" : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                  {s === "all" ? "All" : s}{statusCounts[s] ? ` (${statusCounts[s]})` : ""}
                </button>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Sort:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                  style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, color: "#374151", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  <option value="date">Date</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                </select>
                {(categoryFilter !== "all" || statusFilter !== "all" || search) && (
                  <button onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); setSearch(""); }}
                    style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Clear filters</button>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
              Showing <strong style={{ color: "#111827" }}>{filtered.length}</strong> of {events.length} events
            </p>
          </div>

          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#991b1b", fontSize: 13 }}>Failed to load: {error}</div>}

          {loading ? (
            view === "list"
              ? <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} view="list" />)}</div>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 16 }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} view="grid" />)}</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "72px 24px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <p style={{ fontSize: 40, margin: "0 0 12px" }}>🗓</p>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#111827" }}>No events found</h3>
              <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>Try adjusting your filters or search term.</p>
            </div>
          ) : view === "list" ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <AnimatePresence>
                {filtered.map(ev => (
                  <EventRow key={ev.id} event={ev}
                    onSelect={() => setSelected(ev)}
                    onEdit={() => openEdit(ev)}
                    onDelete={id => setDeleteTarget(events.find(e => e.id === id)!)}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div layout style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 16 }}>
                {filtered.map(ev => (
                  <EventCard key={ev.id} event={ev}
                    onSelect={() => setSelected(ev)}
                    onEdit={() => openEdit(ev)}
                    onDelete={id => setDeleteTarget(events.find(e => e.id === id)!)}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Detail drawer */}
        <AnimatePresence>
          {selected && <EventDrawer event={selected} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} />}
        </AnimatePresence>

        {/* Edit drawer */}
        <AnimatePresence>
          {editing && <EditDrawer event={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
        </AnimatePresence>

        {/* Confirm delete */}
        <AnimatePresence>
          {deleteTarget && <ConfirmDialog eventTitle={deleteTarget.title} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />}
        </AnimatePresence>
      </div>
    </>
  );
}