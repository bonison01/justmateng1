'use client'

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Footer from "@/components/footer/Footer";
import { useRouter } from "next/navigation";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { Timer } from "lucide-react";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

// Limited-time offer deadline: 12 July 2026, 00:00:00 IST
const OFFER_DEADLINE = new Date('2026-07-12T00:00:00+05:30');

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

const getTimeLeft = (deadline: Date): TimeLeft => {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, expired: false };
};

const pad = (n: number) => n.toString().padStart(2, '0');

export default function Page() {
  const router = useRouter();

  const [parcels, setParcels] = useState(0);
  const [merchants, setMerchants] = useState(0);
  const [businesses, setBusinesses] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showEventsPopup, setShowEventsPopup] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => getTimeLeft(OFFER_DEADLINE));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(OFFER_DEADLINE));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const offerActive = !timeLeft.expired;

  const PARTNERS = [
    { name: "175c", logo: "/partners/partner1.png" },
    { name: "Coffee Culture", logo: "/partners/partner2.png" },
    { name: "Laija Trends", logo: "/partners/partner3.png" },
    { name: "Shija Hospitals and Research Institute (SHRI)", logo: "/partners/partner7.png" },
    { name: "Safe Sight Eye Care", logo: "/partners/partner5.png" },
    { name: "Vegnus Health and Beauty", logo: "/partners/partner6.png" },
    { name: "PB Online Store", logo: "/partners/partner4.png" },
    { name: "Cleaneteria", logo: "/partners/cleaneteria.png" },
  ];

  useEffect(() => {
    const targetParcels = 100;
    const targetMerchants = 300;
    const targetBusinesses = 130;

    const interval = setInterval(() => {
      setParcels((prev) => (prev < targetParcels ? prev + 2 : targetParcels));
      setMerchants((prev) => (prev < targetMerchants ? prev + 5 : targetMerchants));
      setBusinesses((prev) => (prev < targetBusinesses ? prev + 3 : targetBusinesses));
    }, 40);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const alreadySeen = typeof window !== "undefined" && sessionStorage.getItem("mateng_events_popup_seen");
    if (alreadySeen) return;

    const timer = setTimeout(() => {
      setShowEventsPopup(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("mateng_events_popup_seen", "1");
      }
    }, 900);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`${fraunces.variable} ${inter.variable} ${mono.variable} w-full min-h-[calc(100svh-64px)] flex flex-col`}
      style={{
        background: "#0B1410",
        fontFamily: "var(--font-body)",
        color: "#F3F1EA",
      }}
    >
      <style jsx global>{`
        @keyframes dash-run {
          to { stroke-dashoffset: -200; }
        }
        @keyframes drift {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .route-line {
          stroke-dasharray: 5 9;
          animation: dash-run 14s linear infinite;
        }
        .stub-row > div + div {
          position: relative;
        }
        .stub-row > div + div::before {
          content: "";
          position: absolute;
          left: -1px;
          top: 50%;
          transform: translateY(-50%);
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: #0B1410;
          box-shadow: 0 -34px 0 -1px #0B1410, 0 34px 0 -1px #0B1410;
        }
        .eyebrow {
          font-family: var(--font-mono);
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .tabular {
          font-family: var(--font-mono);
          font-feature-settings: "tnum" 1;
        }
        .live-dot {
          animation: pulse-glow 1.8s ease-in-out infinite;
        }
        @keyframes pop-in {
          0% { opacity: 0; transform: translateY(24px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ring-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(63,166,55,0.35); }
          50% { box-shadow: 0 0 0 10px rgba(63,166,55,0); }
        }
        @keyframes ring-pulse-purple {
          0%, 100% { box-shadow: 0 0 0 0 rgba(80,194,115,0.35); }
          50% { box-shadow: 0 0 0 10px rgba(80,194,115,0); }
        }
        .event-card {
          animation: pop-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease;
          will-change: transform;
        }
        .event-card:hover {
          transform: translateY(-6px) scale(1.008);
        }
        .event-card-green {
          box-shadow: 0 0 0 1px rgba(63,166,55,0.25), 0 20px 60px -20px rgba(63,166,55,0.35);
        }
        .event-card-green:hover {
          box-shadow: 0 0 0 1px rgba(63,166,55,0.5), 0 30px 80px -20px rgba(63,166,55,0.55);
        }
        .event-card-purple {
          box-shadow: 0 0 0 1px rgba(80,194,115,0.25), 0 20px 60px -20px rgba(80,60,180,0.45);
        }
        .event-card-purple:hover {
          box-shadow: 0 0 0 1px rgba(80,194,115,0.5), 0 30px 80px -20px rgba(80,60,180,0.65);
        }
        .featured-badge {
          animation: ring-pulse-purple 2.2s ease-in-out infinite;
        }
        .featured-badge-green {
          animation: ring-pulse 2.2s ease-in-out infinite;
        }
      `}</style>

      <div className="flex-grow">
        {/* HERO */}
        <section className="relative flex flex-col items-center text-center px-6 pt-28 pb-20 overflow-hidden">
          <svg
            className="absolute inset-x-0 top-10 w-full max-w-4xl mx-auto opacity-40 pointer-events-none"
            viewBox="0 0 800 160"
            fill="none"
          >
            <path
              d="M20 120 C 180 20, 280 140, 420 60 S 640 20, 780 90"
              stroke="#3FA637"
              strokeWidth="1.5"
              className="route-line"
            />
            <circle cx="20" cy="120" r="4" fill="#E8B84B" />
            <circle cx="420" cy="60" r="4" fill="#3FA637" />
            <circle cx="780" cy="90" r="4" fill="#E8B84B" />
          </svg>

          <span className="eyebrow relative text-[11px] text-[#8FA391] mb-6">
            All Across India — On the Move
          </span>

          <h1
            className="relative text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] max-w-4xl"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "#F3F1EA" }}
          >
            Discover, Events & Delivery — Making a{" "}
            <em style={{ fontStyle: "italic", color: "#3FA637" }}>Difference</em>.
          </h1>

          <p className="relative text-[#92A395] mt-6 max-w-xl text-sm sm:text-base leading-relaxed">
            Mateng delivers parcels all across India, helps people
            discover great local businesses, and creates events that
            unite people — building community, joy, and healthy
            competition along the way.
          </p>

          <div className="relative flex flex-col sm:flex-row gap-4 mt-10">
            <Link href="/events">
              <button
                className="px-8 py-3 rounded-full font-semibold text-[#0B1410] transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: "#3FA637" }}
              >
                Explore Events →
              </button>
            </Link>

            <Link href="https://matengdelivery.com/">
              <button
                className="px-8 py-3 rounded-full font-semibold text-[#F3F1EA] border transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3FA637]/60"
                style={{ borderColor: "rgba(243,241,234,0.18)" }}
              >
                Book Delivery →
              </button>
            </Link>
          </div>
        </section>

        {/* EDUFEST TICKET BANNER */}
        <section className="w-full flex justify-center px-4 mt-6">
          <div
            className="event-card event-card-green relative w-full max-w-6xl rounded-3xl overflow-hidden flex flex-col md:flex-row"
            style={{ background: "linear-gradient(120deg, #17240F 0%, #0F550C 60%, #0B1410 100%)", animationDelay: "0.05s" }}
          >
            <div
              className="featured-badge-green absolute top-5 right-5 z-20 eyebrow text-[10px] px-3 py-1.5 rounded-full"
              style={{ background: "#3FA637", color: "#0B1410", fontWeight: 700 }}
            >
              ★ Featured
            </div>

            <div className="flex-1 px-8 sm:px-12 py-10 text-left">
              <span className="eyebrow text-[11px] text-[#E8B84B]">Registrations Open</span>

              <h2
                className="mt-3 text-3xl sm:text-4xl md:text-5xl leading-tight"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Mateng Education{" "}
                <em style={{ fontStyle: "italic", color: "#E8B84B" }}>Festival</em> 2026
              </h2>

              <p className="mt-4 text-[#D7E4D8] max-w-xl text-sm sm:text-base leading-relaxed">
                Enter the Mathematics Competition and put your problem-solving
                to the test — plus quiz, painting, and innovation tracks for
                every kind of student.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {["Quiz Competition", "Painting", "Young Innovators", "Mathematics"].map((tag) => (
                  <span
                    key={tag}
                    className="eyebrow px-3 py-1.5 rounded-full text-[10px] text-[#F3F1EA]"
                    style={{ background: "rgba(243,241,234,0.08)", border: "1px solid rgba(243,241,234,0.15)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/events/matengfest/edufest_registration">
                  <button
                    className="px-8 py-3 rounded-full font-bold text-[#0F550C] bg-white hover:bg-[#F3F1EA] hover:scale-[1.03] transition-all duration-200 text-sm"
                  >
                    Register Now →
                  </button>
                </Link>
                <Link href="/events/matengfest">
                  <button className="px-8 py-3 rounded-full font-semibold text-white border border-white/30 hover:border-white/70 hover:bg-white/10 transition-all duration-200 text-sm">
                    Learn More
                  </button>
                </Link>
              </div>
            </div>

            {/* Ticket stub */}
            <div
              className="relative md:w-48 flex md:flex-col items-center justify-center gap-3 py-6 md:py-0 border-t md:border-t-0 md:border-l border-dashed"
              style={{ borderColor: "rgba(243,241,234,0.25)" }}
            >
              <span
                className="eyebrow text-[10px] text-[#E8B84B] md:[writing-mode:vertical-rl]"
              >
                Admit One
              </span>
              <span className="tabular text-xs text-[#D7E4D8]">EDU·26</span>
            </div>
          </div>
        </section>

        {/* G15 FESTIVAL TICKET BANNER */}
        <section className="w-full flex justify-center px-4 mt-6">
          <div
            className="event-card event-card-purple relative w-full max-w-6xl rounded-3xl overflow-hidden"
            style={{ background: "#150C33", animationDelay: "0.15s" }}
          >
            {/* PHOTO HERO STRIP */}
            <div className="relative w-full h-48 sm:h-56 md:h-64">
              <Image
                src="/g15-festival.png"
                alt="G15 Festival — live crowd and stage lights"
                fill
                className="object-cover"
                priority={false}
              />
              {/* readability gradient over the photo */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(21,12,51,0.15) 0%, rgba(21,12,51,0.55) 65%, #150C33 100%)",
                }}
              />

              <div
                className="featured-badge absolute top-5 right-5 z-20 eyebrow text-[10px] px-3 py-1.5 rounded-full"
                style={{ background: "#50C273", color: "#0B1410", fontWeight: 700 }}
              >
                ★ Featured
              </div>

              <div className="absolute bottom-4 left-6 sm:left-10 flex items-center gap-2">
                <span
                  className="live-dot inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "#50C273" }}
                />
                <span
                  className="eyebrow text-[11px] text-[#F3F1EA] px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(0,0,0,0.35)" }}
                >
                  Booking Open · New Date Confirmed
                </span>
              </div>
            </div>

            {/* CONTENT */}
            <div className="relative flex flex-col md:flex-row">
              <div className="relative flex-1 px-8 sm:px-12 py-10 text-left">
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl leading-tight"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  G15{" "}
                  <em style={{ fontStyle: "italic", color: "#50C273" }}>Festival</em> 2026
                </h2>

                <p className="mt-4 text-[#E4DEF5] max-w-xl text-sm sm:text-base leading-relaxed">
                  Live music, food, and good energy — the ultimate vibe is
                  back. Now happening{" "}
                  <strong className="text-white">24th July 2026</strong>.
                </p>

                {/* LIMITED-TIME OFFER COUNTDOWN */}
                {offerActive && (
                  <div className="mt-5 inline-flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-400/20 flex-shrink-0">
                        <Timer className="h-3.5 w-3.5 text-amber-300" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-200 font-medium">
                          Limited-time price <span className="text-amber-300">₹349</span>{" "}
                          <span className="text-zinc-500 line-through">₹399</span>
                        </p>
                        <p className="text-[10px] text-zinc-400">Ends 12 July, midnight</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {[
                        { label: "D", value: timeLeft.days },
                        { label: "H", value: timeLeft.hours },
                        { label: "M", value: timeLeft.minutes },
                        { label: "S", value: timeLeft.seconds },
                      ].map((unit, i) => (
                        <div key={unit.label} className="flex items-center gap-1.5">
                          <div className="flex flex-col items-center justify-center bg-black/30 border border-amber-400/20 rounded-md h-10 w-10">
                            <span className="text-sm font-bold tabular-nums text-amber-300 leading-none">
                              {pad(unit.value)}
                            </span>
                            <span className="text-[8px] text-zinc-500 uppercase tracking-wide">{unit.label}</span>
                          </div>
                          {i < 3 && <span className="text-zinc-600 text-xs">:</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-2">
                  {["Live Music", "Food & Drinks", "Community"].map((tag) => (
                    <span
                      key={tag}
                      className="eyebrow px-3 py-1.5 rounded-full text-[10px] text-[#F3F1EA]"
                      style={{ background: "rgba(243,241,234,0.08)", border: "1px solid rgba(243,241,234,0.15)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link href="/events/g15-festival">
                    <button className="px-8 py-3 rounded-full font-bold text-[#2D1B69] bg-white hover:bg-[#F3F1EA] hover:scale-[1.03] transition-all duration-200 text-sm">
                      Book Your Pass →
                    </button>
                  </Link>
                  <Link href="/events/g15-festival">
                    <button className="px-8 py-3 rounded-full font-semibold text-white border border-white/30 hover:border-white/70 hover:bg-white/10 transition-all duration-200 text-sm">
                      Learn More
                    </button>
                  </Link>
                </div>
              </div>

              {/* Ticket stub */}
              <div
                className="relative md:w-48 flex md:flex-col items-center justify-center gap-3 py-6 md:py-0 border-t md:border-t-0 md:border-l border-dashed"
                style={{ borderColor: "rgba(243,241,234,0.25)" }}
              >
                <span className="eyebrow text-[10px] text-[#E2DE59] md:[writing-mode:vertical-rl]">
                  Admit One
                </span>
                <span className="tabular text-xs text-[#E4DEF5]">24 JUL</span>
              </div>
            </div>
          </div>
        </section>

        {/* NOTICE LINK */}
        <div className="w-full flex justify-center px-6 mt-8">
          <button
            onClick={() => router.push("/events/matengfest")}
            className="eyebrow text-[11px] text-[#8FA391] hover:text-[#3FA637] transition-colors duration-200 flex items-center gap-2"
          >
            Check Pre-Neet Examination Answer Key
            <span aria-hidden>→</span>
          </button>
        </div>

        {/* WHAT WE DO */}
        <section className="mt-24 px-6 flex flex-col items-center">
          <span className="eyebrow text-[11px] text-[#8FA391] mb-3">What We Do</span>
          <h2
            className="text-2xl sm:text-3xl mb-12"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Three ways we move Manipur
          </h2>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl w-full">
            {[
              {
                tag: "Discovery",
                title: "Events & Competitions",
                body: "Structured competitions and events helping students showcase their skills.",
                icon: (
                  <path d="M11 4a7 7 0 105.29 12.29l4.2 4.2 1.42-1.41-4.2-4.2A7 7 0 0011 4zm0 2a5 5 0 110 10 5 5 0 010-10z" />
                ),
              },
              {
                tag: "Local Business",
                title: "Business Discovery",
                body: "Helping local businesses become discoverable and connect with customers.",
                icon: (
                  <path d="M4 4h16v4l-1 1v11h-6v-6H11v6H5V9L4 8V4zm2 2v1.17L6.83 8H17.2l.8-1V6H6z" />
                ),
              },
              {
                tag: "Logistics",
                title: "Delivery",
                body: "Reliable hyperlocal delivery and porter services helping businesses move goods quickly.",
                icon: (
                  <path d="M3 6h11v7h2.5l2.5 3.5V17h1v2h-2a2 2 0 11-4 0H8a2 2 0 11-4 0H3V6zm2 2v7h.28a2 2 0 013.44 0H12V8H5zm10 4v2h2l-1.5-2H15z" />
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl p-8 text-left"
                style={{
                  background: "rgba(243,241,234,0.03)",
                  border: "1px dashed rgba(243,241,234,0.16)",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#3FA637" className="mb-4">
                  {item.icon}
                </svg>
                <span className="eyebrow text-[10px] text-[#E8B84B]">{item.tag}</span>
                <h3
                  className="text-lg mt-2"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  {item.title}
                </h3>
                <p className="text-[#92A395] text-sm mt-3 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DELIVERY CTA */}
        <section className="mt-24 px-6 flex justify-center">
          <div
            className="relative overflow-hidden p-10 sm:p-12 rounded-2xl text-center max-w-3xl w-full shadow-xl"
            style={{ background: "linear-gradient(120deg, #14710f, #0f550c)" }}
          >
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 400 140">
              <path d="M-10 100 C 100 40, 200 130, 410 50" stroke="#F3F1EA" strokeWidth="1.5" className="route-line" />
            </svg>

            <h2
              className="relative text-2xl sm:text-3xl"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Need something delivered?
            </h2>
            <p className="relative text-sm text-[#D7E4D8] mt-3">
              Book a fast, reliable local delivery with Mateng.
            </p>

            <Link href="https://matengdelivery.com/">
              <button className="relative mt-6 px-8 py-3 rounded-full bg-white text-[#14710f] font-semibold shadow-md hover:scale-[1.03] transition">
                Book Delivery
              </button>
            </Link>
          </div>
        </section>
      </div>

      {/* ENTRANCE EVENTS POPUP */}
      {showEventsPopup && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-[60] px-4"
          onClick={() => setShowEventsPopup(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: "#101B15",
              border: "1px solid rgba(243,241,234,0.12)",
              animation: "pop-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
            }}
          >
            <button
              onClick={() => setShowEventsPopup(false)}
              aria-label="Close"
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center text-[#F3F1EA] hover:bg-white/10 transition-colors"
              style={{ background: "rgba(0,0,0,0.35)" }}
            >
              ✕
            </button>

            <div className="px-7 pt-7 pb-2 text-center">
              <span className="eyebrow text-[10px] text-[#E8B84B]">Happening Soon</span>
              <h3
                className="text-xl sm:text-2xl mt-2"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "#F3F1EA" }}
              >
                Don&apos;t miss what&apos;s coming up
              </h3>
            </div>

            <div className="p-5 flex flex-col gap-3">
              {/* G15 event card */}
              <Link href="/events/g15-festival" onClick={() => setShowEventsPopup(false)}>
                <div
                  className="rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
                  style={{ background: "linear-gradient(120deg, #2D1B69, #4D3799)" }}
                >
                  <div className="flex-shrink-0 text-center w-14">
                    <p className="eyebrow text-[10px] text-[#E2DE59]">JUL</p>
                    <p className="text-2xl font-bold text-white leading-none">24</p>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-white text-sm">G15 Festival 2026</p>
                    <p className="text-xs text-[#E4DEF5] mt-0.5">
                      Live music, food & community — booking open
                    </p>
                  </div>
                  <span className="text-white text-lg">→</span>
                </div>
              </Link>

              {/* EduFest event card */}
              <Link href="/events/matengfest/edufest_registration" onClick={() => setShowEventsPopup(false)}>
                <div
                  className="rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
                  style={{ background: "linear-gradient(120deg, #17240F, #0F550C)" }}
                >
                  <div className="flex-shrink-0 text-center w-14">
                    <p className="eyebrow text-[10px] text-[#E8B84B]">EDU</p>
                    <p className="text-2xl font-bold text-white leading-none">26</p>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-white text-sm">Mateng Education Festival</p>
                    <p className="text-xs text-[#D7E4D8] mt-0.5">
                      Maths, quiz, painting & innovation — registrations open
                    </p>
                  </div>
                  <span className="text-white text-lg">→</span>
                </div>
              </Link>
            </div>

            <button
              onClick={() => setShowEventsPopup(false)}
              className="w-full py-3 text-xs eyebrow text-[#8FA391] hover:text-[#F3F1EA] transition-colors border-t"
              style={{ borderColor: "rgba(243,241,234,0.1)" }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div
            className="p-8 rounded-2xl max-w-md w-full text-center shadow-xl border border-dashed"
            style={{ background: "#101B15", borderColor: "rgba(243,241,234,0.2)" }}
          >
            <span className="eyebrow text-[10px] text-[#E8B84B]">Admit One</span>
            <h3
              className="text-xl mt-2"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Tickets coming soon
            </h3>
            <p className="text-[#92A395] mt-3 text-sm">
              Online ticket booking for this event will be available soon.
              Stay tuned for updates.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="mt-6 px-6 py-2 rounded-full text-white font-semibold"
              style={{ background: "#14710f" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* IMPACT — TICKET STUB ROW */}
      <section className="mt-24 flex flex-col items-center text-center px-6">
        <span className="eyebrow text-[11px] text-[#8FA391] mb-3">Our Impact</span>
        <h2
          className="text-2xl sm:text-3xl mb-10"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          On the road, every day
        </h2>

        <div
          className="stub-row flex flex-row justify-center gap-8 md:gap-16 rounded-2xl px-8 sm:px-14 py-8"
          style={{ background: "rgba(243,241,234,0.03)", border: "1px dashed rgba(243,241,234,0.16)" }}
        >
          <div>
            <p className="tabular text-2xl sm:text-3xl text-[#3FA637] font-semibold">
              {Math.floor(parcels)}K
            </p>
            <p className="text-[#92A395] text-xs mt-1">Parcels delivered</p>
          </div>

          <div>
            <p className="tabular text-2xl sm:text-3xl text-[#3FA637] font-semibold">
              {Math.floor(merchants)}+
            </p>
            <p className="text-[#92A395] text-xs mt-1">Merchants</p>
          </div>

          <div>
            <p className="tabular text-2xl sm:text-3xl text-[#3FA637] font-semibold">
              {Math.floor(businesses)}+
            </p>
            <p className="text-[#92A395] text-xs mt-1">Businesses discovered</p>
          </div>
        </div>
      </section>

      {/* TRUSTED PARTNERS */}
      <section className="mt-28 px-6 flex flex-col items-center">
        <div className="text-center mb-12">
          <span className="eyebrow text-[11px] text-[#E8B84B] mb-3 block">Our Network</span>
          <h2
            className="text-2xl sm:text-3xl mb-3"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Trusted Partners
          </h2>
          <p className="text-[#92A395] text-sm max-w-md mx-auto">
            Proudly working with 400+ local businesses across Imphal and Delhi
          </p>
        </div>

        <div className="relative w-full max-w-5xl">
          <button
            onClick={() => {
              const el = document.getElementById("partner-track");
              if (el) el.scrollBy({ left: -200, behavior: "smooth" });
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center text-[#F3F1EA] transition-all duration-200 shadow-lg backdrop-blur-sm -translate-x-1/2"
            style={{ background: "rgba(243,241,234,0.08)", border: "1px solid rgba(243,241,234,0.16)" }}
          >
            ‹
          </button>

          <button
            onClick={() => {
              const el = document.getElementById("partner-track");
              if (el) el.scrollBy({ left: 200, behavior: "smooth" });
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center text-[#F3F1EA] transition-all duration-200 shadow-lg backdrop-blur-sm translate-x-1/2"
            style={{ background: "rgba(243,241,234,0.08)", border: "1px solid rgba(243,241,234,0.16)" }}
          >
            ›
          </button>

          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0B1410] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0B1410] to-transparent z-10 pointer-events-none" />

          <div
            id="partner-track"
            className="flex gap-5 overflow-x-auto scroll-smooth px-8 pb-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <style>{`#partner-track::-webkit-scrollbar { display: none; }`}</style>

            {[...PARTNERS, ...PARTNERS].map((partner, i) => (
              <div
                key={i}
                className="flex-shrink-0 group relative w-40 h-24 rounded-2xl flex flex-col items-center justify-center px-5 gap-2 transition-all duration-300 cursor-pointer"
                style={{
                  background: "rgba(243,241,234,0.04)",
                  border: "1px dashed rgba(243,241,234,0.14)",
                }}
              >
                <div
                  className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"
                  style={{ background: "#3FA637" }}
                />
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="max-h-10 max-w-[75%] object-contain opacity-50 group-hover:opacity-100 grayscale group-hover:grayscale-0 transition-all duration-300"
                />
                <span className="eyebrow text-[10px] text-[#8FA391] group-hover:text-[#F3F1EA] truncate w-full text-center transition-all duration-300">
                  {partner.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="w-full mt-20">
        <Footer />
      </footer>
    </div>
  );
}