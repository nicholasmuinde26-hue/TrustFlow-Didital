import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ExternalLink, FolderPlus, Gift, Repeat, TimerReset } from "lucide-react";
import toast from "react-hot-toast";

import useAuth from "@/app/hooks/useAuth";
import Spinner from "@/shared/components/ui/Spinner";
import adminSupportService from "../services/adminSupport.service";
import useAdminProfile from "../hooks/useAdminProfile";
import { AttemptList } from "../components/support/ReviewQueueTab";
import { CaseRow } from "../components/support/CasesTab";
import NewCaseDialog from "../components/support/NewCaseDialog";
import NotesPanel from "../components/support/NotesPanel";
import { ActionDialog, BillingStatePill, btn, Card, EmptyState, errText, fmtDate, kes, Pill } from "../components/support/supportUi";

const GRANT_LABEL = { extend: "Extended access", comp: "Comped plan", plan_change: "Plan changed" };

function Fact({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-slate-900 dark:text-white">{children}</p>
    </div>
  );
}

export default function AdminSupportChamaPage() {
  const { chamaId } = useParams();
  const { user } = useAuth();
  const { profile } = useAdminProfile();
  const canSupport = user?.systemRole === "super_admin" || profile?.permissions?.support === true;

  const [data, setData] = useState(null);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null); // extend | comp | plan
  const [newCase, setNewCase] = useState(false);

  const load = useCallback(async () => {
    try {
      const [billing, caseList] = await Promise.all([
        adminSupportService.getChamaBilling(chamaId),
        adminSupportService.listCases({ subject_type: "chama", subject_id: chamaId, status: "all", limit: 10 }),
      ]);
      setData(billing); setCases(caseList.items); setError("");
    } catch (err) { setError(errText(err, "Could not load this chama")); }
  }, [chamaId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <Card><EmptyState>{error}</EmptyState></Card>;
  if (!data) return <Spinner />;

  const { chama, subscription: sub, plans } = data;
  const paidPlans = plans.filter((p) => p.code !== "free");
  const overLimit = sub.max_members && data.members.active > sub.max_members;
  const lapsed = sub.state === "read_only";

  const dialogs = {
    extend: {
      title: `Extend ${chama.name}`,
      description: `Adds days on top of the current end date${sub.state === "grace" || lapsed ? " (or from today, since access has already ended)" : ""}. No invoice is created and nothing is counted as revenue.`,
      confirmLabel: "Extend access",
      fields: [{ name: "days", label: "Days to add", type: "number", min: 1, max: 90, initial: 7, help: "1 to 90 days." }],
      run: (v) => adminSupportService.extendAccess(chamaId, { days: Number(v.days), reason: v.reason }),
    },
    comp: {
      title: `Comp a plan for ${chama.name}`,
      description: "Gives a paid plan free for a set number of months, starting when the current period ends (or today). Not counted as revenue.",
      confirmLabel: "Comp plan",
      fields: [
        { name: "plan_code", label: "Plan", type: "select", options: paidPlans.map((p) => [p.code, `${p.name} (${kes(p.price_monthly)}/mo)`]), initial: paidPlans[0]?.code },
        { name: "months", label: "Months", type: "number", min: 1, max: 12, initial: 1 },
      ],
      run: (v) => adminSupportService.compPlan(chamaId, { plan_code: v.plan_code, months: Number(v.months), reason: v.reason }),
    },
    plan: {
      title: `Change ${chama.name}'s plan`,
      description: "Switches the plan immediately without payment and keeps the current end date. To give a paid plan to a chama on Free, use Comp instead.",
      confirmLabel: "Change plan",
      fields: [{ name: "plan_code", label: "New plan", type: "select", options: plans.filter((p) => p.code !== sub.plan_code).map((p) => [p.code, `${p.name} (${kes(p.price_monthly)}/mo)`]), initial: plans.find((p) => p.code !== sub.plan_code)?.code }],
      run: async (v) => {
        const res = await adminSupportService.changePlan(chamaId, { plan_code: v.plan_code, reason: v.reason });
        if (res?.warning) toast(res.warning, { icon: "⚠️", duration: 8000 });
      },
    },
  };
  const active = dialog ? dialogs[dialog] : null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/support?tab=lookup" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-violet-600"><ArrowLeft size={12} /> Support Desk</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">{chama.name}</h1>
            <BillingStatePill state={sub.state} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/directory/chama/${chamaId}`} className={btn.outline}><ExternalLink size={13} /> Workspace detail</Link>
            <button type="button" className={btn.outline} onClick={() => setNewCase(true)}><FolderPlus size={13} /> Open case</button>
          </div>
        </div>
        <p className="mt-1 text-xs capitalize text-slate-500">{(chama.chama_type || "chama").replace("-", " ")} · created {fmtDate(chama.created_at)}</p>
      </div>

      {lapsed ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>This chama's plan lapsed on {fmtDate(sub.access_until)}, so it is read-only (records stay visible). Extending access or marking a payment paid restores it.</span>
        </div>
      ) : null}

      <Card
        title="Plan & access"
        action={canSupport ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.outline} onClick={() => setDialog("extend")} disabled={sub.plan_code === "free"}><TimerReset size={13} /> Extend</button>
            <button type="button" className={btn.outline} onClick={() => setDialog("comp")}><Gift size={13} /> Comp a plan</button>
            <button type="button" className={btn.outline} onClick={() => setDialog("plan")}><Repeat size={13} /> Change plan</button>
          </div>
        ) : <span className="text-[11px] font-semibold text-slate-400">View only — plan changes need Support permission</span>}
      >
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Fact label="Plan">{sub.plan_name || sub.plan_code}</Fact>
          <Fact label={sub.state === "trial" ? "Trial ends" : "Access until"}>
            {sub.access_until ? fmtDate(sub.access_until) : "No expiry"}
            {sub.days_left ? <span className="block text-[11px] font-semibold text-slate-400">{sub.days_left} days left</span> : null}
            {sub.state === "grace" ? <span className="block text-[11px] font-semibold text-amber-600">grace ends {fmtDate(sub.grace_until)}</span> : null}
          </Fact>
          <Fact label="Price / month">
            {kes(sub.price_monthly)}
            {sub.list_price_monthly ? <span className="block text-[11px] font-semibold text-violet-600">special price (list {kes(sub.list_price_monthly)})</span> : null}
          </Fact>
          <Fact label="Active members">
            {data.members.active}{sub.max_members ? ` / ${sub.max_members}` : " (no limit)"}
            {overLimit ? <span className="block text-[11px] font-semibold text-amber-600">over the plan limit</span> : null}
          </Fact>
          <Fact label="Last paid">{fmtDate(sub.last_paid_at)}</Fact>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Invoices & receipts" className="lg:col-span-2">
          {data.invoices.length === 0 ? <EmptyState>No invoices yet. This chama has not been billed.</EmptyState> : (
            <div className="-my-2 divide-y divide-slate-100 dark:divide-slate-800">
              {data.invoices.map((inv) => (
                <details key={inv._id} className="group py-3">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">{inv.number}</span>
                      <span className="ml-2 text-[11px] text-slate-500">{inv.plan_name} × {inv.months} mo</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {inv.needs_review ? <Link to="/admin/support?tab=review" onClick={(e) => e.stopPropagation()}><Pill tone="red">Needs review</Pill></Link> : null}
                      <Pill tone={inv.status === "paid" ? "green" : inv.status === "void" ? "slate" : "amber"}>{inv.status}</Pill>
                      <b className="tabular-nums">{kes(inv.amount)}</b>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
                    <p className="text-[11px] text-slate-500">
                      Created {fmtDate(inv.created_at)}
                      {inv.paid_at ? ` · paid ${fmtDate(inv.paid_at)}` : ""}
                      {inv.mpesa_receipt ? <> · receipt <b className="font-mono">{inv.mpesa_receipt}</b></> : ""}
                      {inv.period_end ? ` · covers ${fmtDate(inv.period_start)} to ${fmtDate(inv.period_end)}` : ""}
                      {inv.credit ? ` · credit ${kes(inv.credit)}` : ""}
                    </p>
                    <AttemptList attempts={inv.attempts} />
                  </div>
                </details>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Who to contact">
            {data.leaders.length === 0 ? <EmptyState>No active chairperson or treasurer</EmptyState> : (
              <div className="-my-2 divide-y divide-slate-100 dark:divide-slate-800">
                {data.leaders.map((l) => (
                  <Link key={`${l.user_id}-${l.role}`} to={`/admin/support/users/${l.user_id}`} className="block py-2.5 hover:opacity-80">
                    <p className="text-xs font-black text-slate-900 dark:text-white">{l.name || "Unnamed"} <span className="font-semibold capitalize text-slate-400">· {l.role}</span></p>
                    <p className="text-[11px] text-slate-500">{l.phone}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
          <Card title="Support grants">
            {sub.grants.length === 0 ? <EmptyState>No extensions, comps or overrides</EmptyState> : (
              <div className="space-y-3">
                {sub.grants.map((g, i) => (
                  <div key={i} className="text-[11px] text-slate-600 dark:text-slate-300">
                    <p className="font-black">{GRANT_LABEL[g.kind]}{g.days ? ` · +${g.days} days` : ""}{g.months ? ` · ${g.months} mo` : ""}{g.plan_code ? ` · ${g.plan_code}` : ""}</p>
                    <p className="text-slate-500">{g.reason}</p>
                    <p className="text-slate-400">{fmtDate(g.granted_at)}{g.access_until_after ? ` · access to ${fmtDate(g.access_until_after)}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <NotesPanel subject_type="chama" subject_id={chamaId} />
        <Card title="Cases for this chama">
          {cases.length === 0 ? <EmptyState>No cases yet</EmptyState> : (
            <div className="-m-5 divide-y divide-slate-100 dark:divide-slate-800">{cases.map((c) => <CaseRow key={c._id} item={c} />)}</div>
          )}
        </Card>
      </div>

      <ActionDialog
        open={Boolean(active)} onClose={(done) => { setDialog(null); if (done) { toast.success("Done and saved to the audit trail"); load(); } }}
        title={active?.title} description={active?.description} confirmLabel={active?.confirmLabel}
        fields={active?.fields || []} needsStepUp onSubmit={(v) => active.run(v)}
      />
      <NewCaseDialog
        open={newCase} onClose={(created) => { setNewCase(false); if (created) { toast.success(`Opened ${created.number}`); load(); } }}
        subject={{ type: "chama", id: chamaId, label: chama.name }} defaultCategory="billing"
      />
    </div>
  );
}
