import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Plus, Search, Loader2, HeartHandshake, X } from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import chamaContributionApi from "../api/chamaContribution.api";
import mgrApi from "../api/mgr.api";
import ContributionCard from "../components/chamaContributions/ContributionCard";
import ContributionDrawer from "../components/chamaContributions/ContributionDrawer";
import {
  CreateModal,
  ChipInModal,
  RecordCashModal,
  ProposePayoutModal,
  ConfirmModal,
} from "../components/chamaContributions/modals";
import {
  OFFICIAL_ROLES,
  PURPOSES,
  getCollected,
  getPct,
  daysLeft,
  beneficiaryName,
  nextStepFor,
  compactMoney,
  money,
  toNumber,
  purposeOf,
} from "../components/chamaContributions/helpers";

const TAB_FILTERS = {
  attention: () => true, // resolved separately, needs the viewer's next step
  active: (c) => c.status === "active",
  pending: (c) => c.status === "pending_approval",
  payouts: (c) => ["closed", "payout_pending"].includes(c.status),
  past: (c) => ["completed", "rejected", "cancelled"].includes(c.status),
  all: () => true,
};

const SORTS = {
  newest: { label: "Newest first", fn: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  closing: {
    label: "Closing soonest",
    fn: (a, b) => {
      const da = a.deadline && a.status === "active" ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline && b.status === "active" ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    },
  },
  raised: { label: "Most raised", fn: (a, b) => getCollected(b) - getCollected(a) },
  nearly: { label: "Nearest to target", fn: (a, b) => (getPct(b) ?? -1) - (getPct(a) ?? -1) },
};

const raisedOf = (c) => (c.status === "completed" ? toNumber(c.disbursed_amount) : getCollected(c));

function Stat({ label, value, note }) {
  return (
    <div className="flex-1 px-5 py-4">
      <p className="text-xs font-medium text-slate-500 dark:text-mist-muted">{label}</p>
      <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-mist">{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-mist-muted">{note}</p>}
    </div>
  );
}

export default function ChamaContributionsPage() {
  const workspace = useWorkspace();
  const workspaceId = workspace?.workspaceId;
  const role = workspace?.activeWorkspace?.role || workspace?.currentWorkspace?.role || workspace?.membership?.role;
  const isOfficial = OFFICIAL_ROLES.includes(role);
  const myMembershipId = String(workspace?.membership?._id || workspace?.activeWorkspace?.membershipId || "");

  const [contributions, setContributions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState(null);

  const [tab, setTab] = useState(null);
  const [query, setQuery] = useState("");
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [openId, setOpenId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState(null); // { type, contribution }

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [{ data: listRes }, membersRes] = await Promise.all([
        chamaContributionApi.list(workspaceId),
        mgrApi.getMembers(workspaceId).catch(() => ({ data: { data: { members: [] } } })),
      ]);
      setContributions(listRes?.data?.contributions || []);
      setMembers(membersRes?.data?.data?.members || membersRes?.data?.members || []);
      setLoadError("");
    } catch (err) {
      setLoadError(err?.response?.data?.message || "Couldn't load contributions. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const toastTimer = useRef(null);
  const notify = (message, kind = "ok") => {
    setToast({ message, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  const stepFor = useCallback((c) => nextStepFor(c, { isOfficial, myMembershipId }), [isOfficial, myMembershipId]);

  // ---- derived data -------------------------------------------------------
  const counts = useMemo(() => {
    const out = {};
    for (const key of Object.keys(TAB_FILTERS)) {
      out[key] =
        key === "attention"
          ? contributions.filter((c) => stepFor(c)?.attention).length
          : contributions.filter(TAB_FILTERS[key]).length;
    }
    return out;
  }, [contributions, stepFor]);

  // Land the viewer on whatever is most useful the first time data arrives.
  useEffect(() => {
    if (tab !== null || loading) return;
    if (isOfficial && counts.attention > 0) setTab("attention");
    else if (counts.active > 0) setTab("active");
    else setTab("all");
  }, [tab, loading, isOfficial, counts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const activeTab = tab || "all";
    return contributions
      .filter((c) => (activeTab === "attention" ? stepFor(c)?.attention : TAB_FILTERS[activeTab](c)))
      .filter((c) => purposeFilter === "all" || c.purpose === purposeFilter)
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.title} ${beneficiaryName(c) || ""} ${purposeOf(c.purpose).label}`.toLowerCase();
        return hay.includes(q);
      })
      .sort(SORTS[sort].fn);
  }, [contributions, tab, query, purposeFilter, sort, stepFor]);

  const summary = useMemo(() => {
    const active = contributions.filter((c) => c.status === "active");
    const closingSoon = active.filter((c) => {
      const d = daysLeft(c);
      return d !== null && d <= 7;
    });
    return {
      activeCount: active.length,
      activeRaised: active.reduce((sum, c) => sum + getCollected(c), 0),
      closingSoon: closingSoon.length,
      totalRaised: contributions
        .filter((c) => ["active", "closed", "payout_pending", "completed"].includes(c.status))
        .reduce((sum, c) => sum + raisedOf(c), 0),
      iGave: contributions.reduce((sum, c) => sum + toNumber(c.my_contributed), 0),
    };
  }, [contributions]);

  const openContribution = contributions.find((c) => c._id === openId) || null;

  // ---- actions ------------------------------------------------------------
  const refresh = async () => {
    await load();
    setRefreshKey((k) => k + 1);
  };

  const run = async (fn, success) => {
    await fn();
    if (success) notify(success);
    await refresh();
  };

  const handleCreate = (payload) =>
    run(() => chamaContributionApi.create(workspaceId, payload), "Submitted. An official needs to approve it before money can come in.");

  // Entry point for every button on cards and in the drawer.
  const handleAction = async (key, c) => {
    switch (key) {
      case "review":
        setOpenId(c._id);
        break;
      case "approve":
        try {
          await run(() => chamaContributionApi.approve(workspaceId, c._id), "Approved. Members can now chip in.");
        } catch (err) {
          notify(err?.response?.data?.message || err?.message || "Couldn't approve", "error");
        }
        break;
      default:
        setModal({ type: key, contribution: c });
    }
  };

  const approvalId = (c) => c.payout_approval?._id || c.approval_request_id;

  const renderModal = () => {
    if (!modal) return null;
    const { type, contribution: c } = modal;
    const close = () => setModal(null);

    switch (type) {
      case "create":
        return <CreateModal members={members} isOfficial={isOfficial} onClose={close} onSubmit={handleCreate} />;
      case "chip_in":
        return (
          <ChipInModal
            contribution={c}
            onClose={close}
            onSubmit={(p) => run(() => chamaContributionApi.contribute(workspaceId, c._id, p), "Check your phone and enter your M-Pesa PIN. It will show here once it goes through.")}
          />
        );
      case "record_cash":
        return (
          <RecordCashModal
            contribution={c}
            members={members}
            onClose={close}
            onSubmit={(p) => run(() => chamaContributionApi.recordCash(workspaceId, c._id, p), "Cash recorded")}
          />
        );
      case "propose_payout":
        return (
          <ProposePayoutModal
            contribution={c}
            onClose={close}
            onSubmit={(p) => run(() => chamaContributionApi.proposePayout(workspaceId, c._id, p), "Payout sent for sign-off")}
          />
        );
      case "reject":
        return (
          <ConfirmModal
            title={`Reject "${c.title}"?`}
            body="The person who proposed it will see the reason you give."
            confirmLabel="Reject"
            tone="bg-rose-500 hover:bg-rose-600"
            withReason
            reasonRequired
            onClose={close}
            onSubmit={(reason) => run(() => chamaContributionApi.reject(workspaceId, c._id, reason), "Rejected")}
          />
        );
      case "close":
        return (
          <ConfirmModal
            title="Close this collection?"
            body={`Nobody will be able to chip in to "${c.title}" after this. You can then propose a payout of ${money(getCollected(c))}.`}
            confirmLabel="Close collection"
            onClose={close}
            onSubmit={() => run(() => chamaContributionApi.closeCollection(workspaceId, c._id), "Collection closed")}
          />
        );
      case "cancel":
        return (
          <ConfirmModal
            title={`Cancel "${c.title}"?`}
            body="This is only possible before any money has come in."
            confirmLabel="Cancel contribution"
            tone="bg-rose-500 hover:bg-rose-600"
            withReason
            reasonLabel="Reason (optional)"
            onClose={close}
            onSubmit={(reason) => run(() => chamaContributionApi.cancel(workspaceId, c._id, reason), "Cancelled")}
          />
        );
      case "sign_off":
        return (
          <ConfirmModal
            title="Sign off this payout?"
            body={`You are confirming that ${money(getCollected(c))} from "${c.title}" can be paid out.`}
            confirmLabel="Sign off"
            tone="bg-violet-600 hover:bg-violet-700"
            withReason
            reasonLabel="Comment (optional)"
            onClose={close}
            onSubmit={(comment) =>
              run(() => mgrApi.submitApprovalSignoff(approvalId(c), { status: "approved", comment }), "Signed off")
            }
          />
        );
      case "reject_payout":
        return (
          <ConfirmModal
            title="Decline this payout?"
            body="Declining stops the payout request for everyone. The collection stays closed."
            confirmLabel="Decline payout"
            tone="bg-rose-500 hover:bg-rose-600"
            withReason
            reasonRequired
            onClose={close}
            onSubmit={(comment) =>
              run(() => mgrApi.submitApprovalSignoff(approvalId(c), { status: "rejected", comment }), "Payout declined")
            }
          />
        );
      case "disburse":
        return (
          <ConfirmModal
            title={`Disburse ${money(getCollected(c))}?`}
            body={`This pays out "${c.title}" and records it in the books. It can't be undone.`}
            confirmLabel="Disburse"
            tone="bg-emerald-600 hover:bg-emerald-700"
            onClose={close}
            onSubmit={() => run(() => chamaContributionApi.disburse(workspaceId, c._id), "Paid out")}
          />
        );
      default:
        return null;
    }
  };

  // ---- render -------------------------------------------------------------
  const tabs = [
    ...(isOfficial ? [["attention", "Needs you"]] : []),
    ["active", "Collecting"],
    ["pending", "Awaiting approval"],
    ["payouts", "Payouts"],
    ["past", "Past"],
    ["all", "All"],
  ];

  const filtersActive = query.trim() || purposeFilter !== "all";

  return (
    <div className="mx-auto max-w-6xl p-4 font-sans md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-mist">Chama contributions</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-mist-muted">
            Chip in for a member's emergency or wedding, or raise money for something the chama wants to buy.
          </p>
        </div>
        <button
          onClick={() => setModal({ type: "create" })}
          className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-600"
        >
          <Plus size={16} /> New contribution
        </button>
      </div>

      {/* Summary strip: one panel with dividers, not four separate cards */}
      {!loading && contributions.length > 0 && (
        <div className="mt-6 flex flex-col divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:flex-row sm:divide-x sm:divide-y-0 dark:divide-obsidian-border dark:border-obsidian-border dark:bg-obsidian-card">
          <Stat label="Collecting now" value={summary.activeCount} note={`${compactMoney(summary.activeRaised)} raised so far`} />
          <Stat
            label="Closing within a week"
            value={summary.closingSoon}
            note={summary.closingSoon ? "Remind members to chip in" : "No deadlines close to"}
          />
          {isOfficial ? (
            <Stat label="Waiting on you" value={counts.attention} note={counts.attention ? "Approvals, payouts and sign-offs" : "You're all caught up"} />
          ) : (
            <Stat label="You've given" value={compactMoney(summary.iGave)} note="Across all contributions" />
          )}
          <Stat label="Raised in total" value={compactMoney(summary.totalRaised)} note="Active and paid out" />
        </div>
      )}

      {/* Tabs + filters */}
      {!loading && contributions.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
            {tabs.map(([key, label]) => {
              const on = tab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(key)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    on
                      ? "bg-slate-900 text-white dark:bg-mint dark:text-obsidian"
                      : "text-slate-600 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-raised"
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 text-[11px] ${
                      on ? "bg-white/20 dark:bg-obsidian/20" : key === "attention" && counts[key] ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted"
                    }`}
                  >
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or member"
                aria-label="Search contributions"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X size={15} />
                </button>
              )}
            </div>
            <select
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              aria-label="Filter by type"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
            >
              <option value="all">All types</option>
              {Object.entries(PURPOSES).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
            >
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mt-6">
        {loading && <Loader2 className="mx-auto mt-16 animate-spin text-slate-400" size={26} />}

        {!loading && loadError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {loadError}
            <button onClick={load} className="ml-3 font-bold underline">
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && contributions.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-16 text-center dark:border-obsidian-border">
            <HeartHandshake className="mx-auto text-rose-400" size={34} />
            <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-mist">No contributions yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-mist-muted">
              Start one when a member needs support or the chama wants to buy something. Members can chip in once it is approved.
            </p>
            <button onClick={() => setModal({ type: "create" })} className="mt-5 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-600">
              Start a contribution
            </button>
          </div>
        )}

        {!loading && contributions.length > 0 && visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-obsidian-border dark:text-mist-muted">
            {filtersActive ? "Nothing matches those filters." : tab === "attention" ? "Nothing needs your attention right now." : "Nothing here yet."}
            {filtersActive && (
              <button
                onClick={() => {
                  setQuery("");
                  setPurposeFilter("all");
                }}
                className="ml-2 font-bold text-emerald-600 underline dark:text-mint"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((c) => (
            <ContributionCard
              key={c._id}
              contribution={c}
              nextStep={stepFor(c)}
              onOpen={(item) => setOpenId(item._id)}
              onQuickAction={handleAction}
            />
          ))}
        </div>
      </div>

      {openContribution && (
        <ContributionDrawer
          contribution={openContribution}
          workspaceId={workspaceId}
          isOfficial={isOfficial}
          myMembershipId={myMembershipId}
          nextStep={stepFor(openContribution)}
          refreshKey={refreshKey}
          onClose={() => setOpenId(null)}
          onAction={handleAction}
        />
      )}

      {renderModal()}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
        {toast && (
          <div
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
              toast.kind === "error" ? "bg-rose-600" : "bg-slate-900 dark:bg-mint dark:text-obsidian"
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
