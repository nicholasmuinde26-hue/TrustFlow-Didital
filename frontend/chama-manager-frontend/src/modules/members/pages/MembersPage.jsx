import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Users,
  Search,
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
  Link2,
  Copy,
  Check,
  Clock,
  X,
  UserX,
  Award,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import { usePresence } from "@/modules/presence/hooks/usePresence";
import {
  canManageMembers,
  canInviteMembers,
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
import {
  useCreateChamaInvite,
  useChamaJoinRequests,
  useInvalidateChamaJoinRequests,
} from "@/modules/chama/hooks/useChamaInvite";

import EditProfileModal from "../components/EditProfileModal";
import Spinner from "@/shared/components/ui/Spinner";

const ROLE_OPTIONS = [
  { value: "member", label: "Member", description: "Standard member with voting & contribution rights." },
  { value: "treasurer", label: "Treasurer", description: "Financial officer with payout & disbursement authority." },
  { value: "secretary", label: "Secretary", description: "Write access to meeting minutes and announcements." },
  { value: "auditor", label: "Auditor", description: "Read-only access to audit logs and loan reviews." },
  { value: "chairperson", label: "Chairperson", description: "Full administrative & governance authority." },
  { value: "committee_member", label: "Committee Member", description: "Governance committee member with poll voting rights." },
  { value: "patron", label: "Patron", description: "Advisory role with read-only access across Chama." },
];

const formatRoleLabel = (role) => {
  if (!role) return "Member";
  const found = ROLE_OPTIONS.find((r) => r.value === role?.toLowerCase());
  if (found) return found.label;
  return String(role).charAt(0).toUpperCase() + String(role).slice(1);
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

  const { data: members = [], isLoading } = useMembers(type, workspaceId);
  const { data: presence = [] } = usePresence(workspaceId);

  const addMember = useAddMember(type, workspaceId);
  const updateRole = useUpdateMemberRole(type, workspaceId);
  const removeMember = useRemoveMember(type, workspaceId);
  const updateProfile = useUpdateMemberProfile(type, workspaceId);
  const updateStatus = useUpdateMemberStatus(type, workspaceId);
  const transferTreasurer = useTransferTreasurer(type, workspaceId);

  const isChamaWorkspace = type === "chama";
  const createInvite = useCreateChamaInvite(workspaceId);
  const { data: joinRequests = [] } = useChamaJoinRequests(workspaceId, manage && isChamaWorkspace);
  const invalidateJoinRequests = useInvalidateChamaJoinRequests(workspaceId);

  const [editingMember, setEditingMember] = useState(null);
  const [reassignRoleMember, setReassignRoleMember] = useState(null);
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState("member");
  const [removeConfirmMember, setRemoveConfirmMember] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");

  // Quick Add Member Form State
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [addingPhone, setAddingPhone] = useState(false);

  // Invite Link State
  const [inviteLink, setInviteLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [decidingRequestId, setDecidingRequestId] = useState(null);

  const userId = user?.id ?? user?._id;
  const activeCount = members.filter((m) => m.status !== "inactive" && m.status !== "suspended").length;
  const pendingInvitesCount = joinRequests.length;

  // Click outside listener for action dropdowns
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddMemberByPhone = async (e) => {
    e.preventDefault();
    if (!newMemberPhone.trim()) return;
    try {
      setAddingPhone(true);
      setActionError(null);
      await addMember.mutateAsync({ phone: newMemberPhone, name: newMemberName });
      setNewMemberName("");
      setNewMemberPhone("");
      setActionSuccess("Member added successfully!");
      setTimeout(() => setActionSuccess(null), 4000);
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
      setActionSuccess("Member profile updated successfully.");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to update member profile.");
    }
  };

  const handleReassignRole = async (e) => {
    e.preventDefault();
    if (!reassignRoleMember) return;
    try {
      setActionError(null);
      await updateRole.mutateAsync({
        memberId: reassignRoleMember._id,
        role: selectedRoleToAssign,
      });
      setReassignRoleMember(null);
      setActionSuccess(`Role updated to ${formatRoleLabel(selectedRoleToAssign)} successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setActionError(err.response?.data?.message || "Could not reassign role.");
    }
  };

  const handleToggleStatus = async (member) => {
    setOpenDropdownId(null);
    setActionError(null);
    const nextStatus = member.status === "suspended" ? "active" : "suspended";
    try {
      await updateStatus.mutateAsync({
        memberId: member._id,
        status: nextStatus,
      });
      setActionSuccess(`Member ${nextStatus === "suspended" ? "suspended" : "activated"} successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setActionError(err.response?.data?.message || "Could not update member status.");
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeConfirmMember) return;
    try {
      setActionError(null);
      await removeMember.mutateAsync(removeConfirmMember._id);
      setRemoveConfirmMember(null);
      setActionSuccess("Member removed from Chama.");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to remove member.");
    }
  };

  const handleGenerateInviteLink = async () => {
    try {
      setActionError(null);
      const result = await createInvite.mutateAsync({});
      const path = result?.join_path || `/chamas/join?token=${result?.token}`;
      setInviteLink(`${window.location.origin}${path}`);
      setLinkCopied(false);
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to generate invite link.");
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {}
  };

  const handleJoinRequestDecision = async (request, decision) => {
    setActionError(null);
    setDecidingRequestId(request._id);
    try {
      await updateStatus.mutateAsync({
        memberId: request._id,
        status: decision === "approve" ? "active" : "removed",
      });
      invalidateJoinRequests();
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          `Could not ${decision === "approve" ? "approve" : "decline"} this request.`
      );
    } finally {
      setDecidingRequestId(null);
    }
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium mb-1">
            <Link to={`/workspace/${workspaceId}`} className="hover:text-slate-600 dark:hover:text-slate-200">
              {workspace?.name || "workspace"}
            </Link>
            <span>›</span>
            <span className="text-slate-600 dark:text-slate-300 font-bold">Members Directory</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Members Directory
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

      {/* Action Messages */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Top 3 Metric Cards */}
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
        </div>
      </div>

      {/* Add Member Form */}
      {manage && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Add Member by Phone</h2>
              <p className="text-xs text-slate-400">Enter phone number of active registered user.</p>
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

      {/* Members List Container */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Members List</h2>
              <p className="text-xs text-slate-400">Manage and assign roles for members in this workspace.</p>
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
          </div>
        </div>

        {/* Members Table */}
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[300px]" ref={dropdownRef}>
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
                    const isSuspended = member.status === "suspended";
                    const isDropdownOpen = openDropdownId === member._id;

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
                            </div>
                          </div>
                        </td>

                        {/* Role Column */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/50">
                            {formatRoleLabel(member.role)}
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
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                              <span className="h-2 w-2 rounded-full bg-rose-500" /> Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active
                            </span>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 text-right relative">
                          <div className="flex items-center justify-end gap-2">
                            {/* 3-Dots Action Button */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenDropdownId(isDropdownOpen ? null : member._id)}
                                className={`flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                                  isDropdownOpen
                                    ? "border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-500"
                                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                }`}
                                title="Member options"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {/* Dropdown Menu */}
                              {isDropdownOpen && (
                                <div className="absolute right-0 top-10 z-50 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 text-left animate-in fade-in duration-150">
                                  {manage && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        setReassignRoleMember(member);
                                        setSelectedRoleToAssign(member.role || "member");
                                      }}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 transition"
                                    >
                                      <Award size={14} className="text-indigo-600 dark:text-indigo-400" />
                                      Reassign Role
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      setEditingMember(member);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                                  >
                                    <Pencil size={14} className="text-blue-600" />
                                    Edit Profile
                                  </button>

                                  {manage && !isSelf && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStatus(member)}
                                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                                        isSuspended
                                          ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                                          : "text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                                      }`}
                                    >
                                      {isSuspended ? (
                                        <>
                                          <UserCheck size={14} className="text-emerald-600" />
                                          Activate Member
                                        </>
                                      ) : (
                                        <>
                                          <ShieldAlert size={14} className="text-amber-600" />
                                          Suspend Member
                                        </>
                                      )}
                                    </button>
                                  )}

                                  {manage && !isSelf && (
                                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                  )}

                                  {manage && !isSelf && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        setRemoveConfirmMember(member);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950 transition"
                                    >
                                      <UserX size={14} />
                                      Remove Member
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400 font-medium">
                      No members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reassign Role Modal */}
      {reassignRoleMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Award size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Reassign Role</h3>
                  <p className="text-xs text-slate-500">
                    {reassignRoleMember.user_id?.name || "Member"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReassignRoleMember(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleReassignRole} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Select New Governance Role
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {ROLE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex flex-col p-3 rounded-2xl border cursor-pointer transition-all ${
                        selectedRoleToAssign === opt.value
                          ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/50 dark:border-indigo-500"
                          : "border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {opt.label}
                        </span>
                        <input
                          type="radio"
                          name="role"
                          value={opt.value}
                          checked={selectedRoleToAssign === opt.value}
                          onChange={(e) => setSelectedRoleToAssign(e.target.value)}
                          className="accent-indigo-600"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">{opt.description}</p>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignRoleMember(null)}
                  className="w-1/2 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateRole.isPending}
                  className="w-1/2 rounded-2xl bg-indigo-600 py-3 text-xs font-black text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updateRole.isPending ? "Saving..." : "Save Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removeConfirmMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
              <UserX size={24} />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Remove Member</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove <strong>{removeConfirmMember.user_id?.name || "this member"}</strong> from this workspace?
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRemoveConfirmMember(null)}
                className="w-1/2 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={removeMember.isPending}
                className="w-1/2 rounded-2xl bg-rose-600 py-3 text-xs font-black text-white shadow-md hover:bg-rose-700 disabled:opacity-50"
              >
                {removeMember.isPending ? "Removing..." : "Remove Member"}
              </button>
            </div>
          </div>
        </div>
      )}

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