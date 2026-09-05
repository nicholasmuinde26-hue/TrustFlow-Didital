import { useState, useEffect } from "react";
import {
  ShieldCheck,
  UserPlus,
  UserMinus,
  Search,
  Users,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Phone,
} from "lucide-react";
import useAuth from "@/app/hooks/useAuth";
import adminService from "../services/admin.service";
import Spinner from "@/shared/components/ui/Spinner";

export default function AdminSubAdminsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.systemRole === "super_admin";

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search for candidates to promote
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ text: "", type: "" });

  async function loadAdmins() {
    setLoading(true);
    try {
      const data = await adminService.getSubAdmins();
      setAdmins(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await adminService.getUsers({ query: searchQuery.trim(), limit: 10 });
      setSearchResults(res.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }

  async function handlePromote(targetUserId) {
    setActionLoading(true);
    setAlertMsg({ text: "", type: "" });
    try {
      const res = await adminService.promoteSubAdmin(targetUserId);
      setAlertMsg({
        text: res.message || "User promoted to Sub-Admin successfully",
        type: "success",
      });
      setSearchResults((prev) =>
        prev.map((u) => (u._id === targetUserId ? { ...u, systemRole: "sub_admin" } : u))
      );
      await loadAdmins();
    } catch (err) {
      setAlertMsg({
        text: err?.response?.data?.message || "Failed to promote user",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDemote(targetUserId, targetName) {
    if (
      !window.confirm(
        `Are you sure you want to revoke Sub-Admin access for ${targetName || "this user"}?`
      )
    ) {
      return;
    }

    setActionLoading(true);
    setAlertMsg({ text: "", type: "" });
    try {
      const res = await adminService.demoteSubAdmin(targetUserId);
      setAlertMsg({
        text: res.message || "Sub-Admin privileges revoked",
        type: "success",
      });
      await loadAdmins();
    } catch (err) {
      setAlertMsg({
        text: err?.response?.data?.message || "Failed to revoke Sub-Admin",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function togglePermission(targetUserId, permKey, currentVal) {
    const newVal = !currentVal;
    setActionLoading(true);
    try {
      await adminService.updateSubAdminPermissions(targetUserId, { [permKey]: newVal });
      setAdmins((prev) =>
        prev.map((adm) =>
          adm._id === targetUserId
            ? { ...adm, permissions: { ...adm.permissions, [permKey]: newVal } }
            : adm
        )
      );
    } catch (err) {
      setAlertMsg({
        text: err?.response?.data?.message || "Failed to update permission",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
        <AlertTriangle className="mx-auto mb-2 text-amber-600" size={32} />
        <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
          Super Admin Access Required
        </h3>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
          Only the primary Super Admin can view and manage sub-admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          Sub-Admin Management
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          As Super Admin, appoint trusted officials to assist in reviewing requests and creating workspaces
        </p>
      </div>

      {alertMsg.text && (
        <div
          className={`rounded-2xl p-4 text-xs font-semibold ${
            alertMsg.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
          }`}
        >
          {alertMsg.text}
        </div>
      )}

      {/* Current Administrators List */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Active System Administrators
              </h2>
              <p className="text-xs text-slate-500">
                Authorized to manage entities and approve requests
              </p>
            </div>
          </div>

          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            {admins.length} Total
          </span>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {admins.map((admin) => {
              const isTargetSuper = admin.systemRole === "super_admin";
              const isSelf = admin._id === user?._id;

              return (
                <div
                  key={admin._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {admin.name?.charAt(0) || "A"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {admin.name || "Unnamed Official"}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded dark:bg-violet-950/40">
                            (You)
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            isTargetSuper
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {isTargetSuper ? "Super Admin" : "Sub-Admin"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {admin.phone}
                        </span>
                        {admin.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={12} />
                            {admin.email}
                          </span>
                        )}
                      </div>

                      {/* Granular Permissions Badges */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {[
                          { key: "users", label: "Users" },
                          { key: "chamas", label: "Chamas" },
                          { key: "businesses", label: "Businesses" },
                          { key: "contributionGroups", label: "Groups" },
                          { key: "finance", label: "Finance" },
                          { key: "auditLogs", label: "Audit" },
                          { key: "settings", label: "Settings" },
                        ].map((perm) => {
                          const isEnabled = isTargetSuper || admin.permissions?.[perm.key];
                          return (
                            <button
                              key={perm.key}
                              disabled={isTargetSuper || actionLoading}
                              onClick={() => togglePermission(admin._id, perm.key, admin.permissions?.[perm.key])}
                              title={isTargetSuper ? "Super Admin has all permissions" : `Click to toggle ${perm.label} permission`}
                              className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                                isEnabled
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500"
                              }`}
                            >
                              {perm.label} {isEnabled ? "✓" : "✗"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {!isTargetSuper && (
                    <button
                      onClick={() => handleDemote(admin._id, admin.name)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 disabled:opacity-50"
                    >
                      <UserMinus size={14} />
                      Revoke Sub-Admin
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Sub-Admin Search */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            Appoint a New Sub-Admin
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Search for registered users by phone, email, or name to promote them to Sub-Admin
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by phone (07...), email, or name..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="rounded-2xl bg-violet-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search Users"}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800 overflow-hidden">
            {searchResults.map((userCandidate) => {
              const isAlreadyAdmin =
                userCandidate.systemRole === "sub_admin" ||
                userCandidate.systemRole === "super_admin";

              return (
                <div
                  key={userCandidate._id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {userCandidate.name || "Registered User"}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      {userCandidate.phone} {userCandidate.email ? `• ${userCandidate.email}` : ""}
                    </span>
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Role: {userCandidate.systemRole || "user"}
                    </span>
                  </div>

                  <div>
                    {isAlreadyAdmin ? (
                      <span className="text-xs font-bold text-emerald-600">
                        Already Administrator
                      </span>
                    ) : (
                      <button
                        onClick={() => handlePromote(userCandidate._id)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        <UserPlus size={14} />
                        Promote to Sub-Admin
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
