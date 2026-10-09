import { motion } from "framer-motion";
import { Wallet, ArrowUpRight, Inbox } from "lucide-react";
import WithdrawalStatusBadge from "./WithdrawalStatusBadge";

const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;

export default function WithdrawalList({ withdrawals, onSelect, title, subtitle, showMember = false, emptyLabel }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-obsidian-border dark:bg-obsidian-card space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-obsidian-border pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-mist flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {title}
          </h3>
          {subtitle && <p className="text-xs text-slate-500 dark:text-mist-muted">{subtitle}</p>}
        </div>
        <span className="rounded-full bg-slate-100 dark:bg-obsidian-raised border border-slate-200 dark:border-obsidian-border px-3 py-1 text-xs font-bold text-slate-700 dark:text-mist-muted">
          {withdrawals.length} {withdrawals.length === 1 ? "Request" : "Requests"}
        </span>
      </div>

      <div className="space-y-3">
        {withdrawals.length > 0 ? (
          withdrawals.map((w) => (
            <motion.div
              key={w._id}
              whileHover={{ scale: 1.01 }}
              onClick={() => onSelect(w)}
              className="cursor-pointer flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-slate-300 hover:bg-slate-100 dark:border-obsidian-border dark:bg-obsidian-raised/60 dark:hover:bg-obsidian-raised"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-slate-900 dark:text-mist text-base">
                    {showMember ? (w.member_id?.user_id?.name || "Chama Member") : "Withdrawal Request"}
                  </span>
                  <WithdrawalStatusBadge status={w.status} />
                </div>
                <p className="text-xs text-slate-500 dark:text-mist-muted font-medium">
                  {w.reason || "No reason given"}
                  {w.createdAt && ` · ${new Date(w.createdAt).toLocaleDateString()}`}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Amount</span>
                  <span className="font-black text-slate-900 dark:text-mist text-base">{money(w.amount)}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(w);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-600 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist-muted transition"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500 dark:border-obsidian-border dark:bg-obsidian-raised/40">
            <Inbox className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="font-bold text-slate-800 dark:text-mist text-sm">{emptyLabel || "No withdrawal requests found"}</p>
          </div>
        )}
      </div>
    </section>
  );
}