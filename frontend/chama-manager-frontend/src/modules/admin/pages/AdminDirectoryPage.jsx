import { useState, useEffect } from "react";
import {
  Building2,
  Store,
  Wallet,
  Users,
  KeyRound,
  ExternalLink,
  Search,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import workspaceService from "@/app/services/workspace.service";
import Spinner from "@/shared/components/ui/Spinner";

export default function AdminDirectoryPage() {
  const [activeTab, setActiveTab] = useState("chama");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function loadData(searchTerm = query) {
    setLoading(true);
    try {
      const items = await workspaceService.getDirectory(activeTab, searchTerm);
      setData(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData("");
    setQuery("");
  }, [activeTab]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadData(query.trim());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            System Workspace Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            View, search, and manage every registered workspace on the platform
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {[
            { id: "chama", label: "Chamas", icon: Building2 },
            { id: "business", label: "Businesses", icon: Store },
            { id: "contribution_group", label: "Contribution Groups", icon: Wallet },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === tab.id
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${activeTab === "chama" ? "chamas" : activeTab === "business" ? "businesses" : "contribution groups"} by name...`}
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

      {loading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            No workspaces of this type found
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((item) => (
            <div
              key={item.id || item._id}
              className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <Link to={`/admin/directory/${activeTab}/${item.id || item._id}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {item.name}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {item.chama_type || item.category || item.group_type || "Standard"}
                  </span>
                </div>

                {item.created_by?.name && (
                  <p className="text-xs text-slate-500">
                    Created by: <strong>{item.created_by.name}</strong>
                  </p>
                )}

                {item.join_code && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-mono font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <KeyRound size={14} className="text-violet-600" />
                    <span>Join Code: {item.join_code}</span>
                  </div>
                )}
              </Link>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {item.memberCount !== undefined ? `${item.memberCount} Members` : "Active"}
                </span>

                <div className="flex items-center gap-3">
                  <Link
                    to={`/admin/directory/${activeTab}/${item.id || item._id}`}
                    className="flex items-center gap-1 font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                  >
                    Manage
                    <ChevronRight size={13} />
                  </Link>
                  <Link
                    to={item.type === "business" ? `/workspace/${item.id}/business` : `/workspace/${item.id}`}
                    className="flex items-center gap-1 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    title="Open Workspace"
                  >
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

