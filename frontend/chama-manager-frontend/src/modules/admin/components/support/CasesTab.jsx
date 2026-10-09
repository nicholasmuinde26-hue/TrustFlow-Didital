import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import toast from "react-hot-toast";

import Spinner from "@/shared/components/ui/Spinner";
import adminSupportService from "../../services/adminSupport.service";
import NewCaseDialog from "./NewCaseDialog";
import { btn, CaseStatusPill, Card, categoryLabel, EmptyState, errText, fmtDateTime, inputCls, PriorityPill } from "./supportUi";

export function CaseRow({ item }) {
  return (
    <Link to={`/admin/support/cases/${item._id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] font-bold text-slate-400">{item.number}</span>
          <CaseStatusPill status={item.status} />
          <PriorityPill priority={item.priority} />
        </div>
        <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">{item.title}</p>
        <p className="text-[11px] text-slate-500">
          {item.subject_type === "user" ? "User" : "Chama"}: {item.subject_label || "—"} · {categoryLabel(item.category)}
        </p>
      </div>
      <div className="text-right text-[11px] text-slate-400">
        <p className="font-bold text-slate-600 dark:text-slate-300">{item.assignee?.name || "Unassigned"}</p>
        <p>Updated {fmtDateTime(item.updated_at)}</p>
      </div>
    </Link>
  );
}

export default function CasesTab({ onCountChange }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ status: "active", assignee: "", priority: "", query: "" });
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      if (filters.status === "all") delete params.status;
      const res = await adminSupportService.listCases({ ...params, limit: 50 });
      setData(res);
      if (filters.status === "active" && !filters.assignee && !filters.priority && !filters.query) onCountChange?.(res.total);
    } catch (error) { toast.error(errText(error, "Could not load cases")); }
    finally { setLoading(false); }
  }, [filters, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form className="relative min-w-[200px] flex-1" onSubmit={(e) => { e.preventDefault(); setFilters((f) => ({ ...f, query: search.trim() })); }}>
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} pl-8`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search case number, title or name" />
        </form>
        <select className={`${inputCls} !w-auto`} value={filters.status} onChange={set("status")} aria-label="Status">
          <option value="active">Open &amp; pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">All</option>
        </select>
        <select className={`${inputCls} !w-auto`} value={filters.assignee} onChange={set("assignee")} aria-label="Assignee">
          <option value="">Anyone</option><option value="me">Mine</option><option value="unassigned">Unassigned</option>
        </select>
        <select className={`${inputCls} !w-auto`} value={filters.priority} onChange={set("priority")} aria-label="Priority">
          <option value="">Any priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
        </select>
        <button type="button" className={btn.primary} onClick={() => setCreating(true)}><Plus size={13} /> New case</button>
      </div>

      <Card className="overflow-hidden !p-0 [&>div]:!p-0">
        {loading ? <div className="p-8"><Spinner /></div> : data.items.length === 0 ? (
          <EmptyState>No cases match. Open one from here, or from a user or chama page.</EmptyState>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">{data.items.map((c) => <CaseRow key={c._id} item={c} />)}</div>
        )}
      </Card>
      {data.total > data.items.length ? <p className="text-center text-[11px] text-slate-400">Showing {data.items.length} of {data.total}. Narrow the filters to find the rest.</p> : null}

      <NewCaseDialog open={creating} onClose={(created) => { setCreating(false); if (created) navigate(`/admin/support/cases/${created._id}`); }} />
    </div>
  );
}
