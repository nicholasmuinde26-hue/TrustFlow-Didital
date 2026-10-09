import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Phone, Search, Users } from "lucide-react";
import toast from "react-hot-toast";

import Spinner from "@/shared/components/ui/Spinner";
import adminSupportService from "../../services/adminSupport.service";
import { BillingStatePill, btn, Card, EmptyState, errText, fmtDate, inputCls, Pill } from "./supportUi";

export default function LookupTab() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ users: null, chamas: null, loading: false });

  async function search(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) { toast.error("Type at least 2 characters"); return; }
    setState((s) => ({ ...s, loading: true }));
    try {
      const [users, chamas] = await Promise.all([adminSupportService.searchUsers(q), adminSupportService.searchChamas(q)]);
      setState({ users: users.users, chamas, loading: false });
    } catch (error) {
      toast.error(errText(error, "Search failed"));
      setState((s) => ({ ...s, loading: false }));
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} !rounded-2xl py-2.5 pl-10`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Phone (07…), name, email or chama name" autoFocus />
        </div>
        <button type="submit" className={`${btn.primary} !rounded-2xl !px-6`}>Look up</button>
      </form>

      {state.loading ? <Spinner /> : state.users === null ? (
        <Card><EmptyState>Search once to find both people and chamas.</EmptyState></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={<span className="flex items-center gap-2"><Users size={14} /> People ({state.users.length})</span>}>
            {state.users.length === 0 ? <EmptyState>No matching people</EmptyState> : (
              <div className="-my-2 divide-y divide-slate-100 dark:divide-slate-800">
                {state.users.map((u) => (
                  <Link key={u._id} to={`/admin/support/users/${u._id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900 dark:text-white">{u.name || "Unnamed user"}</p>
                      <p className="flex items-center gap-1 text-[11px] text-slate-500"><Phone size={11} /> {u.phone}{u.email ? ` · ${u.email}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!u.isPhoneVerified ? <Pill tone="amber">Unverified</Pill> : null}
                      {u.status !== "active" ? <Pill tone={u.status === "suspended" ? "red" : "slate"}>{u.status}</Pill> : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
          <Card title={<span className="flex items-center gap-2"><Building2 size={14} /> Chamas ({state.chamas.length})</span>}>
            {state.chamas.length === 0 ? <EmptyState>No matching chamas</EmptyState> : (
              <div className="-my-2 divide-y divide-slate-100 dark:divide-slate-800">
                {state.chamas.map((c) => (
                  <Link key={c._id} to={`/admin/support/chamas/${c._id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-[11px] capitalize text-slate-500">{(c.chama_type || "chama").replace("-", " ")}{c.plan_code ? ` · ${c.plan_code}` : ""}{c.access_until ? ` · until ${fmtDate(c.access_until)}` : ""}</p>
                    </div>
                    {c.state ? <BillingStatePill state={c.state} /> : null}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
