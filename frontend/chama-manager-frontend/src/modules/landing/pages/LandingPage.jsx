
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Landmark,
  ShieldCheck,
  Sparkles,
  Store,
  ShoppingCart,
  Package,
  BadgeDollarSign,
  CheckCircle2,
  Users,
  WalletCards,
  BarChart3,
  Receipt,
  CreditCard,
  HandCoins,
  Building2,
  FileCheck2,
  TrendingUp,
  CircleDollarSign,
  LockKeyhole,
  Zap,
  Boxes,
  Banknote,
} from "lucide-react";

const heroSlides = [
  {
    highlight: "for communities and businesses.",
    sub: "Bring your Chama, SACCO, and SME enterprise into one workspace with automated sales, inventory tracking, and M-Pesa clearing.",
  },
  {
    highlight: "for modern financial scale.",
    sub: "Manage professional customer invoices, supplier ledgers, and expense tracking with audited double-entry bookkeeping.",
  },
  {
    highlight: "for collective wealth growth.",
    sub: "Automate revolving payouts, transparent member registries, and secure instant STK collections with absolute clarity.",
  },
];

const modules = [
  {
    label: "CHAMAS",
    title: "Collective finance, without the confusion.",
    description:
      "Run your Chama with transparent member management, contributions, payouts, meetings, and a complete financial history.",
    icon: Users,
    color: "blue",
    stats: [
      "Member registry",
      "Contribution tracking",
      "Payout management",
      "Treasury visibility",
    ],
  },
  {
    label: "CONTRIBUTION GROUPS",
    title: "Turn contributions into an automated system.",
    description:
      "Create structured contribution groups with rules, obligations, payment tracking, reminders, penalties, and real-time reconciliation.",
    icon: HandCoins,
    color: "emerald",
    stats: [
      "Contribution plans",
      "Payment obligations",
      "Automated reminders",
      "M-Pesa reconciliation",
    ],
  },
  {
    label: "BUSINESS MANAGEMENT",
    title: "Run the business behind the money.",
    description:
      "Manage customers, suppliers, products, sales, inventory, expenses, invoices, and business cash flow from the same workspace.",
    icon: Store,
    color: "violet",
    stats: [
      "Sales & invoices",
      "Inventory control",
      "Supplier management",
      "Business analytics",
    ],
  },
];

const trustBadges = [
  {
    icon: ShieldCheck,
    title: "Auditable finance",
    text: "Every financial movement leaves a trace.",
  },
  {
    icon: LockKeyhole,
    title: "Secure by design",
    text: "Built around controlled financial workflows.",
  },
  {
    icon: Zap,
    title: "Real-time operations",
    text: "See your financial position as it changes.",
  },
  {
    icon: FileCheck2,
    title: "Double-entry ledger",
    text: "Professional accounting at the core.",
  },
];

export default function LandingPage() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex(
        (prevIndex) => (prevIndex + 1) % heroSlides.length
      );
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-white text-slate-900">

      {/* ==================== BACKGROUND ==================== */}

      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 opacity-40 bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:48px_48px]" />

        <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-blue-100/40 blur-3xl" />

        <div className="absolute right-[-200px] top-[500px] h-[450px] w-[450px] rounded-full bg-violet-100/50 blur-3xl" />

        <div className="absolute left-[-200px] top-[900px] h-[400px] w-[400px] rounded-full bg-emerald-100/40 blur-3xl" />
      </div>

      {/* ==================== HEADER ==================== */}

      <header className="relative z-30 mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-10">
        <Link to="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg transition duration-300 group-hover:scale-105 group-hover:rotate-1">
            <Landmark size={20} />
          </div>

          <span className="text-xl font-black tracking-tight text-slate-950">
            VeriCircle
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            Log in
          </Link>

          <Link
            to="/register"
            className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* ==================== HERO ==================== */}

      <main className="relative z-10">

        <section className="mx-auto max-w-7xl px-6 pb-24 pt-16 sm:px-10 lg:pb-32 lg:pt-24">

          <div className="max-w-5xl">

            {/* Badge */}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 shadow-sm"
            >
              <Sparkles size={14} />
              Next-Gen Operating System for Chamas, SACCOs & SMEs
            </motion.div>

            {/* Hero */}

            <div className="min-h-[240px] sm:min-h-[220px]">

              <AnimatePresence mode="wait">

                <motion.div
                  key={currentSlideIndex}
                  initial={{
                    opacity: 0,
                    y: 25,
                    filter: "blur(6px)",
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                  }}
                  exit={{
                    opacity: 0,
                    y: -25,
                    filter: "blur(6px)",
                  }}
                  transition={{
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >

                  <h1 className="text-5xl font-black leading-[1.03] tracking-tight text-slate-950 sm:text-7xl lg:text-8xl">

                    The financial system

                    <br />

                    <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-500 bg-clip-text font-black text-transparent">
                      {heroSlides[currentSlideIndex].highlight}
                    </span>

                  </h1>

                  <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
                    {heroSlides[currentSlideIndex].sub}
                  </p>

                </motion.div>

              </AnimatePresence>

            </div>

            {/* CTA */}

            <div className="mt-10 flex flex-wrap items-center gap-4">

              <Link
                to="/register"
                className="flex items-center gap-2 rounded-full bg-slate-950 px-7 py-4 text-sm font-bold text-white shadow-xl shadow-slate-950/15 transition hover:-translate-y-1 hover:bg-slate-800"
              >
                Get started free
                <ArrowRight size={16} />
              </Link>

              <Link
                to="/login"
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
              >
                Sign in to workspace
              </Link>

            </div>

            {/* Hero benefits */}

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs font-mono text-slate-500">

              <span className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600" />
                Automated M-Pesa STK
              </span>

              <span className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-blue-600" />
                Double-Entry Ledger
              </span>

              <span className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-violet-600" />
                Business Management
              </span>

            </div>

          </div>

          {/* ==================== DASHBOARD PREVIEW ==================== */}

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.3,
              ease: "easeOut",
            }}
            className="relative mt-20 overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 p-5 shadow-2xl shadow-slate-300/30 sm:p-8 lg:p-10"
          >

            <div className="absolute left-12 right-12 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

            <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">

              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400">
                  WORKSPACE OVERVIEW
                </span>

                <h3 className="mt-1 text-2xl font-black text-slate-950">
                  Nairobi Enterprise & Chama Hub
                </h3>
              </div>

              <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Live Ledger Active
              </div>

            </div>

            <div className="grid gap-5 md:grid-cols-3">

              {/* Sales */}

              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between text-blue-600">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Sales Revenue
                  </span>
                  <ShoppingCart size={19} />
                </div>

                <p className="text-3xl font-black tracking-tight text-slate-950">
                  KES 148,500
                </p>

                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <TrendingUp size={13} />
                  +18.4% from yesterday
                </p>
              </div>

              {/* Inventory */}

              <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between text-violet-600">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Inventory Health
                  </span>
                  <Package size={19} />
                </div>

                <p className="text-3xl font-black tracking-tight text-slate-950">
                  98.4%
                </p>

                <p className="mt-2 text-xs font-medium text-slate-500">
                  All stock SKUs balanced
                </p>
              </div>

              {/* Treasury */}

              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between text-emerald-600">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Chama Treasury
                  </span>
                  <BadgeDollarSign size={19} />
                </div>

                <p className="text-3xl font-black tracking-tight text-slate-950">
                  KES 2.4M
                </p>

                <p className="mt-2 text-xs font-medium text-slate-500">
                  Automatic STK reconciliation
                </p>
              </div>

            </div>

          </motion.div>

        </section>

        {/* ==================== TRUST STRIP ==================== */}

        <section className="border-y border-slate-200 bg-slate-50/80">

          <div className="mx-auto grid max-w-7xl gap-px bg-slate-200 px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-10">

            {trustBadges.map((badge, index) => {

              const Icon = badge.icon;

              return (
                <motion.div
                  key={badge.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="bg-slate-50 px-6 py-8"
                >

                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                    <Icon size={19} />
                  </div>

                  <h4 className="font-bold text-slate-950">
                    {badge.title}
                  </h4>

                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {badge.text}
                  </p>

                </motion.div>
              );

            })}

          </div>

        </section>

        {/* ==================== CORE MODULES ==================== */}

        <section className="mx-auto max-w-7xl px-6 py-28 sm:px-10">

          <div className="max-w-3xl">

            <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              ONE PLATFORM
            </span>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              Everything your financial ecosystem needs.
            </h2>

            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              VeriCircle connects community finance and business operations
              inside one structured workspace — giving you visibility from
              the first contribution to the final transaction.
            </p>

          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">

            {modules.map((module, index) => {

              const Icon = module.icon;

              const colorClasses = {
                blue: {
                  wrapper:
                    "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white",
                  icon: "bg-blue-600 text-white shadow-blue-200",
                  badge: "bg-blue-100 text-blue-700 border-blue-200",
                  check: "text-blue-600",
                },
                emerald: {
                  wrapper:
                    "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white",
                  icon: "bg-emerald-600 text-white shadow-emerald-200",
                  badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
                  check: "text-emerald-600",
                },
                violet: {
                  wrapper:
                    "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-white",
                  icon: "bg-violet-600 text-white shadow-violet-200",
                  badge: "bg-violet-100 text-violet-700 border-violet-200",
                  check: "text-violet-600",
                },
              };

              const styles = colorClasses[module.color];

              return (
                <motion.div
                  key={module.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.1,
                  }}
                  whileHover={{ y: -6 }}
                  className={`rounded-3xl border p-8 shadow-sm transition-shadow hover:shadow-xl ${styles.wrapper}`}
                >

                  <div className="flex items-start justify-between">

                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ${styles.icon}`}
                    >
                      <Icon size={25} />
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-widest ${styles.badge}`}
                    >
                      {module.label}
                    </span>

                  </div>

                  <h3 className="mt-8 text-2xl font-black tracking-tight text-slate-950">
                    {module.title}
                  </h3>

                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    {module.description}
                  </p>

                  <div className="mt-7 space-y-3 border-t border-slate-200/70 pt-6">

                    {module.stats.map((stat) => (
                      <div
                        key={stat}
                        className="flex items-center gap-2 text-sm font-medium text-slate-700"
                      >
                        <CheckCircle2
                          size={16}
                          className={styles.check}
                        />
                        {stat}
                      </div>
                    ))}

                  </div>

                  <div className="mt-8 flex items-center gap-2 text-sm font-bold text-slate-950">
                    Explore module
                    <ArrowRight size={15} />
                  </div>

                </motion.div>
              );

            })}

          </div>

        </section>

        {/* ==================== CONTRIBUTION GROUP FEATURE ==================== */}

        <section className="relative overflow-hidden border-y border-emerald-100 bg-emerald-50/50">

          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 py-24 sm:px-10 lg:grid-cols-2">

            <div>

              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
                <HandCoins size={14} />
                CONTRIBUTION ENGINE
              </span>

              <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Contributions that run themselves.
              </h2>

              <p className="mt-6 text-lg leading-relaxed text-slate-600">
                Define the rules once. VeriCircle handles contribution
                obligations, payment records, reconciliation, penalties,
                reminders, and financial posting.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">

                {[
                  ["Contribution plans", WalletCards],
                  ["Member obligations", Users],
                  ["Payment tracking", CreditCard],
                  ["Automatic reconciliation", CircleDollarSign],
                ].map(([text, Icon]) => (

                  <div
                    key={text}
                    className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm"
                  >
                    <Icon size={18} className="text-emerald-600" />
                    <span className="text-sm font-bold text-slate-800">
                      {text}
                    </span>
                  </div>

                ))}

              </div>

            </div>

            {/* Contribution visual */}

            <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-2xl shadow-emerald-900/10">

              <div className="flex items-center justify-between border-b border-slate-100 pb-5">

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    CONTRIBUTION GROUP
                  </p>

                  <h3 className="mt-1 text-xl font-black text-slate-950">
                    Wealth Builders 2026
                  </h3>
                </div>

                <div className="rounded-xl bg-emerald-100 p-3 text-emerald-600">
                  <HandCoins size={20} />
                </div>

              </div>

              <div className="py-6">

                <div className="flex items-end justify-between">

                  <div>
                    <p className="text-xs text-slate-500">
                      Collected this cycle
                    </p>

                    <p className="mt-1 text-3xl font-black text-slate-950">
                      KES 184,000
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    92% complete
                  </span>

                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">

                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "92%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1 }}
                    className="h-full rounded-full bg-emerald-500"
                  />

                </div>

              </div>

              <div className="grid grid-cols-3 gap-3">

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">Members</p>
                  <p className="mt-1 text-xl font-black">48</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">Paid</p>
                  <p className="mt-1 text-xl font-black">44</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">Pending</p>
                  <p className="mt-1 text-xl font-black">4</p>
                </div>

              </div>

            </div>

          </div>

        </section>

        {/* ==================== BUSINESS MANAGEMENT ==================== */}

        <section className="mx-auto max-w-7xl px-6 py-28 sm:px-10">

          <div className="grid items-center gap-16 lg:grid-cols-2">

            {/* Dashboard visual */}

            <div className="order-2 rounded-3xl border border-violet-200 bg-violet-50/50 p-6 shadow-xl lg:order-1">

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                <div className="flex items-center justify-between border-b border-slate-100 pb-5">

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      BUSINESS OVERVIEW
                    </p>
                    <h3 className="mt-1 text-xl font-black">
                      VeriMart Enterprises
                    </h3>
                  </div>

                  <Building2 className="text-violet-600" size={22} />

                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">

                  <div className="rounded-xl bg-violet-50 p-4">
                    <Receipt className="mb-3 text-violet-600" size={18} />
                    <p className="text-xs text-slate-500">Invoices</p>
                    <p className="mt-1 text-2xl font-black">KES 620K</p>
                  </div>

                  <div className="rounded-xl bg-blue-50 p-4">
                    <Boxes className="mb-3 text-blue-600" size={18} />
                    <p className="text-xs text-slate-500">Inventory</p>
                    <p className="mt-1 text-2xl font-black">1,284</p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-4">
                    <Banknote className="mb-3 text-emerald-600" size={18} />
                    <p className="text-xs text-slate-500">Cash flow</p>
                    <p className="mt-1 text-2xl font-black">+18.2%</p>
                  </div>

                  <div className="rounded-xl bg-orange-50 p-4">
                    <ShoppingCart className="mb-3 text-orange-600" size={18} />
                    <p className="text-xs text-slate-500">Orders</p>
                    <p className="mt-1 text-2xl font-black">326</p>
                  </div>

                </div>

              </div>

            </div>

            {/* Content */}

            <div className="order-1 lg:order-2">

              <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                <Store size={14} />
                BUSINESS MANAGEMENT
              </span>

              <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Your business deserves more than a spreadsheet.
              </h2>

              <p className="mt-6 text-lg leading-relaxed text-slate-600">
                From your first sale to your monthly financial report,
                manage your entire business operation from a single
                connected workspace.
              </p>

              <div className="mt-8 space-y-4">

                {[
                  ["Sales & customer invoices", Receipt],
                  ["Products & inventory", Package],
                  ["Suppliers & purchasing", Store],
                  ["Expenses & cash flow", BarChart3],
                ].map(([text, Icon]) => (

                  <div
                    key={text}
                    className="flex items-center gap-4"
                  >

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                      <Icon size={18} />
                    </div>

                    <span className="font-bold text-slate-800">
                      {text}
                    </span>

                  </div>

                ))}

              </div>

            </div>

          </div>

        </section>

        {/* ==================== CHAMA FEATURE ==================== */}

        <section className="border-y border-blue-100 bg-blue-50/40">

          <div className="mx-auto max-w-7xl px-6 py-28 sm:px-10">

            <div className="text-center">

              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm">
                <Users size={14} />
                CHAMA MANAGEMENT
              </span>

              <h2 className="mx-auto mt-6 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Bring your whole Chama into one trusted workspace.
              </h2>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Replace notebooks, WhatsApp messages, spreadsheets, and
                fragmented payment records with a single source of truth.
              </p>

            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

              {[
                {
                  icon: Users,
                  title: "Members",
                  text: "Know who belongs to your Chama and what they are responsible for.",
                },
                {
                  icon: WalletCards,
                  title: "Contributions",
                  text: "Track every member contribution and outstanding obligation.",
                },
                {
                  icon: HandCoins,
                  title: "Payouts",
                  text: "Manage revolving payouts with transparent financial records.",
                },
                {
                  icon: ShieldCheck,
                  title: "Transparency",
                  text: "Give members confidence through clear and auditable records.",
                },
              ].map((item, index) => {

                const Icon = item.icon;

                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.08 }}
                    className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
                  >

                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                      <Icon size={19} />
                    </div>

                    <h3 className="font-black text-slate-950">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {item.text}
                    </p>

                  </motion.div>
                );

              })}

            </div>

          </div>

        </section>

        {/* ==================== FINAL CTA ==================== */}

        <section className="mx-auto max-w-7xl px-6 py-28 sm:px-10">

          <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-8 py-16 text-center shadow-2xl sm:px-16">

            <div className="absolute left-1/2 top-[-150px] h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-blue-600/30 blur-3xl" />

            <div className="relative">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-xl">
                <Landmark size={25} />
              </div>

              <h2 className="mx-auto mt-7 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                One workspace.
                <br />
                Every financial relationship.
              </h2>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
                Build stronger Chamas, smarter contribution groups, and
                better-run businesses with a financial operating system
                designed for modern Africa.
              </p>

              <div className="mt-9 flex flex-wrap justify-center gap-4">

                <Link
                  to="/register"
                  className="flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-bold text-slate-950 shadow-xl transition hover:-translate-y-1 hover:bg-slate-100"
                >
                  Create your workspace
                  <ArrowRight size={16} />
                </Link>

                <Link
                  to="/login"
                  className="rounded-full border border-slate-700 px-7 py-4 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Sign in
                </Link>

              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs font-medium text-slate-500">

                <span className="flex items-center gap-2">
                  <ShieldCheck size={14} />
                  Secure financial workflows
                </span>

                <span className="flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Transparent records
                </span>

                <span className="flex items-center gap-2">
                  <Zap size={14} />
                  Built for scale
                </span>

              </div>

            </div>

          </div>

        </section>

      </main>

      {/* ==================== FOOTER ==================== */}

      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-10 text-center text-xs font-mono text-slate-500">

        © {new Date().getFullYear()} VeriCircle Technologies Inc.
        <span className="mx-2">•</span>
        Designed for trusted community finance and business growth.

      </footer>

    </div>
  );
}

