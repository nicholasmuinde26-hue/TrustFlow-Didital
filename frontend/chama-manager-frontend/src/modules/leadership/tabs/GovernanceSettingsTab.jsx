import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Banknote,
  Building2,
  CalendarClock,
  Coins,
  Globe,
  Landmark,
  Lock,
  MessageCircle,
  Puzzle,
  Plus,
  Smartphone,
  Trash2,
  Users,
  ShieldCheck,
  AlertOctagon,
  Siren,
  Scale,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import loanService from "@/modules/loans/services/loan.service";
import {
  useChamaSettings,
  useUpdateChamaSettings,
} from "@/modules/chama/hooks/useChamaSettings";
import { canEditChamaSettings } from "@/modules/workspaces/permissions/Permissions";

import WorkspaceModulesPanel from "../components/WorkspaceModulesPanel";
import ChamaPublicProfileEditor from "@/modules/chama/components/ChamaPublicProfileEditor";
import OrgKycCard from "@/modules/chama/components/OrgKycCard";
import {
  Button,
  ChipInput,
  ChoiceCards,
  CopyButton,
  Disclosure,
  InputField,
  MultiPick,
  Notice,
  OrderList,
  RoleLocked,
  SaveBar,
  SectionCard,
  Segmented,
  Skeleton,
  Stepper,
  ToggleRow,
  money,
} from "../components/DeskUI";

// ========================================
// GOVERNANCE SETTINGS TAB
// ========================================
//
// This used to be one very long form: four cards and about forty fields on a
// single scroll. It is now an index of five short panes, each showing its
// current value in the list on the left:
//
//   Basics · Rhythm & approvals · Loan rules · Payment details · Features
//
// What did NOT change, on purpose:
//
//   - One state, one save. Edits in every pane live together and save through
//     the same two endpoints as before (settings, then loan policy), so there
//     is still no second form that could overwrite the first.
//   - Loan policy is the chairperson's alone; payment-detail and loan-policy
//     saves still raise the Leadership PIN prompt from the API layer.
//   - A dismissed PIN prompt is not a save failure.
//
// What is new: panes stay mounted-in-state while you move between them, a save
// bar appears only when something changed, and each pane in the list shows a
// dot when it holds unsaved edits.
//
// ========================================

const CONTRIBUTION_CYCLES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const MEETING_DAY_SUGGESTIONS = [
  "Every Saturday",
  "First Saturday of the month",
  "Last Saturday of the month",
  "Every Sunday",
];

const PURPOSE_SUGGESTIONS = ["Business", "Education", "Medical", "School fees", "Farming", "Rent"];
const OFFICIAL_ROLES = ["chairperson", "treasurer", "secretary"];
const FREQUENCIES = ["weekly", "monthly"];

const DEFAULT_FORM = {
  name: "",
  monthly_savings: "",
  visibility: "private",
  contribution_cycle: "monthly",
  fine_amount: 0,
  meeting_day: "",
  approval_threshold: 20000,
  required_payout_approvals: 2,
  mpesa_shortcode: "",
  mpesa_account_reference: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  kyc_requirements: [],
  public_enabled: false,
  public_description: "",
  public_location: "",
  public_purpose: "",
  public_contact_email: "",
  public_website: "",
};

const DEFAULT_LOAN_POLICY = {
  loan_multiplier: 3,
  interest_rate_percent: 10,
  interest_type: "flat",
  min_membership_months: 3,
  max_active_loans_per_member: 1,
  allowed_purposes: [],
  allowed_repayment_periods_months: [1, 2, 3, 6, 12],
  allowed_repayment_frequencies: ["weekly", "monthly"],
  grace_period_days: 7,
  default_after_days: 30,
  penalty_type: "flat_per_week",
  penalty_amount: 100,
  repayment_waterfall: ["penalty", "interest", "principal"],
  guarantor_capacity_ratio: 0.5,
  allow_guarantor_recovery: true,
  min_guarantors_required: 0,
  recusal_quorum_size: 2,
  emergency_loan_enabled: true,
  emergency_loan_limit: 5000,
  emergency_loan_approval_roles: ["treasurer"],
  topup_enabled: true,
  group_loans_enabled: true,
  approval_matrix: [{ max_amount: null, required_roles: ["chairperson", "treasurer"] }],
};

// Which saved fields belong to which pane, so the list can flag unsaved edits.
const FORM_FIELDS = {
  basics: ["name", "monthly_savings", "visibility"],
  rhythm: ["contribution_cycle", "fine_amount", "meeting_day", "approval_threshold", "required_payout_approvals"],
  payments: ["mpesa_shortcode", "mpesa_account_reference", "bank_name", "bank_account_name", "bank_account_number"],
  identity: ["kyc_requirements", "public_enabled", "public_description", "public_location", "public_purpose", "public_contact_email", "public_website"],
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pickFields = (source, fields) => fields.map((field) => source?.[field]);
const pluralise = (count, word) => `${count} ${word}${Number(count) === 1 ? "" : "s"}`;

export default function GovernanceSettingsTab({ workspaceId, role, isChairperson }) {
  const { data, isLoading, isError } = useChamaSettings(workspaceId, true);
  const updateSettings = useUpdateChamaSettings(workspaceId);
  const [searchParams, setSearchParams] = useSearchParams();

  const canEdit = canEditChamaSettings(role);
  const canEditLoanPolicy = isChairperson;

  const [form, setForm] = useState(DEFAULT_FORM);
  const [formBaseline, setFormBaseline] = useState(DEFAULT_FORM);
  const [loanPolicy, setLoanPolicy] = useState(DEFAULT_LOAN_POLICY);
  const [policyBaseline, setPolicyBaseline] = useState(DEFAULT_LOAN_POLICY);
  const [policyLoading, setPolicyLoading] = useState(true);

  useEffect(() => {
    if (!data) return;
    const { chama, profile } = data;
    const loaded = {
      name: chama?.name || "",
      monthly_savings: chama?.monthly_savings ?? "",
      visibility: chama?.visibility || "private",
      contribution_cycle: profile?.contribution_cycle || "monthly",
      fine_amount: profile?.fine_amount ?? 0,
      meeting_day: profile?.meeting_day || "",
      approval_threshold: profile?.approval_threshold ?? 20000,
      required_payout_approvals: profile?.required_payout_approvals ?? 2,
      mpesa_shortcode: profile?.mpesa_shortcode || "",
      mpesa_account_reference: profile?.mpesa_account_reference || "",
      bank_name: profile?.bank_name || "",
      bank_account_name: profile?.bank_account_name || "",
      bank_account_number: profile?.bank_account_number || "",
      kyc_requirements: profile?.kyc_requirements || [],
      public_enabled: Boolean(profile?.public_profile?.enabled),
      public_description: profile?.public_profile?.description || "",
      public_location: profile?.public_profile?.location || "",
      public_purpose: profile?.public_profile?.purpose || "",
      public_contact_email: profile?.public_profile?.contact_email || "",
      public_website: profile?.public_profile?.website || "",
    };
    setForm(loaded);
    setFormBaseline(loaded);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    setPolicyLoading(true);

    loanService
      .getPolicy(workspaceId)
      .then((policy) => {
        if (!cancelled && policy) {
          const merged = { ...DEFAULT_LOAN_POLICY, ...policy };
          setLoanPolicy(merged);
          setPolicyBaseline(merged);
        }
      })
      .catch((error) => console.warn("Could not load loan policy", error))
      .finally(() => {
        if (!cancelled) setPolicyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const setField = (field) => (value) => setForm((previous) => ({ ...previous, [field]: value }));
  const setPolicyField = (field, value) => setLoanPolicy((previous) => ({ ...previous, [field]: value }));

  // ----- what has changed -----
  const dirtyBySection = useMemo(
    () => ({
      basics: !same(pickFields(form, FORM_FIELDS.basics), pickFields(formBaseline, FORM_FIELDS.basics)),
      rhythm: !same(pickFields(form, FORM_FIELDS.rhythm), pickFields(formBaseline, FORM_FIELDS.rhythm)),
      payments: !same(pickFields(form, FORM_FIELDS.payments), pickFields(formBaseline, FORM_FIELDS.payments)),
      identity: isChairperson && !same(pickFields(form, FORM_FIELDS.identity), pickFields(formBaseline, FORM_FIELDS.identity)),
      loans: canEditLoanPolicy && !policyLoading && !same(loanPolicy, policyBaseline),
    }),
    [form, formBaseline, loanPolicy, policyBaseline, policyLoading, canEditLoanPolicy]
  );
  const dirty = canEdit && Object.values(dirtyBySection).some(Boolean);

  // Closing the tab with unsaved edits is the one way to lose work silently.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const discard = () => {
    setForm(formBaseline);
    setLoanPolicy(policyBaseline);
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (!canEdit || updateSettings.isPending) return;

    try {
      await updateSettings.mutateAsync({
        chamaUpdates: {
          name: form.name?.trim(),
          monthly_savings: Number(form.monthly_savings),
          visibility: form.visibility,
        },
        profileUpdates: {
          contribution_cycle: form.contribution_cycle,
          fine_amount: Number(form.fine_amount) || 0,
          meeting_day: form.meeting_day?.trim() || null,
          approval_threshold: Number(form.approval_threshold) || 0,
          required_payout_approvals: Number(form.required_payout_approvals) || 1,
          loan_policy: {
            min_savings_months: Number(loanPolicy.min_membership_months) || 0,
            max_multiple: Number(loanPolicy.loan_multiplier) || 1,
            interest_rate: Number(loanPolicy.interest_rate_percent) || 0,
            repayment_months: Number(loanPolicy.allowed_repayment_periods_months?.[0]) || 1,
          },
          mpesa_shortcode: form.mpesa_shortcode?.trim() || null,
          mpesa_account_reference: form.mpesa_account_reference?.trim() || null,
          bank_name: form.bank_name?.trim() || null,
          bank_account_name: form.bank_account_name?.trim() || null,
          bank_account_number: form.bank_account_number?.trim() || null,
          ...(isChairperson ? {
            kyc_requirements: form.kyc_requirements,
          } : {}),
        },
      });
      setFormBaseline(form);

      if (canEditLoanPolicy) {
        const updated = await loanService.updatePolicy(workspaceId, {
          loan_multiplier: Number(loanPolicy.loan_multiplier),
          interest_rate_percent: Number(loanPolicy.interest_rate_percent),
          interest_type: loanPolicy.interest_type,
          min_membership_months: Number(loanPolicy.min_membership_months),
          max_active_loans_per_member: Number(loanPolicy.max_active_loans_per_member),
          allowed_purposes: loanPolicy.allowed_purposes,
          allowed_repayment_periods_months: (loanPolicy.allowed_repayment_periods_months || []).map(Number),
          allowed_repayment_frequencies: loanPolicy.allowed_repayment_frequencies,
          grace_period_days: Number(loanPolicy.grace_period_days),
          default_after_days: Number(loanPolicy.default_after_days),
          penalty_type: loanPolicy.penalty_type,
          penalty_amount: Number(loanPolicy.penalty_amount),
          repayment_waterfall: loanPolicy.repayment_waterfall,
          guarantor_capacity_ratio: Number(loanPolicy.guarantor_capacity_ratio),
          allow_guarantor_recovery: Boolean(loanPolicy.allow_guarantor_recovery),
          min_guarantors_required: Number(loanPolicy.min_guarantors_required),
          approval_matrix: loanPolicy.approval_matrix,
          recusal_quorum_size: Number(loanPolicy.recusal_quorum_size),
          emergency_loan_enabled: Boolean(loanPolicy.emergency_loan_enabled),
          emergency_loan_limit: Number(loanPolicy.emergency_loan_limit),
          emergency_loan_approval_roles: loanPolicy.emergency_loan_approval_roles,
          topup_enabled: Boolean(loanPolicy.topup_enabled),
          group_loans_enabled: Boolean(loanPolicy.group_loans_enabled),
        });

        const next = updated ? { ...loanPolicy, ...updated } : loanPolicy;
        setLoanPolicy(next);
        setPolicyBaseline(next);
      }

      toast.success("Settings saved");
    } catch (error) {
      // Dismissing the PIN prompt shouldn't read as a save failure.
      if (error?.leadershipCancelled) return;
      toast.error(
        error?.response?.data?.message || error?.message || "Couldn't save settings. Please try again."
      );
    }
  };

  // ----- pane navigation (kept in ?section= so other pages can deep-link) -----
  const SECTIONS = [
    {
      id: "basics",
      label: "Basics",
      icon: Building2,
      summary: form.name ? `${form.name}, ${money(form.monthly_savings)} a month` : "Name, savings and visibility",
    },
    {
      id: "rhythm",
      label: "Rhythm & approvals",
      icon: CalendarClock,
      summary: `${cap(form.contribution_cycle)}, fine ${money(form.fine_amount)}`,
    },
    {
      id: "loans",
      label: "Loan rules",
      icon: Coins,
      summary: `${loanPolicy.interest_rate_percent}% ${loanPolicy.interest_type === "flat" ? "flat" : "reducing"}, ${loanPolicy.loan_multiplier}× savings`,
    },
    {
      id: "payments",
      label: "Payment details",
      icon: Landmark,
      summary: form.mpesa_shortcode ? `Paybill/Till ${form.mpesa_shortcode}` : form.bank_name ? form.bank_name : "Not set yet",
    },
    {
      id: "identity",
      label: "KYC & public profile",
      icon: ShieldCheck,
      summary: "Member registration and group profile",
    },
    { id: "features", label: "Features", icon: Puzzle, summary: "Turn parts of the app on or off" },
  ];

  const requested = searchParams.get("section");
  const active = SECTIONS.some((item) => item.id === requested) ? requested : "basics";
  const activeSectionIndex = Math.max(0, SECTIONS.findIndex((item) => item.id === active));
  const activeSection = SECTIONS[activeSectionIndex];
  const ActiveSectionIcon = activeSection.icon;
  const openSection = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("section", id);
    setSearchParams(next, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return <Notice tone="error">Couldn't load Chama settings. Please refresh.</Notice>;
  }

  const joinCode = data?.chama?.join_code;

  return (
    <div className="space-y-5">
      {!canEdit && (
        <RoleLocked>
          Only the treasurer or chairperson can change these settings. Loan policy is the chairperson's alone.
        </RoleLocked>
      )}

      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* ---------- Index of panes, each showing its current value ---------- */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-2 lg:self-start">
          <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const selected = item.id === active;
              return (
                <li key={item.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => openSection(item.id)}
                    aria-current={selected ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
                      selected
                        ? "bg-slate-800 text-white dark:bg-mint dark:text-obsidian-rail"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-obsidian-raised"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className={`hidden truncate text-xs lg:block ${selected ? "opacity-75" : "text-slate-500"}`}>
                        {item.summary}
                      </span>
                    </span>
                    {dirtyBySection[item.id] && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Unsaved changes">
                        <span className="sr-only">Unsaved changes</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50 p-5 shadow-sm dark:border-obsidian-border dark:from-obsidian-card dark:to-obsidian-raised/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-obsidian-raised dark:text-mint">
                <ActiveSectionIcon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Settings · Step {activeSectionIndex + 1} of {SECTIONS.length}</p>
                <h2 className="mt-0.5 truncate text-base font-bold text-slate-900 dark:text-white">{activeSection.label}</h2>
              </div>
            </div>
            {dirtyBySection[active] && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Unsaved edits</span>}
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/70" role="progressbar" aria-label="Settings section progress" aria-valuenow={activeSectionIndex + 1} aria-valuemin={1} aria-valuemax={SECTIONS.length}>
            <div className="h-full rounded-full bg-gradient-to-r from-slate-700 to-sky-500 transition-all duration-300 dark:from-mint dark:to-sky-400" style={{ width: `${((activeSectionIndex + 1) / SECTIONS.length) * 100}%` }} />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="min-w-0 space-y-5" noValidate>
          {/* ================= BASICS ================= */}
          {active === "basics" && (
            <>
              <SectionCard
                icon={Building2}
                title="About the group"
                description="What members see when they open the Chama."
                collapsible={false}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField label="Chama name" value={form.name} onChange={setField("name")} disabled={!canEdit} required />
                  <InputField
                    label="Monthly savings"
                    type="number"
                    min="1"
                    prefix="KES"
                    value={form.monthly_savings}
                    onChange={setField("monthly_savings")}
                    disabled={!canEdit}
                    required
                  />
                </div>

                <ChoiceCards
                  label="Who can find this group"
                  value={form.visibility}
                  onChange={setField("visibility")}
                  disabled={!canEdit}
                  options={[
                    { value: "private", label: "Private", detail: "Only people with your code or link can join.", icon: Lock },
                    { value: "public", label: "Public", detail: "Anyone can find the group in the directory.", icon: Globe },
                  ]}
                />
              </SectionCard>

              <SectionCard
                icon={Users}
                title="Invite people"
                description="This code never changes. Share it with people who haven't joined yet."
                collapsible={false}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 px-5 py-4 dark:bg-obsidian-raised/40">
                  <p className="font-mono text-3xl font-bold uppercase tracking-[0.25em] text-slate-900 dark:text-white">
                    {joinCode || "..."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton value={joinCode} label="Copy code" copiedLabel="Code copied" size="md" />
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Join ${form.name || "our Chama"} with this code: ${joinCode || ""}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!joinCode}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <MessageCircle size={15} aria-hidden="true" />
                      Share on WhatsApp
                    </a>
                  </div>
                </div>
              </SectionCard>
            </>
          )}

          {/* ================= RHYTHM & APPROVALS ================= */}
          {active === "rhythm" && (
            <>
              <SectionCard
                icon={CalendarClock}
                title="Contributions and meetings"
                description="How often members pay and when the group meets."
                collapsible={false}
              >
                <Segmented
                  label="Members contribute"
                  value={form.contribution_cycle}
                  onChange={setField("contribution_cycle")}
                  options={CONTRIBUTION_CYCLES}
                  disabled={!canEdit}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Stepper
                    label="Late payment fine"
                    prefix="KES"
                    min={0}
                    step={50}
                    value={form.fine_amount}
                    onChange={setField("fine_amount")}
                    disabled={!canEdit}
                    hint="Charged when a contribution is paid late. 0 means no fine."
                  />
                  <div>
                    <InputField
                      label="Regular meeting day"
                      value={form.meeting_day}
                      onChange={setField("meeting_day")}
                      disabled={!canEdit}
                      placeholder="e.g. Last Saturday of the month"
                    />
                    {canEdit && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {MEETING_DAY_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setField("meeting_day")(suggestion)}
                            className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 transition hover:border-sky-500 hover:text-sky-700 dark:border-slate-600"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={ShieldCheck}
                title="Payout approvals"
                description="Large payouts need more than one official to agree."
                collapsible={false}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Stepper
                    label="Extra approval above"
                    prefix="KES"
                    min={0}
                    step={1000}
                    value={form.approval_threshold}
                    onChange={setField("approval_threshold")}
                    disabled={!canEdit}
                  />
                  <Segmented
                    label="Officials who must approve"
                    value={form.required_payout_approvals}
                    onChange={(value) => setField("required_payout_approvals")(Number(value))}
                    disabled={!canEdit}
                    options={[
                      { value: 1, label: "1" },
                      { value: 2, label: "2" },
                      { value: 3, label: "3" },
                    ]}
                  />
                </div>
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-obsidian-raised/40 dark:text-slate-200">
                  Any payout above <strong>{money(form.approval_threshold)}</strong> needs{" "}
                  <strong>{pluralise(form.required_payout_approvals || 1, "official")}</strong> to approve it.
                </p>
              </SectionCard>
            </>
          )}

          {/* ================= LOAN RULES ================= */}
          {active === "loans" && (
            <SectionCard
              icon={Coins}
              title="Loan rules"
              description="The Loans page reads these rules directly, so changes apply there as soon as you save."
              collapsible={false}
            >
              {!canEditLoanPolicy && <RoleLocked>Only the chairperson can edit loan policy rules.</RoleLocked>}

              {policyLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                </div>
              ) : (
                <div className="space-y-3">
                  <Disclosure
                    icon={Scale}
                    title="Who can borrow, and how much"
                    summary={`${loanPolicy.loan_multiplier}× savings, ${pluralise(loanPolicy.min_membership_months, "month")} as a member, ${loanPolicy.max_active_loans_per_member} active at a time`}
                  >
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Stepper
                        label="Borrow up to"
                        suffix="× savings"
                        min={0}
                        step={0.5}
                        value={loanPolicy.loan_multiplier}
                        onChange={(value) => setPolicyField("loan_multiplier", value)}
                        disabled={!canEditLoanPolicy}
                      />
                      <Stepper
                        label="Member for at least"
                        suffix="months"
                        min={0}
                        value={loanPolicy.min_membership_months}
                        onChange={(value) => setPolicyField("min_membership_months", value)}
                        disabled={!canEditLoanPolicy}
                      />
                      <Stepper
                        label="Active loans per member"
                        min={1}
                        value={loanPolicy.max_active_loans_per_member}
                        onChange={(value) => setPolicyField("max_active_loans_per_member", value)}
                        disabled={!canEditLoanPolicy}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Example: a member with {money(20000)} saved can borrow up to{" "}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {money(20000 * (Number(loanPolicy.loan_multiplier) || 0))}
                      </strong>
                      .
                    </p>
                    <ChipInput
                      label="What loans can be for"
                      values={loanPolicy.allowed_purposes || []}
                      onChange={(values) => setPolicyField("allowed_purposes", values)}
                      suggestions={PURPOSE_SUGGESTIONS}
                      disabled={!canEditLoanPolicy}
                      placeholder="Type a purpose and press Enter"
                      hint="Leave empty to allow any purpose."
                    />
                  </Disclosure>

                  <Disclosure
                    icon={Banknote}
                    title="Interest and repayment"
                    summary={`${loanPolicy.interest_rate_percent}% ${loanPolicy.interest_type === "flat" ? "flat" : "reducing balance"}, over ${(loanPolicy.allowed_repayment_periods_months || []).join(", ") || "any number of"} months`}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Stepper
                        label="Interest rate"
                        suffix="%"
                        min={0}
                        max={100}
                        step={0.5}
                        value={loanPolicy.interest_rate_percent}
                        onChange={(value) => setPolicyField("interest_rate_percent", value)}
                        disabled={!canEditLoanPolicy}
                      />
                      <Segmented
                        label="How interest is worked out"
                        value={loanPolicy.interest_type}
                        onChange={(value) => setPolicyField("interest_type", value)}
                        disabled={!canEditLoanPolicy}
                        options={[
                          { value: "flat", label: "Flat" },
                          { value: "reducing_balance", label: "Reducing balance" },
                        ]}
                      />
                    </div>
                    <ChipInput
                      label="Repayment periods (months)"
                      values={loanPolicy.allowed_repayment_periods_months || []}
                      onChange={(values) =>
                        setPolicyField("allowed_repayment_periods_months", [...values].sort((a, b) => a - b))
                      }
                      suggestions={[1, 2, 3, 6, 12, 18, 24]}
                      transform={(value) => Number(value)}
                      validate={(value) => Number.isInteger(value) && value > 0}
                      disabled={!canEditLoanPolicy}
                      placeholder="Type a number of months"
                    />
                    <MultiPick
                      label="Members can repay"
                      values={loanPolicy.allowed_repayment_frequencies || []}
                      onChange={(values) => setPolicyField("allowed_repayment_frequencies", values)}
                      options={FREQUENCIES}
                      disabled={!canEditLoanPolicy}
                    />
                    <OrderList
                      label="When a payment comes in, it clears these first"
                      values={loanPolicy.repayment_waterfall || []}
                      onChange={(values) => setPolicyField("repayment_waterfall", values)}
                      disabled={!canEditLoanPolicy}
                      hint="Top of the list is paid off first."
                    />
                  </Disclosure>

                  <Disclosure
                    icon={AlertOctagon}
                    title="Late payments"
                    summary={`${loanPolicy.grace_period_days} days grace, default after ${loanPolicy.default_after_days} days, penalty ${
                      loanPolicy.penalty_type === "flat_per_week"
                        ? `${money(loanPolicy.penalty_amount)} a week`
                        : `${loanPolicy.penalty_amount}% of what's due`
                    }`}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Stepper
                        label="Grace period"
                        suffix="days"
                        min={0}
                        value={loanPolicy.grace_period_days}
                        onChange={(value) => setPolicyField("grace_period_days", value)}
                        disabled={!canEditLoanPolicy}
                      />
                      <Stepper
                        label="Treat as defaulted after"
                        suffix="days"
                        min={0}
                        step={5}
                        value={loanPolicy.default_after_days}
                        onChange={(value) => setPolicyField("default_after_days", value)}
                        disabled={!canEditLoanPolicy}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Segmented
                        label="Penalty is"
                        value={loanPolicy.penalty_type}
                        onChange={(value) => setPolicyField("penalty_type", value)}
                        disabled={!canEditLoanPolicy}
                        options={[
                          { value: "flat_per_week", label: "A fixed amount a week" },
                          { value: "percentage_of_due", label: "A % of what's due" },
                        ]}
                      />
                      <Stepper
                        label={loanPolicy.penalty_type === "flat_per_week" ? "Penalty per week" : "Penalty rate"}
                        prefix={loanPolicy.penalty_type === "flat_per_week" ? "KES" : undefined}
                        suffix={loanPolicy.penalty_type === "flat_per_week" ? undefined : "%"}
                        min={0}
                        step={loanPolicy.penalty_type === "flat_per_week" ? 50 : 0.5}
                        value={loanPolicy.penalty_amount}
                        onChange={(value) => setPolicyField("penalty_amount", value)}
                        disabled={!canEditLoanPolicy}
                      />
                    </div>
                  </Disclosure>

                  <Disclosure
                    icon={Users}
                    title="Guarantors"
                    summary={`${
                      Number(loanPolicy.min_guarantors_required) > 0
                        ? pluralise(loanPolicy.min_guarantors_required, "guarantor") + " required"
                        : "No guarantor required"
                    }, each can cover up to ${Math.round(Number(loanPolicy.guarantor_capacity_ratio) * 100)}% of their savings`}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Stepper
                        label="Guarantors required"
                        min={0}
                        value={loanPolicy.min_guarantors_required}
                        onChange={(value) => setPolicyField("min_guarantors_required", value)}
                        disabled={!canEditLoanPolicy}
                      />
                      <Stepper
                        label="A guarantor can cover up to"
                        suffix="% of savings"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round(Number(loanPolicy.guarantor_capacity_ratio) * 100)}
                        onChange={(value) => setPolicyField("guarantor_capacity_ratio", Number(value) / 100)}
                        disabled={!canEditLoanPolicy}
                      />
                    </div>
                    <ToggleRow
                      label="Recover from guarantors"
                      description="If a borrower defaults, the guarantor's savings can be used to cover the loan."
                      checked={loanPolicy.allow_guarantor_recovery}
                      onChange={(value) => setPolicyField("allow_guarantor_recovery", value)}
                      disabled={!canEditLoanPolicy}
                    />
                  </Disclosure>

                  <Disclosure
                    icon={Siren}
                    title="Emergency loans and extras"
                    summary={`Emergency loans ${
                      loanPolicy.emergency_loan_enabled ? `up to ${money(loanPolicy.emergency_loan_limit)}` : "off"
                    }, top-ups ${loanPolicy.topup_enabled ? "on" : "off"}, group loans ${
                      loanPolicy.group_loans_enabled ? "on" : "off"
                    }`}
                  >
                    <ToggleRow
                      label="Emergency loans"
                      description="A faster, smaller loan for urgent needs."
                      checked={loanPolicy.emergency_loan_enabled}
                      onChange={(value) => setPolicyField("emergency_loan_enabled", value)}
                      disabled={!canEditLoanPolicy}
                    />
                    {loanPolicy.emergency_loan_enabled && (
                      <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 dark:bg-obsidian-raised/30">
                        <Stepper
                          label="Emergency loan limit"
                          prefix="KES"
                          min={0}
                          step={500}
                          value={loanPolicy.emergency_loan_limit}
                          onChange={(value) => setPolicyField("emergency_loan_limit", value)}
                          disabled={!canEditLoanPolicy}
                        />
                        <MultiPick
                          label="Who can approve them"
                          values={loanPolicy.emergency_loan_approval_roles || []}
                          onChange={(values) => setPolicyField("emergency_loan_approval_roles", values)}
                          options={OFFICIAL_ROLES}
                          disabled={!canEditLoanPolicy}
                        />
                      </div>
                    )}
                    <ToggleRow
                      label="Loan top-ups"
                      description="Let a member borrow more on top of a loan they're still repaying."
                      checked={loanPolicy.topup_enabled}
                      onChange={(value) => setPolicyField("topup_enabled", value)}
                      disabled={!canEditLoanPolicy}
                    />
                    <ToggleRow
                      label="Group loans"
                      description="Let a few members borrow together."
                      checked={loanPolicy.group_loans_enabled}
                      onChange={(value) => setPolicyField("group_loans_enabled", value)}
                      disabled={!canEditLoanPolicy}
                    />
                  </Disclosure>

                  <Disclosure
                    icon={ShieldCheck}
                    title="Who approves loans"
                    summary={`${pluralise((loanPolicy.approval_matrix || []).length, "approval tier")}`}
                  >
                    <ApprovalMatrix
                      tiers={loanPolicy.approval_matrix || []}
                      onChange={(tiers) => setPolicyField("approval_matrix", tiers)}
                      disabled={!canEditLoanPolicy}
                    />
                    <Stepper
                      label="Seats filled when an official steps aside"
                      min={1}
                      value={loanPolicy.recusal_quorum_size}
                      onChange={(value) => setPolicyField("recusal_quorum_size", value)}
                      disabled={!canEditLoanPolicy}
                      hint="Committee members who take over a seat when an official has a conflict of interest."
                    />
                  </Disclosure>
                </div>
              )}
            </SectionCard>
          )}

          {/* ================= PAYMENT DETAILS ================= */}
          {active === "payments" && (
            <>
              <Notice tone="warn">
                Changing the paybill or bank account changes where the group's money goes. Saving asks for your Leadership PIN again.
              </Notice>

              <SectionCard
                icon={Smartphone}
                title="M-Pesa"
                description="Where members send contributions."
                collapsible={false}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField
                    label="Paybill or till number"
                    value={form.mpesa_shortcode}
                    onChange={setField("mpesa_shortcode")}
                    disabled={!canEdit}
                    placeholder="e.g. 174379"
                    inputMode="numeric"
                  />
                  <InputField
                    label="Account reference"
                    value={form.mpesa_account_reference}
                    onChange={setField("mpesa_account_reference")}
                    disabled={!canEdit}
                    hint="What members type as the account number, if anything."
                  />
                </div>
              </SectionCard>

              <SectionCard
                icon={Landmark}
                title="Bank account"
                description="For members who pay by bank transfer, and for payouts."
                collapsible={false}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField label="Bank" value={form.bank_name} onChange={setField("bank_name")} disabled={!canEdit} />
                  <InputField label="Account name" value={form.bank_account_name} onChange={setField("bank_account_name")} disabled={!canEdit} />
                  <InputField label="Account number" value={form.bank_account_number} onChange={setField("bank_account_number")} disabled={!canEdit} inputMode="numeric" />
                </div>
              </SectionCard>
            </>
          )}

        {active === "identity" && (
          <>
            <SectionCard icon={ShieldCheck} title="Member KYC requirements" description="Choose the extra registration details every member must provide with their ID and selfie. This information stays private to the member and the chairperson." collapsible={false}>
              {!isChairperson && <RoleLocked>Only the chairperson can change KYC requirements. Members' KYC documents remain private.</RoleLocked>}
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["date_of_birth", "Date of birth"], ["residential_area", "Residential area"], ["occupation", "Occupation"],
                  ["next_of_kin_name", "Next of kin name"], ["next_of_kin_phone", "Next of kin phone"],
                ].map(([key, label]) => {
                  const checked = form.kyc_requirements.includes(key);
                  return <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm dark:border-slate-700">
                    <input type="checkbox" checked={checked} disabled={!isChairperson} onChange={() => setField("kyc_requirements")(checked ? form.kyc_requirements.filter((item) => item !== key) : [...form.kyc_requirements, key])} />
                    <span>{label}</span><span className="ml-auto text-xs text-slate-400">Required</span>
                  </label>;
                })}
              </div>
              <p className="mt-3 text-xs text-slate-500">National ID/passport number, ID image and selfie are always required. The chairperson and treasurer review submissions (never their own).</p>
            </SectionCard>
            <SectionCard icon={Globe} title="Chama public profile" description="The group's own page: logo, cover, tagline and details. The chairperson or secretary can change it at any time, and saving it does not need the payment PIN." collapsible={false}>
              <ChamaPublicProfileEditor workspaceId={workspaceId} canEdit={isChairperson || role === "secretary"} chamaIsPublic={form.visibility === "public"} />
            </SectionCard>
            <SectionCard icon={ShieldCheck} title="Verify this Chama" description="Verify the group itself (registration and authorised officials). A verified group shows a mark on its public page." collapsible={false}>
              <OrgKycCard workspaceId={workspaceId} role={role} chamaName={form.name} />
            </SectionCard>
          </>
        )}

          <nav aria-label="Settings step navigation" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-obsidian-border dark:bg-obsidian-card/70">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              disabled={activeSectionIndex === 0}
              onClick={() => openSection(SECTIONS[activeSectionIndex - 1]?.id)}
            >
              Previous
            </Button>
            <span className="hidden text-xs font-medium text-slate-400 sm:block">{activeSectionIndex + 1} / {SECTIONS.length}</span>
            {activeSectionIndex < SECTIONS.length - 1 ? (
              <Button
                size="sm"
                icon={ChevronRight}
                onClick={() => openSection(SECTIONS[activeSectionIndex + 1].id)}
              >
                Next: {SECTIONS[activeSectionIndex + 1].label}
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={!dirty || updateSettings.isPending}>
                {updateSettings.isPending ? "Saving…" : "Save settings"}
              </Button>
            )}
          </nav>

          <SaveBar
            dirty={dirty}
            saving={updateSettings.isPending}
            onSave={handleSubmit}
            onDiscard={discard}
            label="Save settings"
          />
        </form>

        {active === "features" && (
          /* Feature modules are a governance decision; saving settings does not change them. */
          <WorkspaceModulesPanel workspaceId={workspaceId} role={role} />
        )}
        </div>
      </div>
    </div>
  );
}

const cap = (text) => String(text || "").charAt(0).toUpperCase() + String(text || "").slice(1);

// Each tier reads as a sentence: "Loans up to KES 50,000 need ...".
function ApprovalMatrix({ tiers, onChange, disabled }) {
  const update = (index, patch) =>
    onChange(tiers.map((tier, position) => (position === index ? { ...tier, ...patch } : tier)));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Approval tiers</p>
        <p className="text-xs text-slate-500">Each tier names the officials who must independently approve loans up to that amount.</p>
      </div>

      {tiers.map((tier, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-obsidian-border">
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <Stepper
                label={tier.max_amount == null ? "Loans of any amount" : "Loans up to"}
                prefix="KES"
                min={0}
                step={5000}
                value={tier.max_amount ?? ""}
                onChange={(value) => update(index, { max_amount: value === "" ? null : Number(value) })}
                disabled={disabled}
                hint="Clear the amount to cover any loan size."
              />
            </div>
            {!disabled && (
              <Button variant="outline" size="sm" icon={Trash2} onClick={() => onChange(tiers.filter((_, position) => position !== index))} aria-label="Remove this tier">
                Remove
              </Button>
            )}
          </div>
          <MultiPick
            label="These officials must approve"
            values={tier.required_roles || []}
            onChange={(values) => update(index, { required_roles: values })}
            options={OFFICIAL_ROLES}
            disabled={disabled}
          />
        </div>
      ))}

      {!disabled && (
        <Button
          variant="outline"
          size="sm"
          icon={Plus}
          onClick={() => onChange([...tiers, { max_amount: null, required_roles: ["chairperson", "treasurer"] }])}
        >
          Add a tier
        </Button>
      )}
    </div>
  );
}
