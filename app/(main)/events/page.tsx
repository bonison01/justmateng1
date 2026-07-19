"use client";

/**
 * ── EVENT COVER PHOTOS ──────────────────────────────────────────────
 * Events carry an `image_url` column (cover photo). The hero carousel
 * is built primarily from *live data*: it pulls the soonest upcoming/
 * open/ongoing events that have a photo and turns them into "ticket
 * banner" slides automatically. Manually curated rows in
 * `active_banners` (promos, sponsor placements) are shown first, with
 * event-photo slides filling in after them.
 *
 * DB migration (if the column doesn't exist yet):
 *   alter table events add column if not exists image_url text;
 *
 * ── VISUAL LANGUAGE ──────────────────────────────────────────────────
 * Typography (Fraunces / Inter / JetBrains Mono) and the ticket-banner
 * carousel motif still match the Mateng homepage. The page canvas
 * itself is white/light rather than the homepage's dark theme — the
 * hero carousel intentionally stays a dark "poster" card, the same way
 * a photo card reads fine floating on either a light or dark page.
 * ─────────────────────────────────────────────────────────────────────
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Footer from "@/components/footer/Footer";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── PALETTE — light theme, same brand hues as the homepage ───────────
const BG = "#FFFFFF";
const TEXT = "#0B1410";
const MUTED = "#5B6B5D";
const MUTED2 = "#7C8C7E";
const GREEN = "#3FA637";
const GREEN_DARK = "#0F550C";
const GOLD = "#E8B84B";
const GOLD_TEXT = "#B8860B";
const GREEN2 = "#50C273";
const CARD_BG = "#F6F7F4";
const CARD_BORDER = "#E1E5DE";
const MODAL_BG = "#FFFFFF";

export type CategoryId =
  | "all" | "education" | "concerts" | "business"
  | "medical" | "sports" | "cultural" | "workshops" | "exhibitions";
export type EventStatus = "upcoming" | "ongoing" | "past" | "postponed" | "open" | "cancelled";

export interface Banner {
  id: string; title: string; subtitle?: string; image_url: string;
  link_href?: string; link_label?: string; bg_color?: string; display_order: number;
}
export interface LineupItem {
  id: string; role: string; name: string; sub_role?: string; genre?: string;
  origin?: string; company?: string; team?: string; avatar_initials?: string;
  avatar_color?: string; photo_url?: string; upcoming_shows?: number; topic?: string;
}
export interface ScheduleItem { id: string; slot_label: string; title: string; speaker_name?: string; display_order: number; }
export interface PrizeItem { id: string; rank_label: string; reward: string; display_order: number; }
export interface DBEvent {
  id: string; title: string; subtitle?: string; category: CategoryId; status: EventStatus;
  tags: string[]; featured: boolean; accent_color: string; description: string;
  organizer_name: string; date_start: string; date_end?: string; time_start?: string;
  venue: string; city: string; fee_label: string; capacity?: number; attendees_count?: number;
  sponsors: string[]; register_href?: string;
  page_href?: string;
  image_url?: string;
  contact_phone?: string; contact_email?: string; contact_name?: string;
  website_url?: string; maps_url?: string; social_instagram?: string; social_facebook?: string;
  lineup: LineupItem[]; schedule: ScheduleItem[]; prizes: PrizeItem[];
}

type HeroSlide = Banner & { event?: DBEvent };

// Deep, saturated accents — good contrast on a white page.
export const CATEGORIES: { id: CategoryId; label: string; icon: string; accent: string }[] = [
  { id: "all", label: "All Events", icon: "◈", accent: "#374151" },
  { id: "education", label: "Education", icon: "◎", accent: "#14710f" },
  { id: "concerts", label: "Concerts", icon: "♪", accent: "#7c3d94" },
  { id: "business", label: "Business", icon: "◇", accent: "#1a56a8" },
  { id: "medical", label: "Medical", icon: "✦", accent: "#b91c1c" },
  { id: "sports", label: "Sports", icon: "◉", accent: "#b45309" },
  { id: "cultural", label: "Cultural", icon: "❋", accent: "#0e7490" },
  { id: "workshops", label: "Workshops", icon: "⬡", accent: "#c2410c" },
  { id: "exhibitions", label: "Exhibitions", icon: "▣", accent: "#4338ca" },
];

function statusConfig(s: EventStatus) {
  return ({
    upcoming: { label: "Upcoming", color: "#1a56a8", bg: "#eff6ff" },
    open: { label: "Open Now", color: "#14710f", bg: "#f0fdf4" },
    ongoing: { label: "Live Now", color: "#b91c1c", bg: "#fef2f2" },
    past: { label: "Past", color: "#6b7280", bg: "#f9fafb" },
    postponed: { label: "Postponed", color: "#92400e", bg: "#fffbeb" },
    cancelled: { label: "Cancelled", color: "#6b7280", bg: "#f3f4f6" },
  } as any)[s] ?? { label: s, color: "#6b7280", bg: "#f9fafb" };
}
function timeAgo(d: string) { const diff = new Date(d).getTime() - Date.now(); const days = Math.round(Math.abs(diff) / 86400000); if (diff > 0) return `in ${days}d`; if (days === 0) return "today"; return `${days}d ago`; }
function lineupLabel(items: LineupItem[]) { if (!items?.length) return ""; const r = items.map(i => i.role); if (r.includes("artist") || r.includes("performer")) return "Artists"; if (r.includes("speaker")) return "Speakers"; if (r.includes("athlete")) return "Athletes"; if (r.includes("exhibitor")) return "Exhibitors"; return "Participants"; }

function AvatarCircle({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color + "18", border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.33), fontWeight: 700, color, flexShrink: 0 }}>{initials || "?"}</div>;
}
function StatusPill({ status }: { status: EventStatus }) {
  const cfg = statusConfig(status);
  return (
    <span className="eyebrow" style={{ padding: "3px 10px", borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, border: `1px solid ${cfg.color}22`, display: "inline-flex", alignItems: "center", gap: 5, letterSpacing: "0.07em" }}>
      {status === "open" && <span className="live-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, display: "inline-block" }} />}
      {cfg.label}
    </span>
  );
}
function CategoryChip({ cat }: { cat: { label: string; icon: string; accent: string } }) {
  return (
    <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.94)", border: `1px solid ${cat.accent}40`, color: cat.accent, fontSize: 10, letterSpacing: "0.07em" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cat.accent, flexShrink: 0 }} />
      {cat.icon} {cat.label}
    </span>
  );
}

// ── HERO CAROUSEL — a dark "ticket banner" poster, same motif as the homepage's EduFest/G15 cards ──
function HeroCarousel({ slides, onEventOpen }: { slides: HeroSlide[]; onEventOpen: (e: DBEvent) => void }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimer = useCallback(() => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = setInterval(() => { if (!paused) setIdx(p => (p + 1) % slides.length); }, 5500); }, [slides.length, paused]);
  useEffect(() => { setIdx(0); }, [slides.length]);
  useEffect(() => { if (slides.length > 1) startTimer(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [slides.length, startTimer]);
  if (!slides.length) return null;
  const cur = slides[Math.min(idx, slides.length - 1)];
  const isExternal = cur.link_href?.startsWith("http");
  const cat = cur.event ? CATEGORIES.find(c => c.id === cur.event!.category) : null;
  const glowClass = idx % 2 === 0 ? "event-card-green" : "event-card-purple";

  const go = () => {
    if (cur.event) { onEventOpen(cur.event); return; }
    if (cur.link_href) {
      if (isExternal) window.open(cur.link_href, "_blank", "noopener,noreferrer");
      else window.location.href = cur.link_href;
    }
  };

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} style={{ position: "relative" }}>
      <AnimatePresence mode="wait">
        <motion.div key={cur.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
          className={`event-card ${glowClass}`}
          style={{ position: "relative", borderRadius: 24, overflow: "hidden", background: cur.image_url ? "#150C33" : (cur.bg_color || "linear-gradient(120deg, #17240F 0%, #0F550C 60%, #0B1410 100%)"), display: "flex", flexDirection: "column" }}
        >
          {/* photo strip */}
          <div style={{ position: "relative", width: "100%", height: "clamp(200px, 34vw, 340px)", flexShrink: 0 }}>
            {cur.image_url && <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${cur.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,20,16,0.1) 0%, rgba(11,20,16,0.55) 65%, #0B1410 100%)" }} />
            {cur.event?.featured && (
              <div className={`featured-badge${idx % 2 === 0 ? "-green" : ""}`} style={{ position: "absolute", top: 18, right: 18, zIndex: 2 }}>
                <span className="eyebrow" style={{ background: idx % 2 === 0 ? GREEN : GREEN2, color: "#0B1410", fontWeight: 700, fontSize: 10, padding: "6px 12px", borderRadius: 999, display: "inline-block" }}>★ Featured</span>
              </div>
            )}
            <div style={{ position: "absolute", bottom: 16, left: 24, display: "flex", alignItems: "center", gap: 8 }}>
              {cur.event ? (
                <>
                  {cur.event.status === "open" && <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN2, display: "inline-block" }} />}
                  <span className="eyebrow" style={{ fontSize: 11, color: "#F3F1EA", padding: "6px 12px", borderRadius: 999, background: "rgba(0,0,0,0.4)" }}>
                    {statusConfig(cur.event.status).label} · {cat?.icon} {cat?.label}
                  </span>
                </>
              ) : (
                <span className="eyebrow" style={{ fontSize: 11, color: GOLD, padding: "6px 12px", borderRadius: 999, background: "rgba(0,0,0,0.4)" }}>Featured</span>
              )}
            </div>
          </div>

          {/* content + ticket stub */}
          <div style={{ display: "flex", flexDirection: "row" }}>
            <div style={{ flex: 1, padding: "clamp(22px,3vw,40px)", textAlign: "left" }}>
              <h2 style={{ margin: "0 0 10px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(22px,3.2vw,36px)", lineHeight: 1.15, color: "#F3F1EA" }}>{cur.title}</h2>
              {cur.subtitle && <p style={{ margin: "0 0 22px", fontSize: 14, color: "#D7E4D8", maxWidth: 560, lineHeight: 1.6 }}>{cur.subtitle}</p>}
              <button onClick={go} style={{ padding: "12px 26px", borderRadius: 999, background: "#fff", color: idx % 2 === 0 ? "#0F550C" : "#2D1B69", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
                {cur.link_label || (cur.event ? "View Event" : "Learn More")} →
              </button>
            </div>
            <div className="hero-stub" style={{ width: 96, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, borderLeft: "1px dashed rgba(243,241,234,0.2)" }}>
              <span className="eyebrow" style={{ fontSize: 10, color: GOLD, writingMode: "vertical-rl" }}>Admit One</span>
              <span className="tabular" style={{ fontSize: 11, color: "#D7E4D8" }}>{cur.event ? cur.event.date_start.slice(5).replace("-", "·") : "★"}</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 16 }}>
          {slides.map((_, i) => <button key={i} onClick={() => { setIdx(i); startTimer(); }} style={{ width: i === idx ? 24 : 7, height: 7, borderRadius: 999, background: i === idx ? GREEN_DARK : "#D1D5CD", border: "none", cursor: "pointer", padding: 0, transition: "all 0.3s" }} />)}
        </div>
      )}
      {slides.length > 1 && (
        <>
          <button onClick={() => { setIdx((idx - 1 + slides.length) % slides.length); startTimer(); }} style={{ position: "absolute", left: 12, top: "38%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(243,241,234,0.2)", color: "#fff", width: 38, height: 38, borderRadius: "50%", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5, backdropFilter: "blur(4px)" }}>‹</button>
          <button onClick={() => { setIdx((idx + 1) % slides.length); startTimer(); }} style={{ position: "absolute", right: 12, top: "38%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(243,241,234,0.2)", color: "#fff", width: 38, height: 38, borderRadius: "50%", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5, backdropFilter: "blur(4px)" }}>›</button>
        </>
      )}
    </div>
  );
}

// ── EVENT CARD ─────────────────────────────────────────────────────
function EventCard({ event, onSelect, delay = 0 }: { event: DBEvent; onSelect: (e: DBEvent) => void; delay?: number }) {
  const cat = CATEGORIES.find(c => c.id === event.category) || CATEGORIES[0];
  const lineup = event.lineup || [];
  const lLabel = lineupLabel(lineup);
  return (
    <motion.button layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3, delay: Math.min(delay, 0.4) }}
      whileHover={{ y: -6 }} onClick={() => onSelect(event)}
      style={{
        all: "unset", cursor: "pointer", display: "flex", flexDirection: "column",
        background: "#fff", border: `1px solid ${CARD_BORDER}`, borderRadius: 18, overflow: "hidden", textAlign: "left",
        transition: "box-shadow 0.3s ease",
        boxShadow: event.featured ? `0 0 0 1px ${cat.accent}30, 0 20px 44px -26px ${cat.accent}44` : "0 1px 3px rgba(11,20,16,0.06)",
      }}>
      {event.image_url ? (
        <div style={{ position: "relative", height: 140, flexShrink: 0, backgroundImage: `url(${event.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,20,16,0) 55%, rgba(11,20,16,0.45) 100%)" }} />
          <div style={{ position: "absolute", top: 10, left: 10 }}><CategoryChip cat={cat} /></div>
          <div style={{ position: "absolute", top: 10, right: 10 }}><StatusPill status={event.status} /></div>
          {event.featured && <span className="eyebrow" style={{ position: "absolute", bottom: 10, left: 10, fontSize: 9, color: GOLD }}>★ Featured</span>}
        </div>
      ) : (
        <div style={{ padding: "16px 18px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <CategoryChip cat={cat} />
          <StatusPill status={event.status} />
        </div>
      )}
      <div style={{ padding: "16px 18px 12px", flex: 1 }}>
        <h3 style={{ margin: "6px 0 4px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: TEXT, lineHeight: 1.25 }}>{event.title}</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: MUTED, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{event.subtitle}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[["📅", event.date_start + (event.date_end ? ` – ${event.date_end}` : "")], ["📍", event.venue], ["🎟", event.fee_label]].map(([icon, val]) => (
            <div key={icon} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 12, flexShrink: 0, opacity: 0.7 }}>{icon}</span>
              <span className="tabular" style={{ fontSize: 12, color: "#33402F", lineHeight: 1.5 }}>{val}</span>
            </div>
          ))}
        </div>
        {lineup.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex" }}>{lineup.slice(0, 5).map((item, i) => <div key={i} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: "50%", border: "2px solid #fff" }}><AvatarCircle initials={item.avatar_initials || item.name.slice(0, 2).toUpperCase()} color={item.avatar_color || cat.accent} size={26} /></div>)}</div>
            <span style={{ fontSize: 11, color: MUTED }}>{lineup.length} {lLabel}</span>
          </div>
        )}
        {(event.tags || []).length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5 }}>
            {(event.tags || []).slice(0, 3).map(t => (
              <span key={t} className="eyebrow" style={{ padding: "3px 9px", borderRadius: 999, fontSize: 9, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: MUTED2 }}>{t}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: "auto", padding: "10px 18px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="tabular" style={{ fontSize: 11, color: MUTED }}>{timeAgo(event.date_start)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: cat.accent }}>
          {event.page_href ? "Learn More →" : "Details →"}
        </span>
      </div>
    </motion.button>
  );
}

// ── DETAIL MODAL ───────────────────────────────────────────────────
function DetailModal({ event, onClose }: { event: DBEvent; onClose: () => void }) {
  const router = useRouter();
  type TabId = "overview" | "lineup" | "schedule" | "prizes";
  const [tab, setTab] = useState<TabId>("overview");
  const lineup = event.lineup || [];
  const lLabel = lineupLabel(lineup);
  const cat = CATEGORIES.find(c => c.id === event.category) || CATEGORIES[0];
  const tabs = [
    { id: "overview" as TabId, label: "Overview" },
    ...(lineup.length > 0 ? [{ id: "lineup" as TabId, label: lLabel }] : []),
    ...((event.schedule?.length || 0) > 0 ? [{ id: "schedule" as TabId, label: "Schedule" }] : []),
    ...((event.prizes?.length || 0) > 0 ? [{ id: "prizes" as TabId, label: "Prizes" }] : []),
  ];

  const learnMoreHref = event.page_href || null;
  const registerHref = event.register_href || null;
  const isLearnMoreExternal = learnMoreHref?.startsWith("http");
  const isRegisterExternal = registerHref?.startsWith("http");

  const handleLearnMore = () => {
    if (!learnMoreHref) return;
    onClose();
    if (isLearnMoreExternal) window.open(learnMoreHref, "_blank", "noopener,noreferrer");
    else router.push(learnMoreHref);
  };
  const handleRegister = () => {
    if (!registerHref) return;
    onClose();
    if (isRegisterExternal) window.open(registerHref, "_blank", "noopener,noreferrer");
    else router.push(registerHref);
  };

  const isPast = event.status === "past" || event.status === "cancelled";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, top: 80, background: "rgba(11,20,16,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(3px)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.22 }}
        style={{ background: MODAL_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 24, width: "100%", maxWidth: 640, maxHeight: "calc(100vh - 100px)", overflowY: "auto", boxShadow: "0 30px 80px rgba(11,20,16,0.25)", display: "flex", flexDirection: "column" }}
      >
        {event.image_url && (
          <div style={{ position: "relative", height: 200, flexShrink: 0, borderRadius: "24px 24px 0 0", backgroundImage: `url(${event.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "24px 24px 0 0", background: "linear-gradient(180deg, rgba(11,20,16,0.05) 40%, rgba(11,20,16,0.55) 100%)" }} />
            <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(243,241,234,0.25)", color: "#fff", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 15 }}>✕</button>
          </div>
        )}

        <div style={{ padding: "22px 26px 0", position: "sticky", top: 0, background: MODAL_BG, zIndex: 10, borderRadius: event.image_url ? 0 : "24px 24px 0 0", borderBottom: `1px solid ${CARD_BORDER}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ flex: 1, marginRight: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <CategoryChip cat={cat} />
                <StatusPill status={event.status} />
                {learnMoreHref && <span className="eyebrow" style={{ fontSize: 10, color: GREEN_DARK, background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 9px", borderRadius: 999 }}>🔗 Full page available</span>}
              </div>
              <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, color: TEXT, lineHeight: 1.2 }}>{event.title}</h2>
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{event.subtitle}</p>
            </div>
            {!event.image_url && <button onClick={onClose} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: TEXT, borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className="eyebrow"
                style={{ padding: "9px 14px", background: "none", border: "none", borderBottom: tab === t.id ? `2px solid ${cat.accent}` : "2px solid transparent", color: tab === t.id ? TEXT : MUTED, fontWeight: tab === t.id ? 700 : 500, fontSize: 10, cursor: "pointer", marginBottom: -1 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "22px 26px", flex: 1, overflowY: "auto" }}>
          {tab === "overview" && <>
            <p style={{ margin: "0 0 22px", fontSize: 14, lineHeight: 1.8, color: "#33402F" }}>{event.description}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
              {([
                ["Date", event.date_start + (event.date_end ? ` – ${event.date_end}` : "")],
                ["Time", event.time_start || "All Day"],
                ["Venue", event.venue],
                ["City", event.city],
                ["Fee", event.fee_label],
                ["Organiser", event.organizer_name],
                event.capacity ? ["Capacity", event.capacity.toLocaleString()] : null,
                event.attendees_count ? ["Attended", event.attendees_count.toLocaleString()] : null,
              ] as ([string, string | number] | null)[]).filter((x): x is [string, string | number] => x !== null).map(([k, v]) => (
                <div key={String(k)} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: "11px 13px" }}>
                  <p className="eyebrow" style={{ margin: 0, fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>{k}</p>
                  <p className="tabular" style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: TEXT }}>{String(v)}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: (event.sponsors?.length || 0) > 0 ? 18 : 0 }}>
              {(event.tags || []).map(t => <span key={t} className="eyebrow" style={{ padding: "4px 12px", borderRadius: 999, fontSize: 10, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: MUTED2 }}>{t}</span>)}
            </div>
            {(event.sponsors?.length || 0) > 0 && (
              <div style={{ marginTop: 14 }}>
                <p className="eyebrow" style={{ margin: "0 0 8px", fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>Sponsors & Partners</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{event.sponsors.map(s => <span key={s} style={{ padding: "4px 12px", background: CARD_BG, borderRadius: 8, fontSize: 12, color: "#374151", fontWeight: 500 }}>{s}</span>)}</div>
              </div>
            )}

            {(event.contact_phone || event.contact_email || event.website_url || event.maps_url || event.social_instagram || event.social_facebook) && (
              <div style={{ marginTop: 18, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: "16px 18px" }}>
                <p className="eyebrow" style={{ margin: "0 0 12px", fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>Contact & Links</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {event.contact_name && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 14 }}>👤</span>
                      <span style={{ fontSize: 13, color: "#33402F", fontWeight: 600 }}>{event.contact_name}</span>
                    </div>
                  )}
                  {event.contact_phone && (
                    <a href={`tel:${event.contact_phone}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 14 }}>📞</span>
                      <span style={{ fontSize: 13, color: GREEN_DARK, fontWeight: 600 }}>{event.contact_phone}</span>
                    </a>
                  )}
                  {event.contact_email && (
                    <a href={`mailto:${event.contact_email}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 14 }}>✉️</span>
                      <span style={{ fontSize: 13, color: GREEN_DARK, fontWeight: 600 }}>{event.contact_email}</span>
                    </a>
                  )}
                  {event.website_url && (
                    <a href={event.website_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 14 }}>🌐</span>
                      <span style={{ fontSize: 13, color: GREEN_DARK, fontWeight: 600 }}>{event.website_url.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                  {event.maps_url && (
                    <a href={event.maps_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 14 }}>📍</span>
                      <span style={{ fontSize: 13, color: GREEN_DARK, fontWeight: 600 }}>View on Google Maps</span>
                    </a>
                  )}
                  {(event.social_instagram || event.social_facebook) && (
                    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                      {event.social_instagram && (
                        <a href={event.social_instagram.startsWith("http") ? event.social_instagram : `https://instagram.com/${event.social_instagram.replace("@", "")}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", background: "#fff", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 12, color: "#374151", fontWeight: 600, textDecoration: "none" }}>
                          <span>📷</span> Instagram
                        </a>
                      )}
                      {event.social_facebook && (
                        <a href={event.social_facebook} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", background: "#fff", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 12, color: "#374151", fontWeight: 600, textDecoration: "none" }}>
                          <span>👥</span> Facebook
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
              {lineup.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: "12px 16px" }}>
                  {item.photo_url
                    ? <img src={item.photo_url} alt={item.name} style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    : <AvatarCircle initials={item.avatar_initials || item.name.slice(0, 2).toUpperCase()} color={item.avatar_color || cat.accent} size={46} />
                  }
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: TEXT }}>{item.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>{[item.sub_role, item.genre, item.company, item.team, item.origin ? `From ${item.origin}` : null].filter(Boolean).join(" · ")}</p>
                    {item.topic && <span className="eyebrow" style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", background: cat.accent + "16", color: cat.accent, borderRadius: 999, fontSize: 10 }}>"{item.topic}"</span>}
                  </div>
                  {item.upcoming_shows !== undefined && (
                    <div style={{ textAlign: "right" }}>
                      <p className="tabular" style={{ margin: 0, fontSize: 20, fontWeight: 900, color: item.avatar_color || cat.accent }}>{item.upcoming_shows}</p>
                      <p className="eyebrow" style={{ margin: 0, fontSize: 9, color: MUTED }}>upcoming</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "schedule" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {(event.schedule || []).map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 14, paddingBottom: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.accent, marginTop: 4, flexShrink: 0 }} />
                    {i < (event.schedule?.length ?? 0) - 1 && <div style={{ width: 1, flex: 1, background: CARD_BORDER, marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="eyebrow" style={{ margin: "0 0 2px", fontSize: 9, color: cat.accent, letterSpacing: "0.08em" }}>{item.slot_label}</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{item.title}</p>
                    {item.speaker_name && <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>by {item.speaker_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "prizes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(event.prizes || []).map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: i === 0 ? "#fffbeb" : CARD_BG, borderRadius: 12, padding: "12px 16px", border: `1px solid ${i === 0 ? "#fde68a" : CARD_BORDER}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: i === 0 ? GOLD : i === 1 ? "#9ca3af" : i === 2 ? "#fb923c" : cat.accent + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: i <= 2 ? "#0B1410" : cat.accent, flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: TEXT }}>{item.rank_label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>{item.reward}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 26px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", position: "sticky", bottom: 0, background: MODAL_BG, borderRadius: "0 0 24px 24px", flexShrink: 0 }}>
          {learnMoreHref ? (
            <button onClick={handleLearnMore}
              style={{ flex: 2, padding: "13px 22px", background: GREEN, color: "#fff", border: "none", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 140 }}>
              {isLearnMoreExternal ? "🌐" : "→"} Learn More
            </button>
          ) : (
            <div style={{ flex: 2, padding: "13px 22px", background: CARD_BG, border: `1px dashed ${CARD_BORDER}`, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 140 }}>
              <span style={{ fontSize: 13 }}>🔗</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>More details coming soon</span>
            </div>
          )}
          {!isPast && registerHref && (
            <button onClick={handleRegister}
              style={{ flex: learnMoreHref ? 1 : 2, padding: "13px 22px", background: learnMoreHref ? "#fff" : GREEN, color: learnMoreHref ? TEXT : "#fff", border: learnMoreHref ? `1px solid ${CARD_BORDER}` : "none", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer", minWidth: 100 }}>
              {event.status === "postponed" ? "Get Notified" : "Register →"}
            </button>
          )}
          <button onClick={onClose}
            style={{ padding: "13px 18px", background: "#fff", color: MUTED, border: `1px solid ${CARD_BORDER}`, borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: "pointer", flexShrink: 0 }}>
            Close
          </button>
          {(event.contact_phone || event.contact_email) && (
            <span style={{ fontSize: 12, color: MUTED, marginLeft: "auto", flexShrink: 0 }}>
              {event.contact_phone
                ? <a href={`tel:${event.contact_phone}`} style={{ color: MUTED, textDecoration: "none", fontWeight: 600 }}>📞 {event.contact_phone}</a>
                : <a href={`mailto:${event.contact_email}`} style={{ color: MUTED, textDecoration: "none", fontWeight: 600 }}>✉️ {event.contact_email}</a>
              }
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#fff", border: `1px solid ${CARD_BORDER}`, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ height: 140, background: CARD_BG, animation: "shimmer 1.5s infinite" }} />
      <div style={{ padding: "16px 18px" }}>
        {[80, 140, 40, 40, 40].map((w, i) => <div key={i} style={{ height: i === 0 ? 16 : 12, width: `${w}%`, background: CARD_BG, borderRadius: 6, marginBottom: 10, animation: "shimmer 1.5s infinite" }} />)}
      </div>
    </div>
  );
}

function EventDiscoveryIllustration() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
      style={{ position: "relative", borderRadius: 24, border: `1px dashed ${CARD_BORDER}`, background: CARD_BG, padding: "64px 24px", textAlign: "center" }}>
      <p style={{ fontSize: 34, margin: "0 0 10px" }}>🎪</p>
      <p className="eyebrow" style={{ margin: 0, fontSize: 11, color: MUTED }}>No featured events yet — check back soon</p>
    </motion.div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────
function EventDiscoveryPageContent() {
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [selectedEvent, setSelectedEvent] = useState<DBEvent | null>(null);
  const [events, setEvents] = useState<DBEvent[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const q = searchParams.get("search"); if (q !== null) setSearch(q); }, [searchParams]);
  useEffect(() => { supabase.from("active_banners").select("*").then(({ data, error }) => { if (!error && data) setBanners(data as Banner[]); }); }, []);
  useEffect(() => { setLoading(true); setError(null); supabase.from("events_full").select("*").neq("status", "draft").then(({ data, error }) => { if (error) setError(error.message); else setEvents((data || []) as DBEvent[]); setLoading(false); }); }, []);

  const filtered = useMemo(() => {
    let res = events.filter(ev => {
      const matchCat = activeCategory === "all" || ev.category === activeCategory;
      const matchStatus = statusFilter === "all" || ev.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || [ev.title, ev.subtitle || "", ev.description, ev.city, ev.organizer_name, ...(ev.tags || [])].some(s => s.toLowerCase().includes(q));
      return matchCat && matchStatus && matchSearch;
    });
    if (sortBy === "date") res = res.sort((a, b) => a.date_start.localeCompare(b.date_start));
    if (sortBy === "name") res = res.sort((a, b) => a.title.localeCompare(b.title));
    return res;
  }, [events, activeCategory, search, statusFilter, sortBy]);

  const counts = useMemo(() => { const c: Record<string, number> = { all: events.length }; CATEGORIES.forEach(cat => { c[cat.id] = events.filter(e => e.category === cat.id).length; }); return c; }, [events]);

  const heroSlides: HeroSlide[] = useMemo(() => {
    // Split camelCase ("EduFest" -> "Edu Fest") before normalizing, since
    // curated banner titles and event titles often differ only in spacing
    // or capitalization ("Mateng EduFest 2026" vs "Mateng Edu Fest 2026").
    const norm = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const wordSet = (s: string) => new Set(norm(s).split(" ").filter(Boolean));

    // Try to find the live event a curated banner is "about" — via its
    // link (most reliable) or a fuzzy word-overlap title match — so we
    // can borrow that event's actual uploaded photo instead of treating
    // an updated photo as a brand-new, separate slide. The banners
    // table's own image_url often points at a static /public file that
    // can go missing or was never added; the event's photo (uploaded
    // through the admin Media tab) is always the current, working one.
    const findMatchingEvent = (banner: Banner) => {
      if (banner.link_href) {
        const byHref = events.find(e => e.page_href && e.page_href === banner.link_href);
        if (byHref) return byHref;
      }
      const bWords = wordSet(banner.title);
      if (bWords.size === 0) return undefined;
      let best: DBEvent | undefined; let bestScore = 0;
      for (const e of events) {
        const eWords = wordSet(e.title);
        if (eWords.size === 0) continue;
        const overlap = [...bWords].filter(w => eWords.has(w)).length;
        const score = overlap / Math.min(bWords.size, eWords.size);
        if (score > bestScore) { bestScore = score; best = e; }
      }
      // Require most of the words to line up (allows a stray extra word
      // like a year or subtitle fragment, but not an unrelated event).
      return bestScore >= 0.6 ? best : undefined;
    };

    const matchedIds = new Set<string>();
    const curated: HeroSlide[] = banners
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map(b => {
        const matched = findMatchingEvent(b);
        if (matched) matchedIds.add(matched.id);
        return matched?.image_url ? { ...b, image_url: matched.image_url } : { ...b };
      });

    const curatedTitles = new Set(curated.map(b => norm(b.title)));
    const eventSlides: HeroSlide[] = events
      .filter(e => e.image_url && (e.status === "upcoming" || e.status === "open" || e.status === "ongoing"))
      // skip events already represented by a matched or same-titled curated banner
      .filter(e => !matchedIds.has(e.id) && !curatedTitles.has(norm(e.title)))
      .sort((a, b) => (Number(b.featured) - Number(a.featured)) || a.date_start.localeCompare(b.date_start))
      .slice(0, 6)
      .map(e => ({
        id: `ev-${e.id}`,
        title: e.title,
        subtitle: `${e.date_start}${e.date_end ? ` – ${e.date_end}` : ""} · ${e.venue}, ${e.city}`,
        image_url: e.image_url!,
        bg_color: e.accent_color,
        display_order: 0,
        event: e,
      }));
    return [...curated, ...eventSlides].slice(0, 8);
  }, [banners, events]);

  return (
    <div className={`${fraunces.variable} ${inter.variable} ${mono.variable} w-full min-h-screen flex flex-col`}
      style={{ background: BG, color: TEXT, fontFamily: "var(--font-body)" }}>
      <style jsx global>{`
        @keyframes pulse-glow { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes pop-in { 0% { opacity:0; transform: translateY(24px) scale(0.98); } 100% { opacity:1; transform: translateY(0) scale(1); } }
        @keyframes ring-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(63,166,55,0.35);} 50% { box-shadow: 0 0 0 10px rgba(63,166,55,0);} }
        @keyframes ring-pulse-purple { 0%,100% { box-shadow: 0 0 0 0 rgba(80,194,115,0.35);} 50% { box-shadow: 0 0 0 10px rgba(80,194,115,0);} }
        @keyframes shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
        .eyebrow { font-family: var(--font-mono); letter-spacing: 0.18em; text-transform: uppercase; }
        .tabular { font-family: var(--font-mono); font-feature-settings: "tnum" 1; }
        .live-dot { animation: pulse-glow 1.8s ease-in-out infinite; }
        .event-card { animation: pop-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; transition: box-shadow 0.35s ease; }
        .event-card-green { box-shadow: 0 0 0 1px rgba(63,166,55,0.2), 0 24px 60px -26px rgba(63,166,55,0.4); }
        .event-card-purple { box-shadow: 0 0 0 1px rgba(80,194,115,0.2), 0 24px 60px -26px rgba(80,60,180,0.35); }
        .featured-badge { animation: ring-pulse-purple 2.2s ease-in-out infinite; }
        .featured-badge-green { animation: ring-pulse 2.2s ease-in-out infinite; }
        input:focus, select:focus { outline: none; border-color: ${GREEN} !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: ${CARD_BORDER}; border-radius: 4px; }
        @media (max-width: 720px) { .hero-stub { display: none; } }
      `}</style>

      <div className="flex-grow">
        {/* HERO CAROUSEL — ticket banner (headline section removed), full-bleed */}
        <section className="w-full px-3 sm:px-5 md:px-8 pt-6">
          <div className="w-full">
            {heroSlides.length > 0 ? (
              <HeroCarousel slides={heroSlides} onEventOpen={setSelectedEvent} />
            ) : !loading ? (
              <EventDiscoveryIllustration />
            ) : null}
          </div>
        </section>

        {/* EXPLORE EVENTS HEADING */}
        <section className="mt-16 px-6 flex flex-col items-center">
          <span className="eyebrow text-[11px]" style={{ color: MUTED2, marginBottom: 10 }}>Browse</span>
          <h2 className="text-2xl sm:text-3xl mb-2 text-center" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Explore <em style={{ fontStyle: "italic", color: GOLD_TEXT }}>every</em> event
          </h2>
        </section>

        {/* CATEGORY TABS */}
        <div className="w-full flex justify-center px-4 mt-6">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 900 }}>
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className="eyebrow"
                  style={{ padding: "8px 16px", borderRadius: 999, border: `1.5px solid ${active ? cat.accent : CARD_BORDER}`, background: active ? cat.accent + "12" : "#fff", color: active ? cat.accent : MUTED, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 13 }}>{cat.icon}</span>{cat.label}
                  <span className="tabular" style={{ fontSize: 9, padding: "0 6px", borderRadius: 999, background: active ? cat.accent + "20" : CARD_BG, color: active ? cat.accent : MUTED }}>{counts[cat.id] || 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 md:px-8 mt-8 mb-6" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "0 1 300px", minWidth: 200 }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: MUTED }}>🔍</span>
            <input type="text" placeholder="Search events, venues, tags…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "9px 32px 9px 34px", fontSize: 12.5, border: `1px solid ${CARD_BORDER}`, borderRadius: 999, background: "#fff", color: TEXT }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13 }}>✕</button>}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}><strong style={{ color: TEXT }}>{filtered.length}</strong> events{activeCategory !== "all" && ` · ${CATEGORIES.find(c => c.id === activeCategory)?.label}`}</p>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {(["all", "upcoming", "open", "past", "postponed"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className="eyebrow"
                style={{ padding: "5px 11px", borderRadius: 999, border: `1px solid ${statusFilter === s ? GREEN_DARK : CARD_BORDER}`, background: statusFilter === s ? "#f0fdf4" : "#fff", color: statusFilter === s ? GREEN_DARK : MUTED, fontSize: 9, cursor: "pointer" }}>
                {s === "all" ? "All Status" : s}
              </button>
            ))}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as "date" | "name")}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "#fff", fontSize: 12, color: TEXT, cursor: "pointer" }}>
              <option value="date">Date</option>
              <option value="name">Name</option>
            </select>
            {(activeCategory !== "all" || statusFilter !== "all" || search) && (
              <button onClick={() => { setActiveCategory("all"); setStatusFilter("all"); setSearch(""); }} className="eyebrow"
                style={{ padding: "5px 12px", borderRadius: 999, border: "none", background: "#fee2e2", color: "#991b1b", fontSize: 9, cursor: "pointer" }}>Clear</button>
            )}
          </div>
        </div>

        {/* GRID */}
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 md:px-8 pb-24">
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "14px 18px", marginBottom: 20, color: "#991b1b", fontSize: 14 }}>Failed to load events: {error}. Check Supabase credentials in .env.local</div>}

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px,1fr))", gap: 18 }}>{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.length > 0 ? (
                <motion.div layout style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px,1fr))", gap: 18 }}>
                  {filtered.map((ev, i) => <EventCard key={ev.id} event={ev} onSelect={setSelectedEvent} delay={i * 0.03} />)}
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: "80px 24px", border: `1px dashed ${CARD_BORDER}`, borderRadius: 18 }}>
                  <p style={{ fontSize: 40, margin: "0 0 12px" }}>🔍</p>
                  <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: TEXT, fontFamily: "var(--font-display)" }}>No events found</h3>
                  <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>Try adjusting filters or clear your search.</p>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      <AnimatePresence>{selectedEvent && <DetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}</AnimatePresence>

      <footer className="w-full mt-4">
        <Footer />
      </footer>
    </div>
  );
}

export default function EventDiscoveryPage() {
  return (
    <Suspense fallback={null}>
      <EventDiscoveryPageContent />
    </Suspense>
  );
}