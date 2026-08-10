import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Users,
  CircleDollarSign,
  Wallet,
  MessageCircle,
  CalendarDays,
  Megaphone,
  FileText,
  Settings,
  ChevronRight,
  Smartphone,
} from "lucide-react";

import { useWorkspace } from "../../../app/hooks/useWorkspace";
import MpesaStkModal from "../../finance/components/MpesaStkModal";

const baseActions = [
  {
    title: "Members",
    description: "Manage workspace members",
    icon: Users,
    path: "members",
  },
  {
    title: "Contributions",
    description: "Record contributions",
    icon: CircleDollarSign,
    path: "contributions",
  },
  {
    title: "Finance",
    description: "Accounts & ledger",
    icon: Wallet,
    path: "finance",
  },
  {
    title: "Chat",
    description: "Open discussion",
    icon: MessageCircle,
    path: "chat",
  },
  {
    title: "Meetings",
    description: "Upcoming meetings",
    icon: CalendarDays,
    path: "meetings",
  },
  {
    title: "Announcements",
    description: "Post updates",
    icon: Megaphone,
    path: "announcements",
  },
  {
    title: "Reports",
    description: "Financial reports",
    icon: FileText,
    path: "reports",
  },
  {
    title: "Settings",
    description: "Workspace settings",
    icon: Settings,
    path: "settings",
  },
];

export default function WorkspaceQuickActions() {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const workspaceId = paramId || workspaceCtx?.workspaceId;
  const isChama = workspaceCtx?.isChama;

  const [isStkOpen, setIsStkOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Quick Actions
        </h2>

        {/* Top Header Trigger — savings deposits only apply to chamas */}
        {isChama && (
          <button
            type="button"
            onClick={() => setIsStkOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
          >
            <Smartphone size={16} />
            M-Pesa STK Push
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Dedicated M-Pesa Interactive Action Card — savings deposits only apply to chamas */}
        {isChama && (
          <button
            type="button"
            onClick={() => setIsStkOpen(true)}
            className="group text-left rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-lg dark:border-emerald-900/40 dark:bg-emerald-950/20"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-emerald-600 p-3 text-white dark:bg-emerald-500">
                <Smartphone size={20} />
              </div>

              <ChevronRight
                size={18}
                className="text-emerald-600 transition-transform group-hover:translate-x-1 dark:text-emerald-400"
              />
            </div>

            <h3 className="mt-4 font-semibold text-emerald-950 dark:text-emerald-200">
              M-Pesa Express
            </h3>

            <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-400/80">
              Deposit to savings via STK push
            </p>
          </button>
        )}

        {/* Standard Navigation Actions */}
        {baseActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.title}
              to={`/workspace/${workspaceId}/${action.path}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-500/20">
                  <Icon size={20} />
                </div>

                <ChevronRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </div>

              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">
                {action.title}
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {action.description}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Payment STK Modal */}
      {isChama && (
        <MpesaStkModal
          isOpen={isStkOpen}
          onClose={() => setIsStkOpen(false)}
          chamaId={workspaceId}
          title="Deposit to Savings via M-Pesa"
        />
      )}
    </section>
  );
}