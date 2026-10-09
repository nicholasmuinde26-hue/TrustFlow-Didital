import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, FolderPlus, KeyRound, LogOut, MailCheck } from "lucide-react";
import toast from "react-hot-toast";

import useAuth from "@/app/hooks/useAuth";
import Spinner from "@/shared/components/ui/Spinner";
import adminSupportService from "../services/adminSupport.service";
import useAdminProfile from "../hooks/useAdminProfile";
import { CaseRow } from "../components/support/CasesTab";
import NewCaseDialog from "../components/support/NewCaseDialog";
import NotesPanel from "../components/support/NotesPanel";
import { ActionDialog, BillingStatePill, btn, Card, EmptyState, errText, fmtDate, fmtDateTime, Pill } from "../components/support/supportUi";

function ToolRow({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><Icon size={15} /></span>
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-900 dark:text-white">{title}</p>
          <p className="text-[11px] text-slate-500">{hint}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export default function AdminSupportUserPage() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const { profile } = useAdminProfile();
  const isSuper = me?.systemRole === "super_admin";
  const canSupport = isSuper || profile?.permissions?.support === true;

  const [data, setData] = useState(null);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null); // unlock | logout | verify
  const [newCase, setNewCase] = useState(false);

  const load = useCallback(async () => {
    try {
      const [profileData, caseList] = await Promise.all([
        adminSupportService.getUser(userId),
        adminSupportService.listCases({ subject_type: "user", subject_id: userId, status: "all", limit: 10 }),
      ]);
      setData(profileData); setCases(caseList.items); setError("");
    } catch (err) { setError(errText(err, "Could not load this user")); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <Card><EmptyState>{error}</EmptyState></Card>;
  if (!data) return <Spinner />;

  const { user, security, chamas } = data;
  const displayName = user.name || user.phone;
  const protectedAccount = user.systemRole !== "user" && !isSuper;
  const unverified = !user.isPhoneVerified || user.status === "unverified";
  const canResend = unverified && user.status !== "suspended" && user.status !== "inactive";
  const isMe = String(user._id) === String(me?._id || me?.id);

  const dialogs = {
    unlock: {
      title: `Unlock ${displayName}`,
      description: "Clears the USSD PIN lockout and the count of wrong verification codes so they can try again. It does not lift a suspension.",
      confirmLabel: "Unlock",
      run: (v) => adminSupportService.unlockUser(userId, v),
    },
    logout: {
      title: `Sign ${displayName} out everywhere`,
      description: "Ends every active session on every device straight away. They will need to sign in again. Use this when an account may be in the wrong hands or a phone was lost.",
      confirmLabel: "Force logout", tone: "danger",
      run: (v) => adminSupportService.forceLogout(userId, v),
    },
    verify: {
      title: `Resend verification to ${displayName}`,
      description: "Sends a fresh code to their phone. The code is never shown here. You can send one a minute.",
      confirmLabel: "Send code",
      fields: [{ name: "channel", label: "Send by", type: "select", options: [["", "Their usual channel"], ["sms", "SMS"], ["whatsapp", "WhatsApp"], ["email", "Email"]], initial: "", required: false }],
      run: async (v) => {
        const res = await adminSupportService.resendVerification(userId, { reason: v.reason, channel: v.channel || undefined });
        toast.success(`Code sent by ${res.channel}`);
      },
    },
  };
  const active = dialog ? dialogs[dialog] : null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/support?tab=lookup" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-violet-600"><ArrowLeft size={12} /> Support Desk</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">{displayName}</h1>
            <Pill tone={user.status === "active" ? "green" : user.status === "suspended" ? "red" : "amber"}>{user.status}</Pill>
            {user.systemRole !== "user" ? <Pill tone="violet">{user.systemRole.replace("_", " ")}</Pill> : null}
          </div>
          <div className="flex gap-2">
            <Link to="/admin/people" className={btn.outline}><ExternalLink size={13} /> People directory</Link>
            <button type="button" className={btn.outline} onClick={() => setNewCase(true)}><FolderPlus size={13} /> Open case</button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">{user.phone}{user.email ? ` · ${user.email}` : ""} · joined {fmtDate(user.createdAt)} · phone {user.isPhoneVerified ? "verified" : "not verified"}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account tools">
          {protectedAccount ? (
            <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">This is an admin account. Only the Super Admin can run support tools on it.</p>
          ) : null}
          {!canSupport ? <p className="mb-2 text-[11px] font-semibold text-slate-400">View only — these tools need Support permission.</p> : null}
          <div className="-my-1 divide-y divide-slate-100 dark:divide-slate-800">
            <ToolRow icon={KeyRound} title="Unlock account"
              hint={security.is_locked
                ? `${security.ussd_locked_until ? `USSD PIN locked until ${fmtDateTime(security.ussd_locked_until)}. ` : ""}${security.ussd_failed_attempts ? `${security.ussd_failed_attempts} wrong PIN tries. ` : ""}${security.otp_failed_attempts ? `${security.otp_failed_attempts} wrong codes.` : ""}`
                : "Nothing is locked right now."}
              action={<button type="button" className={btn.outline} disabled={!canSupport || protectedAccount || !security.is_locked} onClick={() => setDialog("unlock")}>Unlock</button>} />
            <ToolRow icon={LogOut} title="Force logout"
              hint={`${security.has_active_session ? "Has an active session." : "No active session on record."}${security.last_force_logout ? ` Last forced out ${fmtDateTime(security.last_force_logout)}.` : ""}`}
              action={<button type="button" className={btn.outline} disabled={!canSupport || protectedAccount || isMe} onClick={() => setDialog("logout")}>Sign out</button>} />
            <ToolRow icon={MailCheck} title="Resend verification"
              hint={canResend ? "Not verified yet. Send them a fresh code." : unverified ? "Verification can't be sent while the account is suspended or inactive." : "Already verified."}
              action={<button type="button" className={btn.outline} disabled={!canSupport || protectedAccount || !canResend} onClick={() => setDialog("verify")}>Send code</button>} />
          </div>
        </Card>

        <Card title={`Chamas (${chamas.length})`}>
          {chamas.length === 0 ? <EmptyState>Not a member of any chama</EmptyState> : (
            <div className="-my-2 divide-y divide-slate-100 dark:divide-slate-800">
              {chamas.map((c) => (
                <Link key={c.chama_id} to={`/admin/support/chamas/${c.chama_id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900 dark:text-white">{c.name}</p>
                    <p className="text-[11px] capitalize text-slate-500">{c.role.replace("_", " ")}{c.status !== "active" ? ` · ${c.status}` : ""}{c.plan_code ? ` · ${c.plan_code} plan` : ""}</p>
                  </div>
                  {c.billing_state ? <BillingStatePill state={c.billing_state} /> : null}
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <NotesPanel subject_type="user" subject_id={userId} />
        <Card title="Cases for this user">
          {cases.length === 0 ? <EmptyState>No cases yet</EmptyState> : (
            <div className="-m-5 divide-y divide-slate-100 dark:divide-slate-800">{cases.map((c) => <CaseRow key={c._id} item={c} />)}</div>
          )}
        </Card>
      </div>

      <ActionDialog
        open={Boolean(active)} onClose={(done) => { setDialog(null); if (done) { toast.success("Done and saved to the audit trail"); load(); } }}
        title={active?.title} description={active?.description} confirmLabel={active?.confirmLabel} tone={active?.tone}
        fields={active?.fields || []} onSubmit={(v) => active.run(v)}
      />
      <NewCaseDialog
        open={newCase} onClose={(created) => { setNewCase(false); if (created) { toast.success(`Opened ${created.number}`); load(); } }}
        subject={{ type: "user", id: userId, label: displayName }} defaultCategory="account_access"
      />
    </div>
  );
}
