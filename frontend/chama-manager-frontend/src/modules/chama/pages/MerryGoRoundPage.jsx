import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bell, CircleDollarSign, MessageCircle, Save, Smartphone } from "lucide-react";
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

    return () => clearInterval(timer);
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

  const requestPayment = async (item) => {
    const phoneNumber = window.prompt(
      `M-Pesa phone number for ${item.member_name}`,
      item.phone || ""
    );

    if (!phoneNumber) return;

    setSendingObligationId(item.obligation._id);

    try {
      await financeService.initiateMpesaStkPush({
        contributionObligationId: item.obligation._id,
        amount: Number(
          item.obligation.expected_amount?.$numberDecimal ||
            item.obligation.expected_amount
        ),
        phoneNumber,
        accountReference: `MGR-${String(chamaId).slice(-6)}`,
        transactionDescription: "Merry-Go-Round contribution",
      });

      setNotice({
        text: `STK prompt sent to ${item.member_name}. Complete it on the selected phone number.`,
      });
      window.dispatchEvent(new Event("finance:updated"));
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

      <section className="rounded-2xl border bg-white p-6">
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
