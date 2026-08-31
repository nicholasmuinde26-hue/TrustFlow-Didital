import React, { useState } from "react";
import { X, Copy, Check, Share2, MessageSquare } from "lucide-react";

export default function ShareLinkModal({ isOpen, onClose, group = {} }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const joinCode = group.join_code || group.joinCode || "CG-XXXXXX";
  const shareUrl = `${window.location.origin}/g/${joinCode}`;
  
  const whatsappMessage = encodeURIComponent(
    `🤝 Join our contribution group: *${group.name || "Cause"}*!\n\nPledge and support directly here:\n${shareUrl}`
  );
  const whatsappUrl = `https://api.whatsapp.com/send?text=${whatsappMessage}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Share Cause</h3>
              <p className="text-xs text-slate-500">Invite anyone to view & pledge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Join Code Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-lg space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-200">Official Join Code</span>
          <div className="flex items-center justify-between">
            <span className="font-mono text-2xl font-black tracking-widest">{joinCode}</span>
            <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">Instant Join</span>
          </div>
        </div>

        {/* Share Link Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Public Shareable Link</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono font-medium text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <button
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-violet-600 px-4 py-3 text-xs font-bold text-white hover:bg-violet-700 transition-colors shadow-md"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* WhatsApp Quick Share Button */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 py-3.5 text-xs font-black text-white shadow-xl hover:bg-emerald-600 transition-all transform hover:-translate-y-0.5"
        >
          <MessageSquare size={18} />
          Share to WhatsApp Group / Contacts
        </a>
      </div>
    </div>
  );
}
