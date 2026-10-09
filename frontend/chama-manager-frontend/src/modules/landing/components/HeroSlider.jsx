import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Link2, Smartphone, Store, Users } from "lucide-react";

import { SceneBusiness, SceneChama, SceneCollections, SceneTrust } from "./HeroScenes";
import { BusinessCard, ChamaCard, CollectionsCard, TrustCard } from "./HeroCards";
import { prefersReducedMotion } from "../hooks";
import Magnetic from "./Magnetic";

/* ============================================================
   HERO SLIDER
   Four slides, each with its own scene, headline, points and
   product card. Backgrounds slide across one after another;
   the text re-animates in on every change. Autoplay is driven by
   the progress bar's CSS animation (.lp-progress in landing.css, 3s
   per slide) so the bar and the timing can never drift apart; it
   pauses on hover/focus. With reduced
   motion on, autoplay is off and the arrows/dots still work.

   Want real photography? Put images at the `photo` paths below
   (inside /public/landing). They are layered over the scene
   automatically; if a file is missing the illustrated scene
   simply stays.
============================================================ */

const SLIDES = [
  {
    key: "chama",
    accent: ["#34d399", "#fbbf24"],
    label: "Chamas",
    icon: Users,
    eyebrow: "For chamas & groups",
    title: ["Money your group can", "see, verify and trust."],
    text: "VeriCircle replaces notebooks, spreadsheets and WhatsApp tallies with one workspace: contributions, loans, rotations and a clear record every member can check.",
    points: ["Contribution plans per chama custom", "Loans, guarantors & share-out", "Welfare and burial cases"],
    Scene: SceneChama,
    Card: ChamaCard,
    photo: "/landing/hero-chama.jpg",
  },
  {
    key: "collections",
    accent: ["#38bdf8", "#34d399"],
    label: "Collections",
    icon: Smartphone,
    eyebrow: "Contributions & M-Pesa",
    title: ["Collections that", "reconcile themselves."],
    text: "Members pay with an M-Pesa STK push. Each payment is matched to the right member, plan and month, then posted to the ledger - no more screenshots of messages.",
    points: ["One-tap STK push payments", "Auto-matched to member and month", "Reminders and fines handled"],
    Scene: SceneCollections,
    Card: CollectionsCard,
    photo: "/landing/hero-collections.jpg",
  },
  {
    key: "business",
    accent: ["#f472b6", "#fbbf24"],
    label: "Business",
    icon: Store,
    eyebrow: "Chama-owned businesses",
    title: ["The business behind", "the money, handled."],
    text: "Run your shop, restaurant or rentals with point of sale, inventory and suppliers - with business funds kept clearly separate from the group's.",
    points: ["POS with receipts, refunds & shifts", "Live stock levels", "Storefront & marketplace listing"],
    Scene: SceneBusiness,
    Card: BusinessCard,
    photo: "/landing/hero-business.jpg",
  },
  {
    key: "trust",
    accent: ["#a78bfa", "#34d399"],
    label: "Trust",
    icon: Link2,
    eyebrow: "Trust & governance",
    title: ["Every action leaves", "a trace anyone can check."],
    text: "Approvals, role-based access and a tamper-evident audit chain mean the treasurer's word is never the only proof.",
    points: ["Chained audit trail", "PIN-protected leadership desk", "Statements for every member"],
    Scene: SceneTrust,
    Card: TrustCard,
    photo: "/landing/hero-trust.jpg",
  },
];

const N = SLIDES.length;

const PARTICLE_COLORS = ["#6ee0b6", "#7dd3fc", "#fcd34d"];
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 3 + (i % 4) * 2,
  delay: (i * 0.55) % 6,
  duration: 7 + (i % 5) * 1.6,
  color: PARTICLE_COLORS[i % 3],
}));

export default function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const sectionRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /* mouse parallax: writes --px / --py (-1..1) on the section */
  const onPointerMove = (e) => {
    if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const el = sectionRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.setProperty("--px", nx.toFixed(3));
      el.style.setProperty("--py", ny.toFixed(3));
    });
  };
  const resetPointer = () => {
    cancelAnimationFrame(rafRef.current);
    const el = sectionRef.current;
    if (!el) return;
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  };

  const go = useCallback((i) => setIndex(((i % N) + N) % N), []);
  const next = useCallback(() => setIndex((i) => (i + 1) % N), []);
  const prev = useCallback(() => setIndex((i) => (i - 1 + N) % N), []);

  const stateOf = (i) => {
    const off = (i - index + N) % N;
    return off === 0 ? "is-active" : off === N - 1 ? "is-prev" : "is-next";
  };

  return (
    <section
      ref={sectionRef}
      className="lp-hero relative overflow-hidden bg-obsidian"
      aria-roledescription="carousel"
      aria-label="VeriCircle highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        resetPointer();
      }}
      onPointerMove={onPointerMove}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
      }}
    >
      {/* ---------- backgrounds: wipe in one after another ---------- */}
      <div className="absolute inset-0 isolate" aria-hidden>
        {SLIDES.map(({ key, Scene, photo, accent }, i) => {
          const st = stateOf(i);
          return (
            <div key={key} className={`lp-bg ${st}`}>
              <div className="lp-parallax">
                <div className="lp-vivid h-full w-full">
                  <Scene />
                  <img
                    src={photo}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </div>
              {/* colour washes in this slide's accent colours */}
              <div className="lp-aurora lp-aurora-a" style={{ "--c": accent[0] }} />
              <div className="lp-aurora lp-aurora-b" style={{ "--c": accent[1] }} />
            </div>
          );
        })}

        {/* rising glow particles */}
        <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="lp-particle"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                background: p.color,
                boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>

        {/* keep the left side calm for text (lighter than before so the colour shows), blend into the next section */}
        <div className="absolute inset-0 z-[4] bg-gradient-to-r from-obsidian via-obsidian/55 to-transparent lg:via-obsidian/40" />
        <div className="absolute inset-0 z-[4] bg-gradient-to-b from-obsidian/50 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-[4] h-14 bg-gradient-to-b from-transparent to-[#e9f3ee]" />

        {/* light sweep on every slide change (re-mounts via key) */}
        <div key={index} className="lp-sweep pointer-events-none absolute inset-0 z-[5] overflow-hidden" />
      </div>

      {/* ---------- content ---------- */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pb-16 pt-8 sm:px-8 lg:pt-10">
        <div className="grid">
          {SLIDES.map((s, i) => {
            const st = stateOf(i);
            const active = st === "is-active";
            const rise = (d) => ({ className: active ? "lp-rise" : "opacity-0", style: { "--d": `${d}ms` } });
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className={`lp-slide ${st} grid items-center gap-8 [grid-area:1/1] lg:grid-cols-[1.05fr_0.95fr] lg:gap-12`}
                aria-hidden={!active}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${N}: ${s.label}`}
              >
                <div>
                  <span
                    {...rise(60)}
                    className={`${rise(0).className} inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint/15 px-3.5 py-1.5 text-xs font-semibold text-mint backdrop-blur`}
                  >
                    <Icon size={14} />
                    {s.eyebrow}
                  </span>

                  <h1 className="lp-title mt-4 font-black leading-[1.05] tracking-tight text-white sm:mt-5">
                    <span className="block">
                      {s.title[0].split(" ").map((w, k) => (
                        <span key={k} className="lp-word-mask mr-[0.26em]">
                          <span className="lp-word" style={{ "--d": `${120 + k * 60}ms` }}>
                            {w}
                          </span>
                        </span>
                      ))}
                    </span>
                    <span className="lp-wipe block" style={{ "--d": "300ms" }}>
                      <span className="lp-shimmer bg-clip-text pb-1 text-transparent">{s.title[1]}</span>
                    </span>
                  </h1>

                  <p {...rise(380)} className={`${rise(0).className} mt-4 max-w-xl text-[0.95rem] leading-relaxed text-slate-200 sm:text-base xl:text-lg`}>
                    {s.text}
                  </p>

                  <div {...rise(480)} className={`${rise(0).className} mt-6 flex flex-wrap items-center gap-3`}>
                    <Magnetic strength={0.4}>
                    <Link
                      to="/register"
                      tabIndex={active ? 0 : -1}
                      className="lp-glow lp-shine group inline-flex items-center gap-2 rounded-full bg-mint px-7 py-3.5 text-sm font-bold text-obsidian! transition hover:-translate-y-0.5 hover:bg-mint-hover"
                    >
                      Get started free
                      <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                    </Magnetic>
                    <Magnetic strength={0.4}>
                    <Link
                      to="/login"
                      tabIndex={active ? 0 : -1}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-bold text-white! backdrop-blur transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15"
                    >
                      Sign in to your workspace
                    </Link>
                    </Magnetic>
                  </div>

                  <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-200">
                    {s.points.map((p, k) => (
                      <li key={p} {...rise(560 + k * 70)} className={`${rise(0).className} flex items-center gap-2`}>
                        <CheckCircle2 size={16} className="text-mint" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="lp-card-fit mx-auto mt-5 block w-full max-w-[420px] lg:mt-0 lg:max-w-none">
                  <div className="lp-card-in" style={{ "--d": "250ms" }}>
                    <div className="lp-tilt">
                      <div className="lp-float-slow">
                        <s.Card active={active} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------- controls ---------- */}
        <div className="mt-6 flex items-center gap-4 lg:mt-8">
          <div className="flex max-w-xl flex-1 gap-2 sm:gap-3">
            {SLIDES.map((s, i) => {
              const current = i === index;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show slide ${i + 1}: ${s.label}`}
                  aria-current={current}
                  className="group flex-1 text-left"
                >
                  <span className="block h-1 overflow-hidden rounded-full bg-white/20 transition-colors group-hover:bg-white/30">
                    <span
                      className={`block h-full rounded-full bg-mint ${current ? "lp-progress" : i < index ? "w-full" : "w-0"}`}
                      style={{ animationPlayState: paused ? "paused" : "running" }}
                      onAnimationEnd={next}
                    />
                  </span>
                  <span
                    className={`mt-2 hidden text-xs font-semibold transition-colors sm:block ${
                      current ? "text-white" : "text-mist-muted group-hover:text-mist"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          <span key={index} className="lp-pop-in hidden text-xs font-bold tabular-nums tracking-widest text-white/70 sm:block">
            {String(index + 1).padStart(2, "0")} <span className="text-white/35">/ {String(N).padStart(2, "0")}</span>
          </span>

          <div className="flex gap-2">
            <Magnetic strength={0.5} radius={50}>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous slide"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:scale-105 hover:bg-white/20"
            >
              <ChevronLeft size={18} />
            </button>
            </Magnetic>
            <Magnetic strength={0.5} radius={50}>
            <button
              type="button"
              onClick={next}
              aria-label="Next slide"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:scale-105 hover:bg-white/20"
            >
              <ChevronRight size={18} />
            </button>
            </Magnetic>
          </div>
        </div>
      </div>
    </section>
  );
}
