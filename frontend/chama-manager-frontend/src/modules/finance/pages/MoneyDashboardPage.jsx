import React from "react";
import { useParams } from "react-router-dom";

import useWorkspace from "@/app/hooks/useWorkspace";
import useWorkspacePermissions from "../hooks/useworkspacepermissions";
import FinanceDashboard from "./FinanceDashboard";
import TreasuryPage from "./TreasuryPage";
import BusinessFinanceDashboard from "./BusinessFinanceDashboard";
import BurialMoneyDashboard from "./BurialMoneyDashboard";

// The "Money" landing page. People who can see the group's books get
// the Treasury view; everyone else keeps the personal member view that
// FinanceDashboard already renders for them.
export default function MoneyDashboardPage() {
  const { workspaceId: routeId } = useParams();
  const ws = useWorkspace();
  const workspaceId = routeId || ws?.workspaceId;
  const isBusiness = ws?.isBusiness || ws?.workspaceType === "business";
  const isBurialChama = ws?.isBurialChama || ws?.workspaceType === "burial-chama";
  const { canForOthers, isLoading } = useWorkspacePermissions(workspaceId);

  if (isBusiness) return <BusinessFinanceDashboard />;
  if (isBurialChama) return <BurialMoneyDashboard />;
  if (isLoading) return null;
  return canForOthers("finance.summary.view") ? <TreasuryPage /> : <FinanceDashboard />;
}
