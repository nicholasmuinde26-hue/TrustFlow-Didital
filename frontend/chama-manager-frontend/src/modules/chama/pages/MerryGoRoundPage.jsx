import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bell,
  CircleDollarSign,
  MessageCircle,
  Save,
  Smartphone,
  Loader2,
  XCircle,
  CheckCircle2,
  History,
  X,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import useAuth from "@/app/hooks/useAuth";
import chamaApi from "../api/chama.api";
import financeService from "@/modules/finance/services/finance.service";

/* ============================================================================
 * CONFIGURATION
 * Keep runtime/configurable values here instead of scattering magic values
 * throughout the component.
 * ========================================================================== */

const MGR_CONFIG = {
  polling: {
    intervalMs: 3000,
    timeoutSeconds: 60,
    reconciliationEvery: 4,
    refreshMs: 15000,
  },

  phone: {
    defaultCountryCode:
      import.meta.env.VITE_DEFAULT_COUNTRY_CODE || "254",
  },

  accountReference: {
    prefix: import.meta.env.VITE_MGR_ACCOUNT_REFERENCE_PREFIX || "MGR",
    maxWorkspaceChars: 6,
  },

  permissions: {
    treasurerRoles: ["treasurer", "admin", "owner"],
  },

  statuses: {
    paid: "paid",
    completed: "completed",
    failed: "failed",
    cancelled: "cancelled",
    pending: "pending",
    reversed: "reversed",
  },

  paymentMethods: [
    { value: "cash", label: "Cash" },
    { value: "bank", label: "Bank" },
    { value: "other", label: "Other" },
  ],

  frequencies: [
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
    { value: "custom", label: "Custom" },
  ],

  payoutIntervals: [
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
    { value: "custom", label: "Custom days" },
  ],

  reminderChannels: {
    sms: "sms",
    whatsapp: "whatsapp",
  },
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const getDecimalValue = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "object" && "$numberDecimal" in value) {
    return value.$numberDecimal;
  }

  return value;
};

const money = (value) => {
  const numericValue = Number(getDecimalValue(value, 0));

  return Number.isFinite(numericValue)
    ? numericValue.toLocaleString()
    : "0";
};

const getUserId = (user) =>
  user?._id || user?.id || user?.user_id?._id || user?.user_id;

const getMembershipUserId = (membership) =>
  membership?.user_id?._id ||
  membership?.user_id ||
  membership?.user?._id ||
  membership?.user?.id;

const normalizeRole = (role) =>
  String(role || "").trim().toLowerCase();

const isTreasurerRole = (role) =>
  MGR_CONFIG.permissions.treasurerRoles.includes(
    normalizeRole(role)
  );

const normalizePhone = (phone) => {
  const raw = String(phone || "").trim();

  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");

  if (!digits) return "";

  const countryCode = String(
    MGR_CONFIG.phone.defaultCountryCode
  ).replace(/\D/g, "");

  if (digits.startsWith(countryCode)) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `${countryCode}${digits.slice(1)}`;
  }

  return digits;
};

const buildAccountReference = (workspaceId) => {
  const prefix = MGR_CONFIG.accountReference.prefix;
  const suffix = String(workspaceId || "")
    .replace(/\s/g, "")
    .slice(-MGR_CONFIG.accountReference.maxWorkspaceChars);

  return `${prefix}-${suffix}`;
};

const buildReminderMessage = ({ memberName, amount }) =>
  `Hello ${memberName}, a MGR contribution of KES ${money(
    amount
  )} is pending for the current chama round. Please complete payment as soon as possible. Thank you.`;

const buildReminderUrl = ({ channel, phone, message }) => {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const encodedMessage = encodeURIComponent(message);

  if (channel === MGR_CONFIG.reminderChannels.whatsapp) {
    return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
  }

  return `sms:${normalizedPhone}?body=${encodedMessage}`;
};

const PAYMENT_STATUS_STYLES = {
  [MGR_CONFIG.statuses.completed]: "text-emerald-600",
  [MGR_CONFIG.statuses.pending]: "text-amber-600",
  [MGR_CONFIG.statuses.failed]: "text-red-600",
  [MGR_CONFIG.statuses.reversed]: "text-red-600",
  [MGR_CONFIG.statuses.cancelled]: "text-slate-400",
};

/* ============================================================================
 * INITIAL STATE
 * ========================================================================== */

const EMPTY_FORM = {
  amount: "",
  frequency: "monthly",
  payoutInterval: "monthly",
  payoutIntervalDays: "",
};

const EMPTY_MARK_PAID_FORM = {
  method: "cash",
  reference: "",
  notes: "",
};

/* ============================================================================
 * COMPONENT
 * ========================================================================== */

export default function MerryGoRoundPage() {
  const { workspaceId: routeWorkspaceId } = useParams();

  const workspace = useWorkspace();
  const { user } = useAuth();

  const chamaId =
    routeWorkspaceId ||
    workspace?.workspaceId ||
    workspace?.currentWorkspace?._id ||
    workspace?.currentWorkspace?.id;

  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);

  const [form, setForm] = useState(EMPTY_FORM);

  const [notice, setNotice] = useState(null);

  const [sendingObligationId, setSendingObligationId] =
    useState(null);

  const [reminding, setReminding] = useState(false);

  const [isPolling, setIsPolling] = useState(false);
  const [countdown, setCountdown] = useState(
    MGR_CONFIG.polling.timeoutSeconds
  );

  const [markPaidTarget, setMarkPaidTarget] = useState(null);

  const [markPaidForm, setMarkPaidForm] = useState(
    EMPTY_MARK_PAID_FORM
  );

  const [markingPaid, setMarkingPaid] = useState(false);

  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  /* ==========================================================================
   * TIMER MANAGEMENT
   * ======================================================================== */

  const clearTimers = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  /* ==========================================================================
   * LOAD DATA
   * ======================================================================== */

  const load = useCallback(
    async ({ updateSettings = true } = {}) => {
      if (!chamaId) return;

      try {
        const response = await chamaApi.getMgr(chamaId);
        const nextOverview = response?.data?.data;

        setOverview(nextOverview);

        /*
         * Only hydrate the settings form when requested.
         *
         * This prevents the 15-second refresh from overwriting values while
         * the treasurer is currently editing the form.
         */
        if (updateSettings) {
          const plan = nextOverview?.plan;

          if (plan) {
            setForm({
              amount:
                getDecimalValue(plan.amount, ""),
              frequency:
                plan.frequency || EMPTY_FORM.frequency,
              payoutInterval:
                plan.merry_go_round?.payout_interval ||
                EMPTY_FORM.payoutInterval,
              payoutIntervalDays:
                plan.merry_go_round?.payout_interval_days || "",
            });
          }
        }
      } catch (error) {
        setNotice({
          error: true,
          text:
            error?.response?.data?.message ||
            "Could not load MGR settings.",
        });
      }

      try {
        const response = await chamaApi.getMgrHistory(chamaId);

        setHistory(
          response?.data?.data?.payments || []
        );
      } catch (error) {
        console.debug(
          "Could not load MGR history",
          error
        );
      }
    },
    [chamaId]
  );

  useEffect(() => {
    if (!chamaId) return undefined;

    load({ updateSettings: true });

    const refreshTimer = setInterval(() => {
      load({ updateSettings: false });
    }, MGR_CONFIG.polling.refreshMs);

    return () => {
      clearInterval(refreshTimer);
    };
  }, [chamaId, load]);

  /* ==========================================================================
   * MEMBERSHIP / PERMISSIONS
   * ======================================================================== */

  const currentMembership = useMemo(() => {
    const memberships = overview?.members || [];
    const currentUserId = String(getUserId(user) || "");

    if (!currentUserId) return null;

    return (
      memberships.find(
        (member) =>
          String(
            getMembershipUserId(member) || ""
          ) === currentUserId
      ) || null
    );
  }, [overview?.members, user]);

  const role = useMemo(() => {
    return normalizeRole(
      currentMembership?.role ||
        workspace?.currentWorkspace?.role ||
        workspace?.currentWorkspace?.membership?.role
    );
  }, [
    currentMembership?.role,
    workspace?.currentWorkspace?.role,
    workspace?.currentWorkspace?.membership?.role,
  ]);

  const isTreasurer = isTreasurerRole(role);

  /* ==========================================================================
   * CURRENT USER OBLIGATION
   * ======================================================================== */

  const currentMembershipId = String(
    currentMembership?._id || ""
  );

  const pendingObligations = useMemo(
    () =>
      (overview?.obligations || []).filter(
        (item) =>
          item?.obligation?.status !==
          MGR_CONFIG.statuses.paid
      ),
    [overview?.obligations]
  );

  const hasPendingObligations =
    pendingObligations.length > 0;

  /* ==========================================================================
   * SAVE SETTINGS
   * ======================================================================== */

  const save = async (event) => {
    event.preventDefault();

    if (!chamaId) return;

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice({
        error: true,
        text: "Enter a valid contribution amount.",
      });
      return;
    }

    if (
      form.payoutInterval === "custom" &&
      (!form.payoutIntervalDays ||
        Number(form.payoutIntervalDays) <= 0)
    ) {
      setNotice({
        error: true,
        text: "Enter a valid number of days between payouts.",
      });
      return;
    }

    try {
      await chamaApi.saveMgrSettings(chamaId, {
        ...form,
        amount,
        payoutIntervalDays:
          form.payoutInterval === "custom"
            ? Number(form.payoutIntervalDays)
            : undefined,
      });

      setNotice({
        text:
          "MGR settings saved and the current round obligations were created.",
      });

      await load({ updateSettings: true });
    } catch (error) {
      setNotice({
        error: true,
        text:
          error?.response?.data?.message ||
          "Could not save MGR settings.",
      });
    }
  };

  /* ==========================================================================
   * M-PESA POLLING
   * ======================================================================== */

  const startPolling = useCallback(
    (paymentIntent, memberName) => {
      clearTimers();

      if (!paymentIntent?._id || !chamaId) {
        return;
      }

      setIsPolling(true);
      setCountdown(
        MGR_CONFIG.polling.timeoutSeconds
      );

      let remainingSeconds =
        MGR_CONFIG.polling.timeoutSeconds;

      let pollCount = 0;

      countdownRef.current = setInterval(() => {
        remainingSeconds -= 1;

        setCountdown(
          Math.max(remainingSeconds, 0)
        );

        if (remainingSeconds <= 0) {
          clearTimers();
          setIsPolling(false);

          setNotice({
            error: true,
            text: `Payment confirmation timed out for ${memberName}. If you completed the payment, the list will update shortly.`,
          });
        }
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          pollCount += 1;

          const shouldReconcile =
            pollCount %
              MGR_CONFIG.polling.reconciliationEvery ===
            0;

          const response = shouldReconcile
            ? await chamaApi.reconcilePaymentIntent(
                chamaId,
                paymentIntent._id
              )
            : await chamaApi.getPaymentIntent(
                chamaId,
                paymentIntent._id
              );

          const updated =
            response?.data?.data?.paymentIntent;

          if (!updated) {
            return;
          }

          const terminalStatuses = [
            MGR_CONFIG.statuses.completed,
            MGR_CONFIG.statuses.failed,
            MGR_CONFIG.statuses.cancelled,
          ];

          if (
            !terminalStatuses.includes(updated.status)
          ) {
            return;
          }

          clearTimers();
          setIsPolling(false);

          if (
            updated.status ===
            MGR_CONFIG.statuses.completed
          ) {
            setNotice({
              text: `Payment confirmed successfully for ${memberName}!`,
            });

            window.dispatchEvent(
              new Event("finance:updated")
            );

            await load({ updateSettings: false });
            return;
          }

          setNotice({
            error: true,
            text:
              updated.failure_reason ||
              `The transaction for ${memberName} failed or was cancelled.`,
          });

          await load({ updateSettings: false });
        } catch (error) {
          console.debug(
            "Polling attempt failed, retrying...",
            error
          );
        }
      }, MGR_CONFIG.polling.intervalMs);
    },
    [chamaId, clearTimers, load]
  );

  const handleCancelPayment = () => {
    clearTimers();

    setIsPolling(false);

    setCountdown(
      MGR_CONFIG.polling.timeoutSeconds
    );

    setNotice({
      error: true,
      text: "Payment process was cancelled by user.",
    });
  };

  /* ==========================================================================
   * REQUEST M-PESA PAYMENT
   * ======================================================================== */

  const requestPayment = async (item) => {
    if (!item?.obligation?._id) {
      return;
    }

    const phoneNumber = window.prompt(
      `M-Pesa phone number for ${item.member_name}`,
      item.phone || ""
    );

    if (!phoneNumber) return;

    const amount = Number(
      getDecimalValue(
        item.obligation.expected_amount ||
          overview?.plan?.amount
      )
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice({
        error: true,
        text: "This obligation does not have a valid payment amount.",
      });
      return;
    }

    setSendingObligationId(
      item.obligation._id
    );

    setNotice(null);

    try {
      const responseData =
        await financeService.initiateMpesaStkPush({
          contributionObligationId:
            item.obligation._id,
          amount,
          phoneNumber,
          accountReference:
            buildAccountReference(chamaId),
          transactionDescription:
            "Merry-Go-Round contribution",
        });

      const paymentIntent =
        responseData?.paymentIntent;

      setNotice({
        text: `STK prompt sent to ${item.member_name}. Complete it on the selected phone number.`,
      });

      window.dispatchEvent(
        new Event("finance:updated")
      );

      if (paymentIntent?._id) {
        startPolling(
          paymentIntent,
          item.member_name
        );
      }
    } catch (error) {
      setNotice({
        error: true,
        text:
          error?.response?.data?.message ||
          "Could not send the M-Pesa prompt.",
      });
    } finally {
      setSendingObligationId(null);
    }
  };

  /* ==========================================================================
   * MARK PAYMENT PAID
   * ======================================================================== */

  const openMarkPaid = (item) => {
    if (!item?.obligation?._id) return;

    setMarkPaidTarget(
      item.obligation._id
    );

    setMarkPaidForm({
      ...EMPTY_MARK_PAID_FORM,
    });

    setNotice(null);
  };

  const cancelMarkPaid = () => {
    setMarkPaidTarget(null);
    setMarkPaidForm({
      ...EMPTY_MARK_PAID_FORM,
    });
  };

  const submitMarkPaid = async (item) => {
    if (!chamaId || !item?.obligation?._id) {
      return;
    }

    setMarkingPaid(true);
    setNotice(null);

    try {
      await chamaApi.markMgrPaid(
        chamaId,
        item.obligation._id,
        markPaidForm
      );

      setNotice({
        text: `${item.member_name}'s contribution was recorded as paid.`,
      });

      setMarkPaidTarget(null);

      setMarkPaidForm({
        ...EMPTY_MARK_PAID_FORM,
      });

      window.dispatchEvent(
        new Event("finance:updated")
      );

      await load({ updateSettings: false });
    } catch (error) {
      setNotice({
        error: true,
        text:
          error?.response?.data?.message ||
          "Could not record this payment.",
      });
    } finally {
      setMarkingPaid(false);
    }
  };

  /* ==========================================================================
   * REMINDERS
   * ======================================================================== */

  const sendReminder = async (
    item,
    channel
  ) => {
    if (!item?.phone) {
      setNotice({
        error: true,
        text: `${item.member_name} has no phone number saved.`,
      });
      return;
    }

    const amount =
      item.obligation?.expected_amount ||
      overview?.plan?.amount;

    const message = buildReminderMessage({
      memberName: item.member_name,
      amount,
    });

    setReminding(true);

    try {
      await chamaApi.recordMgrReminder(
        chamaId,
        {
          obligationId:
            item.obligation._id,
          channel,
          message,
        }
      );

      const url = buildReminderUrl({
        channel,
        phone: item.phone,
        message,
      });

      if (url) {
        window.open(
          url,
          "_blank",
          "noopener,noreferrer"
        );
      }

      setNotice({
        text: `${
          channel ===
          MGR_CONFIG.reminderChannels.sms
            ? "SMS"
            : "WhatsApp"
        } reminder opened for ${item.member_name}.`,
      });

      await load({
        updateSettings: false,
      });
    } catch (error) {
      setNotice({
        error: true,
        text:
          error?.response?.data?.message ||
          "Could not prepare this reminder.",
      });
    } finally {
      setReminding(false);
    }
  };

  const remindAllPending = async () => {
    const pendingWithPhones =
      pendingObligations.filter(
        (item) => item?.phone
      );

    if (!pendingWithPhones.length) {
      setNotice({
        error: true,
        text:
          "There are no pending members with saved phone numbers.",
      });
      return;
    }

    setReminding(true);

    try {
      await Promise.all(
        pendingWithPhones.map((item) => {
          const amount =
            item.obligation?.expected_amount ||
            overview?.plan?.amount;

          const message =
            buildReminderMessage({
              memberName: item.member_name,
              amount,
            });

          return chamaApi.recordMgrReminder(
            chamaId,
            {
              obligationId:
                item.obligation._id,
              channel:
                MGR_CONFIG.reminderChannels.sms,
              message,
            }
          );
        })
      );

      setNotice({
        text: `Reminder activity recorded for ${pendingWithPhones.length} pending member(s). Use the SMS or WhatsApp button beside each member to send it.`,
      });

      await load({
        updateSettings: false,
      });
    } catch (error) {
      setNotice({
        error: true,
        text:
          error?.response?.data?.message ||
          "Could not prepare all reminders.",
      });
    } finally {
      setReminding(false);
    }
  };

  /* ==========================================================================
   * RENDER
   * ======================================================================== */

  return (
    <div className="space-y-6">
      {/* ======================================================================
       * HEADER
       * ==================================================================== */}

      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <CircleDollarSign />
          Merry-Go-Round
        </h1>

        <p className="mt-2 text-slate-500">
          Track every member&apos;s payment for the active interval
          and settle each rotational payout.
        </p>
      </div>

      {/* ======================================================================
       * SETTINGS
       * ==================================================================== */}

      {isTreasurer && (
        <form
          onSubmit={save}
          className="grid max-w-3xl gap-4 rounded-2xl border bg-white p-6 md:grid-cols-2"
        >
          <label className="text-sm font-semibold">
            Contribution amount (KES)

            <input
              required
              type="number"
              min="1"
              value={form.amount}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  amount: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm font-semibold">
            Contribution frequency

            <select
              value={form.frequency}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  frequency: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border p-3"
            >
              {MGR_CONFIG.frequencies.map(
                (frequency) => (
                  <option
                    key={frequency.value}
                    value={frequency.value}
                  >
                    {frequency.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="text-sm font-semibold">
            Payout interval

            <select
              value={form.payoutInterval}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  payoutInterval:
                    event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border p-3"
            >
              {MGR_CONFIG.payoutIntervals.map(
                (interval) => (
                  <option
                    key={interval.value}
                    value={interval.value}
                  >
                    {interval.label}
                  </option>
                )
              )}
            </select>
          </label>

          {form.payoutInterval === "custom" && (
            <label className="text-sm font-semibold">
              Days between payouts

              <input
                required
                type="number"
                min="1"
                value={form.payoutIntervalDays}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    payoutIntervalDays:
                      event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border p-3"
              />
            </label>
          )}

          <button
            type="submit"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white"
          >
            <Save size={18} />
            Save MGR settings
          </button>
        </form>
      )}

      {!isTreasurer && (
        <p className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
          Only authorized MGR officials can manage settings and
          reminders. You can pay your own pending contribution below.
        </p>
      )}

      {/* ======================================================================
       * NOTICE
       * ==================================================================== */}

      {notice && (
        <p
          className={`rounded-xl border p-4 ${
            notice.error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* ======================================================================
       * CURRENT ROUND
       * ==================================================================== */}

      <section className="relative rounded-2xl border bg-white p-6">
        {isPolling && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/80 p-6 text-center backdrop-blur-sm dark:bg-slate-900/80">
            <Loader2
              size={38}
              className="mb-2 animate-spin text-emerald-600"
            />

            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Waiting for M-Pesa PIN Entry ({countdown}s)
            </p>

            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Check the phone screen for the prompt and enter the PIN.
            </p>

            <button
              type="button"
              onClick={handleCancelPayment}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 shadow-sm transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
            >
              <XCircle size={16} />
              Cancel Payment
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              Current MGR round
            </h2>

            {overview?.round && (
              <p className="mt-1 text-sm text-slate-500">
                {new Date(
                  overview.round.start
                ).toLocaleDateString()}{" "}
                to{" "}
                {new Date(
                  overview.round.end
                ).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {isTreasurer &&
              hasPendingObligations && (
                <button
                  type="button"
                  disabled={reminding}
                  onClick={remindAllPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Bell size={16} />

                  {reminding
                    ? "Preparing..."
                    : "Remind all pending"}
                </button>
              )}

            {overview?.currentPayout && (
              <Link
                to={`/workspace/${chamaId}/finance/payouts`}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Settle pending payout
              </Link>
            )}
          </div>
        </div>

        {/* ====================================================================
         * OBLIGATIONS
         * ================================================================== */}

        <div className="mt-4 divide-y rounded-xl border">
          {overview?.obligations?.length ? (
            overview.obligations.map((item) => {
              const obligation =
                item?.obligation;

              const paid =
                obligation?.status ===
                MGR_CONFIG.statuses.paid;

              const own =
                String(item?.member_id || "") ===
                currentMembershipId;

              const canPay =
                isTreasurer || own;

              const amount =
                obligation?.expected_amount ||
                overview?.plan?.amount;

              const isSending =
                sendingObligationId ===
                obligation?._id;

              return (
                <div
                  key={
                    obligation?._id ||
                    item?.member_id
                  }
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-semibold">
                      {item?.member_name ||
                        "Member"}

                      <span className="ml-1 text-sm font-normal text-slate-500">
                        (Position{" "}
                        {item?.payout_position ||
                          "-"}
                        )
                      </span>
                    </p>

                    <p className="text-sm text-slate-500">
                      {item?.phone ||
                        "No phone saved"}{" "}
                      · KES {money(amount)} ·{" "}

                      <span
                        className={
                          paid
                            ? "font-semibold text-emerald-600"
                            : "font-semibold text-amber-600"
                        }
                      >
                        {paid
                          ? "Paid"
                          : "Pending"}
                      </span>

                      {!paid &&
                        item?.owed_periods >
                          1 && (
                          <span className="ml-1 font-semibold text-red-600">
                            · Owes{" "}
                            {item.owed_periods}{" "}
                            periods
                          </span>
                        )}

                      {item?.last_reminder && (
                        <span>
                          {" "}
                          · Last reminded{" "}
                          {new Date(
                            item.last_reminder.sent_at
                          ).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>

                  {!paid && obligation && (
                    <div className="flex flex-wrap gap-2">
                      {canPay && (
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() =>
                            requestPayment(item)
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
                        >
                          <Smartphone size={16} />

                          {isSending
                            ? "Sending..."
                            : own &&
                                !isTreasurer
                              ? "Pay by M-Pesa"
                              : "Send STK"}
                        </button>
                      )}

                      {isTreasurer && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openMarkPaid(
                                item
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                          >
                            <CheckCircle2
                              size={16}
                            />
                            Mark Paid
                          </button>

                          <button
                            type="button"
                            disabled={
                              reminding ||
                              !item?.phone
                            }
                            onClick={() =>
                              sendReminder(
                                item,
                                MGR_CONFIG
                                  .reminderChannels
                                  .sms
                              )
                            }
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            SMS
                          </button>

                          <button
                            type="button"
                            disabled={
                              reminding ||
                              !item?.phone
                            }
                            onClick={() =>
                              sendReminder(
                                item,
                                MGR_CONFIG
                                  .reminderChannels
                                  .whatsapp
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            <MessageCircle
                              size={15}
                            />
                            WA
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* ==========================================================
                   * MARK PAID FORM
                   * ======================================================== */}

                  {markPaidTarget ===
                    obligation?._id && (
                    <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-700">
                        Record{" "}
                        {item?.member_name ||
                          "member"}
                        &apos;s payment of KES{" "}
                        {money(amount)}
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="text-xs font-semibold text-slate-600">
                          Method

                          <select
                            value={
                              markPaidForm.method
                            }
                            onChange={(event) =>
                              setMarkPaidForm(
                                (previous) => ({
                                  ...previous,
                                  method:
                                    event.target
                                      .value,
                                })
                              )
                            }
                            className="mt-1 w-full rounded-lg border p-2 text-sm"
                          >
                            {MGR_CONFIG.paymentMethods.map(
                              (method) => (
                                <option
                                  key={
                                    method.value
                                  }
                                  value={
                                    method.value
                                  }
                                >
                                  {method.label}
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                          Reference (optional)

                          <input
                            type="text"
                            value={
                              markPaidForm.reference
                            }
                            onChange={(event) =>
                              setMarkPaidForm(
                                (previous) => ({
                                  ...previous,
                                  reference:
                                    event.target
                                      .value,
                                })
                              )
                            }
                            placeholder="e.g. till receipt or slip number"
                            className="mt-1 w-full rounded-lg border p-2 text-sm"
                          />
                        </label>
                      </div>

                      <label className="mt-3 block text-xs font-semibold text-slate-600">
                        Notes (optional)

                        <textarea
                          rows={2}
                          value={
                            markPaidForm.notes
                          }
                          onChange={(event) =>
                            setMarkPaidForm(
                              (previous) => ({
                                ...previous,
                                notes:
                                  event.target
                                    .value,
                              })
                            )
                          }
                          className="mt-1 w-full rounded-lg border p-2 text-sm"
                          placeholder="Add any useful payment notes..."
                        />
                      </label>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={markingPaid}
                          onClick={() =>
                            submitMarkPaid(
                              item
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          <CheckCircle2
                            size={16}
                          />

                          {markingPaid
                            ? "Recording..."
                            : "Confirm payment"}
                        </button>

                        <button
                          type="button"
                          disabled={markingPaid}
                          onClick={
                            cancelMarkPaid
                          }
                          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
                        >
                          <X size={16} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">
              No MGR obligations are available for the current round.
            </div>
          )}
        </div>
      </section>

      {/* ======================================================================
       * PAYMENT HISTORY
       * ==================================================================== */}

      <section className="rounded-2xl border bg-white p-6">
        <div className="flex items-center gap-2">
          <History
            size={20}
            className="text-slate-500"
          />

          <h2 className="text-lg font-bold">
            Payment history
          </h2>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Every recorded MGR contribution across all rounds, most recent first.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">
                  Member
                </th>

                <th className="py-2 pr-4">
                  Amount
                </th>

                <th className="py-2 pr-4">
                  Method
                </th>

                <th className="py-2 pr-4">
                  Status
                </th>

                <th className="py-2 pr-4">
                  Reference
                </th>

                <th className="py-2 pr-4">
                  Date
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {!history.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-400"
                  >
                    No payments recorded yet.
                  </td>
                </tr>
              )}

              {history.map((record) => {
                const status =
                  record?.status;

                const completedDate =
                  record?.completed_at ||
                  record?.paid_at ||
                  record?.createdAt;

                return (
                  <tr key={record?._id}>
                    <td className="py-2 pr-4 font-medium">
                      {record?.participant_id
                        ?.user_id?.name ||
                        record?.participant?.user
                          ?.name ||
                        "Member"}
                    </td>

                    <td className="py-2 pr-4">
                      KES{" "}
                      {money(record?.amount)}
                    </td>

                    <td className="py-2 pr-4 capitalize">
                      {record?.payment_method ||
                        "—"}
                    </td>

                    <td
                      className={`py-2 pr-4 font-semibold capitalize ${
                        PAYMENT_STATUS_STYLES[
                          status
                        ] ||
                        "text-slate-500"
                      }`}
                    >
                      {status || "—"}
                    </td>

                    <td className="py-2 pr-4 text-slate-500">
                      {record?.external_reference ||
                        record?.reference ||
                        "—"}
                    </td>

                    <td className="py-2 pr-4 text-slate-500">
                      {completedDate
                        ? new Date(
                            completedDate
                          ).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}