import { useParams, Navigate } from "react-router-dom";

import Spinner from "@/shared/components/ui/Spinner";

import useDashboard from "../hooks/useDashboard";

import ChamaOverviewPage from "@/modules/chama/pages/ChamaOverviewPage";
import ContributionGroupOverviewPage from "@/modules/contribution-group/pages/ContributionGroupOverviewPage";

export default function WorkspaceOverviewPage() {
  const { workspaceId } = useParams();

  const {
    data: dashboard,
    isLoading,
    isFetching,
    error,
  } = useDashboard(workspaceId);

  if (isLoading) {
    return <Spinner fullscreen />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
          Unable to load dashboard
        </h2>

        <p className="mt-2 text-sm text-red-500">
          Please refresh the page or try again later.
        </p>
      </div>
    );
  }

  // Redirect business workspaces straight to the Business Dashboard
  if (dashboard?.type === "business") {
    return <Navigate to="business" replace />;
  }

  if (dashboard?.type === "contribution-group") {
    return <ContributionGroupOverviewPage dashboard={dashboard} />;
  }

  return <ChamaOverviewPage dashboard={dashboard} refreshing={isFetching} />;
}