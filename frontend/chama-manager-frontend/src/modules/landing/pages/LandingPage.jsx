import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  Boxes,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileSearch,
  Gavel,
  HandCoins,
  HeartHandshake,
  KeyRound,
  Landmark,
  Link2,
  Megaphone,
  Menu,
  Receipt,
  RefreshCcw,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Truck,
  UserPlus,
  Users,
  Vote,
  X,
  WalletCards,
} from "lucide-react";

import BrandMark from "@/shared/components/layout/BrandMark";
import HeroSlider from "../components/HeroSlider";
import Magnetic from "../components/Magnetic";
import { prefersReducedMotion, useCountUp, useSmoothScroll } from "../hooks";
import "./landing.css";

/* ============================================================
   CONTENT
   Everything below describes what the product really does today
   (chamas, contribution groups, businesses, books, governance).
   The numbers inside the product mock-ups are labelled as sample
   data on purpose — no invented customer stats.
============================================================ */

const NAV = [
  { href: "#platform", label: "Platform" },
  { href: "#chamas", label: "Chamas" },
  { href: "#books", label: "Finance" },
  { href: "#business", label: "Business" },
  { href: "#trust", label: "Trust" },
];

const WORKSPACES = [
  {
    icon: Users,
    tag: "Chama",
    title: "Run your chama like an institution",
    text: "Members, contributions, merry-go-round rotation, loans with guarantors, savings share-out, meetings and a leadership desk for your officials.",
    points: ["Contribution plans per chama custom", "Loans, guarantors & approvals", "Burial & welfare cases"],
    tone: "emerald",
  },
  {
    icon: HandCoins,
    tag: "Contribution group",
    title: "Collections that follow up on their own",
    text: "Set the obligation once. Members get reminders, pay by M-Pesa, and every payment is matched to the right member and month.",
    points: ["Fixed, minimum or member-chosen amounts", "Grace periods & fines", "Month-by-month member view"],
    tone: "sky",
  },
  {
    icon: Store,
    tag: "Business",
    title: "The business behind the money",
    text: "Point of sale, inventory, suppliers, customers, expenses and a public storefront - with the books kept separate from chama funds.",
    points: ["POS with receipts, refunds & shifts", "Retail, restaurant, service & rentals", "Marketplace storefront"],
    tone: "violet",
  },
];

const CHAMA_FEATURES = [
  { icon: Users, title: "Member registry", text: "Roles, officials and a full membership history in one place." },
  { icon: WalletCards, title: "Contributions", text: "Dues, savings, welfare, targets and fines - each behaving the way your chama expects." },
  { icon: RefreshCcw, title: "Merry-go-round", text: "Rotation payouts scheduled and visible to every member." },
  { icon: Banknote, title: "Loans", text: "Applications, guarantor consent, approvals and repayment tracking." },
  { icon: HeartHandshake, title: "Welfare & burial", text: "Cases, fundraising, beneficiaries and equipment hire." },
  { icon: CalendarDays, title: "Meetings", text: "Schedule, record minutes and keep attendance." },
  { icon: Vote, title: "Polls", text: "Let members vote and keep the result on record." },
  { icon: Megaphone, title: "Announcements", text: "Reach every member without a noisy group chat." },
  { icon: Gavel, title: "Disputes", text: "Raise and resolve disagreements through a clear process." },
  { icon: BadgeCheck, title: "Trust score", text: "A transparent rating built from real payment behaviour." },
  { icon: Building2, title: "Assets", text: "Land, property and leases tracked with compliance nudges." },
  { icon: Sparkles, title: "AI assistant", text: "Ask questions about your chama and get insights and suggestions." },
];

const BOOKS = [
  { icon: BookOpenCheck, text: "Double-entry ledger and trial balance" },
  { icon: Receipt, text: "Income statement, balance sheet & cash flow" },
  { icon: Smartphone, text: "M-Pesa STK collections, matched automatically" },
  { icon: RefreshCcw, text: "Reconciliation sessions against bank and M-Pesa" },
  { icon: Landmark, text: "Bank accounts, payouts and adjustments with approval" },
];

const BUSINESS = [
  { icon: Receipt, title: "Point of sale", text: "Receipts, refunds and cashier shifts." },
  { icon: Boxes, title: "Inventory", text: "Stock levels that move with every sale." },
  { icon: Truck, title: "Suppliers", text: "Purchasing and supplier balances." },
  { icon: Users, title: "Customers", text: "Know who buys and what they owe." },
  { icon: Banknote, title: "Expenses & accounts", text: "Cash and M-Pesa accounts side by side." },
  { icon: Store, title: "Storefront", text: "A public page and marketplace listing." },
];

const TRUST = [
  { icon: Link2, title: "Tamper-evident audit trail", text: "Every financial action is chained to the one before it. Anyone can verify the chain has not been altered." },
  { icon: KeyRound, title: "PIN-protected leadership desk", text: "Sensitive officer actions sit behind a separate PIN, away from everyday member screens." },
  { icon: ShieldCheck, title: "Approvals, not shortcuts", text: "Large or sensitive changes go through an approval request and leave a record." },
  { icon: Scale, title: "Role-based access", text: "Chairperson, treasurer, secretary and members each see only what their role needs." },
  { icon: FileSearch, title: "Statements for everyone", text: "Members can see their own statement, so nobody has to take the treasurer's word for it." },
  { icon: BadgeCheck, title: "Verified workspaces", text: "New workspaces are reviewed before they go live." },
];

const STEPS = [
  { icon: UserPlus, title: "Create your account", text: "Sign up with your phone or email and verify with a one-time code." },
  { icon: Building2, title: "Request your workspace", text: "Tell us about your chama, group or business. We verify it and switch it on." },
  { icon: Users, title: "Invite your members", text: "Share an invitation or join code. Members join with one tap." },
  { icon: CheckCircle2, title: "Run it transparently", text: "Collect, lend, pay out and report - with every step on the record." },
];

const TONES = {
  emerald: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: "bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/30",
    tick: "text-emerald-600",
    glow: "bg-emerald-400/30",
    g: "linear-gradient(135deg,#34d399,#38bdf8)",
  },
  sky: {
    chip: "bg-sky-50 text-sky-700 ring-sky-200",
    icon: "bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30",
    tick: "text-sky-600",
    glow: "bg-sky-400/30",
    g: "linear-gradient(135deg,#38bdf8,#818cf8)",
  },
  violet: {
    chip: "bg-violet-50 text-violet-700 ring-violet-200",
    icon: "bg-gradient-to-br from-violet-400 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30",
    tick: "text-violet-600",
    glow: "bg-fuchsia-400/30",
    g: "linear-gradient(135deg,#a78bfa,#f472b6)",
  },
};

/* rotating accent set for icon tiles, spotlights and hover borders */
const ACCENTS = [
  { tile: "from-emerald-400 to-teal-500", shadow: "shadow-emerald-500/30", spot: "rgba(52,211,153,0.16)", glow: "rgba(52,211,153,0.55)", g: "linear-gradient(135deg,#34d399,#38bdf8)" },
  { tile: "from-sky-400 to-blue-500", shadow: "shadow-sky-500/30", spot: "rgba(56,189,248,0.16)", glow: "rgba(56,189,248,0.55)", g: "linear-gradient(135deg,#38bdf8,#818cf8)" },
  { tile: "from-amber-300 to-orange-500", shadow: "shadow-amber-500/30", spot: "rgba(251,191,36,0.16)", glow: "rgba(251,191,36,0.5)", g: "linear-gradient(135deg,#fbbf24,#f472b6)" },
  { tile: "from-pink-400 to-rose-500", shadow: "shadow-pink-500/30", spot: "rgba(244,114,182,0.16)", glow: "rgba(244,114,182,0.5)", g: "linear-gradient(135deg,#f472b6,#a78bfa)" },
  { tile: "from-violet-400 to-purple-500", shadow: "shadow-violet-500/30", spot: "rgba(167,139,250,0.16)", glow: "rgba(167,139,250,0.55)", g: "linear-gradient(135deg,#a78bfa,#38bdf8)" },
  { tile: "from-teal-300 to-cyan-500", shadow: "shadow-teal-500/30", spot: "rgba(45,212,191,0.16)", glow: "rgba(45,212,191,0.55)", g: "linear-gradient(135deg,#2dd4bf,#34d399)" },
];

const DOTS = ["bg-emerald-500", "bg-sky-500", "bg-amber-400", "bg-pink-500", "bg-violet-500"];
const CHAIN = [["#1", "9f3a…c1"], ["#2", "b72e…04"], ["#3", "5d1c…ae"], ["#4", "e08b…77"]];
const CTA_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 41 + 7) % 100,
  size: 3 + (i % 3) * 2,
  delay: (i * 0.7) % 7,
  duration: 8 + (i % 4) * 1.8,
  color: ["#6ee0b6", "#7dd3fc", "#fcd34d"][i % 3],
}));

/* ============================================================
   MOTION HELPERS
   Reveal fades/slides/pops an element in once it scrolls into
   view. Content is only hidden *after* the observer is attached,
   and reduced-motion users get everything immediately.
============================================================ */

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, seen];
}

function Reveal({ as: Tag = "div", variant = "up", delay = 0, className = "", children, ...rest }) {
  const [ref, seen] = useInView();
  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`lp-reveal lp-${variant} ${seen ? "is-in" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* Card with a soft spotlight that follows the cursor (and an optional gradient hover border via `g`). */
function SpotCard({ className = "", spot, g, glow, children }) {
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  const style = { ...(spot ? { "--spot": spot } : {}), ...(g ? { "--g": g } : {}), ...(glow ? { "--glow": glow } : {}) };
  return (
    <div onMouseMove={onMove} style={style} className={`lp-spot ${g ? "lp-gborder" : ""} ${className}`}>
      <div className="relative">{children}</div>
    </div>
  );
}

const MARQUEE = [
  "M-Pesa STK collections", "Double-entry ledger", "Merry-go-round rotations", "Loans & guarantors",
  "Savings share-out", "Burial & welfare cases", "Meetings & minutes", "Member polls",
  "Trust score", "Audit trail", "Bank reconciliation", "Business POS", "Inventory & suppliers", "Marketplace storefront",
];

/* ============================================================
   SMALL PIECES
============================================================ */

function Wordmark({ dark = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={36} title="" />
      <span
        className={`text-[1.15rem] font-black tracking-tight ${dark ? "text-white" : "text-slate-950"}`}
      >
        Veri<span className="text-emerald-500">Circle</span>
      </span>
    </span>
  );
}

function SectionHead({ eyebrow, title, highlight, text, center = false, dark = false }) {
  const parts = highlight && title.includes(highlight) ? title.split(highlight) : null;
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] ring-1 ${
          dark ? "bg-mint/10 text-mint ring-mint/25" : "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20"
        }`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="lp-ping absolute inset-0 rounded-full bg-current opacity-60" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
        </span>
        {eyebrow}
      </span>
      <h2
        className={`mt-4 text-3xl font-black leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl ${
          dark ? "text-white" : "text-slate-950"
        }`}
      >
        {parts ? (
          <>
            {parts[0]}
            <span className={`${dark ? "lp-shimmer" : "lp-shimmer-dark"} bg-clip-text text-transparent`}>{highlight}</span>
            {parts[1]}
          </>
        ) : (
          title
        )}
      </h2>
      {text && (
        <p className={`mt-4 text-base leading-relaxed sm:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}>
          {text}
        </p>
      )}
    </div>
  );
}

/* Ledger mock-up for the finance section. Rows fade in one by one, totals count up. */
function LedgerMock() {
  const [ref, seen] = useInView(0.3);
  const total = useCountUp(146000, seen, 1500);
  const lines = [
    ["Cash at bank (M-Pesa Paybill)", "96,000", ""],
    ["Member contributions - dues", "", "96,000"],
    ["Loan principal - disbursed", "50,000", ""],
    ["Cash at bank (M-Pesa Paybill)", "", "50,000"],
  ];
  return (
    <div ref={ref} className="relative">
      <div className="lp-orb -right-10 -top-10 h-64 w-64" style={{ "--c": "#34d399", "--o": 0.35 }} aria-hidden />
      <div className="lp-orb -bottom-12 -left-10 h-56 w-56" style={{ "--c": "#38bdf8", "--o": 0.3 }} aria-hidden />

      <div className="relative overflow-hidden rounded-3xl lp-glass border border-white/70 bg-white/60 shadow-2xl shadow-emerald-900/10">
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400" />
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ledger</p>
            <p className="text-base font-black text-slate-950">Journal entries</p>
          </div>
          <span
            className="lp-row inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"
            style={{ "--d": "900ms" }}
          >
            <CheckCircle2 size={12} /> Debits = Credits
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3 font-semibold">Account</th>
                <th className="px-3 py-3 text-right font-semibold">Debit</th>
                <th className="px-5 py-3 text-right font-semibold">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map(([acc, dr, cr], i) => (
                <tr key={i} className="lp-row transition-colors hover:bg-emerald-50/60" style={{ "--d": `${250 + i * 180}ms` }}>
                  <td className="px-5 py-3 font-medium text-slate-800">{acc}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{dr}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">{cr}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="lp-row bg-slate-50 font-black text-slate-950" style={{ "--d": "1000ms" }}>
                <td className="px-5 py-3 text-xs uppercase tracking-wider text-slate-500">Total</td>
                <td className="px-3 py-3 text-right tabular-nums">{total.toLocaleString("en-KE")}</td>
                <td className="px-5 py-3 text-right tabular-nums">{total.toLocaleString("en-KE")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-center text-[10px] uppercase tracking-widest text-slate-400">
          Sample data for illustration
        </p>
      </div>

      <Reveal variant="pop" delay={1100} className="absolute -bottom-5 -left-4 z-10 hidden sm:block">
        <div className="lp-float flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Smartphone size={15} />
          </span>
          <div>
            <p className="text-[11px] font-bold text-slate-900">Posted automatically</p>
            <p className="text-[10px] text-slate-500">from the M-Pesa payment</p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* ============================================================
   PAGE
============================================================ */

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Eased wheel scrolling + eased anchor jumps (desktop pointers only, off for reduced motion).
  useSmoothScroll();

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setScrolled(y > 8);
        setProgress(max > 0 ? Math.min(y / max, 1) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-slate-900 antialiased">
      <div className="lp-grain" aria-hidden />
      {/* ===================== HEADER ===================== */}
      <header
        className={`lp-header-in sticky top-0 z-40 border-b backdrop-blur-xl transition-all duration-300 ${
          scrolled ? "border-white/10 bg-obsidian/95 shadow-lg shadow-black/20" : "border-transparent bg-obsidian/70"
        }`}
      >
        {/* scroll progress */}
        <div
          className="absolute bottom-0 left-0 h-[2px] origin-left bg-gradient-to-r from-mint to-sky-300"
          style={{ width: `${progress * 100}%` }}
          aria-hidden
        />

        <div
          className={`mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 transition-all duration-300 sm:px-8 ${
            scrolled ? "h-14" : "h-16"
          }`}
        >
          <Link to="/" aria-label="VeriCircle home" className="transition hover:opacity-90">
            <Wordmark dark />
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Sections">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="lp-link text-sm font-medium text-mist-muted! transition-colors hover:text-white!"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="hidden rounded-full px-3 py-2 text-sm font-semibold text-mist! transition-colors hover:text-white! sm:inline-flex"
            >
              Log in
            </Link>
            <Magnetic strength={0.4}>
            <Link
              to="/register"
              className="rounded-full bg-mint px-4 py-2 text-sm font-bold text-obsidian! transition hover:-translate-y-0.5 hover:bg-mint-hover hover:shadow-lg hover:shadow-mint/25 sm:px-5"
            >
              Sign up
            </Link>
            </Magnetic>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-mist transition hover:bg-white/10 md:hidden"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* mobile menu — slides down */}
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out md:hidden ${
            menuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 pb-4 pt-1" aria-label="Mobile sections">
              {[...NAV, { href: "/login", label: "Log in", route: true }, { href: "/register", label: "Sign up", route: true }].map((item) =>
                item.route ? (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-3 py-3 text-base font-semibold text-mist! hover:bg-white/5"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-3 py-3 text-base font-semibold text-mist! hover:bg-white/5"
                  >
                    {item.label}
                  </a>
                )
              )}
            </nav>
          </div>
        </div>
      </header>

      <main>
        {/* ===================== HERO ===================== */}
        <HeroSlider />

        {/* ===================== MARQUEE ===================== */}
        <div className="space-y-3 border-b border-emerald-900/5 bg-[#e9f3ee] pb-7 pt-6">
          {[false, true].map((rev) => {
            const items = rev ? [...MARQUEE].reverse() : MARQUEE;
            return (
              <div key={String(rev)} className={`lp-marquee overflow-hidden ${rev ? "lp-marquee-rev" : ""}`} aria-hidden={rev} aria-label={rev ? undefined : "Capabilities"}>
                <div className="lp-marquee-track">
                  {[...items, ...items].map((t, i) => (
                    <span
                      key={i}
                      aria-hidden={i >= items.length}
                      className="mx-1.5 inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-emerald-900/5 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      <span className={`h-2 w-2 rounded-full ${DOTS[(i + (rev ? 2 : 0)) % DOTS.length]}`} />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ===================== PLATFORM ===================== */}
        <section id="platform" className="relative scroll-mt-16 overflow-hidden bg-[#e9f3ee] pb-32 pt-14 sm:pb-40 sm:pt-20">
          <div className="lp-dots" aria-hidden />
          <div className="lp-orb -right-40 top-10 h-[34rem] w-[34rem]" style={{ "--c": "#7dd3fc", "--o": 0.35 }} aria-hidden />
          <div className="lp-orb -left-40 bottom-0 h-[30rem] w-[30rem]" style={{ "--c": "#6ee0b6", "--o": 0.4 }} aria-hidden />
          <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal>
              <SectionHead
                eyebrow="One platform"
                title="Three kinds of workspace, one set of books."
                highlight="one set of books."
                text="Pick what you run. Each workspace gets only the tools it needs, so nobody wades through screens that do not apply to them."
              />
            </Reveal>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {WORKSPACES.map(({ icon: Icon, tag, title, text, points, tone }, i) => {
                const t = TONES[tone];
                return (
                  <Reveal key={tag} variant="popup" delay={i * 130}>
                    <article
                      style={{ "--g": t.g }}
                      className="lp-gborder group relative flex h-full flex-col overflow-hidden rounded-3xl lp-glass border border-white bg-white/40 p-7 shadow-lg shadow-emerald-900/5 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-900/15"
                    >
                      <div className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100 ${t.glow}`} aria-hidden />
                      <div className="relative flex items-center justify-between">
                        <span
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${t.icon}`}
                        >
                          <Icon size={22} />
                        </span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ring-1 ${t.chip}`}>{tag}</span>
                      </div>
                      <h3 className="relative mt-6 text-xl font-black tracking-tight text-slate-950">{title}</h3>
                      <p className="relative mt-3 text-sm leading-relaxed text-slate-600">{text}</p>
                      <ul className="relative mt-6 space-y-2.5 border-t border-slate-100 pt-5">
                        {points.map((p) => (
                          <li key={p} className="flex items-start gap-2.5 text-sm font-medium text-slate-700">
                            <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${t.tick}`} />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================== CHAMAS (dark) ===================== */}
        <section id="chamas" className="relative scroll-mt-16 overflow-hidden lp-sheet pt-24 pb-32 sm:pt-32 sm:pb-40 bg-obsidian">
          <div className="lp-dots-dark" aria-hidden />
          <div className="lp-orb -left-48 -top-24 h-[36rem] w-[36rem]" style={{ "--c": "#34d399", "--o": 0.28 }} aria-hidden />
          <div className="lp-orb -bottom-40 -right-40 h-[34rem] w-[34rem]" style={{ "--c": "#8b5cf6", "--o": 0.26 }} aria-hidden />
          <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal>
              <SectionHead
                dark
                eyebrow="For chamas"
                title="Everything a chama actually does, in one place."
                highlight="in one place."
                text="From the first contribution to the annual share-out, VeriCircle follows the way Kenyan chamas really run - including merry-go-rounds, welfare and officials."
              />
            </Reveal>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {CHAMA_FEATURES.map(({ icon: Icon, title, text }, i) => {
                const a = ACCENTS[i % ACCENTS.length];
                return (
                  <Reveal key={title} variant="pop" delay={(i % 4) * 90}>
                    <SpotCard
                      spot={a.spot}
                      g={a.g}
                      glow={a.glow}
                      className="lp-glass-dark group h-full rounded-2xl border border-white/10 p-5 transition-all duration-300 hover:-translate-y-1.5"
                    >
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 ${a.tile} ${a.shadow}`}
                      >
                        <Icon size={19} />
                      </span>
                      <h3 className="mt-4 font-black text-white">{title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{text}</p>
                    </SpotCard>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================== BOOKS ===================== */}
        <section id="books" className="relative scroll-mt-16 overflow-hidden lp-sheet pt-24 pb-32 sm:pt-32 sm:pb-40 bg-[#e9f3ee]">
          <div className="lp-dots" aria-hidden />
          <div className="lp-orb -left-32 top-0 h-[28rem] w-[28rem]" style={{ "--c": "#fcd34d", "--o": 0.28 }} aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
            <Reveal variant="left">
              <SectionHead
                eyebrow="Finance & books"
                title="Real accounting, without needing an accountant."
                highlight="without needing an accountant."
                text="Every shilling that comes in or goes out is posted to a double-entry ledger, so your reports are always backed by the books - not by someone's memory."
              />
              <ul className="mt-8 space-y-3">
                {BOOKS.map(({ icon: Icon, text }, i) => {
                  const a = ACCENTS[i % ACCENTS.length];
                  return (
                    <Reveal as="li" key={text} variant={i % 2 ? "right" : "left"} delay={200 + i * 100}>
                      <div className="lp-glass group flex items-center gap-4 rounded-2xl border border-white bg-white/50 p-3 shadow-sm transition-all duration-300 hover:translate-x-1 hover:shadow-md">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform duration-300 group-hover:scale-110 ${a.tile} ${a.shadow}`}>
                          <Icon size={18} />
                        </span>
                        <span className="font-semibold text-slate-800">{text}</span>
                      </div>
                    </Reveal>
                  );
                })}
              </ul>
            </Reveal>
            <Reveal variant="right" delay={150}>
              <LedgerMock />
            </Reveal>
          </div>
        </section>

        {/* ===================== BUSINESS ===================== */}
        <section id="business" className="relative scroll-mt-16 overflow-hidden lp-sheet pt-24 pb-32 sm:pt-32 sm:pb-40 bg-white">
          <div className="lp-dots" aria-hidden />
          <div className="lp-orb -right-40 -top-20 h-[32rem] w-[32rem]" style={{ "--c": "#c4b5fd", "--o": 0.4 }} aria-hidden />
          <div className="lp-orb -bottom-40 -left-32 h-[28rem] w-[28rem]" style={{ "--c": "#f9a8d4", "--o": 0.3 }} aria-hidden />
          <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal>
              <SectionHead
                eyebrow="For businesses"
                title="Your chama's business deserves better than a spreadsheet."
                highlight="better than a spreadsheet."
                text="Run retail, restaurants, services or rentals with tools matched to the kind of business you have - and keep the business money clearly separate from the group's."
              />
            </Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BUSINESS.map(({ icon: Icon, title, text }, i) => (
                <Reveal key={title} variant={i % 2 ? "right" : "left"} delay={(i % 3) * 100}>
                  <div
                    style={{ "--g": "linear-gradient(135deg,#a78bfa,#f472b6)" }}
                    className="lp-gborder group relative flex h-full items-start gap-4 rounded-2xl lp-glass border border-slate-200 bg-white/50 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-violet-900/10"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30 transition-all duration-300 group-hover:rotate-6 group-hover:scale-110">
                      <Icon size={20} />
                    </span>
                    <div>
                      <h3 className="font-black text-slate-950">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
                    </div>
                    <ArrowRight
                      size={16}
                      className="absolute right-4 top-4 -translate-x-2 text-violet-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== TRUST (dark) ===================== */}
        <section id="trust" className="relative scroll-mt-16 overflow-hidden lp-sheet pt-24 pb-32 sm:pt-32 sm:pb-40 bg-obsidian">
          <div className="lp-dots-dark" aria-hidden />
          <div className="lp-orb -right-32 -top-32 h-[34rem] w-[34rem]" style={{ "--c": "#6ee0b6", "--o": 0.3 }} aria-hidden />
          <div className="lp-orb -bottom-40 -left-32 h-[30rem] w-[30rem]" style={{ "--c": "#38bdf8", "--o": 0.22 }} aria-hidden />
          <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal>
              <SectionHead
                dark
                eyebrow="Trust & governance"
                title="Built so nobody has to take anyone's word for it."
                highlight="take anyone's word for it."
                text="Most chama disputes start with money nobody can account for. VeriCircle makes every action visible, attributable and checkable."
              />
            </Reveal>

            {/* illustration: a verified audit chain */}
            <Reveal className="mt-10" variant="zoom">
              <div className="flex items-center overflow-x-auto pb-2" aria-hidden>
                {CHAIN.map(([n, h], i) => (
                  <div key={n} className="flex shrink-0 items-center">
                    <div
                      className="lp-pulse lp-glass-dark rounded-xl border border-mint/30 px-4 py-2.5 font-mono text-[11px]"
                      style={{ animationDelay: `${i * 0.5}s` }}
                    >
                      <p className="font-bold text-mint">BLOCK {n}</p>
                      <p className="mt-0.5 text-slate-400">{h}</p>
                    </div>
                    <div className="lp-flow w-8 sm:w-14" />
                  </div>
                ))}
                <span className="lp-glow inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mint px-3.5 py-2 text-xs font-bold text-obsidian">
                  <CheckCircle2 size={14} /> Chain verified
                </span>
              </div>
            </Reveal>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {TRUST.map(({ icon: Icon, title, text }, i) => {
                const a = ACCENTS[i % ACCENTS.length];
                return (
                  <Reveal key={title} variant="popup" delay={(i % 3) * 110}>
                    <SpotCard
                      spot={a.spot}
                      g={a.g}
                      glow={a.glow}
                      className="lp-glass-dark group h-full rounded-2xl border border-white/10 p-6 transition-all duration-300 hover:-translate-y-1.5"
                    >
                      <span className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-all duration-300 group-hover:rotate-6 group-hover:scale-110 ${a.tile} ${a.shadow}`}>
                        <Icon size={20} />
                      </span>
                      <h3 className="mt-5 font-black text-white">{title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">{text}</p>
                    </SpotCard>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================== HOW IT WORKS ===================== */}
        <section className="relative overflow-hidden lp-sheet bg-[#e9f3ee] pt-24 pb-32 sm:pt-32 sm:pb-40">
          <div className="lp-dots" aria-hidden />
          <div className="lp-orb left-1/2 top-0 h-[30rem] w-[30rem] -translate-x-1/2" style={{ "--c": "#7dd3fc", "--o": 0.3 }} aria-hidden />
          <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal>
              <SectionHead center eyebrow="Getting started" title="From sign-up to first contribution." highlight="first contribution." />
            </Reveal>
            <ol className="relative mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div
                className="lp-flow pointer-events-none absolute left-[12%] right-[12%] top-[3.1rem] hidden lg:block"
                aria-hidden
              />
              {STEPS.map(({ icon: Icon, title, text }, i) => {
                const a = ACCENTS[i % ACCENTS.length];
                return (
                  <Reveal as="li" key={title} variant="pop" delay={i * 150} className="relative">
                    <div
                      style={{ "--g": a.g }}
                      className="lp-gborder group relative h-full overflow-hidden rounded-2xl lp-glass border border-white bg-white/50 p-6 shadow-md shadow-emerald-900/5 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                    >
                      <span className="absolute right-4 top-2 bg-gradient-to-b from-slate-300/70 to-transparent bg-clip-text text-6xl font-black text-transparent transition-all duration-300 group-hover:from-emerald-400/60">
                        {i + 1}
                      </span>
                      <span className={`relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${a.tile} ${a.shadow}`}>
                        <Icon size={20} />
                      </span>
                      <h3 className="relative mt-5 font-black text-slate-950">{title}</h3>
                      <p className="relative mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
                    </div>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ===================== CTA ===================== */}
        <section className="relative overflow-hidden lp-sheet bg-white pt-24 pb-32 sm:pt-28 sm:pb-40">
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <Reveal variant="pop">
              <div className="relative overflow-hidden rounded-[2rem] bg-obsidian px-6 py-16 text-center shadow-2xl shadow-emerald-900/20 sm:px-14">
                <div className="lp-dots-dark" aria-hidden />
                <div className="lp-orb -top-32 left-1/2 h-96 w-96 -translate-x-1/2" style={{ "--c": "#34d399", "--o": 0.45 }} aria-hidden />
                <div className="lp-orb -bottom-32 -left-24 h-80 w-80" style={{ "--c": "#38bdf8", "--o": 0.3 }} aria-hidden />
                <div className="lp-orb -bottom-24 -right-24 h-80 w-80" style={{ "--c": "#f472b6", "--o": 0.28 }} aria-hidden />
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                  {CTA_PARTICLES.map((p, i) => (
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
                <div className="relative">
                  <div className="lp-float mx-auto w-fit">
                    <BrandMark size={56} title="" />
                  </div>
                  <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-black leading-[1.1] tracking-tight text-white sm:text-5xl">
                    Bring your group into one{" "}
                    <span className="lp-shimmer bg-clip-text text-transparent">trusted workspace.</span>
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-base text-slate-300 sm:text-lg">
                    Create your account, request your workspace, and start collecting the right way.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Magnetic strength={0.4}>
                      <Link
                        to="/register"
                        className="lp-glow lp-shine group inline-flex items-center gap-2 rounded-full bg-mint px-8 py-4 text-sm font-bold text-obsidian! transition hover:-translate-y-0.5 hover:bg-mint-hover"
                      >
                        Create your account
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Magnetic>
                    <Magnetic strength={0.4}>
                      <Link
                        to="/login"
                        className="inline-flex rounded-full border border-white/20 bg-white/10 px-8 py-4 text-sm font-bold text-white! backdrop-blur transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15"
                      >
                        Sign in
                      </Link>
                    </Magnetic>
                  </div>
                  <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-300">
                    {["M-Pesa ready", "Verified workspaces", "Every action on the record"].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-mint" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <footer className="lp-sheet relative overflow-hidden bg-obsidian">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mint/60 to-transparent" aria-hidden />
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-5 pb-10 pt-14 sm:flex-row sm:px-8">
          <Wordmark dark />
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-slate-400" aria-label="Footer">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="lp-link transition-colors hover:text-white!">
                {item.label}
              </a>
            ))}
            <Link to="/login" className="lp-link transition-colors hover:text-white!">Log in</Link>
            <Link to="/register" className="lp-link transition-colors hover:text-white!">Sign up</Link>
          </nav>
          <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} VeriCircle. Trust · Connect · Grow</p>
        </div>
      </footer>
    </div>
  );
}