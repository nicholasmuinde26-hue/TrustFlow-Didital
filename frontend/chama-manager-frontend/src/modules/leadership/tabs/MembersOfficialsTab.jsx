import { useState } from "react";
import {
  Award,
  Check,
  Clock,
  Crown,
  Loader2,
  Phone,
  Send,
  ShieldAlert,
  UserCheck,
  UserPlus,
  UserX,
  UsersRound,
  X,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import {
  useMembers,
  useAddMember,
  useUpdateMemberRole,
  useRemoveMember,
  useUpdateMemberStatus,
} from "@/modules/members/hooks/useMembers";
import {
  useCreateChamaInvite,
  useChamaJoinRequests,
  useInvalidateChamaJoinRequests,
} from "@/modules/chama/hooks/useChamaInvite";

import {
  EmptyState,
  InputField,
  Notice,
  RoleLocked,
  SectionCard,
} from "../components/DeskUI";

// ========================================
// MEMBERS & OFFICIALS TAB
// ========================================
//
// This is where the approve / change-role / suspend / remove controls
// now live — the ones that used to sit inside MembersPage, the page
// every ordinary member opens just to browse the directory. Having
// leadership mutations render on a member-facing page was the second
// half of the "colliding surfaces" problem; MembersPage is now
// browse-only and these are here, behind the PIN.
//
// The backend endpoints are unchanged. Role changes additionally
// require a fresh PIN (requireLeadershipStepUp on the route) — the
// modal for that is raised globally by the API layer, so nothing in
// this file has to know about it.
//
// ========================================

const ROLE_OPTIONS = [
  { value: "member", label: "Member", description: "Standard member with voting & contribution rights." },
  { value: "treasurer", label: "Treasurer", description: "Financial officer with payout & disbursement authority." },
  { value: "secretary", label: "Secretary", description: "Write access to meeting minutes and announcements." },
  { value: "auditor", label: "Auditor", description: "Read-only access to audit logs and loan reviews." },
  { value: "chairperson", label: "Chairperson", description: "Full administrative & governance authority." },
  { value: "committee_member", label: "Committee Member", description: "Governance committee member with poll voting rights." },
  { value: "patron", label: "Patron", description: "Advisory role with read-only access across Chama." },
];

const roleLabel = (role) =>
  ROLE_OPTIONS.find((option) => option.value === role)?.label ||
  String(role || "member").replace(/_/g, " ");

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export default function MembersOfficialsTab({
  workspaceId,
  type,
  role,
  isChairperson,
  data,
  reload,
}) {
  const { user } = useAuth();
  const userId = user?.id ?? user?._id;

  const { data: members = [], isLoading } = useMembers(type, workspaceId);
  const addMember = useAddMember(type, workspaceId);
  const updateRole = useUpdateMemberRole(type, workspaceId);
  const updateStatus = useUpdateMemberStatus(type, workspaceId);
  const removeMember = useRemoveMember(type, workspaceId);

  const createInvite = useCreateChamaInvite(workspaceId);
  const { data: joinRequests = [] } = useChamaJoinRequests(workspaceId, true);
  const invalidateJoinRequests = useInvalidateChamaJoinRequests(workspaceId);

  const [feedback, setFeedback] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [inviteLink, setInviteLink] = useState(null);
  const [decidingId, setDecidingId] = useState(null);
  const [roleTarget, setRoleTarget] = useState(null);
  const [selectedRole, setSelectedRole] = useState("member");
  const [removeTarget, setRemoveTarget] = useState(null);

  const isSystemAdmin = ["super_admin", "sub_admin"].includes(
    String(user?.systemRole || "").toLowerCase()
  );

  // Role assignment stays Chairperson-only, matching
  // canManageMembersAsChairperson and the backend's own gate. The PIN is
  // a second factor on top of that, never a substitute for it.
  const canChangeRoles = isChairperson || isSystemAdmin;
  const canSuspendOrRemove = isChairperson || isSystemAdmin;

  const hasActiveTreasurer = members.some(
    (member) => member.status === "active" && member.role === "treasurer"
  );
  const treasurerRequired = isChairperson && !hasActiveTreasurer;

  const say = (tone, text) => {
    setFeedback({ tone, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // A cancelled PIN prompt is a decision, not a failure — the API layer
  // flags it so we can stay quiet instead of showing an error.
  const report = (error, fallback) => {
    if (error?.leadershipCancelled) return;
    say("error", error?.response?.data?.message || fallback);
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!newPhone.trim()) return;

    try {
      await addMember.mutateAsync({ phone: newPhone, name: newName });
      setNewName("");
      setNewPhone("");
      say("success", "Member added.");
    } catch (error) {
      report(error, "Could not add that member.");
    }
  };

  const handleJoinDecision = async (request, decision) => {
    setDecidingId(request._id);
    try {
      await updateStatus.mutateAsync({
        memberId: request._id,
        status: decision === "approve" ? "active" : "removed",
      });
      invalidateJoinRequests();
      say(
        "success",
        `${request.user_id?.name || "Member"}'s request was ${
          decision === "approve" ? "approved" : "declined"
        }.`
      );
    } catch (error) {
      report(error, "Could not action that request.");
    } finally {
      setDecidingId(null);
    }
  };

  const handleRoleSave = async (event) => {
    event.preventDefault();
    if (!roleTarget) return;

    // The one management action still permitted while the Chama has no
    // active Treasurer is appointing one — everything else is locked
    // until the seat is filled (mirrors requireChamaTreasurer).
    if (treasurerRequired && selectedRole !== "treasurer") {
      say("error", "Appoint a Treasurer first — other role changes are locked.");
      return;
    }

    try {
      await updateRole.mutateAsync({
        memberId: roleTarget._id,
        role: selectedRole,
      });
      setRoleTarget(null);
      say("success", `Role updated to ${roleLabel(selectedRole)}.`);
      reload?.();
    } catch (error) {
      report(error, "Could not reassign that role.");
    }
  };

  const handleToggleStatus = async (member) => {
    const nextStatus = member.status === "suspended" ? "active" : "suspended";

    try {
      await updateStatus.mutateAsync({ memberId: member._id, status: nextStatus });
      say(
        "success",
        `Member ${nextStatus === "suspended" ? "suspended" : "returned to the Chama"}.`
      );
    } catch (error) {
      report(error, "Could not update that member's status.");
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;

    try {
      const result = await removeMember.mutateAsync(removeTarget._id);
      const amount =
        result?.exitRequest?.savings_amount ??
        result?.data?.exitRequest?.savings_amount;

      setRemoveTarget(null);
      say(
        "success",
        Number(amount || 0) > 0
          ? `Exit started. KES ${Number(amount).toLocaleString()} in savings awaits approval before disbursement.`
          : "Exit started. No withdrawable savings; approval will be recorded before the membership closes."
      );
    } catch (error) {
      report(error, "Could not start the exit process.");
    }
  };

  const handleInviteLink = async () => {
    try {
      const result = await createInvite.mutateAsync({});
      const path = result?.join_path || `/chamas/join?token=${result?.token}`;
      setInviteLink(`${window.location.origin}${path}`);
    } catch (error) {
      report(error, "Could not generate an invite link.");
    }
  };

  const officials = (data?.officials || []).filter(Boolean);

  return (
    <div className="space-y-6">
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}

      {treasurerRequired && (
        <Notice tone="warn">
          This Chama has no active Treasurer. Management operations stay locked
          until an active member is promoted into the seat.
        </Notice>
      )}

      {/* ---------------- Join requests ---------------- */}
      {joinRequests.length > 0 && (
        <SectionCard
          icon={Clock}
          title="Pending join requests"
          description={`${joinRequests.length} ${
            joinRequests.length === 1 ? "person is" : "people are"
          } waiting on a decision.`}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {joinRequests.map((request) => {
              const requester = request.user_id || {};
              const name = requester.name || requester.first_name || "Unknown user";
              const deciding = decidingId === request._id;

              return (
                <li
                  key={request._id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-sm font-black text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {initials(name)}
                    </span>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {name}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {requester.phone || requester.email || "No contact"}
                        {request.invited_by?.name
                          ? ` · via ${request.invited_by.name}'s invite`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={deciding}
                      onClick={() => handleJoinDecision(request, "decline")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <X size={14} /> Decline
                    </button>
                    <button
                      type="button"
                      disabled={deciding}
                      onClick={() => handleJoinDecision(request, "approve")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {deciding ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Approve
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {/* ---------------- Add + invite ---------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={UserPlus}
          title="Add a member by phone"
          description="Enrol someone who already has an account on the platform."
        >
          <form onSubmit={handleAdd} className="space-y-4">
            <InputField
              label="Name (optional)"
              value={newName}
              onChange={setNewName}
              placeholder="e.g. John Doe"
            />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phone number
              </label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                  placeholder="e.g. 0712345678"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={addMember.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {addMember.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Adding
                </>
              ) : (
                <>
                  <UserPlus size={14} /> Add member
                </>
              )}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          icon={Send}
          title="Invite link"
          description="Share a link anyone can use to request to join. Requests land above for approval."
        >
          <button
            type="button"
            onClick={handleInviteLink}
            disabled={createInvite.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <Send size={14} /> Generate invite link
          </button>

          {inviteLink && (
            <div className="space-y-2">
              <input
                readOnly
                value={inviteLink}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(inviteLink);
                  say("success", "Invite link copied.");
                }}
                className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Copy link
              </button>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ---------------- Officials ---------------- */}
      <SectionCard
        icon={Crown}
        title="Officials registry"
        description="Who currently holds each governance seat."
      >
        {officials.length ? (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {officials.map((official) => (
              <li
                key={official._id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50"
              >
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {official.user_id?.name || "Official"}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {official.user_id?.phone || official.user_id?.email || "—"}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {roleLabel(official.role)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Crown}
            title="No officials assigned"
            detail="Promote members below to fill the governance seats."
          />
        )}
      </SectionCard>

      {/* ---------------- Member management ---------------- */}
      <SectionCard
        icon={UsersRound}
        title="Manage members"
        description="Roles, suspensions and exits. The member-facing directory is read-only."
      >
        {!canChangeRoles && (
          <RoleLocked>
            Only the chairperson can change roles, suspend members, or start an
            exit. You can still add members and approve join requests.
          </RoleLocked>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-[11px] font-black uppercase text-slate-400 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-3">Member</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold dark:divide-slate-800/60">
                {members.map((member) => {
                  const memberUser = member.user_id || {};
                  const isSelf =
                    Boolean(userId) &&
                    String(memberUser._id ?? memberUser.id) === String(userId);
                  const isSuspended = member.status === "suspended";

                  return (
                    <tr key={member._id}>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            {initials(memberUser.name || memberUser.first_name)}
                          </span>
                          <div>
                            <p className="font-black text-slate-900 dark:text-white">
                              {memberUser.name || memberUser.first_name || "Member"}
                              {isSelf && (
                                <span className="ml-1 font-normal text-slate-400">(you)</span>
                              )}
                            </p>
                            <p className="font-mono text-[11px] text-slate-400">
                              {memberUser.phone || memberUser.email || "No contact"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <span className="rounded-xl border border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {roleLabel(member.role)}
                        </span>
                      </td>

                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 font-bold ${
                            isSuspended
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isSuspended ? "bg-rose-500" : "bg-emerald-500"
                            }`}
                          />
                          {isSuspended ? "Suspended" : "Active"}
                        </span>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {canChangeRoles && !isSelf && member.status === "active" && (
                            <button
                              type="button"
                              onClick={() => {
                                setRoleTarget(member);
                                setSelectedRole(member.role || "member");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                            >
                              <Award size={13} /> Role
                            </button>
                          )}

                          {canSuspendOrRemove && !isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(member)}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                                isSuspended
                                  ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                  : "text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                              }`}
                            >
                              {isSuspended ? <UserCheck size={13} /> : <ShieldAlert size={13} />}
                              {isSuspended ? "Reinstate" : "Suspend"}
                            </button>
                          )}

                          {canSuspendOrRemove && !isSelf && (
                            <button
                              type="button"
                              onClick={() => setRemoveTarget(member)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                            >
                              <UserX size={13} /> Exit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ---------------- Role modal ---------------- */}
      {roleTarget && (
        <Modal onClose={() => setRoleTarget(null)}>
          <div className="space-y-4">
            <header>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Reassign role
              </h3>
              <p className="text-xs text-slate-500">
                {roleTarget.user_id?.name || "Member"} — you'll be asked for your
                PIN to confirm.
              </p>
            </header>

            <form onSubmit={handleRoleSave} className="space-y-4">
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {ROLE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer flex-col rounded-2xl border p-3 transition ${
                      selectedRole === option.value
                        ? "border-emerald-600 bg-emerald-50/60 dark:border-emerald-500 dark:bg-emerald-950/40"
                        : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {option.label}
                      </span>
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={selectedRole === option.value}
                        onChange={(event) => setSelectedRole(event.target.value)}
                        className="accent-emerald-600"
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                      {option.description}
                    </p>
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRoleTarget(null)}
                  className="w-1/2 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateRole.isPending}
                  className="w-1/2 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {updateRole.isPending ? "Saving…" : "Save role"}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ---------------- Exit modal ---------------- */}
      {removeTarget && (
        <Modal onClose={() => setRemoveTarget(null)}>
          <div className="space-y-4 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
              <UserX size={22} />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Start the exit process
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                This begins a formal exit for{" "}
                <strong>{removeTarget.user_id?.name || "this member"}</strong>.
                Arrears and outstanding loans are checked first; any withdrawable
                savings still need approval before they're disbursed.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className="w-1/2 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removeMember.isPending}
                className="w-1/2 rounded-2xl bg-rose-600 py-3 text-xs font-black text-white shadow-md transition hover:bg-rose-500 disabled:opacity-50"
              >
                {removeMember.isPending ? "Checking…" : "Start exit"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}
