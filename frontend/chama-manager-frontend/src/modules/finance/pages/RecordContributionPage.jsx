import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Smartphone, CheckCircle, AlertCircle } from "lucide-react";

import useWorkspace from "../../../app/hooks/useWorkspace";
import useRecordContribution from "../hooks/useRecordContribution";
import useInitiateMpesaStkPush from "../hooks/useInitiateMpesaStkPush";
import financeService from "../services/finance.service";
import Button from "../../../shared/components/ui/Button";
import Input from "../../../shared/components/ui/Input/Input";
import Spinner from "../../../shared/components/ui/Spinner";

export default function RecordContributionPage() {
  const { workspaceId: paramWorkspaceId } = useParams();
  const { workspaces, currentWorkspace, workspaceId: ctxWorkspaceId } = useWorkspace();

  const workspaceId = paramWorkspaceId || ctxWorkspaceId;
  const workspace =
    currentWorkspace ||
    workspaces?.find((item) => String(item.id ?? item._id) === String(workspaceId));

  const ownerType = workspace?.type === "chama" ? "Chama" : "ContributionGroup";

  const mutation = useRecordContribution();
  const stkPush = useInitiateMpesaStkPush();

  const [plans, setPlans] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    planId: "",
    obligationId: "",
    amount: "",
    paymentMethod: "cash",
    phoneNumber: "",
  });
  const [notice, setNotice] = useState("");

  const isMpesa = form.paymentMethod === "mpesa";
  const userRole = (workspace?.role || workspace?.membership?.role || "").toLowerCase();

  const canInitiateMpesa =
    workspace?.type === "chama"
      ? ["treasurer", "admin", "owner"].includes(userRole)
      : ["organizer", "co_organizer", "treasurer", "admin", "owner"].includes(userRole);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    financeService
      .getContributionPlans(workspaceId, ownerType)
      .then((res) => setPlans(res?.data || res || []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [workspaceId, ownerType]);

  useEffect(() => {
    if (!form.planId) {
      setObligations([]);
      return;
    }
    financeService
      .getContributionObligations(form.planId, workspaceId, ownerType)
      .then((res) => setObligations(res?.data || res || []))
      .catch(() => setObligations([]));
  }, [form.planId, workspaceId, ownerType]);

  const handlePlanChange = (event) => {
    setForm({ ...form, planId: event.target.value, obligationId: "", amount: "" });
  };

  const handleObligationChange = (event) => {
    const selectedId = event.target.value;
    const selectedObligation = obligations.find(
      (o) => String(o._id || o.id) === String(selectedId)
    );
    const expected = selectedObligation?.expected_amount ?? selectedObligation?.amount ?? "";

    setForm({
      ...form,
      obligationId: selectedId,
      amount: expected ? String(expected) : form.amount,
    });
  };

  async function submit(event) {
    event.preventDefault();
    setNotice("");

    try {
      if (isMpesa) {
        const triggerFn = stkPush.initiateStkPush || stkPush.mutateAsync;
        const result = await triggerFn({
          workspaceId,
          contributionObligationId: form.obligationId,
          amount: Number(form.amount),
          phoneNumber: form.phoneNumber,
          accountReference: workspace?.name || "Contribution",
          transactionDescription: `Contribution to ${workspace?.name || "workspace"}`,
        });
        setNotice(
          result?.customerMessage ||
            "STK push sent. Ask the member to complete the prompt on their phone."
        );
      } else {
        const triggerRecord = mutation.mutateAsync || mutation.recordContribution;
        await triggerRecord({
          workspaceId,
          obligationId: form.obligationId,
          amount: Number(form.amount),
            paymentMethod: form.paymentMethod,
          });
        setNotice("Contribution recorded successfully.");
        window.dispatchEvent(new Event("finance:updated"));
        const refreshed = await financeService.getContributionObligations(form.planId, workspaceId, ownerType);
        setObligations(refreshed || []);
        setForm((current) => ({ ...current, obligationId: "", amount: "" }));
      }
    } catch (error) {
      setNotice(
        error?.response?.data?.message ||
          error?.message ||
          "Could not process the payment request."
      );
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const isSubmitting =
    mutation.isPending || stkPush.isPending || mutation.isLoading || stkPush.isLoading;

  return (
    <form
      onSubmit={submit}
      className="max-w-2xl mx-auto space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 font-sans"
    >
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          Record Contribution
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Select a contribution plan and member obligation to log cash or trigger an M-Pesa prompt.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Contribution Plan
        </label>
        <select
          required
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-medium text-slate-900 shadow-xs focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          value={form.planId}
          onChange={handlePlanChange}
        >
          <option value="">Select Plan</option>
          {plans.map((plan) => (
            <option key={plan._id || plan.id} value={plan._id || plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Member Obligation
        </label>
        <select
          required
          disabled={!form.planId}
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-medium text-slate-900 shadow-xs focus:border-violet-500 focus:outline-none disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
          value={form.obligationId}
          onChange={handleObligationChange}
        >
          <option value="">Select obligation</option>
          {obligations.map((obligation) => {
            const dueAmount = Number(
              obligation.expected_amount ?? obligation.amount ?? 0
            ).toLocaleString();
            const memberName = obligation.memberName || obligation.participant_id?.user_id?.name || obligation.user?.name || "Member";
            return (
              <option key={obligation._id || obligation.id} value={obligation._id || obligation.id}>
                {memberName} — Due: KES {dueAmount}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <Input
          label="Amount (KES)"
          type="number"
          min="1"
          required
          placeholder="Enter contribution amount"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Payment Method
        </label>
        <select
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-medium text-slate-900 shadow-xs focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          value={form.paymentMethod}
          onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}
        >
          <option value="cash">Cash</option>
          <option value="bank">Bank Transfer</option>
          <option value="mpesa">M-Pesa STK Push</option>
        </select>
      </div>

      {isMpesa && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <Input
            label="Member M-Pesa Phone Number"
            placeholder="e.g. 0712345678"
            required={isMpesa}
            value={form.phoneNumber}
            onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
          />
          <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Smartphone size={16} className="mt-0.5 text-emerald-600 shrink-0" />
            <span>The STK prompt will be sent directly to this phone number.</span>
          </div>
          {!canInitiateMpesa && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle size={16} className="shrink-0" />
              <span>Only workspace financial managers or treasurers can initiate M-Pesa STK pushes.</span>
            </div>
          )}
        </div>
      )}

      {notice && (
        <div
          className={`flex items-center gap-2 rounded-xl p-4 text-xs font-semibold ${
            notice.includes("success") || notice.includes("sent")
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800"
          }`}
        >
          <CheckCircle size={16} className="shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting || (isMpesa && !canInitiateMpesa)}
        className="w-full py-3 text-sm font-bold"
      >
        {isSubmitting
          ? "Processing..."
          : isMpesa
          ? "Send M-Pesa Prompt"
          : "Record Contribution"}
      </Button>
    </form>
  );
}
