import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Building2,
  Store,
  Wallet,
  Clock,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  PlusCircle,
  MessageSquare,
} from "lucide-react";
import useAuth from "@/app/hooks/useAuth";
import adminService from "../services/admin.service";
import inquiryService from "@/app/services/inquiry.service";
import Spinner from "@/shared/components/ui/Spinner";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [inqStats, setInqStats] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.systemRole === "super_admin";

  useEffect(() => {
    async function loadData() {
      try {
        const [overview, requests, inqs] = await Promise.all([
          adminService.getOverview(),
          adminService.getWorkspaceRequests("pending"),
          inquiryService.getAdminInquiryStats().catch(() => null),
        ]);
        setStats(overview);
        setInqStats(inqs);
        setPendingRequests(requests.slice(0, 5));
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);


  if (loading) {
    return <Spinner />;
  }

  const statCards = [
    {
      title: "Active Inquiries",
      value: inqStats?.openCount ?? 0,
      icon: MessageSquare,
      color: "rose",
      to: "/admin/inquiries",
    },
    {
      title: "Pending Requests",
      value: stats?.pendingRequests ?? 0,
      icon: Clock,
      color: "amber",
      to: "/admin/requests",
    },

    {
      title: "Total Chamas",
      value: stats?.totalChamas ?? 0,
      icon: Building2,
      color: "violet",
      to: "/admin/directory?tab=chamas",
    },
    {
      title: "Total Businesses",
      value: stats?.totalBusinesses ?? 0,
      icon: Store,
      color: "blue",
      to: "/admin/directory?tab=businesses",
    },
    {
      title: "Contribution Groups",
      value: stats?.totalGroups ?? 0,
      icon: Wallet,
      color: "emerald",
      to: "/admin/directory?tab=groups",
    },
    {
      title: "Registered Users",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: "indigo",
      to: "/admin/requests",
    },
    {
      title: "Active Sub-Admins",
      value: stats?.totalSubAdmins ?? 0,
      icon: UserCheck,
      color: "rose",
      to: isSuperAdmin ? "/admin/sub-admins" : "/admin",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-200 backdrop-blur-md mb-2">
              <ShieldCheck size={14} />
              <span>{isSuperAdmin ? "Super Admin Console" : "Sub-Admin Console"}</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Welcome, {user?.name || "Admin"}
            </h1>
            <p className="mt-1 text-sm text-violet-200/80 max-w-xl leading-relaxed">
              Manage system-wide workspaces, review and approve entity creation
              requests with complete governance committee details, and oversee platform operations.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/create"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black text-slate-950 shadow-md transition hover:bg-violet-50"
            >
              <PlusCircle size={16} />
              Create Workspace
            </Link>
            <Link
              to="/admin/requests"
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-700/60 px-5 py-3 text-xs font-black text-white backdrop-blur-md transition hover:bg-violet-700"
            >
              Review Requests ({stats?.pendingRequests ?? 0})
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.to}
              className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {card.title}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-violet-100 group-hover:text-violet-700 dark:bg-slate-800 dark:text-slate-300">
                  <Icon size={16} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-black text-slate-950 dark:text-white">
                  {card.value}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pending Workspace Requests Preview */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Recent Workspace Creation Requests
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Submitted by prospective chairpersons and organizers awaiting approval
            </p>
          </div>

          <Link
            to="/admin/requests"
            className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            View All Requests
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {pendingRequests.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle size={24} />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                No Pending Requests!
              </p>
              <p className="text-xs text-slate-500">
                All workspace creation requests have been reviewed and resolved.
              </p>
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {req.name}
                    </span>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      {req.entityType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Chairperson:{" "}
                    <strong>{req.chairperson?.name || "Not specified"}</strong> (
                    {req.chairperson?.phone || req.chairperson?.email || "No contact"}) •{" "}
                    {req.committeeMembers?.length || 0} Committee Members
                  </p>
                </div>

                <Link
                  to="/admin/requests"
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 sm:w-auto"
                >
                  Review Details
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
