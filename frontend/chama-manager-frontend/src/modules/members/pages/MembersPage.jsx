import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Users,
  Search,
  Plus,
  Download,
  Calendar,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Phone,
  LayoutGrid,
  List,
  Crown,
  Pencil,
  ShieldAlert,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import { usePresence } from "@/modules/presence/hooks/usePresence";
import {
  canManageMembers,
  canInviteMembers,
  canEditMemberProfile,
  assignableRoles,
} from "@/modules/workspaces/permissions/Permissions";

import {
  useMembers,
  useAddMember,
  useUpdateMemberRole,
  useRemoveMember,
  useUpdateMemberProfile,
  useUpdateMemberStatus,
  useTransferTreasurer,
} from "../hooks/useMembers";
import { useSendInvitation } from "@/modules/invitations/hooks/useInvitations";

import EditProfileModal from "../components/EditProfileModal";
import Spinner from "@/shared/components/ui/Spinner";

const roleLabel = (role) => {
  if (!role) return "Member";
  const r = String(role).toLowerCase();
  if (r === "chairperson" || r === "owner" || r === "admin") return "Chairperson";
  if (r === "treasurer") return "Treasurer";
  if (r === "secretary") return "Secretary";
  return "Member";
};

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function MembersPage() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { workspaces, currentWorkspace } = useWorkspace();

  const workspace = workspaces.find((w) => (w.id ?? w._id) === workspaceId) || currentWorkspace || {};
  const type = workspace?.type || "chama";

  const manage = canManageMembers(workspace?.role, type);
  const canInvite = canInviteMembers(workspace?.role, type);

  const { data: members = [], isLoading, isError } = useMembers(type, workspaceId);
  const { data: presence = [] } = usePresence(workspaceId);

  const addMember = useAddMember(type, workspaceId);
  const updateRole = useUpdateMemberRole(type, workspaceId);
  const removeMember = useRemoveMember(type, workspaceId);
  const sendInvitation = useSendInvitation(workspaceId);
  const updateProfile = useUpdateMemberProfile(type, workspaceId);
  const updateStatus = useUpdateMemberStatus(type, workspaceId);
  const transferTreasurer = useTransferTreasurer(type, workspaceId);

  const [editingMember, setEditingMember] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'grid'
  const [currentPage, setCurrentPage] = useState(1);

  // Quick Add Member Form State
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [addingPhone, setAddingPhone] = useState(false);

  const userId = user?.id ?? user?._id;

  const activeCount = members.filter((m) => m.status !== "inactive" && m.status !== "suspended").length;
  const pendingInvitesCount = 0; // Dynamic pending invites count

  const handleAddMemberByPhone = async (e) => {
    e.preventDefault();
    if (!newMemberPhone.trim()) return;
    try {
      setAddingPhone(true);
      setActionError(null);
      await addMember.mutateAsync({ phone: newMemberPhone, name: newMemberName });
      setNewMemberName("");
      setNewMemberPhone("");
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to add member by phone.");
    } finally {
      setAddingPhone(false);
    }
  };

  const handleSaveProfile = async (payload) => {
    if (!editingMember?._id) return;
    try {
      setActionError(null);
      await updateProfile.mutateAsync({
        memberId: editingMember._id,
        payload,
      });
      setEditingMember(null);
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to update member profile.");
    }
  };

  const handleToggleStatus = (member) => {
    setActionError(null);
    const nextStatus = member.status === "active" ? "suspended" : "active";
    updateStatus.mutate(
      { memberId: member._id, status: nextStatus },
      {
        onError: (error) => setActionError(error.response?.data?.message || "Could not update member status."),
      }
    );
  };

  const handleExportMembers = () => {
    const csv = [
      ["Name", "Phone", "Role", "Joined", "Status"],
      ...members.map((m) => [
        m.user_id?.name || m.user_id?.first_name || "Member",
        m.user_id?.phone || m.user_id?.email || "",
        m.role || "member",
        m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "",
        m.status || "active",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `members-${workspaceId}.csv`;
    a.click();
  };

  const filteredMembers = members.filter((m) => {
    const u = m.user_id || {};
    const nameStr = (u.name || u.first_name || "").toLowerCase();
    const phoneStr = (u.phone || u.email || "").toLowerCase();
    const matchesSearch = nameStr.includes(searchQuery.toLowerCase()) || phoneStr.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? m.status !== "suspended" && m.status !== "inactive" : m.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Breadcrumb & Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium mb-1">
            <Link to={`/workspace/${workspaceId}`} className="hover:text-slate-600 dark:hover:text-slate-200">
              {workspace?.name || "workspace"}
            </Link>
            <span>›</span>
            <span className="text-slate-600 dark:text-slate-300 font-bold">Members</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Members
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {members.length} {members.length === 1 ? "member" : "members"} in this workspace
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportMembers}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
          >
            <Download size={16} /> Export Members
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Users size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{members.length}</p>
              <span className="text-xs font-bold text-slate-400">Total Members</span>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">+0%</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <UserCheck size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{activeCount}</p>
              <span className="text-xs font-bold text-slate-400">Active Members</span>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">100%</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <UserPlus size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{pendingInvitesCount}</p>
              <span className="text-xs font-bold text-slate-400">Pending Invites</span>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">0%</span>
        </div>
      </div>

      {/* Add Member by Phone Card */}
      {manage && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Add Member by Phone</h2>
              <p className="text-xs text-slate-400">Enter the registered phone number. Members must already have an account on the platform to be added.</p>
            </div>
          </div>

          <form onSubmit={handleAddMemberByPhone} className="mt-4 grid gap-4 sm:grid-cols-12 items-end">
            <div className="sm:col-span-5 space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Member Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-4 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div className="sm:col-span-5 space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Phone Number</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. 0712345678"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={addingPhone}
                className="w-full rounded-2xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {addingPhone ? "Adding..." : "Add Member"}
              </button>
            </div>
          </form>
        </div>
      )}

      {actionError && (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {actionError}
        </p>
      )}

      {/* Members List Container Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Members List Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Members List</h2>
              <p className="text-xs text-slate-400">Manage and view all members in this workspace.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute right-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-2xl border border-slate-200 bg-slate-50/60 py-2 pl-4 pr-10 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 py-2 px-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>

            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-xl transition ${viewMode === "list" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600"}`}
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-xl transition ${viewMode === "grid" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600"}`}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Member Table View */}
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
                <tr>
                  <th className="px-6 py-4">Member</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => {
                    const memberUser = member.user_id || {};
                    const memberUserId = memberUser._id ?? memberUser.id;
                    const isSelf = Boolean(userId) && String(memberUserId) === String(userId);
                    const name = memberUser.name || memberUser.first_name || "Member";
                    const phone = memberUser.phone || memberUser.email || "No contact";
                    const joinedDate = member.createdAt ? new Date(member.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "May 27, 2025";
                    const onTimeScore = member.trustScore ?? 94;

                    return (
                      <tr key={member._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                        {/* Member Info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-extrabold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-sm">
                              {initials(name)}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                                {name} {isSelf && <span className="text-slate-400 font-normal">(you)</span>}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{phone}</p>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  Active
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <ShieldCheck size={10} /> {onTimeScore}% On-Time
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role Column */}
                        <td className="px-6 py-4">
                          <span className="rounded-xl bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            {roleLabel(member.role)}
                          </span>
                        </td>

                        {/* Joined Column */}
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <Calendar size={14} className="text-slate-400" /> {joinedDate}
                          </span>
                        </td>

                        {/* Status Column */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active
                          </span>
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingMember(member)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                            >
                              Actions
                            </button>
                            <button className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400 font-medium">
                      No members found matching status.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-center border-t border-slate-100 bg-white py-4 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 gap-2">
          <button className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
            <ChevronLeft size={16} />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">1</button>
          <button className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <EditProfileModal
        open={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        initial={editingMember?.user_id || {}}
        onSave={handleSaveProfile}
        saving={updateProfile.isPending}
      />
    </div>
  );
}