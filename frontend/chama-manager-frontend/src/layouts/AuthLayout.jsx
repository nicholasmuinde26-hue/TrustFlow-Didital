import React from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Landmark, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import ThemeToggle from "@/shared/components/layout/ThemeToggle/ThemeToggle";
import authBackgroundVideo from "@/assets/auth-background.mp4";

const flowNodes = [
  { x: "8%", y: "22%", delay: 0.2, size: 10 },
  { x: "24%", y: "68%", delay: 1.4, size: 7 },
  { x: "74%", y: "19%", delay: 0.7, size: 8 },
  { x: "88%", y: "72%", delay: 1.9, size: 11 },
  { x: "69%", y: "84%", delay: 2.6, size: 6 },
];

function TechBackdrop() {
  return (
    <div className="auth-tech-backdrop" aria-hidden="true">
      <video
        className="auth-tech-backdrop__video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source src={authBackgroundVideo} type="video/mp4" />
      </video>
      <div className="auth-tech-backdrop__video-wash" />
      <div className="auth-tech-backdrop__mesh" />
      <div className="auth-tech-backdrop__aurora auth-tech-backdrop__aurora--blue" />
      <div className="auth-tech-backdrop__aurora auth-tech-backdrop__aurora--mint" />
      <div className="auth-tech-backdrop__aurora auth-tech-backdrop__aurora--violet" />
      <svg className="auth-tech-backdrop__routes" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <path d="M-80 660 C260 510 320 850 630 610 S1020 280 1520 390" />
        <path d="M-40 250 C220 340 370 120 680 265 S1090 650 1480 525" />
        <path d="M120 930 C420 540 760 900 930 590 S1190 190 1450 80" />
      </svg>
      {flowNodes.map((node, index) => (
        <motion.span key={index} className="auth-tech-backdrop__node" style={{ left: node.x, top: node.y, width: node.size, height: node.size }} animate={{ y: [0, -18, 0], opacity: [0.35, 1, 0.35], scale: [1, 1.35, 1] }} transition={{ duration: 5 + index, delay: node.delay, repeat: Infinity, ease: "easeInOut" }} />
      ))}
      <motion.div className="auth-tech-backdrop__orbit auth-tech-backdrop__orbit--one" animate={{ rotate: 360 }} transition={{ duration: 34, repeat: Infinity, ease: "linear" }} />
      <motion.div className="auth-tech-backdrop__orbit auth-tech-backdrop__orbit--two" animate={{ rotate: -360 }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }} />
      <div className="auth-tech-backdrop__status"><span className="auth-tech-backdrop__pulse" />Secure financial network</div>
    </div>
  );
}

export default function AuthLayout({ children }) {
  return (
    <div className="auth-layout min-h-screen bg-slate-50 text-slate-900">
      <div className="auth-split">
        <aside className="auth-split__visual">
          <TechBackdrop />
          <div className="auth-split__brand">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white shadow-lg backdrop-blur-xl"><Landmark size={21} /></div>
            <div><p className="text-lg font-black tracking-tight text-white">VeriCircle</p><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">Financial OS</p></div>
          </div>
          <div className="auth-split__message">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-50 backdrop-blur-md"><Sparkles size={13} className="text-cyan-300" />Built for collective progress</div>
            <h1>Move forward.<br /><span>Together.</span></h1>
            <p>Modern financial infrastructure for communities, contribution groups, and growing businesses.</p>
          </div>
          <div className="auth-split__visual-footer"><span className="auth-tech-backdrop__pulse" />Secure. Transparent. Connected.</div>
        </aside>
        <main className="auth-split__form-area">
          <header className="auth-split__form-header">
            <div className="flex items-center gap-2 lg:hidden"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white"><Landmark size={17} /></div><span className="font-black tracking-tight">VeriCircle</span></div>
            <div className="ml-auto rounded-full border border-slate-200 bg-white p-1 shadow-sm"><ThemeToggle /></div>
          </header>
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="auth-split__form-wrap">
            <div className="mb-8 text-center"><div className="mx-auto mb-4 hidden h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/25 lg:flex"><Landmark size={22} /></div><p className="text-sm font-semibold text-slate-500">Welcome to VeriCircle</p><p className="mt-1 text-xs text-slate-400">Your trusted workspace for progress</p></div>
            <div className="auth-split__content"><div className="relative w-full">{children ?? <Outlet />}</div><div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-medium text-slate-400"><LockKeyhole size={12} className="text-emerald-600" />Secure workspace authentication<ShieldCheck size={12} className="text-emerald-600" /></div></div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
