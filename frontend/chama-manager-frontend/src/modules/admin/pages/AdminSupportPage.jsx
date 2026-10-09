import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FolderKanban, Receipt, Search } from "lucide-react";
import clsx from "clsx";

import useAuth from "@/app/hooks/useAuth";
import adminSupportService from "../services/adminSupport.service";
import useAdminProfile from "../hooks/useAdminProfile";
import CasesTab from "../components/support/CasesTab";
import LookupTab from "../components/support/LookupTab";
import ReviewQueueTab from "../components/support/ReviewQueueTab";
import { Pill } from "../components/support/supportUi";

export default function AdminSupportPage() {
  const { user } = useAuth();
  const { profile } = useAdminProfile();
  const [params, setParams] = useSearchParams();
  const [overview, setOverview] = useState(null);

  const isSuper = user?.systemRole === "super_admin";
  const canFinance = isSuper || profile?.permissions?.finance === true;
  const tab = ["cases", "review", "lookup"].includes(params.get("tab")) ? params.get("tab") : "cases";

  const refreshOverview = useCallback(() => {
    adminSupportService.getOverview().then(setOverview).catch(() => setOverview(null));
  }, []);
  useEffect(() => { refreshOverview(); }, [refreshOverview]);

  // Keep callbacks passed to the tab data loaders stable. A new callback on
  // every render changes each tab's `load` dependency, which triggers another
  // request; the resulting count update then repeats that cycle until the API
  // rate limiter blocks the page.
  const handleCaseCountChange = useCallback((openCases) => {
    setOverview((current) => (current ? { ...current, openCases } : current));
  }, []);
  const handleReviewCountChange = useCallback((reviewInvoices) => {
    setOverview((current) => (current ? { ...current, reviewInvoices } : current));
  }, []);

  const tabs = [
    { key: "cases", label: "Cases", icon: FolderKanban, count: overview?.openCases },
    { key: "review", label: "Payments to review", icon: Receipt, count: overview?.reviewInvoices, alert: true },
    { key: "lookup", label: "Look up", icon: Search },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Support Desk</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Help chamas with billing, fix stuck payments, assist users with access, and keep a record of every case.
          </p>
        </div>
        {overview ? (
          <div className="flex flex-wrap gap-2">
            <Pill tone="blue">{overview.myOpenCases} mine</Pill>
            {overview.urgentCases > 0 ? <Pill tone="red">{overview.urgentCases} urgent</Pill> : null}
          </div>
        ) : null}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map(({ key, label, icon: Icon, count, alert }) => (
          <button key={key} type="button" onClick={() => setParams(key === "cases" ? {} : { tab: key })}
            className={clsx("flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-bold transition",
              tab === key ? "border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400" : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")}>
            <Icon size={15} /> {label}
            {count > 0 ? <span className={clsx("flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black text-white", alert ? "bg-red-600" : "bg-slate-500")}>{count}</span> : null}
          </button>
        ))}
      </div>

      {tab === "cases" && <CasesTab onCountChange={handleCaseCountChange} />}
      {tab === "review" && <ReviewQueueTab canFinance={canFinance} onCountChange={handleReviewCountChange} />}
      {tab === "lookup" && <LookupTab />}
    </div>
  );
}
