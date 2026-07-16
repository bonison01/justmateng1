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
 * This page is restyled to match the Mateng homepage exactly: Fraunces
 * for display type, Inter for body, JetBrains Mono for "eyebrow"
 * labels, a dark #0B1410 canvas, green (#3FA637) + gold (#E8B84B)
 * accents, dashed-border cards, ticket-stub motifs, and the same
 * pop-in / ring-pulse / route-line animation vocabulary.
 * ─────────────────────────────────────────────────────────────────────
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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

// ── PALETTE (matches homepage exactly) ────────────────────────────────
const BG = "#0B1410";
const TEXT = "#F3F1EA";
const MUTED = "#92A395";
const MUTED2 = "#8FA391";
const GREEN = "#3FA637";
const GOLD = "#E8B84B";
const GREEN2 = "#50C273";
const CARD_BG = "rgba(243,241,234,0.03)";
const CARD_BORDER = "rgba(243,241,234,0.16)";
const MODAL_BG = "#101B15";

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

// Dark-mode-tuned accents, brand-consistent with the homepage's green/gold/purple palette.
export const CATEGORIES: { id: CategoryId; label: string; icon: string; accent: string }[] = [
  { id: "all", label: "All Events", icon: "◈", accent: MUTED2 },
  { id: "education", label: "Education", icon: "◎", accent: GOLD },
  { id: "concerts", label: "Concerts", icon: "♪", accent: "#c084fc" },
  { id: "business", label: "Business", icon: "◇", accent: "#60a5fa" },
  { id: "medical", label: "Medical", icon: "✦", accent: "#f87171" },
  { id: "sports", label: "Sports", icon: "◉", accent: "#fb923c" },
  { id: "cultural", label: "Cultural", icon: "❋", accent: "#22d3ee" },
  { id: "workshops", label: "Workshops", icon: "⬡", accent: "#fbbf24" },
  { id: "exhibitions", label: "Exhibitions", icon: "▣", accent: "#a78bfa" },
];

function statusConfig(s: EventStatus) {
  return ({
    upcoming: { label: "Upcoming", color: "#93c5fd", bg: "rgba(96,165,250,0.14)" },
    open: { label: "Open Now", color: GREEN2, bg: "rgba(80,194,115,0.16)" },
    ongoing: { label: "Live Now", color: "#fca5a5", bg: "rgba(248,113,113,0.14)" },
    past: { label: "Past", color: MUTED, bg: "rgba(243,241,234,0.05)" },
    postponed: { label: "Postponed", color: GOLD, bg: "rgba(232,184,75,0.14)" },
    cancelled: { label: "Cancelled", color: MUTED, bg: "rgba(243,241,234,0.05)" },
  } as any)[s] ?? { label: s, color: MUTED, bg: "rgba(243,241,234,0.05)" };
}
function timeAgo(d: string) { const diff = new Date(d).getTime() - Date.now(); const days = Math.round(Math.abs(diff) / 86400000); if (diff > 0) return `in ${days}d`; if (days === 0) return "today"; return `${days}d ago`; }
function lineupLabel(items: LineupItem[]) { if (!items?.length) return ""; const r = items.map(i => i.role); if (r.includes("artist") || r.includes("performer")) return "Artists"; if (r.includes("speaker")) return "Speakers"; if (r.includes("athlete")) return "Athletes"; if (r.includes("exhibitor")) return "Exhibitors"; return "Participants"; }

function AvatarCircle({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color + "22", border: `1.5px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.33), fontWeight: 700, color, flexShrink: 0 }}>{initials || "?"}</div>;
}
function StatusPill({ status }: { status: EventStatus }) {
  const cfg = statusConfig(status);
  return (
    <span className="eyebrow" style={{ padding: "3px 10px", borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 600, border: `1px solid ${cfg.color}33`, display: "inline-flex", alignItems: "center", gap: 5, letterSpacing: "0.08em" }}>
      {status === "open" && <span className="live-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, display: "inline-block" }} />}
      {cfg.label}
    </span>
  );
}
function CategoryChip({ cat }: { cat: { label: string; icon: string; accent: string } }) {
  return (
    <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: cat.accent + "1f", border: `1px solid ${cat.accent}44`, color: TEXT, fontSize: 10, letterSpacing: "0.08em" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cat.accent, flexShrink: 0 }} />
      {cat.icon} {cat.label}
    </span>
  );
}

// ── HERO CAROUSEL — styled as a "ticket banner" like the homepage's EduFest/G15 cards ──
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
                  <span className="eyebrow" style={{ fontSize: 11, color: TEXT, padding: "6px 12px", borderRadius: 999, background: "rgba(0,0,0,0.4)" }}>
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
              <h2 style={{ margin: "0 0 10px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(22px,3.2vw,36px)", lineHeight: 1.15, color: TEXT }}>{cur.title}</h2>
              {cur.subtitle && <p style={{ margin: "0 0 22px", fontSize: 14, color: "#D7E4D8", maxWidth: 560, lineHeight: 1.6 }}>{cur.subtitle}</p>}
              <button onClick={go} style={{ padding: "12px 26px", borderRadius: 999, background: "#fff", color: idx % 2 === 0 ? "#0F550C" : "#2D1B69", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
                {cur.link_label || (cur.event ? "View Event" : "Learn More")} →
              </button>
            </div>
            <div className="hero-stub" style={{ width: 96, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, borderLeft: `1px dashed ${CARD_BORDER}` }}>
              <span className="eyebrow" style={{ fontSize: 10, color: GOLD, writingMode: "vertical-rl" }}>Admit One</span>
              <span className="tabular" style={{ fontSize: 11, color: "#D7E4D8" }}>{cur.event ? cur.event.date_start.slice(5).replace("-", "·") : "★"}</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 16 }}>
          {slides.map((_, i) => <button key={i} onClick={() => { setIdx(i); startTimer(); }} style={{ width: i === idx ? 24 : 7, height: 7, borderRadius: 999, background: i === idx ? GREEN2 : "rgba(243,241,234,0.25)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.3s" }} />)}
        </div>
      )}
      {slides.length > 1 && (
        <>
          <button onClick={() => { setIdx((idx - 1 + slides.length) % slides.length); startTimer(); }} style={{ position: "absolute", left: 12, top: "38%", transform: "translateY(-50%)", background: "rgba(243,241,234,0.08)", border: `1px solid ${CARD_BORDER}`, color: TEXT, width: 38, height: 38, borderRadius: "50%", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5, backdropFilter: "blur(4px)" }}>‹</button>
          <button onClick={() => { setIdx((idx + 1) % slides.length); startTimer(); }} style={{ position: "absolute", right: 12, top: "38%", transform: "translateY(-50%)", background: "rgba(243,241,234,0.08)", border: `1px solid ${CARD_BORDER}`, color: TEXT, width: 38, height: 38, borderRadius: "50%", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5, backdropFilter: "blur(4px)" }}>›</button>
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
        background: CARD_BG, border: `1px dashed ${CARD_BORDER}`, borderRadius: 18, overflow: "hidden", textAlign: "left",
        transition: "box-shadow 0.3s ease",
        boxShadow: event.featured ? `0 0 0 1px ${cat.accent}33, 0 20px 50px -24px ${cat.accent}55` : "none",
      }}>
      {event.image_url ? (
        <div style={{ position: "relative", height: 140, flexShrink: 0, backgroundImage: `url(${event.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,20,16,0) 50%, rgba(11,20,16,0.75) 100%)" }} />
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
              <span className="tabular" style={{ fontSize: 12, color: "#C9D6CB", lineHeight: 1.5 }}>{val}</span>
            </div>
          ))}
        </div>
        {lineup.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex" }}>{lineup.slice(0, 5).map((item, i) => <div key={i} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: "50%", border: `2px solid ${BG}` }}><AvatarCircle initials={item.avatar_initials || item.name.slice(0, 2).toUpperCase()} color={item.avatar_color || cat.accent} size={26} /></div>)}</div>
            <span style={{ fontSize: 11, color: MUTED }}>{lineup.length} {lLabel}</span>
          </div>
        )}
        {(event.tags || []).length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5 }}>
            {(event.tags || []).slice(0, 3).map(t => (
              <span key={t} className="eyebrow" style={{ padding: "3px 9px", borderRadius: 999, fontSize: 9, background: "rgba(243,241,234,0.06)", border: "1px solid rgba(243,241,234,0.14)", color: MUTED2 }}>{t}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: "auto", padding: "10px 18px", borderTop: `1px dashed ${CARD_BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
      style={{ position: "fixed", inset: 0, top: 80, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(3px)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.22 }}
        style={{ background: MODAL_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 24, width: "100%", maxWidth: 640, maxHeight: "calc(100vh - 100px)", overflowY: "auto", boxShadow: "0 40px 100px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}
      >
        {event.image_url && (
          <div style={{ position: "relative", height: 200, flexShrink: 0, borderRadius: "24px 24px 0 0", backgroundImage: `url(${event.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "24px 24px 0 0", background: "linear-gradient(180deg, rgba(11,20,16,0.05) 40%, rgba(16,27,21,0.85) 100%)" }} />
            <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(0,0,0,0.4)", border: `1px solid ${CARD_BORDER}`, color: TEXT, borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 15 }}>✕</button>
          </div>
        )}

        <div style={{ padding: "22px 26px 0", position: "sticky", top: 0, background: MODAL_BG, zIndex: 10, borderRadius: event.image_url ? 0 : "24px 24px 0 0", borderBottom: `1px dashed ${CARD_BORDER}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ flex: 1, marginRight: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <CategoryChip cat={cat} />
                <StatusPill status={event.status} />
                {learnMoreHref && <span className="eyebrow" style={{ fontSize: 10, color: GREEN2, background: "rgba(80,194,115,0.12)", border: `1px solid ${GREEN2}44`, padding: "3px 9px", borderRadius: 999 }}>🔗 Full page available</span>}
              </div>
              <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, color: TEXT, lineHeight: 1.2 }}>{event.title}</h2>
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{event.subtitle}</p>
            </div>
            {!event.image_url && <button onClick={onClose} style={{ background: "rgba(243,241,234,0.06)", border: `1px solid ${CARD_BORDER}`, color: TEXT, borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className="eyebrow"
                style={{ padding: "9px 14px", background: "none", border: "none", borderBottom: tab === t.id ? `2px solid ${GREEN2}` : "2px solid transparent", color: tab === t.id ? TEXT : MUTED, fontWeight: tab === t.id ? 700 : 500, fontSize: 10, cursor: "pointer", marginBottom: -1 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "22px 26px", flex: 1, overflowY: "auto" }}>
          {tab === "overview" && <>
            <p style={{ margin: "0 0 22px", fontSize: 14, lineHeight: 1.8, color: "#D7E4D8" }}>{event.description}</p>
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
                <div key={String(k)} style={{ background: "rgba(243,241,234,0.04)", border: `1px dashed ${CARD_BORDER}`, borderRadius: 12, padding: "11px 13px" }}>
                  <p className="eyebrow" style={{ margin: 0, fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>{k}</p>
                  <p className="tabular" style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: TEXT }}>{String(v)}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: (event.sponsors?.length || 0) > 0 ? 18 : 0 }}>
              {(event.tags || []).map(t => <span key={t} className="eyebrow" style={{ padding: "4px 12px", borderRadius: 999, fontSize: 10, background: "rgba(243,241,234,0.06)", border: "1px solid rgba(243,241,234,0.15)", color: MUTED2 }}>{t}</span>)}
            </div>
            {(event.sponsors?.length || 0) > 0 && (
              <div style={{ marginTop: 14 }}>
                <p className="eyebrow" style={{ margin: "0 0 8px", fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>Sponsors & Partners</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{event.sponsors.map(s => <span key={s} style={{ padding: "4px 12px", background: "rgba(243,241,234,0.05)", borderRadius: 8, fontSize: 12, color: "#D7E4D8", fontWeight: 500 }}>{s}</span>)}</div>
              </div>
            )}

            {(event.contact_phone || event.contact_email || event.website_url || event.maps_url || event.social_instagram || event.social_facebook) && (
              <div style={{ marginTop: 18, background: "rgba(243,241,234,0.04)", border: `1px dashed ${CARD_BORDER}`, borderRadius: 14, padding: "16px 18px" }}>
                <p className="eyebrow" style={{ margin: "0 0 12px", fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>Contact & Links</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {event.contact_name && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 14 }}>👤</span>
                      <span style={{ fontSize: 13, color: "#D7E4D8", fontWeight: 600 }}>{event.contact_name}</span>
                    </div>
                  )}
                  {event.contact_phone && (
                    <a href={`tel:${event.contact_phone}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 14 }}>📞</span>
                      <span style={{ fontSize: 13, color: GREEN2, fontWeight: 600 }}>{event.contact_phone}</span>
                    </a>
                  )}
                  {event.contact_email && (
                    <a href={`mailto:${event.contact_email}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 14 }}>✉️</span>
                      <span style={{ fontSize: 13, color: GREEN2, fontWeight: 600 }}>{event.contact_email}</span>
                    </a>
                  )}
                  {event.website_url && (
                    <a href={event.website_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 14 }}>🌐</span>
                      <span style={{ fontSize: 13, color: GREEN2, fontWeight: 600 }}>{event.website_url.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                  {event.maps_url && (
                    <a href={event.maps_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 14 }}>📍</span>
                      <span style={{ fontSize: 13, color: GREEN2, fontWeight: 600 }}>View on Google Maps</span>
                    </a>
                  )}
                  {(event.social_instagram || event.social_facebook) && (
                    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                      {event.social_instagram && (
                        <a href={event.social_instagram.startsWith("http") ? event.social_instagram : `https://instagram.com/${event.social_instagram.replace("@", "")}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", background: "rgba(243,241,234,0.05)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 12, color: "#D7E4D8", fontWeight: 600, textDecoration: "none" }}>
                          <span>📷</span> Instagram
                        </a>
                      )}
                      {event.social_facebook && (
                        <a href={event.social_facebook} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", background: "rgba(243,241,234,0.05)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 12, color: "#D7E4D8", fontWeight: 600, textDecoration: "none" }}>
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
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(243,241,234,0.04)", border: `1px dashed ${CARD_BORDER}`, borderRadius: 14, padding: "12px 16px" }}>
                  {item.photo_url
                    ? <img src={item.photo_url} alt={item.name} style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    : <AvatarCircle initials={item.avatar_initials || item.name.slice(0, 2).toUpperCase()} color={item.avatar_color || cat.accent} size={46} />
                  }
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: TEXT }}>{item.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>{[item.sub_role, item.genre, item.company, item.team, item.origin ? `From ${item.origin}` : null].filter(Boolean).join(" · ")}</p>
                    {item.topic && <span className="eyebrow" style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", background: cat.accent + "1f", color: cat.accent, borderRadius: 999, fontSize: 10 }}>"{item.topic}"</span>}
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
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: i === 0 ? "rgba(232,184,75,0.08)" : "rgba(243,241,234,0.04)", borderRadius: 12, padding: "12px 16px", border: `1px dashed ${i === 0 ? "rgba(232,184,75,0.35)" : CARD_BORDER}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: i === 0 ? GOLD : i === 1 ? "#9ca3af" : i === 2 ? "#fb923c" : cat.accent + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: i <= 2 ? "#0B1410" : cat.accent, flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: TEXT }}>{item.rank_label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>{item.reward}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 26px", borderTop: `1px dashed ${CARD_BORDER}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", position: "sticky", bottom: 0, background: MODAL_BG, borderRadius: "0 0 24px 24px", flexShrink: 0 }}>
          {learnMoreHref ? (
            <button onClick={handleLearnMore}
              style={{ flex: 2, padding: "13px 22px", background: "#fff", color: "#0F550C", border: "none", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 140 }}>
              {isLearnMoreExternal ? "🌐" : "→"} Learn More
            </button>
          ) : (
            <div style={{ flex: 2, padding: "13px 22px", background: "rgba(243,241,234,0.03)", border: `1px dashed ${CARD_BORDER}`, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 140 }}>
              <span style={{ fontSize: 13 }}>🔗</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>More details coming soon</span>
            </div>
          )}
          {!isPast && registerHref && (
            <button onClick={handleRegister}
              style={{ flex: learnMoreHref ? 1 : 2, padding: "13px 22px", background: learnMoreHref ? "transparent" : "#fff", color: learnMoreHref ? TEXT : "#0F550C", border: learnMoreHref ? `1px solid rgba(243,241,234,0.3)` : "none", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer", minWidth: 100 }}>
              {event.status === "postponed" ? "Get Notified" : "Register →"}
            </button>
          )}
          <button onClick={onClose}
            style={{ padding: "13px 18px", background: "transparent", color: MUTED, border: `1px solid rgba(243,241,234,0.16)`, borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: "pointer", flexShrink: 0 }}>
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
    <div style={{ background: CARD_BG, border: `1px dashed ${CARD_BORDER}`, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ height: 140, background: "rgba(243,241,234,0.05)", animation: "shimmer 1.5s infinite" }} />
      <div style={{ padding: "16px 18px" }}>
        {[80, 140, 40, 40, 40].map((w, i) => <div key={i} style={{ height: i === 0 ? 16 : 12, width: `${w}%`, background: "rgba(243,241,234,0.06)", borderRadius: 6, marginBottom: 10, animation: "shimmer 1.5s infinite" }} />)}
      </div>
    </div>
  );
}

function EventDiscoveryIllustration() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
      style={{ position: "relative", borderRadius: 24, border: `1px dashed ${CARD_BORDER}`, background: "rgba(243,241,234,0.02)", padding: "64px 24px", textAlign: "center" }}>
      <p style={{ fontSize: 34, margin: "0 0 10px" }}>🎪</p>
      <p className="eyebrow" style={{ margin: 0, fontSize: 11, color: MUTED }}>No featured events yet — check back soon</p>
    </motion.div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────
export default function EventDiscoveryPage() {
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
    const curated: HeroSlide[] = banners.slice().sort((a, b) => a.display_order - b.display_order).map(b => ({ ...b }));
    const eventSlides: HeroSlide[] = events
      .filter(e => e.image_url && (e.status === "upcoming" || e.status === "open" || e.status === "ongoing"))
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
        @keyframes dash-run { to { stroke-dashoffset: -200; } }
        @keyframes pulse-glow { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes pop-in { 0% { opacity:0; transform: translateY(24px) scale(0.98); } 100% { opacity:1; transform: translateY(0) scale(1); } }
        @keyframes ring-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(63,166,55,0.35);} 50% { box-shadow: 0 0 0 10px rgba(63,166,55,0);} }
        @keyframes ring-pulse-purple { 0%,100% { box-shadow: 0 0 0 0 rgba(80,194,115,0.35);} 50% { box-shadow: 0 0 0 10px rgba(80,194,115,0);} }
        @keyframes shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .route-line { stroke-dasharray: 5 9; animation: dash-run 14s linear infinite; }
        .eyebrow { font-family: var(--font-mono); letter-spacing: 0.18em; text-transform: uppercase; }
        .tabular { font-family: var(--font-mono); font-feature-settings: "tnum" 1; }
        .live-dot { animation: pulse-glow 1.8s ease-in-out infinite; }
        .stub-row > div + div { position: relative; }
        .stub-row > div + div::before {
          content: ""; position: absolute; left: -1px; top: 50%; transform: translateY(-50%);
          width: 10px; height: 10px; border-radius: 9999px; background: ${BG};
          box-shadow: 0 -34px 0 -1px ${BG}, 0 34px 0 -1px ${BG};
        }
        .event-card { animation: pop-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; transition: box-shadow 0.35s ease; }
        .event-card-green { box-shadow: 0 0 0 1px rgba(63,166,55,0.25), 0 20px 60px -20px rgba(63,166,55,0.35); }
        .event-card-purple { box-shadow: 0 0 0 1px rgba(80,194,115,0.25), 0 20px 60px -20px rgba(80,60,180,0.45); }
        .featured-badge { animation: ring-pulse-purple 2.2s ease-in-out infinite; }
        .featured-badge-green { animation: ring-pulse 2.2s ease-in-out infinite; }
        input:focus, select:focus { outline: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(243,241,234,0.2); border-radius: 4px; }
        @media (max-width: 720px) { .hero-stub { display: none; } }
      `}</style>

      <div className="flex-grow">
        {/* HERO TEXT */}
        <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-10 overflow-hidden">
          <svg className="absolute inset-x-0 top-6 w-full max-w-4xl mx-auto opacity-40 pointer-events-none" viewBox="0 0 800 160" fill="none">
            <path d="M20 120 C 180 20, 280 140, 420 60 S 640 20, 780 90" stroke={GREEN} strokeWidth="1.5" className="route-line" />
            <circle cx="20" cy="120" r="4" fill={GOLD} />
            <circle cx="420" cy="60" r="4" fill={GREEN} />
            <circle cx="780" cy="90" r="4" fill={GOLD} />
          </svg>

          <span className="eyebrow relative text-[11px]" style={{ color: MUTED2, marginBottom: 20 }}>Manipur Event Discovery</span>

          <h1 className="relative text-4xl sm:text-5xl md:text-6xl leading-[1.08] max-w-3xl" style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: TEXT }}>
            Every Event. <em style={{ fontStyle: "italic", color: GREEN }}>One Platform.</em>
          </h1>

          <p className="relative mt-5 max-w-xl text-sm sm:text-base leading-relaxed" style={{ color: MUTED }}>
            Concerts, summits, medical conclaves, education fests, cultural festivals, sports championships, workshops and exhibitions — all in one place.
          </p>

          <div className="relative w-full max-w-md mt-8">
            <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: MUTED }}>🔍</span>
            <input type="text" placeholder="Search events, artists, topics, venues…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "13px 40px 13px 46px", fontSize: 14, borderRadius: 999, background: "rgba(243,241,234,0.05)", border: `1px solid ${CARD_BORDER}`, color: TEXT }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 15 }}>✕</button>}
          </div>

          <div className="stub-row relative flex flex-row justify-center gap-8 md:gap-14 rounded-2xl px-8 py-6 mt-10"
            style={{ background: "rgba(243,241,234,0.03)", border: `1px dashed ${CARD_BORDER}` }}>
            {([[events.length, "Events"], [events.filter(e => e.status === "open" || e.status === "upcoming").length, "Upcoming"], [CATEGORIES.length - 1, "Categories"]] as [number, string][]).map(([n, l]) => (
              <div key={l}>
                <p className="tabular" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: GREEN }}>{n}</p>
                <p className="eyebrow" style={{ margin: "2px 0 0", fontSize: 9, color: MUTED }}>{l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HERO CAROUSEL — ticket banner */}
        <section className="w-full flex justify-center px-4 mt-6">
          <div className="w-full max-w-5xl">
            {heroSlides.length > 0 ? (
              <HeroCarousel slides={heroSlides} onEventOpen={setSelectedEvent} />
            ) : !loading ? (
              <EventDiscoveryIllustration />
            ) : null}
          </div>
        </section>

        {/* EXPLORE EVENTS HEADING */}
        <section className="mt-20 px-6 flex flex-col items-center">
          <span className="eyebrow text-[11px]" style={{ color: MUTED2, marginBottom: 10 }}>Browse</span>
          <h2 className="text-2xl sm:text-3xl mb-2" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Explore <em style={{ fontStyle: "italic", color: GOLD }}>every</em> event
          </h2>
        </section>

        {/* CATEGORY TABS */}
        <div className="w-full flex justify-center px-4 mt-6">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 900 }}>
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className="eyebrow"
                  style={{ padding: "8px 16px", borderRadius: 999, border: `1px ${active ? "solid" : "dashed"} ${active ? cat.accent : CARD_BORDER}`, background: active ? cat.accent + "1f" : "rgba(243,241,234,0.02)", color: active ? TEXT : MUTED, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 13 }}>{cat.icon}</span>{cat.label}
                  <span className="tabular" style={{ fontSize: 9, padding: "0 6px", borderRadius: 999, background: active ? cat.accent + "33" : "rgba(243,241,234,0.06)", color: active ? cat.accent : MUTED }}>{counts[cat.id] || 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="max-w-5xl mx-auto px-6 mt-8 mb-6" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}><strong style={{ color: TEXT }}>{filtered.length}</strong> events{activeCategory !== "all" && ` · ${CATEGORIES.find(c => c.id === activeCategory)?.label}`}</p>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {(["all", "upcoming", "open", "past", "postponed"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className="eyebrow"
                style={{ padding: "5px 11px", borderRadius: 999, border: `1px solid ${statusFilter === s ? GREEN2 : CARD_BORDER}`, background: statusFilter === s ? "rgba(80,194,115,0.14)" : "transparent", color: statusFilter === s ? GREEN2 : MUTED, fontSize: 9, cursor: "pointer" }}>
                {s === "all" ? "All Status" : s}
              </button>
            ))}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as "date" | "name")}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "rgba(243,241,234,0.03)", fontSize: 12, color: TEXT, cursor: "pointer" }}>
              <option value="date" style={{ color: "#000" }}>Date</option>
              <option value="name" style={{ color: "#000" }}>Name</option>
            </select>
            {(activeCategory !== "all" || statusFilter !== "all" || search) && (
              <button onClick={() => { setActiveCategory("all"); setStatusFilter("all"); setSearch(""); }} className="eyebrow"
                style={{ padding: "5px 12px", borderRadius: 999, border: "none", background: "rgba(248,113,113,0.14)", color: "#fca5a5", fontSize: 9, cursor: "pointer" }}>Clear</button>
            )}
          </div>
        </div>

        {/* GRID */}
        <div className="max-w-5xl mx-auto px-6 pb-24">
          {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, color: "#fca5a5", fontSize: 14 }}>Failed to load events: {error}. Check Supabase credentials in .env.local</div>}

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