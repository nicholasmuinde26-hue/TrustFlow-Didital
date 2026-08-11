import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import {
  Smartphone,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import useWorkspace from "../../../app/hooks/useWorkspace";
import useRecordContribution from "../hooks/useRecordContribution";
import useInitiateMpesaStkPush from "../hooks/useInitiateMpesaStkPush";
import financeService from "../services/finance.service";
import chamaApi from "../../chama/api/chama.api";

import Button from "../../../shared/components/ui/Button";
import Input from "../../../shared/components/ui/Input/Input";
import Spinner from "../../../shared/components/ui/Spinner";

// Defensively unwrap MongoDB Decimal128 ({ $numberDecimal: "1500" }) in
// case any obligation/amount source ever sends a raw decimal instead of
// the stringified value the backend is expected to serialize.
const toAmountNumber = (value) =>
  Number(value?.$numberDecimal ?? value ?? 0);

const formatKES = (value) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(toAmountNumber(value));

export default function RecordContributionPage() {
  const { workspaceId: paramWorkspaceId } = useParams();

  const {
    workspaces,
    currentWorkspace,
    workspaceId: ctxWorkspaceId,
  } = useWorkspace();

  const workspaceId =
    paramWorkspaceId || ctxWorkspaceId;

  const workspace =
    currentWorkspace ||
    workspaces?.find(
      (item) =>
        String(item.id ?? item._id) ===
        String(workspaceId)
    );

  const ownerType =
    workspace?.type === "chama"
      ? "Chama"
      : "ContributionGroup";

  const mutation = useRecordContribution();
  const stkPush = useInitiateMpesaStkPush();

  const [plans, setPlans] = useState([]);
  const [obligations, setObligations] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingObligations, setLoadingObligations] =
    useState(false);

  const [form, setForm] = useState({
    planId: "",
    obligationId: "",
    amount: "",
    paymentMethod: "MANUAL",
    phoneNumber: "",
  });

  const [notice, setNotice] =
    useState(null);

  const [isConfirming, setIsConfirming] =
    useState(false);

  const pollRef = useRef(null);

  /*
   * Cleanup polling whenever the component
   * unmounts.
   */
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const isMpesa =
    form.paymentMethod === "MPESA";

  const userRole = (
    workspace?.role ||
    workspace?.membership?.role ||
    ""
  ).toLowerCase();

  const canInitiateMpesa =
    workspace?.type === "chama"
      ? [
          "treasurer",
          "admin",
          "owner",
        ].includes(userRole)
      : [
          "organizer",
          "co_organizer",
          "treasurer",
          "admin",
          "owner",
        ].includes(userRole);

  /*
   * Load contribution plans.
   */
  useEffect(() => {
    if (!workspaceId) {
      setPlans([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadPlans = async () => {
      setLoading(true);

      try {
        const response =
          await financeService.getContributionPlans(
            workspaceId,
            ownerType
          );

        if (!cancelled) {
          const data =
            response?.data ?? response ?? [];

          setPlans(
            Array.isArray(data)
              ? data
              : data?.plans ?? []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPlans([]);

          toast.error(
            error?.response?.data?.message ||
              "Could not load contribution plans."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, ownerType]);

  /*
   * Load obligations whenever the selected
   * contribution plan changes.
   */
  useEffect(() => {
    if (!form.planId || !workspaceId) {
      setObligations([]);
      return;
    }

    let cancelled = false;

    const loadObligations = async () => {
      setLoadingObligations(true);

      try {
        const response =
          await financeService.getContributionObligations(
            form.planId,
            workspaceId,
            ownerType
          );

        if (!cancelled) {
          const data =
            response?.data ?? response ?? [];

          setObligations(
            Array.isArray(data)
              ? data
              : data?.obligations ?? []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setObligations([]);

          toast.error(
            error?.response?.data?.message ||
              "Could not load member obligations."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingObligations(false);
        }
      }
    };

    loadObligations();

    return () => {
      cancelled = true;
    };
  }, [
    form.planId,
    workspaceId,
    ownerType,
  ]);

  const handlePlanChange = (event) => {
    const planId = event.target.value;

    setForm((previous) => ({
      ...previous,
      planId,
      obligationId: "",
      amount: "",
    }));

    setObligations([]);
  };

  const handleObligationChange = (event) => {
    const selectedId =
      event.target.value;

    const selectedObligation =
      obligations.find(
        (obligation) =>
          String(
            obligation._id ??
              obligation.id
          ) === String(selectedId)
      );

    const rawExpected =
      selectedObligation?.expected_amount ??
      selectedObligation?.expectedAmount ??
      selectedObligation?.amount ??
      "";

    const expected =
      rawExpected !== ""
        ? String(toAmountNumber(rawExpected))
        : "";

    setForm((previous) => ({
      ...previous,
      obligationId: selectedId,
      amount:
        expected !== ""
          ? expected
          : previous.amount,
    }));
  };

  const handlePaymentMethodChange = (
    event
  ) => {
    const paymentMethod =
      event.target.value;

    setForm((previous) => ({
      ...previous,
      paymentMethod,
      phoneNumber:
        paymentMethod === "MPESA"
          ? previous.phoneNumber
          : "",
    }));

    setNotice(null);
  };

  const handleInputChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  async function submit(event) {
    event.preventDefault();

    setNotice(null);

    if (!workspaceId) {
      toast.error(
        "No workspace selected."
      );

      return;
    }

    if (!form.planId) {
      toast.error(
        "Please select a contribution plan."
      );

      return;
    }

    if (!form.obligationId) {
      toast.error(
        "Please select a member obligation."
      );

      return;
    }

    const amount = Number(form.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      toast.error(
        "Enter a valid contribution amount."
      );

      return;
    }

    if (
      !Number.isInteger(amount)
    ) {
      toast.error(
        "Contribution amount must be a whole number of KES."
      );

      return;
    }

    if (
      isMpesa &&
      !canInitiateMpesa
    ) {
      toast.error(
        "You do not have permission to initiate M-Pesa payments."
      );

      return;
    }

    if (
      isMpesa &&
      !form.phoneNumber.trim()
    ) {
      toast.error(
        "Enter the member's M-Pesa phone number."
      );

      return;
    }

    try {
      if (isMpesa) {
        const triggerFn =
          stkPush.initiateStkPush ||
          stkPush.mutateAsync;

        if (
          typeof triggerFn !== "function"
        ) {
          throw new Error(
            "M-Pesa payment action is not available."
          );
        }

        const result =
          await triggerFn({
            workspaceId,
            contributionObligationId:
              form.obligationId,
            obligationId:
              form.obligationId,
            amount,
            phoneNumber:
              form.phoneNumber.trim(),
            accountReference:
              workspace?.name ||
              "Contribution",
            transactionDescription:
              `Contribution to ${
                workspace?.name ||
                "workspace"
              }`,
          });

        const paymentIntent =
          result?.data?.paymentIntent ??
          result?.paymentIntent;

        const customerMessage =
          result?.data?.stk
            ?.customerMessage ??
          result?.stk?.customerMessage;

        toast.loading(
          customerMessage ||
            "STK push sent to the member's phone.",
          {
            id: "stk",
          }
        );

        setNotice({
          type: "info",
          text:
            customerMessage ||
            "STK push sent. Ask the member to complete the prompt on their phone.",
        });

        /*
         * Only Chama payments currently use
         * PaymentIntent polling here.
         */
        if (
          ownerType === "Chama" &&
          paymentIntent?._id
        ) {
          pollPaymentIntent(
            paymentIntent._id
          );
        }
      } else {
        const triggerRecord =
          mutation.mutateAsync ||
          mutation.recordContribution;

        if (
          typeof triggerRecord !==
          "function"
        ) {
          throw new Error(
            "Contribution recording action is not available."
          );
        }

        await triggerRecord({
          workspaceId,
          obligationId:
            form.obligationId,
          amount,
          paymentMethod:
            form.paymentMethod,
        });

        toast.success(
          `Contribution recorded: ${formatKES(
            amount
          )}`
        );

        setNotice({
          type: "success",
          text:
            "Contribution recorded successfully.",
        });
      }
    } catch (error) {
      const message =
        error?.response?.data
          ?.message ||
        error?.message ||
        "Could not process the payment request.";

      toast.dismiss("stk");
      toast.error(message);

      setNotice({
        type: "error",
        text: message,
      });
    }
  }

  function pollPaymentIntent(
    paymentIntentId
  ) {
    if (pollRef.current) {
      clearInterval(
        pollRef.current
      );
    }

    setIsConfirming(true);

    let elapsed = 0;

    pollRef.current =
      setInterval(async () => {
        elapsed += 3000;

        try {
          const response =
            await chamaApi.getPaymentIntent(
              workspaceId,
              paymentIntentId
            );

          const updated =
            response?.data?.data
              ?.paymentIntent ??
            response?.data
              ?.paymentIntent ??
            response?.data;

          if (
            updated &&
            [
              "completed",
              "failed",
              "cancelled",
            ].includes(updated.status)
          ) {
            clearInterval(
              pollRef.current
            );

            pollRef.current = null;

            setIsConfirming(false);

            toast.dismiss("stk");

            if (
              updated.status ===
              "completed"
            ) {
              const receipt =
                updated.receipt_reference ||
                updated.external_reference ||
                updated._id;

              toast.success(
                `Payment confirmed! ${formatKES(
                  updated.amount
                )} deposited`
              );

              setNotice({
                type: "success",
                text: `Payment confirmed. The member's contribution has been recorded. Receipt: ${receipt}`,
              });
            } else {
              const failureMessage =
                updated.failure_reason ||
                "The member did not complete the M-Pesa prompt.";

              toast.error(
                `Payment ${updated.status}: ${failureMessage}`
              );

              setNotice({
                type: "error",
                text: failureMessage,
              });
            }

            return;
          }
        } catch (error) {
          /*
           * Don't interrupt polling because of
           * one temporary network/API failure.
           */
        }

        if (
          elapsed >= 60000 &&
          pollRef.current
        ) {
          clearInterval(
            pollRef.current
          );

          pollRef.current = null;

          setIsConfirming(false);

          toast.dismiss("stk");

          toast(
            "Still waiting on confirmation...",
            {
              icon: "⏳",
            }
          );

          setNotice({
            type: "info",
            text:
              "Still waiting on confirmation. If the member completed the prompt, the payment status will update shortly.",
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

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Smartphone
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Record Contribution
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Select a contribution plan and
              member obligation to log cash or
              trigger an M-Pesa prompt.
            </p>
          </div>
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div
          className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${
            notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
              : notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <p className="text-sm font-medium">
            {notice.text}
          </p>
        </div>
      )}

      {/* Form Card */}
      <form
        onSubmit={submit}
        className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7"
      >
        <div className="space-y-6">
          {/* Contribution Plan */}
          <div>
            <label
              htmlFor="planId"
              className="mb-2 block text-sm font-semibold"
            >
              Contribution Plan
            </label>

            <select
              id="planId"
              name="planId"
              value={form.planId}
              onChange={handlePlanChange}
              disabled={
                isSubmitting ||
                plans.length === 0
              }
              className="w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/30"
            >
              <option value="">
                {plans.length
                  ? "Select a contribution plan"
                  : "No contribution plans available"}
              </option>

              {plans.map((plan) => (
                <option
                  key={plan._id ?? plan.id}
                  value={plan._id ?? plan.id}
                >
                  {plan.name ||
                    plan.title ||
                    "Contribution Plan"}
                </option>
              ))}
            </select>
          </div>

          {/* Member Obligation */}
          <div>
            <label
              htmlFor="obligationId"
              className="mb-2 block text-sm font-semibold"
            >
              Member
            </label>

            <select
              id="obligationId"
              name="obligationId"
              value={form.obligationId}
              onChange={
                handleObligationChange
              }
              disabled={
                isSubmitting ||
                !form.planId ||
                loadingObligations
              }
              className="w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/30"
            >
              <option value="">
                {loadingObligations
                  ? "Loading members..."
                  : !form.planId
                  ? "Select a plan first"
                  : obligations.length
                  ? "Select a member"
                  : "No member obligations found"}
              </option>

              {obligations.map(
                (obligation) => {
                  const id =
                    obligation._id ??
                    obligation.id;

                  const member =
                    obligation.participant_id
                      ?.user_id ??
                    obligation.member ??
                    obligation.user;

                  const memberName =
                    member?.name ||
                    obligation.member_name ||
                    obligation.participant_name ||
                    "Member";

                  const expected = toAmountNumber(
                    obligation.expected_amount ??
                      obligation.amount ??
                      0
                  );

                  return (
                    <option
                      key={id}
                      value={id}
                    >
                      {memberName} —{" "}
                      {formatKES(expected)}
                    </option>
                  );
                }
              )}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor="amount"
              className="mb-2 block text-sm font-semibold"
            >
              Contribution Amount
            </label>

            <Input
              id="amount"
              name="amount"
              type="number"
              min="1"
              step="1"
              value={form.amount}
              onChange={handleInputChange}
              placeholder="Enter amount"
              disabled={isSubmitting}
            />

            {form.amount && (
              <p className="mt-2 text-xs text-muted-foreground">
                {formatKES(form.amount)}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label
              htmlFor="paymentMethod"
              className="mb-2 block text-sm font-semibold"
            >
              Payment Method
            </label>

            <select
              id="paymentMethod"
              name="paymentMethod"
              value={form.paymentMethod}
              onChange={
                handlePaymentMethodChange
              }
              disabled={isSubmitting}
              className="w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/30"
            >
              <option value="MANUAL">
                Cash / Manual
              </option>

              <option
                value="MPESA"
                disabled={
                  !canInitiateMpesa
                }
              >
                M-Pesa STK Push
              </option>
            </select>

            {isMpesa &&
              !canInitiateMpesa && (
                <p className="mt-2 text-xs text-amber-600">
                  Your workspace role does not
                  have permission to initiate
                  M-Pesa payments.
                </p>
              )}
          </div>

          {/* M-Pesa Phone */}
          {isMpesa && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Smartphone className="h-4 w-4" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold">
                    M-Pesa Payment
                  </h3>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter the member's Safaricom
                    number. They will receive an
                    STK prompt to authorize the
                    payment.
                  </p>
                </div>
              </div>

              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={form.phoneNumber}
                onChange={
                  handleInputChange
                }
                placeholder="e.g. 0712345678"
                disabled={
                  isSubmitting ||
                  !canInitiateMpesa
                }
              />
            </div>
          )}

          {/* Summary */}
          {form.obligationId &&
            form.amount && (
              <div className="rounded-xl bg-muted/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    Amount to record
                  </span>

                  <span className="text-lg font-bold">
                    {formatKES(
                      form.amount
                    )}
                  </span>
                </div>
              </div>
            )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              !form.planId ||
              !form.obligationId ||
              !form.amount ||
              (isMpesa &&
                !canInitiateMpesa)
            }
            className="w-full py-3 text-sm font-bold"
          >
            {isConfirming
              ? "Waiting for M-Pesa confirmation..."
              : isSubmitting
              ? "Processing..."
              : isMpesa
              ? "Send M-Pesa Prompt"
              : "Record Contribution"}
          </Button>
        </div>
      </form>
    </div>
  );
}