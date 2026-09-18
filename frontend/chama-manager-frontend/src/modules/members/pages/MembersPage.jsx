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
  AlertCircle,
  ArrowLeft,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import { usePresence } from "@/modules/presence/hooks/usePresence";
import { useTrustScore } from "@/modules/trustScore/hooks/useTrustScore";
import {
  canManageMembers,
  canInviteMembers,
  canManageMembersAsChairperson,
  canEditChamaSettings,
  canManageAnnouncements,
  canManageMeetings,
  canManagePolls,
  isLoanOfficial,
  canDisburseLoan,
  canManageDisputes,
  canViewLeadershipDesk,
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
import AuditTrailPanel from "@/modules/audit/components/AuditTrailPanel";

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

// Governs the Members List order: management roles (anything but plain
// "member") sort ABOVE regular members, ordered by seniority of office
// among themselves. Regular members sort below, oldest-joined first —
// so a newly-added member always lands at the very bottom. Promoting a
// member out of the "member" role moves them into the management block
// (the top of the list) immediately, since sorting is derived fresh
// from each member's current role on every render.
const MANAGEMENT_ROLE_PRIORITY = {
  chairperson: 0,
  treasurer: 1,
  secretary: 2,
  auditor: 3,
  committee_member: 4,
  patron: 5,
};

const memberJoinTime = (m) => new Date(m.createdAt || m.joined_at || 0).getTime();

function compareMembersForDisplay(a, b) {
  const aIsManagement = a.role !== "member";
  const bIsManagement = b.role !== "member";

  if (aIsManagement !== bIsManagement) {
    return aIsManagement ? -1 : 1;
  }

  if (aIsManagement && bIsManagement) {
    const priorityDiff =
      (MANAGEMENT_ROLE_PRIORITY[a.role] ?? 99) - (MANAGEMENT_ROLE_PRIORITY[b.role] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;
  }

  // Same group (both management, at the same rank, or both regular
  // members) — oldest joined first, newest last.
  return memberJoinTime(a) - memberJoinTime(b);
}

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

  // Burial Chamas are Chama documents underneath (same membership model,
  // same invite/join-request routes), so they follow the same rule here.
  const isBurialChama = type === "burial-chama";
  const isChamaWorkspace = type === "chama" || isBurialChama;

  // ----------------------------------------------------------------
  // Member-facing by design.
  //
  // This page is what an ORDINARY member opens to browse the directory,
  // so for Chama-backed workspaces it no longer carries any leadership
  // mutation — approve/decline join requests, reassign roles, suspend,
  // remove, add-by-phone all moved to the Leadership Desk's
  // "Members & Officials" tab, behind the leadership PIN. Having those
  // controls render on the page every member visits was half of the
  // "colliding surfaces" problem this redesign set out to fix.
  //
  // Contribution Groups are deliberately unchanged: they have no
  // Leadership Desk, so this page remains their management surface and
  // stripping it would leave organizers with nowhere to go.
  // ----------------------------------------------------------------
  const leadershipDeskOwnsManagement = isChamaWorkspace;

  const manage =
    canManageMembers(workspace?.role, type) && !leadershipDeskOwnsManagement;
  const chairpersonManage =
    canManageMembersAsChairperson(workspace?.role, type) &&
    !leadershipDeskOwnsManagement;
  const canInvite = canInviteMembers(workspace?.role, type);

  const { data: members = [], isLoading } = useMembers(type, workspaceId);
  const { data: presence = [] } = usePresence(workspaceId);

  const addMember = useAddMember(type, workspaceId);
  const updateRole = useUpdateMemberRole(type, workspaceId);
  const removeMember = useRemoveMember(type, workspaceId);
  const updateProfile = useUpdateMemberProfile(type, workspaceId);
  const updateStatus = useUpdateMemberStatus(type, workspaceId);
  const transferTreasurer = useTransferTreasurer(type, workspaceId);

  const createInvite = useCreateChamaInvite(workspaceId);
  const { data: joinRequests = [] } = useChamaJoinRequests(workspaceId, manage && isChamaWorkspace);
  const invalidateJoinRequests = useInvalidateChamaJoinRequests(workspaceId);

  const [editingMember, setEditingMember] = useState(null);
  const [reassignRoleMember, setReassignRoleMember] = useState(null);
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState("member");
  const [removeConfirmMember, setRemoveConfirmMember] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [treasurerRequiredModal, setTreasurerRequiredModal] = useState(false);
  const { data: trustScore } = useTrustScore(workspaceId);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [activeSection, setActiveSection] = useState("members"); // 'members' | 'roles' | 'invitations' | 'audit'
  const canViewAuditTrail = ["treasurer", "auditor"].includes(String(workspace?.role || "").toLowerCase());

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
  const activeCount = members.filter((m) => m.status === "active").length;
  const suspendedCount = members.filter((m) => m.status === "suspended").length;
  const hasActiveTreasurer = members.some((m) => m.status === "active" && m.role === "treasurer");
  const isChairperson = String(workspace?.role || "").toLowerCase() === "chairperson";
  const isSystemAdmin = ["super_admin", "sub_admin"].includes(String(user?.systemRole || "").toLowerCase());
  const canChangeChamaRoles = leadershipDeskOwnsManagement
    ? false
    : isChamaWorkspace
    ? isChairperson || isSystemAdmin
    : manage;
  const treasurerRequired =
    isChamaWorkspace &&
    isChairperson &&
    !hasActiveTreasurer &&
    !leadershipDeskOwnsManagement;
  const governanceHealth = treasurerRequired
    ? { label: "Needs attention", detail: "No active treasurer assigned", tone: "warn" }
    : suspendedCount > 0
    ? { label: "Review needed", detail: `${suspendedCount} suspended ${suspendedCount === 1 ? "member" : "members"}`, tone: "warn" }
    : { label: "Excellent", detail: "All required roles assigned", tone: "good" };
  const pendingInvitesCount = joinRequests.length;

  const guardChairpersonOperation = () => {
    if (treasurerRequired) {
      setOpenDropdownId(null);
      setTreasurerRequiredModal(true);
      return true;
    }
    return false;
  };

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
    if (guardChairpersonOperation()) {
      setEditingMember(null);
      return;
    }
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

    // The one permitted management action while the Chama has no
    // Treasurer is appointing the Treasurer itself.
    if (treasurerRequired && selectedRoleToAssign !== "treasurer") {
      setReassignRoleMember(null);
      setTreasurerRequiredModal(true);
      return;
    }

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

    // Suspending the current Treasurer is intentionally allowed because
    // it is one of the ways a Chama can lose its Treasurer. Once that
    // happens, all other management actions are locked until a new
    // Treasurer is appointed.
    if (treasurerRequired && !(member.role === "treasurer" && nextStatus === "suspended")) {
      setTreasurerRequiredModal(true);
      return;
    }
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
    if (guardChairpersonOperation()) {
      setRemoveConfirmMember(null);
      return;
    }
    try {
      setActionError(null);
      const result = await removeMember.mutateAsync(removeConfirmMember._id);
      setRemoveConfirmMember(null);
      const amount = result?.exitRequest?.savings_amount ?? result?.data?.exitRequest?.savings_amount;
      setActionSuccess(Number(amount || 0) > 0
        ? `Exit process started. KES ${Number(amount).toLocaleString()} savings refund is awaiting the required approvals before disbursement.`
        : "Exit process started. The member has no withdrawable savings balance; the required approval will be recorded before the membership is closed.");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to start the member exit process.";
      if (err.response?.status === 409 && /arrears|loan|financial clearance/i.test(message)) {
        window.alert(`MEMBER EXIT BLOCKED\n\n${message}\n\nThe member must clear the outstanding financial obligations before the Chama can close the membership.`);
      }
      setActionError(message);
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
      setActionSuccess(
        decision === "approve"
          ? `${request.user_id?.name || "Member"}'s request to join was approved.`
          : `${request.user_id?.name || "Member"}'s request to join was declined.`
      );
      setTimeout(() => setActionSuccess(null), 4000);
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

  const filteredMembers = members
    .filter((m) => {
      const u = m.user_id || {};
      const nameStr = (u.name || u.first_name || "").toLowerCase();
      const phoneStr = (u.phone || u.email || "").toLowerCase();
      const matchesSearch = nameStr.includes(searchQuery.toLowerCase()) || phoneStr.includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? m.status !== "suspended" && m.status !== "inactive" : m.status === statusFilter);
      return matchesSearch && matchesStatus;
    })
    .sort(compareMembersForDisplay);

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-mist pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to={`/workspace/${workspaceId}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-mist-muted dark:hover:text-mist mb-2 transition"
          >
            <ArrowLeft size={14} /> Command Center
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
            {isBurialChama ? "Welfare Members" : "People & governance"}
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-mist-muted">
            {isBurialChama
              ? `${members.length} members covered under this welfare fund`
              : "Manage members, roles and the decisions that keep your group trusted."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isBurialChama && (
            <Link
              to={`/workspace/${workspaceId}/beneficiaries`}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised transition"
            >
              <ShieldCheck size={14} /> Manage Beneficiaries
            </Link>
          )}
          {canChangeChamaRoles && (
            <button
              type="button"
              onClick={() => setShowRolesModal(true)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised transition"
            >
              <ShieldAlert size={14} /> Roles &amp; rules
            </button>
          )}
          {/* Chama invite-link generation is a leadership mutation and now
              lives only in the Leadership Desk's "Members & Officials" tab
              (see modules/leadership/tabs/MembersOfficialsTab.jsx) — this
              button used to duplicate it for every member. Contribution
              Groups have no Leadership Desk, so their organizer/
              co-organizer still invites from here. */}
          {manage && (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 dark:bg-mint dark:text-obsidian-rail dark:hover:bg-mint-hover transition"
            >
              <UserPlus size={14} /> + Invite member
            </button>
          )}
          <button
            type="button"
            onClick={handleExportMembers}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted dark:hover:bg-obsidian-raised transition"
            title="Export CSV"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-obsidian-border pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveSection("members")}
          className={`px-4 py-2 text-xs font-bold transition border-b-2 ${
            activeSection === "members"
              ? "border-emerald-600 text-emerald-600 dark:border-mint dark:text-mint"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-mist-muted dark:hover:text-mist"
          }`}
        >
          Members
        </button>
        {/* Roles & Invitations are management mutations. For a Chama,
            leadershipDeskOwnsManagement makes canChangeChamaRoles/manage
            false and these tabs move to the Leadership Desk's "Members &
            Officials" tab instead — no duplicate control surface here.
            Contribution Groups have no Leadership Desk, so their
            organizer/co-organizer keeps these tabs on this page. */}
        {canChangeChamaRoles && (
          <button
            onClick={() => setActiveSection("roles")}
            className={`px-4 py-2 text-xs font-bold transition border-b-2 ${
              activeSection === "roles"
                ? "border-emerald-600 text-emerald-600 dark:border-mint dark:text-mint"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-mist-muted dark:hover:text-mist"
            }`}
          >
            Roles &amp; permissions
          </button>
        )}
        {manage && (
          <button
            onClick={() => setActiveSection("invitations")}
            className={`px-4 py-2 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
              activeSection === "invitations"
                ? "border-emerald-600 text-emerald-600 dark:border-mint dark:text-mint"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-mist-muted dark:hover:text-mist"
            }`}
          >
            Invitations
            {pendingInvitesCount > 0 && (
              <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-black">
                {pendingInvitesCount}
              </span>
            )}
          </button>
        )}
        {canViewAuditTrail && (
          <button
            onClick={() => setActiveSection("audit")}
            className={`px-4 py-2 text-xs font-bold transition border-b-2 ${
              activeSection === "audit"
                ? "border-emerald-600 text-emerald-600 dark:border-mint dark:text-mint"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-mist-muted dark:hover:text-mist"
            }`}
          >
            Audit trail
          </button>
        )}
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

      {/* Top 3 Summary Cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Active Members */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-mist-muted">
            ACTIVE MEMBERS
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
              {members.length || 24}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-mint">
            <CheckCircle2 size={13} /> {activeCount || members.length} in good standing
          </p>
        </div>

        {/* Invitations */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-mist-muted">
            INVITATIONS
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
              {pendingInvitesCount} pending
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-mist-muted">
            <Clock size={13} /> 1 approved this month
          </p>
        </div>

        {/* Governance Health */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-mist-muted">
            GOVERNANCE HEALTH
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-black tracking-tight ${
                governanceHealth.tone === "good"
                  ? "text-slate-900 dark:text-mist"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {governanceHealth.tone === "good" ? "100% compliant" : governanceHealth.label}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-mint">
            <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-mint" />
            {governanceHealth.detail || "All required roles filled"}
          </p>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeSection === "audit" ? (
        <AuditTrailPanel chamaId={workspaceId} canView={canViewAuditTrail} />
      ) : activeSection === "roles" && canChangeChamaRoles ? (
        /* Roles & Permissions Matrix Tab */
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-mist">Roles &amp; Governance Matrix</h2>
                <p className="text-xs text-slate-500 dark:text-mist-muted">
                  Official structure ensuring collective transparency, separation of concerns, and compliance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRolesModal(true)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
              >
                View full constitution rules
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              {ROLE_OPTIONS.map((opt) => {
                const assignedMembers = members.filter((m) => m.role === opt.value && m.status === "active");
                return (
                  <div
                    key={opt.value}
                    className="rounded-2xl border border-slate-200/70 bg-slate-50/50 dark:border-obsidian-border dark:bg-obsidian-raised/30 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-slate-900 dark:text-mist capitalize">
                        {opt.label}
                      </span>
                      <span className="rounded-full bg-slate-200/70 dark:bg-obsidian px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-mist-muted">
                        {assignedMembers.length} {assignedMembers.length === 1 ? "person" : "people"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-mist-muted leading-relaxed">
                      {opt.description}
                    </p>
                    <div className="pt-2 border-t border-slate-200/50 dark:border-obsidian-border/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned To:</p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-mist mt-0.5 truncate">
                        {assignedMembers.length > 0
                          ? assignedMembers.map((m) => m.user_id?.name || m.user_id?.first_name || "Member").join(", ")
                          : "None assigned"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeSection === "invitations" && manage ? (
        /* Invitations Desk Tab */
        <div className="space-y-6">
          {/* Join Requests */}
          {joinRequests.length > 0 && (
            <div className="rounded-3xl border border-amber-200/80 bg-amber-50/40 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/10 overflow-hidden">
              <div className="flex items-center gap-3 p-6 border-b border-amber-200/60 dark:border-amber-900/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <Clock size={20} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-mist">
                    Pending Join Requests
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-mist-muted">
                    {joinRequests.length} {joinRequests.length === 1 ? "person is" : "people are"} waiting on your approval to join.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-amber-200/60 dark:divide-amber-900/30">
                {joinRequests.map((request) => {
                  const requester = request.user_id || {};
                  const name = requester.name || requester.first_name || "Unknown user";
                  const contact = requester.phone || requester.email || "No contact";
                  const isDeciding = decidingRequestId === request._id;

                  return (
                    <div
                      key={request._id}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 font-extrabold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-sm">
                          {initials(name)}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900 dark:text-mist">{name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-mist-muted font-mono">{contact}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isDeciding}
                          onClick={() => handleJoinRequestDecision(request, "decline")}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted transition"
                        >
                          <X size={14} /> Decline
                        </button>
                        <button
                          type="button"
                          disabled={isDeciding}
                          onClick={() => handleJoinRequestDecision(request, "approve")}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition"
                        >
                          <Check size={14} /> {isDeciding ? "Saving..." : "Approve"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Invite Link & Add by Phone */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card space-y-4">
              <h2 className="text-base font-black text-slate-900 dark:text-mist">Chama Invite Link</h2>
              <p className="text-xs text-slate-500 dark:text-mist-muted">
                Generate a secure one-click invitation link for new members to apply.
              </p>
              {inviteLink ? (
                <div className="space-y-3 pt-2">
                  <input
                    readOnly
                    value={inviteLink}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-mono text-slate-800 dark:border-obsidian-border dark:bg-obsidian dark:text-mist"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="flex-1 rounded-2xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 dark:bg-mint dark:text-obsidian-rail"
                    >
                      {linkCopied ? "Link Copied!" : "Copy Link"}
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateInviteLink}
                      className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-obsidian-border dark:text-mist"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateInviteLink}
                  disabled={createInvite.isPending}
                  className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-700 dark:bg-mint dark:text-obsidian-rail transition"
                >
                  {createInvite.isPending ? "Generating..." : "Generate Secure Invite Link"}
                </button>
              )}
            </div>

            {manage && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card space-y-4">
                <h2 className="text-base font-black text-slate-900 dark:text-mist">Direct Enrol by Phone</h2>
                <p className="text-xs text-slate-500 dark:text-mist-muted">
                  Enrol a registered user into this Chama immediately by phone number.
                </p>
                <form onSubmit={handleAddMemberByPhone} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Member Name (Optional)"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white dark:border-obsidian-border dark:bg-obsidian dark:text-mist"
                  />
                  <input
                    type="text"
                    placeholder="Phone number (e.g. 0712345678)"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white dark:border-obsidian-border dark:bg-obsidian dark:text-mist"
                  />
                  <button
                    type="submit"
                    disabled={addingPhone}
                    className="w-full rounded-2xl border border-slate-300 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised transition"
                  >
                    {addingPhone ? "Adding..." : "Add Member Now"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Members Tab (Image 1 2-column layout) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Your Members Directory (7/12 on lg, 8/12 on xl) */}
          <div className="lg:col-span-7 xl:col-span-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card space-y-5">
            {/* Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-mist">Your members</h2>
                <p className="text-xs text-slate-400">Active participants in this Chama</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-56 rounded-full border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-obsidian-border dark:bg-obsidian dark:text-mist dark:focus:border-mint"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "all" ? "active" : "all")}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                    statusFilter !== "all"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-600 dark:border-mint dark:bg-mint-deep dark:text-mint"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted"
                  }`}
                  title="Filter active status"
                >
                  <SlidersHorizontal size={14} />
                </button>
              </div>
            </div>

            {/* Members List */}
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Spinner />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                No members match your criteria.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-obsidian-border/60">
                {filteredMembers.map((member) => {
                  const u = member.user_id || {};
                  const name = u.name || u.first_name || "Member";
                  const phone = u.phone || u.email || "No contact";
                  const isSelf = Boolean(userId) && String(u._id || u.id) === String(userId);
                  const isSuspended = member.status === "suspended";
                  const joinedDate = member.createdAt
                    ? new Date(member.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                    : "Jan 2024";
                  const isDropdownOpen = openDropdownId === member._id;

                  // Role badge styling
                  let roleColorClass = "bg-slate-100 text-slate-700 dark:bg-obsidian-raised dark:text-mist-muted";
                  if (member.role === "chairperson")
                    roleColorClass = "bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-mint-deep dark:text-mint dark:border-mint-strong/40";
                  else if (member.role === "treasurer")
                    roleColorClass = "bg-amber-50 text-amber-700 border border-amber-200/50 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/40";
                  else if (member.role === "secretary")
                    roleColorClass = "bg-sky-50 text-sky-700 border border-sky-200/50 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/40";
                  else if (member.role === "auditor")
                    roleColorClass = "bg-indigo-50 text-indigo-700 border border-indigo-200/50 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/40";

                  return (
                    <div
                      key={member._id}
                      className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-obsidian-raised/20 px-2 rounded-2xl transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-obsidian-raised font-bold text-slate-800 dark:text-mist text-xs border border-slate-200/60 dark:border-obsidian-border">
                          {initials(name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-mist truncate flex items-center gap-1.5">
                            {name}
                            {isSelf && <span className="text-[10px] text-slate-400 font-normal">(you)</span>}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-mist-muted truncate font-mono mt-0.5">
                            {phone} · Joined {joinedDate}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Role Badge */}
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold capitalize ${roleColorClass}`}>
                          {formatRoleLabel(member.role)}
                        </span>

                        {/* Attendance / Status Badge */}
                        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-mint">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-mint" /> 8/8 attended
                        </span>

                        {/* Action Menu */}
                        {(manage || isSelf) && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenDropdownId(isDropdownOpen ? null : member._id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 dark:hover:bg-obsidian-raised dark:hover:text-mist transition"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {isDropdownOpen && (
                              <div className="absolute right-0 top-9 z-50 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-obsidian-border dark:bg-obsidian-card text-left">
                                {canChangeChamaRoles && !isSelf && member.status === "active" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      setReassignRoleMember(member);
                                      setSelectedRoleToAssign(member.role || "member");
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-mist-muted dark:hover:bg-obsidian-raised transition"
                                  >
                                    <Award size={14} className="text-emerald-600 dark:text-mint" /> Reassign Role
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    if (treasurerRequired) {
                                      setTreasurerRequiredModal(true);
                                      return;
                                    }
                                    setEditingMember(member);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-mist-muted dark:hover:bg-obsidian-raised transition"
                                >
                                  <Pencil size={14} className="text-sky-600" /> Edit Profile
                                </button>
                                {(chairpersonManage || isSystemAdmin) && !isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(member)}
                                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                                      isSuspended ? "text-emerald-600" : "text-amber-600"
                                    }`}
                                  >
                                    {isSuspended ? <UserCheck size={14} /> : <ShieldAlert size={14} />}
                                    {isSuspended ? "Return to Chama" : "Suspend Member"}
                                  </button>
                                )}
                                {(chairpersonManage || isSystemAdmin) && !isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      setRemoveConfirmMember(member);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                                  >
                                    <UserX size={14} /> Remove Member
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination / Count Footer */}
            <div className="pt-2 flex items-center justify-between text-xs text-slate-400 dark:text-mist-muted border-t border-slate-100 dark:border-obsidian-border">
              <span>Showing {filteredMembers.length} of {members.length} members</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled className="rounded-lg p-1 text-slate-300 dark:text-mist-muted/40 cursor-not-allowed">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" disabled className="rounded-lg p-1 text-slate-300 dark:text-mist-muted/40 cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Governance to-do & Trust center (5/12 on lg, 4/12 on xl) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* Governance To-do */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <h2 className="text-base font-black text-slate-900 dark:text-mist">Governance to-do</h2>
              <p className="text-xs text-slate-400 mt-0.5">Action items required to keep the Chama compliant</p>

              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-obsidian-border/50 dark:bg-obsidian-raised/30">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 dark:border-mint text-emerald-600 dark:text-mint">
                    <Check size={11} strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-mist">Approve AGM agenda</p>
                    <p className="text-[11px] text-slate-400 dark:text-mist-muted mt-0.5">
                      Drafted by Secretary · Due in 3 days
                    </p>
                  </div>
                </div>

                <Link
                  to={`/workspace/${workspaceId}/loans`}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-obsidian-border/50 dark:bg-obsidian-raised/30 hover:bg-slate-100/70 dark:hover:bg-obsidian-raised/60 transition group"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-amber-500 text-amber-500">
                    <Clock size={11} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-mist group-hover:text-emerald-600 dark:group-hover:text-mint transition">
                      Review 2 loan applications
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-mist-muted mt-0.5">
                      Awaiting committee sign-off
                    </p>
                  </div>
                  <ExternalLink size={12} className="text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-mint" />
                </Link>

                <Link
                  to={`/workspace/${workspaceId}/finance`}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-obsidian-border/50 dark:bg-obsidian-raised/30 hover:bg-slate-100/70 dark:hover:bg-obsidian-raised/60 transition group"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 dark:border-obsidian-border text-slate-400">
                    <Clock size={11} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-mist group-hover:text-emerald-600 dark:group-hover:text-mint transition">
                      Sign off March books
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-mist-muted mt-0.5">
                      Treasurer submitted · 1 pending approval
                    </p>
                  </div>
                  <ExternalLink size={12} className="text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-mint" />
                </Link>
              </div>
            </div>

            {/* Trust Center Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <h2 className="text-base font-black text-slate-900 dark:text-mist">Trust center</h2>
              <p className="text-xs text-slate-400 mt-0.5">Reputation and compliance score</p>

              <div className="mt-5 flex items-center justify-center">
                <div className="relative flex h-32 w-32 items-center justify-center">
                  <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#e2e8f0"
                      strokeWidth="8"
                      fill="none"
                      className="dark:stroke-obsidian-raised"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - (trustScore?.score ?? 94) / 100)}
                      className="text-emerald-500 dark:text-mint"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-black text-slate-900 dark:text-mist">
                      {trustScore?.score ?? 94}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-mint">
                      {trustScore?.grade ?? "EXCELLENT"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-slate-100 dark:border-obsidian-border pt-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500 dark:text-mist-muted">Attendance rate</span>
                  <span className="font-bold text-slate-900 dark:text-mist">
                    {trustScore?.components?.attendance?.score ?? 96}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500 dark:text-mist-muted">On-time payments</span>
                  <span className="font-bold text-slate-900 dark:text-mist">
                    {trustScore?.components?.contributions?.score ?? 92}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500 dark:text-mist-muted">Rule compliance</span>
                  <span className="font-bold text-slate-900 dark:text-mist">100%</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-obsidian-border text-center">
                <Link
                  to={`/workspace/${workspaceId}/trust-score`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-mint dark:hover:text-mint-hover"
                >
                  View trust breakdown →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-obsidian-card border border-slate-200 dark:border-obsidian-border space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-obsidian-border pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-mint">
                  MEMBERSHIP
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-mist">Invite a new member</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-obsidian-raised"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Shareable Invite Link */}
              <div className="rounded-2xl border border-slate-200 dark:border-obsidian-border p-4 space-y-2 bg-slate-50/50 dark:bg-obsidian-raised/30">
                <p className="text-xs font-bold text-slate-900 dark:text-mist">Share invite link</p>
                <p className="text-[11px] text-slate-400">
                  Share this link directly with new members to apply to join this Chama.
                </p>
                {inviteLink ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      readOnly
                      value={inviteLink}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-700 dark:border-obsidian-border dark:bg-obsidian dark:text-mist"
                    />
                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 dark:bg-mint dark:text-obsidian-rail"
                    >
                      {linkCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateInviteLink}
                    disabled={createInvite.isPending}
                    className="mt-1 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 dark:bg-mint dark:text-obsidian-rail transition"
                  >
                    {createInvite.isPending ? "Generating..." : "Generate Invite Link"}
                  </button>
                )}
              </div>

              {/* Add directly by phone */}
              {manage && (
                <form
                  onSubmit={handleAddMemberByPhone}
                  className="rounded-2xl border border-slate-200 dark:border-obsidian-border p-4 space-y-3 bg-slate-50/50 dark:bg-obsidian-raised/30"
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-mist">Or add directly by phone</p>
                  <input
                    type="text"
                    placeholder="Member Name (Optional)"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-900 dark:border-obsidian-border dark:bg-obsidian dark:text-mist"
                  />
                  <input
                    type="text"
                    placeholder="Phone number (e.g. 0712345678)"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-900 dark:border-obsidian-border dark:bg-obsidian dark:text-mist"
                  />
                  <button
                    type="submit"
                    disabled={addingPhone}
                    className="w-full rounded-xl border border-slate-300 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised transition"
                  >
                    {addingPhone ? "Adding..." : "Add Member Directly"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Treasurer Required Modal */}
      {treasurerRequiredModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-900 dark:bg-obsidian-card">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                <Crown size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-mist">
                  Treasurer Required
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-mist-muted">
                  This Chama cannot continue management operations without an active Treasurer.
                  Please promote an active member to Treasurer first.
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setTreasurerRequiredModal(false)}
                className="w-1/2 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-obsidian-border dark:text-mist-muted dark:hover:bg-obsidian-raised"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setTreasurerRequiredModal(false);
                  const candidate = members.find(
                    (m) =>
                      m.status === "active" &&
                      m.role !== "treasurer" &&
                      (!m.management_restriction_until || new Date(m.management_restriction_until) <= new Date())
                  );
                  if (candidate) {
                    setReassignRoleMember(candidate);
                    setSelectedRoleToAssign("treasurer");
                  }
                }}
                className="w-1/2 rounded-2xl bg-amber-600 py-3 text-xs font-black text-white hover:bg-amber-700"
              >
                Promote Treasurer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Role Modal */}
      {reassignRoleMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-obsidian-card border border-slate-200 dark:border-obsidian-border space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-violet-50 p-3 text-violet-600 dark:bg-mint-deep dark:text-mint">
                  <Award size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-mist">Reassign Role</h3>
                  <p className="text-xs text-slate-500">
                    {reassignRoleMember.user_id?.name || "Member"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReassignRoleMember(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-obsidian-raised"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleReassignRole} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-mist-muted">
                  Select New Governance Role
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {ROLE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex flex-col p-3 rounded-2xl border cursor-pointer transition-all ${
                        selectedRoleToAssign === opt.value
                          ? "border-violet-600 bg-violet-50/60 dark:bg-mint-deep/50 dark:border-mint"
                          : "border-slate-200 bg-slate-50/40 dark:border-obsidian-border dark:bg-obsidian"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-mist">
                          {opt.label}
                        </span>
                        <input
                          type="radio"
                          name="role"
                          value={opt.value}
                          checked={selectedRoleToAssign === opt.value}
                          onChange={(e) => setSelectedRoleToAssign(e.target.value)}
                          className="accent-violet-600"
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
                  className="w-1/2 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-obsidian-border dark:text-mist-muted dark:hover:bg-obsidian-raised"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateRole.isPending}
                  className="w-1/2 rounded-2xl bg-violet-600 py-3 text-xs font-black text-white shadow-md hover:bg-violet-700 disabled:opacity-50 dark:bg-mint dark:text-obsidian-rail dark:hover:bg-mint-hover"
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
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-obsidian-card border border-slate-200 dark:border-obsidian-border text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
              <UserX size={24} />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-mist">Remove Member</h3>
              <p className="text-xs text-slate-500 mt-1">
                This starts a formal Chama exit process for <strong>{removeConfirmMember.user_id?.name || "this member"}</strong>. The system will first check arrears and loans. If clear, any withdrawable savings will require approvals before disbursement.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRemoveConfirmMember(null)}
                className="w-1/2 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-obsidian-border dark:text-mist-muted dark:hover:bg-obsidian-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={removeMember.isPending}
                className="w-1/2 rounded-2xl bg-rose-600 py-3 text-xs font-black text-white shadow-md hover:bg-rose-700 disabled:opacity-50"
              >
                {removeMember.isPending ? "Checking finances..." : "Start Exit Process"}
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

      {/* Roles & Rules Modal */}
      {showRolesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-obsidian-card border border-slate-200 dark:border-obsidian-border space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-obsidian-border pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-mint">GOVERNANCE</span>
                <h3 className="text-base font-black text-slate-900 dark:text-mist">Roles &amp; rules</h3>
              </div>
              <button
                onClick={() => setShowRolesModal(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-obsidian-raised"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {ROLE_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className="flex items-start gap-3 rounded-2xl bg-slate-50 dark:bg-obsidian-raised/50 p-3.5 border border-slate-200/60 dark:border-obsidian-border/60"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-mint-deep dark:text-mint">
                    <Crown size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-mist">{opt.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-mist-muted">{opt.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {treasurerRequired && (
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-deep-text bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3.5 py-2.5">
                This workspace currently has no active Treasurer — management actions are locked until one is assigned.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}