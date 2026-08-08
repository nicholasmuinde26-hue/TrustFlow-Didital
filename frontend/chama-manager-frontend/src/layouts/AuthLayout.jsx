
import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Landmark,
  ShieldCheck,
  Sparkles,
  LockKeyhole,
  ArrowUpRight,
} from "lucide-react";

import ThemeToggle from "@/shared/components/layout/ThemeToggle/ThemeToggle";

const authSlides = [
  {
    eyebrow: "TRUSTED FINANCIAL INFRASTRUCTURE",
    title: (
      <>
        Your money.
        <br />
        Your community.
        <br />
        <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-500 bg-clip-text text-transparent">
          One trusted workspace.
        </span>
      </>
    ),
    description:
      "Manage Chamas, contribution groups, and businesses with transparent financial workflows built for modern African organizations.",
    color: "blue",
  },

  {
    eyebrow: "CHAMA MANAGEMENT",
    title: (
      <>
        Build stronger
        <br />
        <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
          communities.
        </span>
        <br />
        Grow together.
      </>
    ),
    description:
      "Bring members, contributions, payouts, treasury management, and financial records into one transparent Chama workspace.",
    color: "blue",
  },

  {
    eyebrow: "CONTRIBUTION ENGINE",
    title: (
      <>
        Contributions
        <br />
        that work
        <br />
        <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
          for you.
        </span>
      </>
    ),
    description:
      "Automate contribution plans, member obligations, payment tracking, reconciliation, reminders, and financial posting.",
    color: "emerald",
  },

  {
    eyebrow: "BUSINESS MANAGEMENT",
    title: (
      <>
        Run your
        <br />
        business with
        <br />
        <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
          clarity.
        </span>
      </>
    ),
    description:
      "Manage sales, customers, invoices, suppliers, inventory, expenses, and business cash flow from one connected workspace.",
    color: "violet",
  },
];

export default function AuthLayout({ children }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % authSlides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const slide = authSlides[currentSlide];

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-slate-50 text-slate-900">

      {/* =========================================================
          BACKGROUND
      ========================================================= */}

      <div className="pointer-events-none absolute inset-0">

        <div
          className="
            absolute inset-0 opacity-60
            bg-[linear-gradient(to_right,rgba(15,23,42,0.035)_1px,transparent_1px),
            linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)]
            bg-[size:48px_48px]
          "
        />

        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, 20, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-200/30 blur-3xl"
        />

        <motion.div
          animate={{
            x: [0, -30, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -right-32 top-1/4 h-[500px] w-[500px] rounded-full bg-violet-200/25 blur-3xl"
        />

        <div className="absolute bottom-[-200px] left-1/3 h-[450px] w-[450px] rounded-full bg-emerald-200/20 blur-3xl" />

      </div>

      {/* =========================================================
          HEADER
      ========================================================= */}

      <div className="absolute left-0 right-0 top-0 z-30">

        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-10">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-950/10">
              <Landmark size={19} />
            </div>

            <div className="hidden sm:block">
              <p className="text-base font-black tracking-tight text-slate-950">
                VeriCircle
              </p>

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Financial OS
              </p>
            </div>

          </div>

          <div className="rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur-xl">
            <ThemeToggle />
          </div>

        </div>

      </div>

      {/* =========================================================
          MAIN
      ========================================================= */}

      <main className="relative z-10 flex min-h-screen w-full items-center justify-center px-5 py-24 sm:px-8">

        <div className="grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1fr_460px]">

          {/* =====================================================
              INFINITE SLIDING BRAND PANEL
          ===================================================== */}

          <motion.div
            initial={{ opacity: 0, x: -25 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.6,
              ease: "easeOut",
            }}
            className="hidden lg:block"
          >

            <AnimatePresence mode="wait">

              <motion.div
                key={currentSlide}
                initial={{
                  opacity: 0,
                  y: 35,
                  filter: "blur(8px)",
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                }}
                exit={{
                  opacity: 0,
                  y: -35,
                  filter: "blur(8px)",
                }}
                transition={{
                  duration: 0.65,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >

                {/* Eyebrow */}

                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm">

                  <Sparkles
                    size={13}
                    className={
                      slide.color === "emerald"
                        ? "text-emerald-500"
                        : slide.color === "violet"
                        ? "text-violet-500"
                        : "text-blue-500"
                    }
                  />

                  {slide.eyebrow}

                </div>

                {/* Title */}

                <h1 className="max-w-xl text-5xl font-black leading-[1.05] tracking-tight text-slate-950 xl:text-6xl">
                  {slide.title}
                </h1>

                {/* Description */}

                <p className="mt-7 max-w-lg text-lg leading-8 text-slate-600">
                  {slide.description}
                </p>

              </motion.div>

            </AnimatePresence>

            {/* =================================================
                SLIDE INDICATORS
            ================================================= */}

            <div className="mt-10 flex items-center gap-2">

              {authSlides.map((item, index) => (

                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Show slide ${index + 1}`}
                  className="group"
                >
                  <motion.span
                    animate={{
                      width: currentSlide === index ? 32 : 7,
                    }}
                    transition={{
                      duration: 0.3,
                    }}
                    className={`block h-1.5 rounded-full ${
                      currentSlide === index
                        ? "bg-slate-950"
                        : "bg-slate-300 group-hover:bg-slate-400"
                    }`}
                  />
                </button>

              ))}

            </div>

            {/* =================================================
                TRUST POINTS
            ================================================= */}

            <div className="mt-8 grid max-w-lg grid-cols-2 gap-4">

              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">

                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheck size={17} />
                </div>

                <p className="text-sm font-bold text-slate-900">
                  Transparent
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Every financial movement stays traceable.
                </p>

              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">

                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <LockKeyhole size={17} />
                </div>

                <p className="text-sm font-bold text-slate-900">
                  Secure
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Built around controlled financial workflows.
                </p>

              </div>

            </div>

          </motion.div>

          {/* =====================================================
              AUTH CARD
          ===================================================== */}

          <motion.div
            initial={{
              opacity: 0,
              y: 20,
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
            }}
            className="w-full"
          >

            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-2xl shadow-slate-300/30 backdrop-blur-xl sm:p-8">

              <div className="absolute left-10 right-10 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

              {/* Mobile brand */}

              <div className="mb-8 flex flex-col items-center text-center lg:hidden">

                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
                  <Landmark size={22} />
                </div>

                <h2 className="text-xl font-black tracking-tight text-slate-950">
                  VeriCircle
                </h2>

                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Financial OS
                </p>

              </div>

              <div className="w-full">
                {children ?? <Outlet />}
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-[11px] font-medium text-slate-400">

                <LockKeyhole size={12} />

                Secure workspace authentication

                <ArrowUpRight size={11} />

              </div>

            </div>

            <p className="mt-5 text-center text-xs text-slate-400">
              VeriCircle • Community finance & business infrastructure
            </p>

          </motion.div>

        </div>

      </main>

    </div>
  );
}
