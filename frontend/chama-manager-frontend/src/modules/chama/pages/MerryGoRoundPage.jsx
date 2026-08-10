import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bell, CircleDollarSign, MessageCircle, Save, Smartphone, Loader2, XCircle } from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import useAuth from "@/app/hooks/useAuth";
import chamaApi from "../api/chama.api";
import financeService from "@/modules/finance/services/finance.service";

const money = (value) =>
  Number(value?.$numberDecimal || value || 0).toLocaleString();

export default function MerryGoRoundPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const workspace = useWorkspace();
  const { user } = useAuth();
  const chamaId = routeWorkspaceId || workspace.workspaceId;

  const [overview, setOverview] = useState(null);
  const [form, setForm] = useState({
    amount: "",
    frequency: "monthly",
    payoutInterval: "monthly",
    payoutIntervalDays: "",
  });
  const [notice, setNotice] = useState(null);
  const [sendingObligationId, setSendingObligationId] = useState(null);
  const [reminding, setReminding] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const handleCancelPayment = () => {
    clearTimers();
    setIsPolling(false);
    setNotice({
      error: true,
      text: "Payment process was cancelled by user.",
    });
  };

  const load = async () => {
    try {
      const { data } = await chamaApi.getMgr(chamaId);
      setOverview(data.data);

      const plan = data.data.plan;
      if (plan) {
        setForm({
          amount: plan.amount?.$numberDecimal || plan.amount || "",
          frequency: plan.frequency,
          payoutInterval: plan.merry_go_round?.payout_interval || "monthly",
          payoutIntervalDays: plan.merry_go_round?.payout_interval_days || "",
        });
      }
    } catch (error) {
      setNotice({
        error: true,
        text: error.response?.data?.message || "Could not load MGR settings.",
      });
    }
  };

  useEffect(() => {
    if (!chamaId) return undefined;

    load();
    const timer = setInterval(load, 15000);

    return () => {
      clearInterval(timer);
      clearTimers();
    };
  }, [chamaId]);

  const currentMembership = overview?.members?.find(
    (member) =>
      String(member.user_id?._id || member.user_id) ===
      String(user?._id || user?.id)
  );

  const role = (
    currentMembership?.role ||
    workspace.currentWorkspace?.role ||
    workspace.currentWorkspace?.membership?.role ||
    ""
  ).toLowerCase();

  const isTreasurer = ["treasurer", "admin", "owner"].includes(role);

  const save = async (event) => {
    event.preventDefault();

    try {
      await chamaApi.saveMgrSettings(chamaId, {
        ...form,
        amount: Number(form.amount),
        payoutIntervalDays:
          form.payoutInterval === "custom"
            ? Number(form.payoutIntervalDays)
            : undefined,
      });

      setNotice({
        text: "MGR settings saved and the current round obligations were created.",
      });

      load();
    } catch (error) {
      setNotice({
        error: true,
        text: error.response?.data?.message || "Could not save MGR settings.",
      });
    }
  };

  const startPolling = (paymentIntent, memberName) => {
    clearTimers();
    setIsPolling(true);
    setCountdown(60);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearTimers();
          setIsPolling(false);
          setNotice({
            error: true,
            text: `Payment confirmation timed out for ${memberName}. If you completed the payment, the list will update shortly.`,
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    let pollCount = 0;
    pollRef.current = setInterval(async () => {
      try {
        pollCount += 1;
        const response = pollCount >= 4 && pollCount % 4 === 0
          ? await chamaApi.reconcilePaymentIntent(chamaId, paymentIntent._id)
          : await chamaApi.getPaymentIntent(chamaId, paymentIntent._id);
        const updated = response.data.data.paymentIntent;

        if (["completed", "failed", "cancelled"].includes(updated.status)) {
          clearTimers();
          setIsPolling(false);

          if (updated.status === "completed") {
            setNotice({
              text: `Payment confirmed successfully for ${memberName}!`,
            });
            window.dispatchEvent(new Event("finance:updated"));
            load();
          } else {
            setNotice({
              error: true,
              text: updated.failure_reason || `The transaction for ${memberName} failed or was cancelled.`,
            });
            load();
          }
        }
      } catch (err) {
        console.debug("Polling attempt failed, retrying...", err);
      }
    }, 3000);
  };

  const requestPayment = async (item) => {
    const phoneNumber = window.prompt(
      `M-Pesa phone number for ${item.member_name}`,
      item.phone || ""
    );

    if (!phoneNumber) return;

    setSendingObligationId(item.obligation._id);
    setNotice(null);

    try {
      const responseData = await financeService.initiateMpesaStkPush({
        contributionObligationId: item.obligation._id,
        amount: Number(
          item.obligation.expected_amount?.$numberDecimal ||
            item.obligation.expected_amount
        ),
        phoneNumber,
        accountReference: `MGR-${String(chamaId).slice(-6)}`,
        transactionDescription: "Merry-Go-Round contribution",
      });

      const paymentIntent = responseData?.paymentIntent;

      setNotice({
        text: `STK prompt sent to ${item.member_name}. Complete it on the selected phone number.`,
      });
      window.dispatchEvent(new Event("finance:updated"));

      if (paymentIntent?._id) {
        startPolling(paymentIntent, item.member_name);
      }
    } catch (error) {
      setNotice({
        error: true,
        text: error.response?.data?.message || "Could not send the M-Pesa prompt.",
      });
    } finally {
      setSendingObligationId(null);
    }
  };

  const reminderMessage = (item) =>
    `Hello ${item.member_name}, a MGR contribution of KES ${money(
      item.obligation?.expected_amount || overview?.plan?.amount
    )} is pending for the current chama round. Please complete payment as soon as possible. Thank you.`;

  const phoneForLink = (phone) =>
    String(phone || "").replace(/[^0-9]/g, "").replace(/^0/, "254");

  const sendReminder = async (item, channel) => {
    if (!item.phone) {
      setNotice({
        error: true,
        text: `${item.member_name} has no phone number saved.`,
      });
      return;
    }

    const message = reminderMessage(item);
    setReminding(true);

    try {
      await chamaApi.recordMgrReminder(chamaId, {
        obligationId: item.obligation._id,
        channel,
        message,
      });

      const url =
        channel === "whatsapp"
          ? `https://wa.me/${phoneForLink(item.phone)}?text=${encodeURIComponent(message)}`
          : `sms:${phoneForLink(item.phone)}?body=${encodeURIComponent(message)}`;

      window.open(url, "_blank", "noopener,noreferrer");

      setNotice({
        text: `${channel === "sms" ? "SMS" : "WhatsApp"} reminder opened for ${item.member_name}.`,
      });

      load();
    } catch (error) {
      setNotice({
        error: true,
        text: error.response?.data?.message || "Could not prepare this reminder.",
      });
    } finally {
      setReminding(false);
    }
  };

  const remindAllPending = async () => {
    const pending = (overview?.obligations || []).filter(
      (item) => item.obligation?.status !== "paid" && item.phone
    );

    if (!pending.length) return;

    setReminding(true);

    try {
      await Promise.all(
        pending.map((item) =>
          chamaApi.recordMgrReminder(chamaId, {
            obligationId: item.obligation._id,
            channel: "sms",
            message: reminderMessage(item),
          })
        )
      );

      setNotice({
        text: `Reminder activity recorded for ${pending.length} pending member(s). Use the SMS or WhatsApp button beside each member to send it.`,
      });

      load();
    } catch (error) {
      setNotice({
        error: true,
        text: error.response?.data?.message || "Could not prepare all reminders.",
      });
    } finally {
      setReminding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <CircleDollarSign /> Merry-Go-Round
        </h1>
        <p className="mt-2 text-slate-500">
          Track every member's payment for the active interval and settle each rotational payout.
        </p>
      </div>

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
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm font-semibold">
            Contribution frequency
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              className="mt-1 w-full rounded-lg border p-3"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label className="text-sm font-semibold">
            Payout interval
            <select
              value={form.payoutInterval}
              onChange={(e) =>
                setForm({ ...form, payoutInterval: e.target.value })
              }
              className="mt-1 w-full rounded-lg border p-3"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom days</option>
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
                onChange={(e) =>
                  setForm({ ...form, payoutIntervalDays: e.target.value })
                }
                className="mt-1 w-full rounded-lg border p-3"
              />
            </label>
          )}

          <button className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white">
            <Save size={18} /> Save MGR settings
          </button>
        </form>
      )}

      {!isTreasurer && (
        <p className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
          Only the treasurer can manage MGR settings and reminders. You can pay
          your own pending contribution below.
        </p>
      )}

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

      <section className="rounded-2xl border bg-white p-6 relative">
        {isPolling && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs z-10 flex flex-col items-center justify-center rounded-2xl p-6 text-center animate-fade-in">
            <Loader2 size={38} className="animate-spin text-emerald-600 mb-2" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Waiting for M-Pesa PIN Entry ({countdown}s)
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Check the phone screen for the prompt and enter the PIN.
            </p>

            <button
              type="button"
              onClick={handleCancelPayment}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300 transition-colors cursor-pointer shadow-xs"
            >
              <XCircle size={16} />
              Cancel Payment
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Current MGR round</h2>
            {overview?.round && (
              <p className="mt-1 text-sm text-slate-500">
                {new Date(overview.round.start).toLocaleDateString()} to{" "}
                {new Date(overview.round.end).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {isTreasurer &&
              (overview?.obligations || []).some(
                (item) => item.obligation?.status !== "paid"
              ) && (
                <button
                  type="button"
                  disabled={reminding}
                  onClick={remindAllPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Bell size={16} /> Remind all pending
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

        <div className="mt-4 divide-y rounded-xl border">
          {overview?.obligations?.map((item) => {
            const paid = item.obligation?.status === "paid";
            const own =
              String(item.member_id) === String(currentMembership?._id);
            const canPay = isTreasurer || own;
            const amount =
              item.obligation?.expected_amount || overview?.plan?.amount;

            return (
              <div
                key={item.member_id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {item.member_name}
                    <span className="ml-1 text-sm font-normal text-slate-500">
                      {" "}
                      (Position {item.payout_position || "-"})
                    </span>
                  </p>

                  <p className="text-sm text-slate-500">
                    {item.phone || "No phone saved"} · KES {money(amount)} ·{" "}
                    <span
                      className={
                        paid
                          ? "font-semibold text-emerald-600"
                          : "font-semibold text-amber-600"
                      }
                    >
                      {paid ? "Paid" : "Pending"}
                    </span>
                    {item.last_reminder && (
                      <span>
                        {" "}
                        · Last reminded{" "}
                        {new Date(item.last_reminder.sent_at).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>

                {!paid && item.obligation && (
                  <div className="flex flex-wrap gap-2">
                    {canPay && (
                      <button
                        type="button"
                        disabled={sendingObligationId === item.obligation._id}
                        onClick={() => requestPayment(item)}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
                      >
                        <Smartphone size={16} />
                        {sendingObligationId === item.obligation._id
                          ? "Sending..."
                          : own && !isTreasurer
                            ? "Pay by M-Pesa"
                            : "Send STK"}
                      </button>
                    )}

                    {isTreasurer && (
                      <>
                        <button
                          type="button"
                          disabled={reminding || !item.phone}
                          onClick={() => sendReminder(item, "sms")}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          SMS
                        </button>

                        <button
                          type="button"
                          disabled={reminding || !item.phone}
                          onClick={() => sendReminder(item, "whatsapp")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          <MessageCircle size={15} /> WA
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
