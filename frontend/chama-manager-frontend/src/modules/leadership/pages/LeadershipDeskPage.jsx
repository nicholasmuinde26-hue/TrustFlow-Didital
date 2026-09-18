import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarCheck,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import chamaApi from "@/modules/chama/api/chama.api";

import LeadershipPinGate from "../components/LeadershipPinGate";
import { Notice } from "../components/DeskUI";

import OverviewTab from "../tabs/OverviewTab";
import MembersOfficialsTab from "../tabs/MembersOfficialsTab";
import MeetingsPollsTab from "../tabs/MeetingsPollsTab";
import LoansTab from "../tabs/LoansTab";
import TreasuryOversightTab from "../tabs/TreasuryOversightTab";
import GovernanceSettingsTab from "../tabs/GovernanceSettingsTab";
import DangerZoneTab from "../tabs/DangerZoneTab";

// ========================================
// LEADERSHIP DESK
// ========================================
//
// One page, seven tabs. This replaces three separate surfaces that each
// did part of the job:
//
//   - the old Leadership Desk (a list of links that took no actions)
//   - the Command Center (the real cockpit, on its own nav item)
//   - Administration → Settings (a third standalone page)
//
// Every leader used to see two near-duplicate sidebar entries plus a
// settings page, with no obvious reason to pick one over another. The
// merge is the fix; the old /command-center and /settings routes now
// redirect into the matching tab here, so nothing bookmarked breaks.
//
// The whole page sits behind LeadershipPinGate — nothing below renders
// until the PIN is accepted, and the session drops when the leader
// navigates away.
//
// ========================================

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "members", label: "Members & Officials", icon: UsersRound },
  { id: "meetings", label: "Meetings & Polls", icon: CalendarCheck },
  { id: "loans", label: "Loans", icon: HandCoins },
  { id: "treasury", label: "Treasury Oversight", icon: Landmark },
  { id: "governance", label: "Governance Settings", icon: SlidersHorizontal },
  { id: "danger", label: "Danger Zone", icon: ShieldAlert, tone: "danger" },
];

export default function LeadershipDeskPage() {
  const { workspaceId } = useParams();

  return (
    <LeadershipPinGate chamaId={workspaceId}>
      <LeadershipDeskContent workspaceId={workspaceId} />
    </LeadershipPinGate>
  );
}

function LeadershipDeskContent({ workspaceId }) {
  const { workspaces, activeWorkspace } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  const workspace =
    workspaces.find((item) => String(item.id ?? item._id) === String(workspaceId)) ||
    activeWorkspace;

  const role = workspace?.role || "member";
  const type = workspace?.type;
  const isTreasurer = role === "treasurer";
  const isChairperson = role === "chairperson";

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Tab lives in the query string so a leader can send "look at the
  // loans tab" as a link, and so the old /command-center and /settings
  // routes can redirect to a specific tab rather than dumping people on
  // Overview and making them hunt.
  const requestedTab = searchParams.get("tab");
  const activeTab = TABS.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "overview";

  const setActiveTab = useCallback(
    (tabId) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tabId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await chamaApi.getCommandCenter(workspaceId);
      setData(response.data.data);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error?.response?.data?.message || "Could not load the Leadership Desk."
      );
    } finally {
      setRefreshing(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  // The Danger Zone only exists for the Treasurer (the only role the
  // backend lets delete a Chama), so it isn't rendered as a dead tab for
  // everyone else.
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => (tab.id === "danger" ? isTreasurer : true)),
    [isTreasurer]
  );

  const shared = {
    workspaceId,
    workspace,
    role,
    type,
    isTreasurer,
    isChairperson,
    data,
    reload: load,
    goToTab: setActiveTab,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 px-6 py-7 text-white shadow-xl shadow-emerald-950/15 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">
              Leadership Desk
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              {workspace?.name || "Your Chama"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100">
              Everything a {role.replace(/_/g, " ")} runs, in one place. Actions
              appear only where your role authorises them, and the group's
              riskiest decisions ask for your PIN again.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-emerald-300/30 bg-white/10 px-3 py-1.5 text-xs font-bold capitalize">
              {role.replace(/_/g, " ")}
            </span>
            <button
              type="button"
              onClick={load}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {loadError && <Notice tone="error">{loadError}</Notice>}

      <nav
        className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 dark:border-slate-800 dark:bg-slate-900/60"
        aria-label="Leadership Desk sections"
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const danger = tab.tone === "danger";

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                isActive
                  ? danger
                    ? "bg-rose-600 text-white shadow-md"
                    : "bg-emerald-600 text-white shadow-md"
                  : danger
                  ? "text-rose-600 hover:bg-white dark:text-rose-400 dark:hover:bg-slate-800"
                  : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {!data && !loadError ? (
        <div className="flex h-72 items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            Loading your desk…
          </span>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === "overview" && <OverviewTab {...shared} />}
          {activeTab === "members" && <MembersOfficialsTab {...shared} />}
          {activeTab === "meetings" && <MeetingsPollsTab {...shared} />}
          {activeTab === "loans" && <LoansTab {...shared} />}
          {activeTab === "treasury" && <TreasuryOversightTab {...shared} />}
          {activeTab === "governance" && <GovernanceSettingsTab {...shared} />}
          {activeTab === "danger" && isTreasurer && <DangerZoneTab {...shared} />}
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <AlertTriangle size={12} />
        Every action taken here is recorded in this Chama's audit trail.
      </p>
    </div>
  );
}
