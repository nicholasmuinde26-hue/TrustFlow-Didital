import {
  LayoutDashboard,
  Users,
  Wallet,
  HandCoins,
  FileBarChart2,
  Coins,
  CalendarClock,
  Video,
  Receipt,
  BookOpen,
  Landmark,
  PlusCircle,
  PiggyBank,
  ArrowLeftRight,
  Scale,
  BarChart3,
  TrendingUp,
  LineChart,
  HeartHandshake,
  Building2,
  HeartPulse,
  UserPlus,
  FileText,
  MessageSquare,
  ShieldCheck,
  ShieldQuestion,
  Gavel,
  Star,
  Tent,
  Megaphone,
  Vote,
  Gem,
} from "lucide-react";

import { canViewFullBooks, canManageBurialChamaSetup } from "../permissions/Permissions";
import { hasModule } from "./workspaceModules";

/**
 * ONE navigation list for every chama-backed workspace (standard + burial).
 *
 * Each item is tagged with the module that owns it (`module`). The list is
 * filtered twice - first by the chama's enabled modules, then by the member's
 * role - so a chama without loans has no Loans link and a plain member has no
 * General Ledger link. Adding a feature = adding one line here and one key to
 * the backend catalog (be/src/constants/workspaceModules.constants.js).
 *
 * The two "shells" (standard chama / burial chama) only differ in wording and
 * grouping, so those are expressed per item with by(chama, burial) instead of
 * keeping two copies of the list:
 *
 *   title / icon / to / section   -> by(standardValue, burialValue)
 *   section: null for a shell     -> the item is not shown in that shell
 *   shell: "chama" | "burial"     -> item only exists in that shell
 *
 * Item order inside a section is the order of this list.
 */

const by = (chama, burial = chama) => ({ __byShell: true, chama, burial });
const resolve = (value, shell) => (value && value.__byShell ? value[shell] : value);

// Section order + titles per shell. A section with no visible items is dropped.
const SECTIONS = {
  chama: [
    { key: "core" },
    { key: "ops", title: "Chama Operations" },
    { key: "assets", title: "Chama Assets" },
    { key: "money", title: "Money & Contributions" },
    { key: "trust", title: "Trust & Accountability" },
    { key: "books", title: "Books" },
  ],
  burial: [
    { key: "core" },
    { key: "assets", title: "Chama Assets" },
    { key: "burial", title: "Burial Chama" },
    { key: "money", title: "Welfare & Contributions" },
    { key: "ops", title: "Income & Fundraising" },
    { key: "notices", title: "Meetings & Notices" },
    { key: "trust", title: "Trust & Accountability" },
    { key: "books", title: "Books & Reports" },
  ],
};

export const CHAMA_NAV_ITEMS = [
  // ---- core -----------------------------------------------------------------
  { module: null, section: "core", title: "Overview", icon: LayoutDashboard, to: "" },
  { module: "members", section: "core", title: "Members", icon: Users, to: "members" },
  { module: null, section: "core", title: "My Chama", icon: Wallet, to: "my-chama" },
  // What the chama pays the platform. Only the people who can act on it see it.
  { module: null, section: "core", title: "Plan & Billing", icon: Gem, to: "billing", role: "billing" },

  // ---- lending / communication ---------------------------------------------
  // The Leadership Desk is deliberately not listed: it is the pinned "Desk"
  // button in the sidebar rail (see getLeadershipDeskItem).
  { module: "loans", section: by("ops", "ops"), title: by("Loans", "Emergency Loans"), icon: HandCoins, to: "loans" },
  // These optional modules are available to either Chama shell when enabled.
  // Their pages and module guards already support both standard and burial
  // Chamas; restricting the nav entries to the burial shell made enabled
  // features appear missing in standard workspaces.
  { module: "equipment_hire", section: "ops", title: "Equipment & Tent Hire", icon: Tent, to: "equipment-hire" },
  { module: "fundraising", section: "ops", title: "Harambee & Fundraising", icon: Megaphone, to: "fundraising" },
  { module: "meetings", section: by("ops", "notices"), title: "Meeting Records", icon: by(CalendarClock, Video), to: "meetings" },
  { module: "polls", section: by("ops", "notices"), title: "Polls", icon: Vote, to: "polls" },
  { module: "announcements", section: by("ops", "notices"), title: "Announcements", icon: by(Megaphone, MessageSquare), to: "announcements" },
  { module: "chat", section: by("ops", "notices"), title: "Messages", icon: MessageSquare, to: "chat" },

  // ---- assets ---------------------------------------------------------------
  { module: "assets", section: "assets", title: "Portfolio", icon: Building2, to: "assets" },
  { module: "assets", section: "assets", title: "Investment Proposals", icon: Coins, to: "assets/investments" },
  { module: "assets", section: "assets", title: "Business & Property Income", icon: TrendingUp, to: "assets/income" },

  // ---- burial / welfare cover ----------------------------------------------
  { module: "burial_welfare", section: "burial", shell: "burial", title: "Setup Wizard", icon: ShieldCheck, to: "burial-chama-setup", role: "burialSetup" },
  { module: "burial_welfare", section: "burial", shell: "burial", title: "Beneficiaries", icon: UserPlus, to: "beneficiaries" },
  { module: "burial_welfare", section: "burial", shell: "burial", title: "Burial Cases", icon: HeartPulse, to: "burial-cases" },
  { module: "burial_welfare", section: "burial", shell: "burial", title: "Member Statement", icon: FileText, to: "member-statement" },

  // ---- money ----------------------------------------------------------------
  { module: "finance_core", section: "money", shell: "chama", title: "Dashboard", icon: Wallet, to: "finance" },
  { module: "finance_core", section: "money", title: "Member Wallet", icon: Wallet, to: "finance/wallet" },
  // Standard chamas use the finance contributions view; burial chamas use the
  // contributions page (the old burial list pointed at /contributions).
  // Money & Contributions shows FIVE top-level tabs. Pages that overlap with
  // a parent are listed with `parent` (the parent's `to`) and appear as
  // sub-tabs under it instead of crowding the top bar:
  //   Contributions -> Record payment, Payment register, Chama Contributions
  //   Savings       -> Savings Share-Out
  //   Payouts       -> Withdrawals
  // `subTitle` is how a parent labels itself as the first sub-tab.
  { module: "contributions", section: "money", title: "Contributions", subTitle: "Collection", icon: Coins, to: by("finance/contributions", "contributions") },
  { module: "contributions", section: "money", title: "Record Contribution", icon: PlusCircle, to: "finance/record-contribution", role: "treasurerOnly", parent: by("finance/contributions", "contributions") },
  { module: "contributions", section: "money", shell: "chama", title: "Payment register", icon: FileText, to: "finance/contributions/register", parent: "finance/contributions" },
  { module: "contributions", section: "money", shell: "chama", title: "Chama Contributions", icon: HeartHandshake, to: "chama-contributions", parent: "finance/contributions" },
  { module: "savings", section: "money", title: by("Savings", "Welfare Fund"), subTitle: "Savings pool", icon: PiggyBank, to: "finance/savings" },
  { module: "savings_shareout", section: "money", title: "Savings Share-Out", icon: PiggyBank, to: "finance/savings-shareout", parent: "finance/savings" },
  { module: "mgr", section: "money", title: "Merry-Go-Round (MGR)", icon: ArrowLeftRight, to: "mgr" },
  { module: "payouts", section: "money", title: by("Payouts", "Benevolent Payouts"), subTitle: "Payouts", icon: ArrowLeftRight, to: "finance/payouts" },
  { module: "withdrawals", section: "money", title: "Withdrawals", icon: Landmark, to: "finance/withdrawals", parent: "finance/payouts" },

  // ---- trust ----------------------------------------------------------------
  { module: "trust", section: "trust", title: "Trust Score", icon: ShieldQuestion, to: "trust-score" },
  { module: "trust", section: "trust", title: "Trust Timeline", icon: ShieldCheck, to: "trust-timeline" },
  { module: "officials", section: "trust", title: "Official Accountability", icon: Star, to: "officials" },
  { module: "disputes", section: "trust", title: "Disputes", icon: Gavel, to: "disputes" },

  // ---- books ----------------------------------------------------------------
  // `role: "fullBooks"` marks the raw double-entry books, which are official-only.
  // Transactions, Balance Sheet, Income Statement, Receipts & Payments, Cash
  // Flow and Reports stay visible to every member.
  { module: "finance_core", section: "books", title: "Transactions", icon: Receipt, to: "finance/transactions" },
  { module: "finance_core", section: "books", title: "General Ledger", icon: BookOpen, to: "finance/ledger", role: "fullBooks" },
  { module: "finance_core", section: "books", title: "Chama Wallet", icon: Landmark, to: "finance/accounts", role: "fullBooks" },
  { module: "finance_core", section: "books", title: "Bank Accounts", icon: Building2, to: "finance/bank-accounts", role: "fullBooks" },
  { module: "finance_core", section: "books", title: "Trial Balance", icon: Scale, to: "finance/trial-balance", role: "fullBooks" },
  { module: "finance_core", section: "books", title: "Balance Sheet", icon: BarChart3, to: "finance/balance-sheet" },
  { module: "finance_core", section: "books", title: "Income Statement", icon: TrendingUp, to: "finance/income-statement" },
  { module: "finance_core", section: "books", title: "Receipts & Payments", icon: Receipt, to: "finance/receipts-payments" },
  { module: "finance_core", section: "books", title: "Cash Flow", icon: LineChart, to: "finance/cash-flow" },
  { module: "finance_core", section: "books", title: "Reports", icon: FileBarChart2, to: "reports" },
];

// Role gates, by the item's `role` tag.
const ROLE_CHECKS = {
  fullBooks: (role, type) => canViewFullBooks(role, type),
  burialSetup: (role, type) => canManageBurialChamaSetup(role, type),
  // Only the treasurer records contributions in a chama-backed workspace.
  treasurerOnly: (role) => role === "treasurer",
  // Plan and billing: the treasurer pays, the chairperson can renew or change plan.
  billing: (role) => ["treasurer", "chairperson"].includes(String(role || "").toLowerCase().replaceAll(" ", "_")),
};

/**
 * Sections for a chama-backed workspace.
 *   shell          "chama" | "burial"
 *   enabledModules workspace.modules (null = no module info: nothing hidden)
 * Items carry their `module` key so callers (command palette, tests) can see
 * why they are there.
 */
export function buildChamaNavigation({ workspaceId, type, role, shell, enabledModules }) {
  const base = `/workspace/${workspaceId}`;
  const sections = SECTIONS[shell] || SECTIONS.chama;

  const items = CHAMA_NAV_ITEMS
    // 1. shell
    .filter((item) => !item.shell || item.shell === shell)
    // 2. module
    .filter((item) => !item.module || hasModule(enabledModules, item.module))
    // 3. role
    .filter((item) => !item.role || ROLE_CHECKS[item.role](role, type))
    .map((item) => {
      const path = resolve(item.to, shell);
      return {
        module: item.module,
        section: resolve(item.section, shell),
        title: resolve(item.title, shell),
        icon: resolve(item.icon, shell),
        to: path ? `${base}/${path}` : base,
        ...(item.subTitle ? { subTitle: resolve(item.subTitle, shell) } : {}),
        ...(item.parent ? { parentTo: `${base}/${resolve(item.parent, shell)}` } : {}),
      };
    });

  return sections
    .map((section) => ({
      sectionKey: section.key,
      ...(section.title ? { title: section.title } : {}),
      items: items
        .filter((item) => item.section === section.key)
        .map(({ section: _section, ...item }) => item),
    }))
    .filter((section) => section.items.length > 0);
}
