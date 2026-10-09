import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import {
  BriefcaseBusiness,
  Menu,
  CalendarCheck,
  Flag,
  HandCoins,
  HeartPulse,
  Landmark,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Workflow,
  UsersRound,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import { hasModule } from "@/modules/workspaces/config/workspaceModules";
import chamaApi from "@/modules/chama/api/chama.api";
import membersApi from "@/modules/members/api/members.api";
import { useChamaJoinRequests } from "@/modules/chama/hooks/useChamaInvite";

import LeadershipPinGate from "../components/LeadershipPinGate";
import CommandPalette from "../components/CommandPalette";
import PageJump from "../components/PageJump";
import { DeskFooter, DeskPageHeader } from "../components/DeskChrome";
import DeskSidebar, { DeskSidebarDrawer } from "../components/DeskSidebar";
import { CountBadge, DeskAccentContext, ACCENTS, Notice } from "../components/DeskUI";

import OverviewTab from "../tabs/OverviewTab";
import MembersOfficialsTab from "../tabs/MembersOfficialsTab";
import MeetingsPollsTab from "../tabs/MeetingsPollsTab";
import LoansTab from "../tabs/LoansTab";
import TreasuryOversightTab from "../tabs/TreasuryOversightTab";
import GovernanceSettingsTab from "../tabs/GovernanceSettingsTab";
import BurialConfigurationTab from "../tabs/BurialConfigurationTab";
import DangerZoneTab from "../tabs/DangerZoneTab";
import BusinessWorkspacesTab from "../tabs/BusinessWorkspacesTab";
import AssetReviewsTab from "../tabs/AssetReviewsTab";
import ContributionsOversightTab from "../tabs/ContributionsOversightTab";
import MemberExitRequestsTab from "../tabs/MemberExitRequestsTab";

// ========================================
// LEADERSHIP DESK
// ========================================
//
// One page, one sidebar. This replaces three separate surfaces that each
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

// Each page says, in one plain line, what a leader does there. The line shows
// under the page switcher and in the search palette, so nobody has to open a
// section to find out whether it is the right one.
const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, purpose: "What needs you today, and where members pay." },
  { id: "members", label: "Members & Officials", icon: UsersRound, purpose: "Approve people who want to join, add members, and assign officials.", keywords: "join requests invite roles chairperson secretary" },
  { id: "exits", label: "Exit Requests", icon: LogOut, purpose: "Members asking to leave, and what they are owed.", keywords: "leave withdraw resign refund" },
  { id: "meetings", label: "Meetings & Polls", icon: CalendarCheck, anyModule: ["meetings", "polls"], purpose: "Start a live meeting or put a decision to a vote.", keywords: "vote check-in attendance" },
  { id: "loans", label: "Loans", icon: HandCoins, module: "loans", purpose: "Review, approve and pay out member loans.", keywords: "disburse borrow repayment guarantor" },
  { id: "treasury", label: "Treasury Oversight", icon: Landmark, purpose: "Goals, KYC checks, bank accounts, share-outs and withdrawals.", keywords: "money kyc bank shareout goals withdrawals" },
  { id: "contributions", label: "Contributions Oversight", icon: CalendarCheck, module: "contributions", purpose: "Contribution years, plans and payment schedules.", keywords: "savings plan year schedule" },
  { id: "businesses", label: "Business Workspaces", icon: BriefcaseBusiness, module: "businesses", purpose: "Businesses the group runs, and who manages each.", keywords: "shop store manager capital" },
  { id: "asset-reviews", label: "Asset Reviews", icon: Flag, module: "assets", purpose: "Asset entries members have flagged as wrong.", keywords: "flagged discrepancy" },
  { id: "governance", label: "Governance Settings", icon: SlidersHorizontal, purpose: "Group rules, loan policy, payment details and features.", keywords: "paybill till bank policy interest fine threshold join code" },
  { id: "burial-config", label: "Burial Configuration", icon: HeartPulse, module: "burial_welfare", purpose: "Burial and welfare rules for this group.", keywords: "welfare bereavement levy" },
  { id: "danger", label: "Danger Zone", icon: ShieldAlert, tone: "danger", purpose: "Permanent actions, such as deleting the Chama.", keywords: "delete close" },
];

// Five areas, each with its own colour. The shell publishes the current area's
// colour to every card underneath through DeskAccentContext.
const TAB_GROUPS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, accent: "emerald", tabs: ["overview"] },
  { id: "people", label: "People", icon: UsersRound, accent: "sky", tabs: ["members", "exits"] },
  { id: "finance", label: "Money", icon: HandCoins, accent: "amber", tabs: ["treasury", "contributions", "loans"] },
  { id: "operations", label: "Operations", icon: Workflow, accent: "violet", tabs: ["meetings", "businesses", "asset-reviews"] },
  { id: "settings", label: "Settings", icon: Settings2, accent: "slate", tabs: ["governance", "burial-config", "danger"] },
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
  // Same three roles the approval engine makes eligible to sign off a flag.
  const canReviewAssets = ["chairperson", "treasurer", "secretary"].includes(role);
  // Burial Chamas are Chama documents underneath, so the backend may hand
  // back "burial-chama" or "burial_chama" depending on the call site —
  // normalize before branching (mirrors WorkspaceOverviewPage.jsx).
  const isBurialChama = type?.toLowerCase().replace(/[-_]/g, "") === "burialchama";

  const { data: exitQueue } = useQuery({
    queryKey: ["member-exits", workspaceId, "open"],
    queryFn: async () => {
      const response = await membersApi.exitQueue(type, workspaceId, "open");
      return response?.data?.data ?? response?.data;
    },
    enabled: Boolean(workspaceId && (isTreasurer || isChairperson) && type),
    refetchInterval: 45000,
  });

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Tab lives in the query string so a leader can send "look at the
  // loans tab" as a link, and so the old /command-center and /settings
  // routes can redirect to a specific tab rather than dumping people on
  // Overview and making them hunt.
  const requestedTab = searchParams.get("tab");

  // A tab whose feature module this chama switched off is neither listed nor
  // reachable through ?tab=. No module info => everything stays available.
  const tabModuleEnabled = (tab) => {
    if (tab.anyModule) return tab.anyModule.some((key) => hasModule(workspace?.modules, key));
    if (tab.module) return hasModule(workspace?.modules, tab.module);
    return true;
  };

  const activeTab = TABS.some((tab) => tab.id === requestedTab && tabModuleEnabled(tab))
    ? requestedTab
    : "overview";

  // goToTab(tab, section) lets one page link straight to a part of another,
  // e.g. Overview's "Set up paybill" opens Governance on its Payments pane.
  const setActiveTab = useCallback(
    (tabId, section) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tabId);
      if (section) next.set("section", section);
      else next.delete("section");
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
  // everyone else. Burial Configuration only applies to burial/welfare
  // chamas — a standard chama has no BurialChamaProfile to show.
  const visibleTabs = useMemo(
    () =>
      TABS.filter((tab) => {
        if (!tabModuleEnabled(tab)) return false;
        if (tab.id === "danger") return isTreasurer;
        if (tab.id === "businesses") return isTreasurer || isChairperson;
        if (tab.id === "asset-reviews") return canReviewAssets;
        if (tab.id === "exits") return isTreasurer || isChairperson;
        if (tab.id === "burial-config") return isBurialChama;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTreasurer, isChairperson, canReviewAssets, isBurialChama, workspace?.modules]
  );

  const visibleGroups = useMemo(
    () =>
      TAB_GROUPS.map((group) => ({
        ...group,
        tabs: group.tabs
          .map((tabId) => visibleTabs.find((tab) => tab.id === tabId))
          .filter(Boolean),
      })).filter((group) => group.tabs.length > 0),
    [visibleTabs]
  );
  const openExitRequests = exitQueue?.summary?.open || 0;
  const { data: joinRequests = [] } = useChamaJoinRequests(workspaceId, true);
  const pendingLoans = (data?.loans || []).filter(
    (loan) => loan.status === "eligible" || loan.status === "approved"
  ).length;
  const liveMeetings = (data?.meetings || []).filter((meeting) => meeting.status === "active").length;

  // Counts that mean "someone is waiting on you". They drive the badges on the
  // page switcher, the area tabs and the search palette, so a leader sees what
  // is waiting without opening anything.
  const badges = {
    members: joinRequests.length,
    exits: openExitRequests,
    loans: pendingLoans,
    meetings: liveMeetings,
  };

  const activeGroup =
    visibleGroups.find((group) => group.tabs.some((tab) => tab.id === activeTab)) || visibleGroups[0];
  const activeTabMeta = visibleTabs.find((tab) => tab.id === activeTab) || visibleTabs[0];
  const accentName = activeGroup?.accent || "emerald";
  const tone = ACCENTS[accentName];
  const groupBadge = (group) => group.tabs.reduce((sum, tab) => sum + (badges[tab.id] || 0), 0);

  // ----- search palette (Ctrl/⌘ + K) -----
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const paletteItems = useMemo(
    () =>
      visibleGroups.flatMap((group) =>
        group.tabs.map((tab) => ({
          id: tab.id,
          label: tab.label,
          group: group.label,
          detail: tab.purpose,
          keywords: tab.keywords,
          icon: tab.icon,
          badge: badges[tab.id] || 0,
        }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleGroups, openExitRequests, joinRequests.length, pendingLoans, liveMeetings]
  );

  // ----- sidebar state (remembered per browser) -----
  const readStored = (key, fallback) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const writeStored = (key, value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode or storage full: the sidebar just forgets */
    }
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStored("leadershipDesk.sidebar.collapsed", false));
  const [foldedGroups, setFoldedGroups] = useState(() => readStored("leadershipDesk.sidebar.folded", {}));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleSidebar = () =>
    setSidebarCollapsed((value) => {
      writeStored("leadershipDesk.sidebar.collapsed", !value);
      return !value;
    });
  const toggleGroup = (groupId) =>
    setFoldedGroups((value) => {
      const next = { ...value, [groupId]: !value[groupId] };
      writeStored("leadershipDesk.sidebar.folded", next);
      return next;
    });

  // Landing on a page inside a folded section (search palette, a deep link,
  // "Set up paybill" on Overview) opens that section so the page is visible.
  const activeGroupId = activeGroup?.id;
  useEffect(() => {
    if (activeGroupId && foldedGroups[activeGroupId]) {
      setFoldedGroups((value) => {
        const next = { ...value, [activeGroupId]: false };
        writeStored("leadershipDesk.sidebar.folded", next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ----- previous / next page, in sidebar order -----
  const orderedTabs = useMemo(() => visibleGroups.flatMap((group) => group.tabs), [visibleGroups]);
  const activeIndex = orderedTabs.findIndex((tab) => tab.id === activeTab);
  const prevTab = activeIndex > 0 ? orderedTabs[activeIndex - 1] : null;
  const nextTab = activeIndex >= 0 && activeIndex < orderedTabs.length - 1 ? orderedTabs[activeIndex + 1] : null;
  const totalWaiting = Object.values(badges).reduce((sum, value) => sum + (value || 0), 0);

  // ----- keep the new page in view after switching -----
  const contentRef = useRef(null);
  const headRef = useRef(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [activeTab]);

  const shared = {
    workspaceId,
    workspace,
    role,
    type,
    isTreasurer,
    isChairperson,
    data,
    badges,
    reload: load,
    goToTab: setActiveTab,
  };

  const roleLabel = role.replace(/_/g, " ");

  const sidebarProps = {
    groups: visibleGroups,
    activeTab,
    activeGroupId,
    badges,
    groupBadge,
    foldedGroups,
    onToggleGroup: toggleGroup,
    onSelect: (tabId) => setActiveTab(tabId),
  };


  return (
    <DeskAccentContext.Provider value={accentName}>
      <div className="mx-auto max-w-[88rem] pb-16">
        {/* ---------- Mobile: one bar that opens the sidebar as a drawer ---------- */}
        <div className="sticky top-0 z-30 -mx-1 mb-5 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-haspopup="dialog"
            aria-label={totalWaiting ? `Open menu, ${totalWaiting} waiting` : "Open menu"}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 text-left shadow-sm backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-obsidian-border dark:bg-obsidian-card/95"
          >
            <Menu size={18} className="shrink-0 text-slate-500" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-slate-400">
                {workspace?.name || "Your Chama"} · {activeGroup?.label}
              </span>
              <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                {activeTabMeta?.label}
              </span>
            </span>
            <CountBadge count={totalWaiting} />
          </button>
        </div>

        <div className="flex items-start gap-8">
          <DeskSidebar
            {...sidebarProps}
            identity={{ name: workspace?.name || "Your Chama", role: roleLabel }}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={toggleSidebar}
          />

          <div className="min-w-0 flex-1 space-y-6">
            {/* ---------- One header: where you are, what it is for, global actions ---------- */}
            <div ref={headRef} className="scroll-mt-16 lg:scroll-mt-2">
              <DeskPageHeader
                group={activeGroup}
                tab={activeTabMeta}
                tone={tone}
                onSearch={() => setPaletteOpen(true)}
                onRefresh={load}
                refreshing={refreshing}
              />
            </div>

            {loadError && <Notice tone="error">{loadError}</Notice>}

            <PageJump containerRef={contentRef} watchKey={`${activeTab}-${Boolean(data)}`} />

            <div ref={contentRef} className="min-w-0 scroll-mt-24">
              {!data && !loadError ? (
                <div className="space-y-6" aria-busy="true" aria-label="Loading your desk">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[0, 1, 2, 3].map((key) => (
                      <div key={key} className="h-28 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/50" />
                    ))}
                  </div>
                  <div className="grid gap-6 xl:grid-cols-12">
                    <div className="h-72 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/50 xl:col-span-7" />
                    <div className="h-72 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/50 xl:col-span-5" />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeTab === "overview" && <OverviewTab {...shared} />}
                  {activeTab === "members" && <MembersOfficialsTab {...shared} />}
                  {activeTab === "exits" && (isTreasurer || isChairperson) && (
                    <MemberExitRequestsTab workspaceId={workspaceId} type={type} role={role} />
                  )}
                  {activeTab === "meetings" && <MeetingsPollsTab {...shared} />}
                  {activeTab === "loans" && <LoansTab {...shared} />}
                  {activeTab === "treasury" && <TreasuryOversightTab {...shared} />}
                  {activeTab === "contributions" && <ContributionsOversightTab {...shared} chamaId={workspaceId} />}
                  {activeTab === "businesses" && <BusinessWorkspacesTab {...shared} />}
                  {activeTab === "asset-reviews" && canReviewAssets && <AssetReviewsTab {...shared} />}
                  {activeTab === "governance" && <GovernanceSettingsTab {...shared} />}
                  {activeTab === "burial-config" && isBurialChama && <BurialConfigurationTab {...shared} />}
                  {activeTab === "danger" && isTreasurer && <DangerZoneTab {...shared} />}
                </div>
              )}
            </div>

            <DeskFooter prev={prevTab} next={nextTab} onSelect={setActiveTab} />
          </div>
        </div>
      </div>

      <DeskSidebarDrawer
        {...sidebarProps}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={workspace?.name || "Your Chama"}
        subtitle={`Leadership Desk · ${roleLabel}`}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
        onPick={(item) => setActiveTab(item.id)}
      />
    </DeskAccentContext.Provider>
  );
}
