import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";

const segmentMap = {
  business: { title: "Business Dashboard", path: "business" },
  sales: { title: "Sales & Invoicing", path: "business/sales" },
  expenses: { title: "Expenses", path: "business/expenses" },
  inventory: { title: "Inventory & Stock", path: "business/inventory" },
  customers: { title: "Customers", path: "business/customers" },
  suppliers: { title: "Suppliers", path: "business/suppliers" },
  accounts: { title: "Cash & Accounts", path: "business/accounts" },
  reports: { title: "Reports", path: "business/reports" },
  contributions: { title: "Contributions", path: "contributions" },
  schedule: { title: "Schedule", path: "schedule" },
  activity: { title: "Activity", path: "activity" },
  loans: { title: "Loans", path: "loans" },
  "chama-finance": { title: "Chama Finance", path: "chama-finance" },
  mgr: { title: "Merry-Go-Round", path: "mgr" },
  "command-center": { title: "Command Center", path: "command-center" },
  "my-chama": { title: "My Chama", path: "my-chama" },
  finance: { title: "Finance Dashboard", path: "finance" },
  "record-contribution": { title: "Record Contribution", path: "finance/record-contribution" },
  transactions: { title: "Transactions", path: "finance/transactions" },
  ledger: { title: "General Ledger", path: "finance/ledger" },
  savings: { title: "Savings", path: "finance/savings" },
  "trial-balance": { title: "Trial Balance", path: "finance/trial-balance" },
  "balance-sheet": { title: "Balance Sheet", path: "finance/balance-sheet" },
  "income-statement": { title: "Income Statement", path: "finance/income-statement" },
  "cash-flow": { title: "Cash Flow Statement", path: "finance/cash-flow" },
  payouts: { title: "Payouts", path: "finance/payouts" },
  members: { title: "Members", path: "members" },
  chat: { title: "Chat", path: "chat" },
  announcements: { title: "Announcements", path: "announcements" },
  meetings: { title: "Meetings", path: "meetings" },
  settings: { title: "Settings", path: "settings" },
};

export default function Breadcrumbs() {
  const { workspaceId } = useParams();
  const { activeWorkspace } = useWorkspace();
  const location = useLocation();

  if (!workspaceId) return null;

  // Split path into parts, e.g., ["workspace", "123", "finance", "ledger"]
  const pathParts = location.pathname.split("/").filter(Boolean);

  // We are interested in segments after /workspace/:workspaceId
  const workspaceIndex = pathParts.findIndex(
    (part, index) => part === "workspace" && pathParts[index + 1] === workspaceId
  );

  if (workspaceIndex === -1) return null;

  const rawSegments = pathParts.slice(workspaceIndex + 2);

  // Home / Overview node
  const workspaceName = activeWorkspace?.name || "Workspace Overview";

  // Build the breadcrumbs list
  const breadcrumbs = [
    {
      title: workspaceName,
      to: `/workspace/${workspaceId}`,
      isRoot: true,
    },
  ];

  let currentRelativePath = "";
  rawSegments.forEach((segment, index) => {
    // Filter out common ID patterns (24 character hex for MongoDB, 36 character UUIDs, etc.)
    const isId = /^[0-9a-fA-F]{24}$/.test(segment) || /^[0-9a-fA-F-]{36}$/.test(segment);
    if (isId) return;

    currentRelativePath += (currentRelativePath ? "/" : "") + segment;

    let title = "";
    const mapped = segmentMap[segment] || segmentMap[currentRelativePath];

    if (mapped) {
      title = mapped.title;
    } else {
      // Fallback formatting
      const parent = index > 0 ? rawSegments[index - 1] : "";
      if (segment === "new") {
        if (parent === "payouts") title = "New Payout";
        else if (parent === "contributions") title = "Record Contribution";
        else if (parent === "deposits") title = "New Deposit";
        else if (parent === "withdrawals") title = "New Withdrawal";
        else if (parent === "transfers") title = "New Transfer";
        else title = "New Record";
      } else {
        title = segment
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }
    }

    breadcrumbs.push({
      title,
      to: `/workspace/${workspaceId}/${currentRelativePath}`,
      isRoot: false,
    });
  });

  // Don't render if it's only the root workspace and no subpages are opened
  if (breadcrumbs.length <= 1) return null;

  return (
    <nav className="mb-6 flex" aria-label="Breadcrumb">
      <ol className="inline-flex flex-wrap items-center space-x-1 md:space-x-2">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;

          return (
            <li key={crumb.to} className="inline-flex items-center">
              {idx > 0 && (
                <ChevronRight className="mx-1 h-4 w-4 text-slate-400 dark:text-slate-600" />
              )}
              {isLast ? (
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {crumb.title}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary transition-colors"
                >
                  {crumb.isRoot && (
                    <Home className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate max-w-[120px] sm:max-w-none">
                    {crumb.title}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
