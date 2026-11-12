import React from "react";
import { Building2, Sparkles, Users, Eye } from "lucide-react";

const ROLE_LABELS = { owner: "Business owner", manager: "Business manager", cashier: "Cashier", inventory: "Stock manager", accountant: "Accounts", chairperson: "Chairperson", treasurer: "Treasurer", member: "Member" };

export function BusinessHeader({ profile }) {
  const isChamaOwned = profile?.owner_type === "chama";
  const canManage = profile?.access?.canManage !== false;
  const role = profile?.access?.role;
  const category = profile?.category_label || ({ retail: "Retail & wholesale", rental: "Rental property", restaurant: "Restaurant & food", service: "Service provider", other: "General business" }[profile?.category] || "Business");

  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
      <div className="flex items-center gap-3.5">
        <div className="h-12 w-12 rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-800 flex items-center justify-center font-bold">
          <Building2 size={24} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {profile?.name || "Business Workspace"}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              <Sparkles size={11} /> Active
            </span>
            {isChamaOwned ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-800 dark:bg-sky-950/80 dark:text-sky-300"
                title="This business belongs to the chama, not to any one member"
              >
                <Users size={11} /> Chama-owned{profile?.chamaName ? ` · ${profile.chamaName}` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {role && role !== "owner" ? "Business staff" : "Independent business"}
              </span>
            )}
          </div>
          {!isChamaOwned && role && role !== "owner" && (
            <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Your access: {ROLE_LABELS[role] || role}</p>
          )}
          {isChamaOwned && role && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {canManage ? null : <Eye size={11} />}
              Your role: {ROLE_LABELS[role] || role}{canManage ? "" : " · view only"}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            {category} · {profile?.location || "Location not set"} · {profile?.currency || "KES"}{(profile?.mpesa_till || profile?.mPesaTill) ? ` · Till ${profile.mpesa_till || profile.mPesaTill}` : ""}
          </p>
        </div>
      </div>

    </div>
  );
}
