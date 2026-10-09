import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Search,
  Banknote,
  ShieldAlert,
  Receipt,
} from "lucide-react";
import toast from "react-hot-toast";

import useWorkspace from "@/app/hooks/useWorkspace";
import useRecordContribution from "../hooks/useRecordContribution";
import useInitiateMpesaStkPush from "../hooks/useInitiateMpesaStkPush";
import useWorkspacePermissions from "../hooks/useworkspacepermissions";
import financeService from "../services/finance.service";
import chamaApi from "@/modules/chama/api/chama.api";

import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input/Input";
import Spinner from "@/shared/components/ui/Spinner";
import {
  Card,
  SectionHeading,
  StatusPill,
  Avatar,
  ProgressBar,
  EmptyState,
  money,
  toAmount,
  formatDate,
  timeAgo,
} from "../components/FinanceUi";

// ============================================================
// RECORD CONTRIBUTION
// ============================================================
//
// The write side of contributions: take a payment and post it.
// The read side (the register) lives on the Contributions page —
// these two used to be the same component behind two different
// URLs, which is why both tabs showed one payment form.
//
// WHO CAN DO WHAT
// ---------------
// This page no longer keeps its own list of role names. It asks the
// API which permissions the caller actually holds, because the
// backend's rules are narrower than the old hardcoded list assumed:
//
//   contributions.record @ 'all'  → treasurer only. May record a
//       cash/bank payment, and may act on ANY member's obligation.
//   contributions.record @ 'own'  → everyone else, chairperson
//       included. May only pay their OWN obligation, and only via a
//       real M-Pesa push — recording cash marks an obligation paid
//       without money moving, so letting members self-record it would
//       let anyone clear their own dues for free.
//
// The old page offered "record for another member" to chairperson,
// admin, owner and secretary; the API then rejected all four.
//
// ============================================================

export default function RecordContributionPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const {
    workspaceId: ctxWorkspaceId,
    currentWorkspace,
    workspaceType,
    membershipId: ctxMembershipId,
  } = useWorkspace();

  const workspaceId = routeWorkspaceId || ctxWorkspaceId;
  const base = `/workspace/${workspaceId}`;
  const ownerType =
    workspaceType === "chama" || workspaceType === "burial-chama"
      ? "Chama"
      : "ContributionGroup";

  const mutation = useRecordContribution();
  const stkPush = useInitiateMpesaStkPush();

  const {
    canForOthers,
    scopeOf,
    isLoading: loadingPermissions,
    membershipId: permissionsMembershipId,
  } = useWorkspacePermissions(workspaceId);

  // Two sources for "who am I, membership-wise": the shared workspace
  // context, and this page's own GET /finance/permissions call (which
  // reads req.membership._id straight off the authenticated request).
  // The permissions one is the trustworthy one — the workspace context
  // doesn't always have membershipId populated (see the note on
  // useWorkspace() itself) — so prefer it and only fall back to the
  // context value if the permissions call hasn't resolved yet.
  const membershipId = permissionsMembershipId || ctxMembershipId;

  // 'all' scope is what the API requires both for acting on another
  // member's obligation AND for recording cash — one grant governs
  // both, so one flag is enough.
  const canRecordForOthers = canForOthers("contributions.record");
  const canRecordCash = canRecordForOthers;
  const canRecordAtAll = Boolean(scopeOf("contributions.record"));

  const [plans, setPlans] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [register, setRegister] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingObligations, setLoadingObligations] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [notice, setNotice] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const [form, setForm] = useState({
    planId: "",
    obligationId: "",
    amount: "",
    paymentMethod: "MPESA",
    phoneNumber: "",
  });

  const pollRef = useRef(null);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    []
  );

  // Default the method to whatever this caller may actually use, rather
  // than starting on Cash and letting a member discover the 403 only
  // after filling the whole form in.
  useEffect(() => {
    if (loadingPermissions) return;
    setForm((previous) => ({
      ...previous,
      paymentMethod: canRecordCash ? "MANUAL" : "MPESA",
    }));
  }, [canRecordCash, loadingPermissions]);

  // ----------------------------------------------------------
  // LOAD PLANS
  // ----------------------------------------------------------
  useEffect(() => {
    if (!workspaceId) {
      setPlans([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const response = await financeService.getContributionPlans(workspaceId, ownerType);
        if (!cancelled) {
          const list = Array.isArray(response) ? response : response?.plans ?? [];
          setPlans(list);
          // With exactly one active plan there's no choice to make, so
          // preselect it and save a click on every single payment.
          // ...and the Contributions manager deep-links here with
          // ?plan=<id> so "Record payment" on a contribution card lands
          // on that exact contribution.
          const requestedPlan = new URLSearchParams(window.location.search).get("plan");
          const requested = requestedPlan
            ? list.find((item) => String(item._id ?? item.id) === requestedPlan)
            : null;
          if (requested) {
            setForm((previous) => ({
              ...previous,
              planId: String(requested._id ?? requested.id),
            }));
          } else if (list.length === 1) {
            setForm((previous) => ({
              ...previous,
              planId: String(list[0]._id ?? list[0].id),
            }));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setPlans([]);
          toast.error(
            error?.response?.data?.message || "Could not load contribution plans."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, ownerType]);

  // ----------------------------------------------------------
  // LOAD THE REGISTER
  // ----------------------------------------------------------
  // Gives each row its real outstanding figure and last payment date,
  // so the picker shows who actually owes what instead of a bare list
  // of names.
  const loadRegister = useCallback(async () => {
    if (!workspaceId) return;
    const data = await financeService.getContributionsRegister(workspaceId);
    setRegister(data);
  }, [workspaceId]);

  useEffect(() => {
    loadRegister();
  }, [loadRegister]);

  // ----------------------------------------------------------
  // LOAD OBLIGATIONS FOR THE SELECTED PLAN
  // ----------------------------------------------------------
  // Only the treasurer flow (browse by plan, then by member) needs this —
  // a member's own obligations are loaded across every plan at once below.
  useEffect(() => {
    if (!form.planId || !workspaceId || !canRecordForOthers) {
      setObligations([]);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setLoadingObligations(true);
      try {
        const response = await financeService.getContributionObligations(
          form.planId,
          workspaceId,
          ownerType
        );
        if (!cancelled) {
          setObligations(
            Array.isArray(response) ? response : response?.obligations ?? []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setObligations([]);
          toast.error(
            error?.response?.data?.message || "Could not load member obligations."
          );
        }
      } finally {
        if (!cancelled) setLoadingObligations(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.planId, workspaceId, ownerType, canRecordForOthers]);

  // ----------------------------------------------------------
  // MEMBER FLOW: LOAD *MY* OUTSTANDING OBLIGATIONS ACROSS EVERY PLAN
  // ----------------------------------------------------------
  // A member doesn't browse plan-by-plan — they just need "what do I still
  // owe, anywhere", picked from one flat list, before they ever see an
  // amount or a phone number field.
  //
  // This probes every plan in the REGISTER (register.plans), not the
  // `plans` state above — `plans` only holds plans with status "active"
  // (that's what GET /contribution-plans filters to, since that's the
  // right list for a treasurer starting a new collection). A member can
  // still owe money on a plan that's since gone "paused" or "completed"
  // (an MGR round that wrapped up with someone still short, say), and
  // that plan would silently disappear from this flow if it only looked
  // at the active list. The register already queries every non-cancelled
  // plan to build its own "outstanding" figures, so it's the right
  // source of plan ids here too.
  const [myObligations, setMyObligations] = useState([]);
  const [loadingMyObligations, setLoadingMyObligations] = useState(false);
  const [memberStep, setMemberStep] = useState("choose"); // 'choose' | 'pay'

  const registerPlans = register?.plans || [];

  useEffect(() => {
    if (canRecordForOthers) return undefined;
    if (!workspaceId || !membershipId || registerPlans.length === 0) {
      setMyObligations([]);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setLoadingMyObligations(true);
      try {
        const perPlan = await Promise.all(
          registerPlans.map(async (plan) => {
            const planId = String(plan._id ?? plan.id);
            try {
              const response = await financeService.getContributionObligations(
                planId,
                workspaceId,
                ownerType,
                membershipId
              );
              const list = Array.isArray(response)
                ? response
                : response?.obligations ?? [];
              return list.map((obligation) => ({
                ...obligation,
                __planId: planId,
                __planName: plan.name || plan.title || "Contribution plan",
              }));
            } catch {
              // One plan failing to load shouldn't blank out the rest.
              return [];
            }
          })
        );
        if (!cancelled) setMyObligations(perPlan.flat());
      } finally {
        if (!cancelled) setLoadingMyObligations(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canRecordForOthers, workspaceId, membershipId, register, ownerType]);

  const myObligationItems = useMemo(() => {
    return myObligations
      .map((obligation) => {
        const expected = toAmount(obligation.expected_amount ?? obligation.amount ?? 0);
        const paid = toAmount(obligation.paid_amount ?? 0);
        return {
          id: String(obligation._id ?? obligation.id),
          planId: obligation.__planId,
          planName: obligation.__planName,
          expected,
          paid,
          balance: Math.max(0, expected - paid),
          dueDate: obligation.due_date || null,
          status: obligation.status,
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [myObligations]);

  const selectedMyObligation =
    myObligationItems.find((item) => item.id === form.obligationId) || null;

  const chooseMyObligation = (item) => {
    setForm((previous) => ({
      ...previous,
      planId: item.planId,
      obligationId: item.id,
      amount: item.balance > 0 ? String(item.balance) : String(item.expected),
    }));
    setNotice(null);
    setMemberStep("pay");
  };

  const backToChooseObligation = () => {
    setMemberStep("choose");
    setNotice(null);
    setForm((previous) => ({ ...previous, obligationId: "", amount: "" }));
  };

  // participant_id arrives either populated or as a bare id depending on
  // the endpoint, so flatten both shapes before comparing.
  const obligationMembershipId = (obligation) => {
    const participant = obligation?.participant_id;
    if (!participant) return null;
    return String(
      typeof participant === "object"
        ? participant._id ?? participant.id ?? ""
        : participant
    );
  };

  const memberStanding = useMemo(() => {
    const map = new Map();
    (register?.members || []).forEach((member) => {
      map.set(String(member.membership_id), member);
    });
    return map;
  }, [register]);

  // A member only ever sees their own obligation; a treasurer sees
  // everybody's, which is the whole point of this page for them.
  const visibleObligations = useMemo(() => {
    const list = canRecordForOthers
      ? obligations
      : obligations.filter(
          (obligation) => obligationMembershipId(obligation) === String(membershipId)
        );

    return list
      .map((obligation) => {
        const id = String(obligation._id ?? obligation.id);
        const memberId = obligationMembershipId(obligation);
        const standing = memberStanding.get(String(memberId));
        const participant = obligation.participant_id;

        const name =
          standing?.name ||
          (typeof participant === "object" ? participant?.user_id?.name : null) ||
          obligation.member_name ||
          obligation.participant_name ||
          "Member";

        const expected = toAmount(obligation.expected_amount ?? obligation.amount ?? 0);
        const paid = toAmount(obligation.paid_amount ?? 0);

        return {
          id,
          memberId,
          name,
          avatarUrl: standing?.avatar_url || null,
          expected,
          paid,
          balance: Math.max(0, expected - paid),
          dueDate: obligation.due_date || null,
          status: obligation.status,
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [obligations, canRecordForOthers, membershipId, memberStanding]);

  const filteredObligations = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return visibleObligations;
    return visibleObligations.filter((item) => item.name.toLowerCase().includes(query));
  }, [visibleObligations, memberSearch]);

  const selected =
    visibleObligations.find((item) => item.id === form.obligationId) || null;
  const isMpesa = form.paymentMethod === "MPESA";

  const selectObligation = (obligation) => {
    setForm((previous) => ({
      ...previous,
      obligationId: obligation.id,
      // Default to the outstanding balance, which is what's being
      // collected the overwhelming majority of the time. Still editable
      // for part payments.
      amount:
        obligation.balance > 0
          ? String(obligation.balance)
          : String(obligation.expected),
    }));
    setNotice(null);
  };

  // Deep link from the Contributions page: ?plan=<id>&member=<membershipId>
  // lands on that member's obligation, already selected with their balance
  // filled in. Applied once, and only for someone allowed to record for
  // others, so it can never be used to pick another member's row otherwise.
  const requestedMemberApplied = useRef(false);
  useEffect(() => {
    if (requestedMemberApplied.current || !canRecordForOthers) return;
    const requestedMember = new URLSearchParams(window.location.search).get("member");
    if (!requestedMember) {
      requestedMemberApplied.current = true;
      return;
    }
    if (loadingObligations || visibleObligations.length === 0) return;
    const match = visibleObligations.find((item) => String(item.memberId) === requestedMember);
    requestedMemberApplied.current = true;
    if (match) {
      selectObligation(match);
      setMemberSearch(match.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleObligations, loadingObligations, canRecordForOthers]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  // ----------------------------------------------------------
  // SUBMIT
  // ----------------------------------------------------------
  async function submit(event) {
    event.preventDefault();
    setNotice(null);

    if (!workspaceId) return toast.error("No workspace selected.");
    if (!form.planId) return toast.error("Select a contribution plan.");
    if (!form.obligationId) return toast.error("Select the member you're recording for.");

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return toast.error("Enter a valid contribution amount.");
    }
    if (!Number.isInteger(amount)) {
      return toast.error("Contribution amount must be a whole number of KES.");
    }
    if (!isMpesa && !canRecordCash) {
      return toast.error(
        "Only the treasurer can record cash or bank payments. Use M-Pesa to pay your own contribution."
      );
    }
    if (isMpesa && !form.phoneNumber.trim()) {
      return toast.error("Enter the M-Pesa number the prompt should go to.");
    }

    // Overpaying an obligation is almost always a typo, so confirm it
    // rather than silently posting a credit the books then carry.
    if (selected && selected.balance > 0 && amount > selected.balance) {
      const proceed = window.confirm(
        `${money(amount)} is more than ${selected.name}'s outstanding ${money(
          selected.balance
        )}. Record it anyway?`
      );
      if (!proceed) return;
    }

    try {
      if (isMpesa) {
        const result = await stkPush.initiateStkPush({
          workspaceId,
          chamaId: workspaceId,
          productType: "contribution",
          obligationId: form.obligationId,
          amount,
          phoneNumber: form.phoneNumber.trim(),
          accountReference: currentWorkspace?.name || "Contribution",
          transactionDescription: `Contribution to ${currentWorkspace?.name || "workspace"}`,
        });

        const paymentIntent = result?.data?.paymentIntent ?? result?.paymentIntent;
        const customerMessage =
          result?.data?.stk?.customerMessage ?? result?.stk?.customerMessage;

        toast.loading(customerMessage || "STK push sent.", { id: "stk" });
        setNotice({
          type: "info",
          text:
            customerMessage ||
            "STK push sent. Ask the member to complete the prompt on their phone.",
        });

        if (ownerType === "Chama" && paymentIntent?._id) {
          pollPaymentIntent(paymentIntent._id);
        }
      } else {
        await mutation.mutateAsync({
          workspaceId,
          obligationId: form.obligationId,
          amount,
          paymentMethod: form.paymentMethod,
        });

        toast.success(`Recorded ${money(amount)} for ${selected?.name || "member"}`);
        setNotice({
          type: "success",
          text: `${money(amount)} recorded against ${
            selected?.name || "the member"
          }'s obligation.`,
        });

        // Clear the payment fields but hold the plan, so a treasurer
        // working through a meeting's collections keeps their place.
        setForm((previous) => ({ ...previous, obligationId: "", amount: "" }));
        loadRegister();
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Could not process the payment.";
      toast.dismiss("stk");
      toast.error(message);
      setNotice({ type: "error", text: message });
    }
  }

  function pollPaymentIntent(paymentIntentId) {
    if (pollRef.current) clearInterval(pollRef.current);

    setIsConfirming(true);
    let elapsed = 0;

    pollRef.current = setInterval(async () => {
      elapsed += 3000;

      try {
        const response = await chamaApi.getPaymentIntent(workspaceId, paymentIntentId);
        const updated =
          response?.data?.data?.paymentIntent ??
          response?.data?.paymentIntent ??
          response?.data;

        if (updated && ["completed", "failed", "cancelled"].includes(updated.status)) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setIsConfirming(false);
          toast.dismiss("stk");

          if (updated.status === "completed") {
            const receipt =
              updated.receipt_reference || updated.external_reference || updated._id;
            toast.success(`Payment confirmed — ${money(updated.amount)}`);
            setNotice({
              type: "success",
              text: `Payment confirmed and recorded. Receipt: ${receipt}`,
            });
            setForm((previous) => ({ ...previous, obligationId: "", amount: "" }));
            loadRegister();
            window.dispatchEvent(new Event("finance:updated"));
          } else {
            const failure =
              updated.failure_reason ||
              "The member did not complete the M-Pesa prompt.";
            toast.error(`Payment ${updated.status}: ${failure}`);
            setNotice({ type: "error", text: failure });
          }
          return;
        }
      } catch {
        // One failed poll shouldn't abandon the wait.
      }

      if (elapsed >= 60000 && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setIsConfirming(false);
        toast.dismiss("stk");
        setNotice({
          type: "info",
          text: "Still waiting on confirmation. If the member completed the prompt it will settle shortly and appear in Contributions.",
        });
      }
    }, 3000);
  }

  const isSubmitting =
    mutation.isPending ||
    stkPush.isPending ||
    mutation.isLoading ||
    stkPush.isLoading ||
    isConfirming;

  const recentPayments = (register?.payments || []).slice(0, 6);

  if (loading || loadingPermissions) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!canRecordAtAll) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={ShieldAlert}
          title="You can't record contributions in this workspace"
          description="Your role doesn't include permission to record a contribution. You can still see the full contribution register."
          action={
            <Link
              to={`${base}/finance/contributions`}
              className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white"
            >
              View contributions
            </Link>
          }
        />
      </Card>
    );
  }

  // ------------------------------------------------------------
  // MEMBER VIEW — the full "Record a contribution" workspace below
  // (plan browser, member search, cash/bank recording) is a treasurer
  // tool. A regular member just picks which of their own obligations
  // to settle, then pays it — nothing else.
  // ------------------------------------------------------------
  if (!canRecordForOthers) {
    return (
      <div className="mx-auto max-w-xl space-y-6 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-mist sm:text-3xl">
              Pay your contribution
            </h1>
            <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-mist-muted">
              {memberStep === "choose"
                ? "Choose which obligation you're settling"
                : "Confirm the amount and send the M-Pesa prompt"}
            </p>
          </div>

          <Link
            to={`${base}/finance/contributions`}
            className="flex items-center gap-1.5 self-start rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
          >
            <Receipt size={14} />
            View the register
          </Link>
        </div>

        {notice && (
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                : notice.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300"
            }`}
          >
            {notice.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <p className="text-sm font-medium">{notice.text}</p>
          </div>
        )}

        {memberStep === "choose" ? (
          <Card className="p-6">
            <SectionHeading
              title="What do you want to pay?"
              subtitle="Every outstanding obligation you owe, across every plan"
            />

            {loadingMyObligations ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : myObligationItems.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="You're all caught up"
                description="You have no outstanding contributions right now."
              />
            ) : (
              <div className="space-y-2">
                {myObligationItems.map((item) => {
                  const isOverdue =
                    item.balance > 0 &&
                    item.dueDate &&
                    new Date(item.dueDate) < new Date();

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseMyObligation(item)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3.5 text-left transition hover:border-emerald-200 hover:bg-slate-50 dark:border-obsidian-border dark:hover:bg-obsidian-raised/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">
                          {item.planName}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400">
                          {item.dueDate ? `Due ${formatDate(item.dueDate)}` : "No due date"}
                          {item.paid > 0 && ` · ${money(item.paid)} already paid`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs font-black text-slate-900 dark:text-mist">
                          {money(item.balance)}
                        </p>
                        <StatusPill status={isOverdue ? "overdue" : item.status} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-6">
            <SectionHeading title="Payment" subtitle="Amount and where to send the prompt" />

            <form onSubmit={submit} className="space-y-5">
              {selectedMyObligation && (
                <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-obsidian-raised/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">
                        {selectedMyObligation.planName}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400">
                        Outstanding {money(selectedMyObligation.balance)} of{" "}
                        {money(selectedMyObligation.expected)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={backToChooseObligation}
                      className="shrink-0 text-[11px] font-bold text-emerald-600 hover:underline dark:text-mint"
                    >
                      Change
                    </button>
                  </div>
                  <div className="mt-2.5">
                    <ProgressBar
                      value={
                        selectedMyObligation.expected > 0
                          ? (selectedMyObligation.paid / selectedMyObligation.expected) * 100
                          : 0
                      }
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="amount"
                  className="mb-2 block text-xs font-bold text-slate-700 dark:text-mist"
                >
                  Amount (KES)
                </label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={handleInputChange}
                  placeholder="0"
                  disabled={isSubmitting}
                />
                {selectedMyObligation && selectedMyObligation.balance > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        amount: String(selectedMyObligation.balance),
                      }))
                    }
                    className="mt-1.5 text-[11px] font-bold text-emerald-600 hover:underline dark:text-mint"
                  >
                    Pay the full {money(selectedMyObligation.balance)} outstanding
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-mint-strong/40 dark:bg-mint-deep/20">
                <div className="mb-3 flex items-start gap-2.5">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-mint" />
                  <p className="text-[11px] font-semibold text-emerald-900 dark:text-mint">
                    You&apos;ll get a prompt on this number to authorise the payment.
                  </p>
                </div>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. 0712345678"
                  disabled={isSubmitting}
                />
              </div>

              {form.amount && form.obligationId && (
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 dark:bg-obsidian-raised/50">
                  <span className="text-xs font-semibold text-slate-500 dark:text-mist-muted">
                    Prompt amount
                  </span>
                  <span className="font-mono text-lg font-black text-slate-900 dark:text-mist">
                    {money(form.amount)}
                  </span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !form.planId || !form.obligationId || !form.amount}
                className="w-full py-3 text-sm font-bold"
              >
                {isConfirming
                  ? "Waiting for M-Pesa confirmation..."
                  : isSubmitting
                  ? "Processing..."
                  : "Send M-Pesa prompt"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-mist sm:text-3xl">
            Record a contribution
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-mist-muted">
            Log a cash or bank payment for any member, or send them an M-Pesa prompt
          </p>
        </div>

        <Link
          to={`${base}/finance/contributions`}
          className="flex items-center gap-1.5 self-start rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
        >
          <Receipt size={14} />
          View the register
        </Link>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
              : notice.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
              : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <p className="text-sm font-medium">{notice.text}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* ---------------- LEFT: who is paying ---------------- */}
        <div className="space-y-6 lg:col-span-7">
          <Card className="p-6">
            <SectionHeading
              title="1. Contribution plan"
              subtitle="Which collection this payment belongs to"
            />

            {plans.length === 0 ? (
              <EmptyState
                icon={Banknote}
                title="No active contribution plan"
                description="A plan has to exist before anything can be collected against it."
              />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {plans.map((plan) => {
                  const id = String(plan._id ?? plan.id);
                  const isActive = form.planId === id;
                  const planStats = (register?.plans || []).find((p) => p.id === id);

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setForm((previous) => ({
                          ...previous,
                          planId: id,
                          obligationId: "",
                          amount: "",
                        }))
                      }
                      className={`rounded-2xl border p-3.5 text-left transition ${
                        isActive
                          ? "border-emerald-500 bg-emerald-50/60 dark:border-mint dark:bg-mint-deep/30"
                          : "border-slate-200 hover:border-emerald-200 hover:bg-slate-50 dark:border-obsidian-border dark:hover:bg-obsidian-raised/40"
                      }`}
                    >
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">
                        {plan.name || plan.title || "Contribution plan"}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {String(plan.contribution_type || "").replace(/_/g, " ")}
                        {plan.frequency && ` · ${plan.frequency}`}
                      </p>
                      {planStats && planStats.expected > 0 && (
                        <p className="mt-1.5 font-mono text-[10px] font-bold text-slate-500">
                          {money(planStats.collected)} of {money(planStats.expected)} in
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <SectionHeading
              title={canRecordForOthers ? "2. Member" : "2. Your obligation"}
              subtitle={
                canRecordForOthers
                  ? "Ordered by what's outstanding — whoever owes most is first"
                  : "The obligation this payment settles"
              }
              action={
                canRecordForOthers && visibleObligations.length > 4 ? (
                  <div className="relative w-48">
                    <Search
                      size={13}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="Find a member..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-hidden dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:text-mist"
                    />
                  </div>
                ) : null
              }
            />

            {!form.planId ? (
              <p className="py-6 text-center text-xs font-semibold text-slate-400">
                Pick a contribution plan first.
              </p>
            ) : loadingObligations ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : filteredObligations.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={
                  canRecordForOthers
                    ? "Nothing outstanding on this plan"
                    : "You have no outstanding obligation here"
                }
                description="Obligations appear as each cycle is raised against the plan."
              />
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {filteredObligations.map((obligation) => {
                  const isActive = form.obligationId === obligation.id;
                  const isOverdue =
                    obligation.balance > 0 &&
                    obligation.dueDate &&
                    new Date(obligation.dueDate) < new Date();

                  return (
                    <button
                      key={obligation.id}
                      type="button"
                      onClick={() => selectObligation(obligation)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${
                        isActive
                          ? "border-emerald-500 bg-emerald-50/60 dark:border-mint dark:bg-mint-deep/30"
                          : "border-slate-100 hover:bg-slate-50 dark:border-obsidian-border dark:hover:bg-obsidian-raised/40"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={obligation.name} url={obligation.avatarUrl} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">
                            {obligation.name}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-400">
                            {obligation.dueDate
                              ? `Due ${formatDate(obligation.dueDate)}`
                              : "No due date"}
                            {obligation.paid > 0 && ` · ${money(obligation.paid)} already paid`}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs font-black text-slate-900 dark:text-mist">
                          {money(obligation.balance)}
                        </p>
                        <StatusPill status={isOverdue ? "overdue" : obligation.status} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ---------------- RIGHT: the payment ---------------- */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="p-6">
            <SectionHeading title="3. Payment" subtitle="Amount and how it was paid" />

            <form onSubmit={submit} className="space-y-5">
              {/* Selected-member recap, so a treasurer working fast can
                  see at a glance who they're about to post against. */}
              {selected && (
                <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-obsidian-raised/50">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={selected.name} url={selected.avatarUrl} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">
                        {selected.name}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400">
                        Outstanding {money(selected.balance)} of {money(selected.expected)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <ProgressBar
                      value={
                        selected.expected > 0
                          ? (selected.paid / selected.expected) * 100
                          : 0
                      }
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="amount"
                  className="mb-2 block text-xs font-bold text-slate-700 dark:text-mist"
                >
                  Amount (KES)
                </label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={handleInputChange}
                  placeholder="0"
                  disabled={isSubmitting || !form.obligationId}
                />
                {selected && selected.balance > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        amount: String(selected.balance),
                      }))
                    }
                    className="mt-1.5 text-[11px] font-bold text-emerald-600 hover:underline dark:text-mint"
                  >
                    Pay the full {money(selected.balance)} outstanding
                  </button>
                )}
              </div>

              <div>
                <label
                  htmlFor="paymentMethod"
                  className="mb-2 block text-xs font-bold text-slate-700 dark:text-mist"
                >
                  Payment method
                </label>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  value={form.paymentMethod}
                  onChange={(event) => {
                    handleInputChange(event);
                    setNotice(null);
                  }}
                  disabled={isSubmitting}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
                >
                  <option value="MPESA">M-Pesa STK push</option>
                  <option value="MANUAL" disabled={!canRecordCash}>
                    Cash / Manual{!canRecordCash ? " (treasurer only)" : ""}
                  </option>
                  <option value="BANK" disabled={!canRecordCash}>
                    Bank transfer{!canRecordCash ? " (treasurer only)" : ""}
                  </option>
                </select>
              </div>

              {isMpesa && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-mint-strong/40 dark:bg-mint-deep/20">
                  <div className="mb-3 flex items-start gap-2.5">
                    <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-mint" />
                    <p className="text-[11px] font-semibold text-emerald-900 dark:text-mint">
                      {canRecordForOthers
                        ? "The member gets a prompt on this number and authorises it themselves — nothing posts until they do."
                        : "You'll get a prompt on this number to authorise the payment."}
                    </p>
                  </div>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    value={form.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="e.g. 0712345678"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {form.amount && form.obligationId && (
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 dark:bg-obsidian-raised/50">
                  <span className="text-xs font-semibold text-slate-500 dark:text-mist-muted">
                    {isMpesa ? "Prompt amount" : "Amount to record"}
                  </span>
                  <span className="font-mono text-lg font-black text-slate-900 dark:text-mist">
                    {money(form.amount)}
                  </span>
                </div>
              )}

              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !form.planId ||
                  !form.obligationId ||
                  !form.amount ||
                  (!isMpesa && !canRecordCash)
                }
                className="w-full py-3 text-sm font-bold"
              >
                {isConfirming
                  ? "Waiting for M-Pesa confirmation..."
                  : isSubmitting
                  ? "Processing..."
                  : isMpesa
                  ? "Send M-Pesa prompt"
                  : "Record contribution"}
              </Button>
            </form>
          </Card>

          {/* Just-recorded feed — confirms the post landed without making
              the treasurer navigate away to check. */}
          <Card className="p-6">
            <SectionHeading
              title="Recently recorded"
              action={
                <Link
                  to={`${base}/finance/contributions`}
                  className="text-[11px] font-bold text-emerald-600 hover:underline dark:text-mint"
                >
                  See all
                </Link>
              }
            />

            {recentPayments.length === 0 ? (
              <p className="py-4 text-center text-xs font-semibold text-slate-400">
                Nothing recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-obsidian-border">
                {recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        name={payment.member?.name}
                        url={payment.member?.avatar_url}
                        size={28}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-slate-900 dark:text-mist">
                          {payment.member?.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {timeAgo(payment.paid_at)}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[11px] font-black text-slate-900 dark:text-mist">
                        {money(payment.amount)}
                      </p>
                      <StatusPill status={payment.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}