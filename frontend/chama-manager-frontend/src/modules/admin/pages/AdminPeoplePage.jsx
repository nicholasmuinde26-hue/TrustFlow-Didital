import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Phone, Mail, Building2, Store, Wallet, Users } from "lucide-react";
import adminService from "../services/admin.service";
import Spinner from "@/shared/components/ui/Spinner";

const WORKSPACE_ICON = {
  chama: Building2,
  business: Store,
  contribution_group: Wallet,
};

const WORKSPACE_PATH = (m) =>
  `/admin/directory/${m.workspaceType}/${m.workspaceId}`;

export default function AdminPeoplePage() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await adminService.searchPeople({ query: q, limit: 30 });
      setPeople(res.people || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  function handleSubmit(e) {
    e.preventDefault();
    load(query.trim());
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">People Directory</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Find anyone on the platform and see every Chama, Business, or Contribution Group they're part of, and in what role.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone (07...), or email..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <button
          type="submit"
          className="rounded-2xl bg-violet-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700"
        >
          Search
        </button>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <Users size={20} />
            </div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {query ? `Results for "${query}"` : "All Registered People"}
            </h2>
          </div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            {total} Total
          </span>
        </div>

        {loading ? (
          <Spinner />
        ) : people.length === 0 ? (
          <div className="p-12 text-center text-xs font-semibold text-slate-500">No matching people found</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {people.map((person) => (
              <div key={person._id} className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {person.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {person.name || "Unnamed User"}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {person.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} /> {person.phone}
                        </span>
                      )}
                      {person.email && (
                        <span className="flex items-center gap-1">
                          <Mail size={12} /> {person.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 pl-13">
                  {(person.memberships || []).length === 0 ? (
                    <span className="text-[11px] font-semibold text-slate-400">
                      Not part of any Chama, Business, or Contribution Group
                    </span>
                  ) : (
                    person.memberships.map((m, i) => {
                      const WIcon = WORKSPACE_ICON[m.workspaceType] || Building2;
                      return (
                        <Link
                          key={i}
                          to={WORKSPACE_PATH(m)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <WIcon size={12} />
                          {m.workspaceName}
                          <span className="text-slate-400">•</span>
                          <span className="capitalize">{(m.role || "").replace("_", " ")}</span>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
