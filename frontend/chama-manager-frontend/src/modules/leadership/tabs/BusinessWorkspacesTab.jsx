import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  HeartPulse,
  ShieldCheck,
  Users,
  Coins,
  UserPlus,
  Clock,
  CheckCircle2,
  CreditCard,
  MessageSquare,
  Loader2,
  Pencil,
} from "lucide-react";

import api from "@/app/services/api";
import { EmptyState, Notice, SectionCard, money } from "../components/DeskUI";

// ========================================
// BURIAL CONFIGURATION TAB
// ========================================
//
// This tab exists so the officials who run a burial/welfare chama can
// actually SEE the rules the chama is running on — membership model,
// contribution components, beneficiary categories, waiting period,
// claim-approval requirements, accepted payment methods, and
// communication settings.
//
// This is read-only by design. The data lives in BurialChamaProfile,
// which is only writable through the Setup Wizard's own multi-step
// validation flow — reproducing that as a second edit surface here
// would mean two forms writing the same document, the exact
// last-writer-wins problem GovernanceSettingsTab's own comment warns
// about for the standard-chama settings form. "Edit in Setup Wizard"
// routes there instead.
//
// Note: benefit/payout calculation rules (the wizard's "Benefits"
// step) are stored on a separate BenefitPlan document, which has no
// GET endpoint yet — so they aren't shown here. Everything else the
// wizard collects into BurialChamaProfile is.
//
// ========================================

const STATUS_STYLES = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  suspended: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  inactive: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default function BurialConfigurationTab({ workspaceId, isChairperson, isTreasurer }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  const canEdit = isChairperson || isTreasurer;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const response = await api.get(`/burial-chama/chama/${workspaceId}/profile`);
      setProfile(response.data.data);
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(
          err?.response?.data?.message ||
            "Could not load this burial chama's configuration."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (notFound) {
    return (
      <SectionCard
        icon={HeartPulse}
        title="Burial Chama Configuration"
        description="This chama hasn't been configured yet."
      >
        <EmptyState
          icon={ShieldCheck}
          title="Setup wizard not completed"
          detail="Run the Burial Chama Setup wizard to define membership rules, contributions, beneficiaries and payout rules before members start contributing."
        />
        {canEdit && (
          <Link
            to={`/workspace/${workspaceId}/burial-chama-setup`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
          >
            Open Setup Wizard
          </Link>
        )}
      </SectionCard>
    );
  }

  if (error) {
    return <Notice tone="error">{error}</Notice>;
  }

  const {
    status,
    chama_info: chamaInfo = {},
    membership_model: membershipModel,
    membership_classes: membershipClasses = [],
    contribution_components: contributionComponents = [],
    beneficiary_categories: beneficiaryCategories = [],
    waiting_period_rules: waitingPeriod = {},
    approval_rules: approvalRules = {},
    payment_rules: paymentRules = {},
    communication_rules: communicationRules = {},
  } = profile || {};

  return (
    <div className="space-y-6">
      <SectionCard
        icon={HeartPulse}
        title="Burial Chama Configuration"
        description="The rules this burial chama runs on — set once via the Setup Wizard."
        action={
          canEdit && (
            <Link
              to={`/workspace/${workspaceId}/burial-chama-setup`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Pencil size={13} /> Edit in Setup Wizard
            </Link>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold capitalize ${
              STATUS_STYLES[status] || STATUS_STYLES.inactive
            }`}
          >
            {status || "unknown"}
          </span>
          {chamaInfo.registration_number && (
            <span className="text-xs text-slate-500">Reg. No. {chamaInfo.registration_number}</span>
          )}
          {chamaInfo.county && <span className="text-xs text-slate-500">{chamaInfo.county} County</span>}
        </div>
        {(chamaInfo.physical_address || chamaInfo.contact_phone || chamaInfo.contact_email) && (
          <div className="mt-3 grid gap-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
            {chamaInfo.physical_address && <span>{chamaInfo.physical_address}</span>}
            {chamaInfo.contact_phone && <span>{chamaInfo.contact_phone}</span>}
            {chamaInfo.contact_email && <span>{chamaInfo.contact_email}</span>}
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Users} title="Membership" description="Who can join and on what terms.">
        <p className="text-xs font-semibold capitalize text-slate-600 dark:text-slate-300">
          Model: {membershipModel?.replace(/_/g, " ") || "—"}
        </p>
        {membershipClasses.length > 0 ? (
          <div className="mt-3 space-y-2">
            {membershipClasses.map((mc, i) => (
              <div
                key={mc._id || i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{mc.name}</p>
                  {mc.description && <p className="text-slate-500">{mc.description}</p>}
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {money(mc.contribution_amount)} / {mc.frequency}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Users} title="No membership classes configured" />
        )}
      </SectionCard>

      <SectionCard
        icon={Coins}
        title="Contribution Components"
        description="What members pay into, and how often."
      >
        {contributionComponents.length > 0 ? (
          <div className="space-y-2">
            {contributionComponents.map((cc, i) => (
              <div
                key={cc._id || i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{cc.name}</p>
                  {cc.description && <p className="text-slate-500">{cc.description}</p>}
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {money(cc.amount)} / {cc.frequency} {cc.is_mandatory ? "· Mandatory" : "· Optional"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Coins} title="No contribution components configured" />
        )}
      </SectionCard>

      <SectionCard
        icon={UserPlus}
        title="Beneficiary Categories"
        description="Who members can register as covered beneficiaries."
      >
        {beneficiaryCategories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {beneficiaryCategories.map((bc, i) => (
              <span
                key={bc._id || i}
                className="rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-bold capitalize text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
              >
                {bc.display_name || bc.relationship}
                {bc.age_condition && bc.age_condition !== "any"
                  ? ` · ${bc.age_condition.replace(/_/g, " ")}`
                  : ""}
              </span>
            ))}
          </div>
        ) : (
          <EmptyState icon={UserPlus} title="No beneficiary categories configured" />
        )}
      </SectionCard>

      <SectionCard
        icon={Clock}
        title="Waiting Period"
        description="How long a new member waits before a claim is payable."
      >
        <p className="text-xs text-slate-600 dark:text-slate-300">
          <span className="font-bold text-slate-900 dark:text-white">
            {waitingPeriod.waiting_period_days ?? "—"} days
          </span>{" "}
          ({(waitingPeriod.waiting_period_type || "fixed_days").replace(/_/g, " ")})
        </p>
        {waitingPeriod.partial_coverage_during_waiting && (
          <p className="mt-1 text-[11px] text-slate-500">
            {waitingPeriod.partial_coverage_percentage}% coverage applies during the waiting period.
          </p>
        )}
      </SectionCard>

      <SectionCard
        icon={CheckCircle2}
        title="Claim Approvals"
        description="Who must sign off before a benefit is paid out."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Claim Approval
            </p>
            <p className="mt-1 text-xs capitalize text-slate-600 dark:text-slate-300">
              {(approvalRules.claim_approval?.required_roles || []).join(", ") || "Not set"} · min{" "}
              {approvalRules.claim_approval?.minimum_approvals ?? "—"} approvals
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              New Member Approval
            </p>
            <p className="mt-1 text-xs capitalize text-slate-600 dark:text-slate-300">
              {(approvalRules.new_member_approval?.required_roles || []).join(", ") || "Not set"} · min{" "}
              {approvalRules.new_member_approval?.minimum_approvals ?? "—"} approvals
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={CreditCard}
        title="Payment Methods"
        description="How members can pay into the welfare fund."
      >
        {(paymentRules.accepted_methods || []).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {paymentRules.accepted_methods.map((m) => (
              <span
                key={m}
                className="rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-bold uppercase text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
              >
                {m}
              </span>
            ))}
          </div>
        ) : (
          <EmptyState icon={CreditCard} title="No payment methods configured" />
        )}
        {paymentRules.mpesa_config?.paybill_number && (
          <p className="mt-2 text-xs text-slate-500">
            M-Pesa PayBill: {paymentRules.mpesa_config.paybill_number}
          </p>
        )}
      </SectionCard>

      <SectionCard icon={MessageSquare} title="Communication" description="How members are reached.">
        <p className="text-xs capitalize text-slate-600 dark:text-slate-300">
          Primary channel: {communicationRules.primary_channel || "—"} · Language:{" "}
          {(communicationRules.default_language || "en").toUpperCase()}
        </p>
        {(communicationRules.enabled_channels || []).length > 0 && (
          <p className="mt-1 text-[11px] capitalize text-slate-500">
            Enabled: {communicationRules.enabled_channels.join(", ")}
          </p>
        )}
      </SectionCard>
    </div>
  );
}