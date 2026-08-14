import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Bell, CircleDollarSign, MessageCircle, ListOrdered, Save, Smartphone, Loader2, XCircle, CheckCircle2, History, X } from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import useAuth from "@/app/hooks/useAuth";
import chamaApi from "../api/chama.api";
import financeService from "@/modules/finance/services/finance.service";
import membersService from "@/modules/members/services/members.service";

const money = (value) =>
  Number(value?.$numberDecimal || value || 0).toLocaleString();

export default function MerryGoRoundPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const workspace = useWorkspace();
  const { user } = useAuth();
  const chamaId = routeWorkspaceId || workspace.workspaceId;

  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
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
  const [markPaidTarget, setMarkPaidTarget] = useState(null); // obligation id with the inline form open
  const [markPaidForm, setMarkPaidForm] = useState({ method: "cash", reference: "", notes: "" });
  const [markingPaid, setMarkingPaid] = useState(false);

  const [isArranging, setIsArranging] = useState(false);
  const [orderDraft, setOrderDraft] = useState([]); // ChamaMembership docs, arranged first payout to last
  const [savingOrder, setSavingOrder] = useState(false);

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

    try {
      const { data } = await chamaApi.getMgrHistory(chamaId);
      setHistory(data.data?.payments || []);
    } catch (error) {
      console.debug("Could not load MGR history", error);
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

  // Treasurer OR Chairperson — mirrors the backend's
  // requireChamaTreasurerOrChairperson, which is what actually gates the
  // payout-order endpoint (and member management generally).
  const isTreasurer = ["treasurer", "chairperson", "admin", "owner"].includes(role);

  const activeMembersSorted = [...(overview?.members || [])].sort(
    (a, b) => (a.payout_position ?? Number.MAX_SAFE_INTEGER) - (b.payout_position ?? Number.MAX_SAFE_INTEGER)
  );

  const startArranging = () => {
    setOrderDraft(activeMembersSorted);
    setIsArranging(true);
    setNotice(null);
  };

  const cancelArranging = () => {
    setIsArranging(false);
    setOrderDraft([]);
  };

  const moveMember = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderDraft.length) return;

    const next = [...orderDraft];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setOrderDraft(next);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    setNotice(null);

    try {
      await membersService.reorderPayoutPositions(
        "chama",
        chamaId,
        orderDraft.map((member) => member._id)
      );

      setNotice({ text: "Payout order updated. The next payout will follow this arrangement." });
      setIsArranging(false);
      setOrderDraft([]);
      load();
    } catch (error) {
      setNotice({
        error: true,
        text: error.response?.data?.message || "Could not update the payout order.",
      });
    } finally {
      setSavingOrder(false);
    }
  };

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

  const openMarkPaid = (item) => {
    setMarkPaidTarget(item.obligation._id);
    setMarkPaidForm({ method: "cash", reference: "", notes: "" });
    setNotice(null);
  };

  const cancelMarkPaid = () => {
    setMarkPaidTarget(null);
  };

  const submitMarkPaid = async (item) => {
    setMarkingPaid(true);
    setNotice(null);

    try {
      await chamaApi.markMgrPaid(chamaId, item.obligation._id, markPaidForm);

      setNotice({
        text: `${item.member_name}'s contribution was recorded as paid.`,
      });
      setMarkPaidTarget(null);
      window.dispatchEvent(new Event("finance:updated"));
      load();
    } catch (error) {
      setNotice({
        error: true,
        text: error.response?.data?.message || "Could not record this payment.",
      });
    } finally {
      setMarkingPaid(false);
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
        <section className="rounded-2xl border bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ListOrdered size={18} /> Payout order
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Arrange the order members receive the merry-go-round payout, just like the
                chama agrees at a meeting. The rotation follows this list and wraps back to
                the top once everyone has received a payout.
              </p>
            </div>

            {!isArranging && (
              <button
                type="button"
                onClick={startArranging}
                disabled={!activeMembersSorted.length || Boolean(overview?.currentPayout)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                <ListOrdered size={16} />
                {overview?.members?.some((m) => m.payout_position == null)
                  ? "Set payout order"
                  : "Rearrange"}
              </button>
            )}
          </div>

          {overview?.currentPayout && !isArranging && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              {overview.currentPayout.status === "approved"
                ? "A payout is approved and ready to be disbursed. Settle or cancel it before rearranging the order."
                : "A payout is awaiting chairperson approval. Settle or cancel it before rearranging the order."}
            </p>
          )}

          {isArranging && (
            <div className="mt-4">
              <ol className="divide-y rounded-xl border">
                {orderDraft.map((member, index) => (
                  <li
                    key={member._id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {member.user_id?.name || "Member"}
                        </p>
                        <p className="text-xs capitalize text-slate-500">
                          {member.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveMember(index, -1)}
                        className="rounded-lg border p-2 text-slate-600 disabled:opacity-30"
                        aria-label={`Move ${member.user_id?.name || "member"} up`}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={index === orderDraft.length - 1}
                        onClick={() => moveMember(index, 1)}
                        className="rounded-lg border p-2 text-slate-600 disabled:opacity-30"
                        aria-label={`Move ${member.user_id?.name || "member"} down`}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={savingOrder}
                  onClick={saveOrder}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingOrder ? "Saving..." : "Save order"}
                </button>

                <button
                  type="button"
                  disabled={savingOrder}
                  onClick={cancelArranging}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50"
                >
                  <X size={16} /> Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

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
                {overview.currentPayout.status === "approved"
                  ? "Settle approved payout"
                  : "Review payout for approval"}
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
                    {!paid && item.owed_periods > 1 && (
                      <span className="ml-1 font-semibold text-red-600">
                        · Owes {item.owed_periods} months
                      </span>
                    )}
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
                          onClick={() => openMarkPaid(item)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} /> Mark Paid
                        </button>

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

                {markPaidTarget === item.obligation?._id && (
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-700">
                      Record {item.member_name}'s payment of KES {money(amount)}
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="text-xs font-semibold text-slate-600">
                        Method
                        <select
                          value={markPaidForm.method}
                          onChange={(e) =>
                            setMarkPaidForm({ ...markPaidForm, method: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border p-2 text-sm"
                        >
                          <option value="cash">Cash</option>
                          <option value="bank">Bank</option>
                          <option value="other">Other</option>
                        </select>
                      </label>

                      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                        Reference (optional)
                        <input
                          type="text"
                          value={markPaidForm.reference}
                          onChange={(e) =>
                            setMarkPaidForm({ ...markPaidForm, reference: e.target.value })
                          }
                          placeholder="e.g. till receipt or slip number"
                          className="mt-1 w-full rounded-lg border p-2 text-sm"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={markingPaid}
                        onClick={() => submitMarkPaid(item)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} />
                        {markingPaid ? "Recording..." : "Confirm payment"}
                      </button>

                      <button
                        type="button"
                        disabled={markingPaid}
                        onClick={cancelMarkPaid}
                        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
                      >
                        <X size={16} /> Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <div className="flex items-center gap-2">
          <History size={20} className="text-slate-500" />
          <h2 className="text-lg font-bold">Payment history</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Every recorded MGR contribution across all rounds, most recent first.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Member</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Reference</th>
                <th className="py-2 pr-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No payments recorded yet.
                  </td>
                </tr>
              )}

              {history.map((record) => {
                const statusStyles = {
                  completed: "text-emerald-600",
                  pending: "text-amber-600",
                  failed: "text-red-600",
                  reversed: "text-red-600",
                  cancelled: "text-slate-400",
                };

                return (
                  <tr key={record._id}>
                    <td className="py-2 pr-4 font-medium">
                      {record.participant_id?.user_id?.name || "Member"}
                    </td>
                    <td className="py-2 pr-4">KES {money(record.amount)}</td>
                    <td className="py-2 pr-4 capitalize">
                      {record.payment_method}
                    </td>
                    <td
                      className={`py-2 pr-4 font-semibold capitalize ${
                        statusStyles[record.status] || "text-slate-500"
                      }`}
                    >
                      {record.status}
                    </td>
                    <td className="py-2 pr-4 text-slate-500">
                      {record.external_reference || record.reference}
                    </td>
                    <td className="py-2 pr-4 text-slate-500">
                      {new Date(
                        record.completed_at || record.paid_at || record.createdAt
                      ).toLocaleDateString()}
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
