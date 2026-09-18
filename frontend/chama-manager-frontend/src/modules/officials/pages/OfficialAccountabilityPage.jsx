import Card from "@/shared/components/ui/Card/Card";
import CardContent from "@/shared/components/ui/Card/CardContent";
import PageHeader from "@/shared/components/ui/PageHeader";
import Spinner from "@/shared/components/ui/Spinner";

import { useWorkspace } from "@/app/hooks/useWorkspace";
import { canViewRatingDetail } from "@/modules/workspaces/permissions/Permissions";

import { useOfficials, useSubmitOfficialRating } from "../hooks/useOfficials";
import OfficialRatingCard from "../components/OfficialRatingCard";

export default function OfficialAccountabilityPage() {
  const { workspaceId, workspaceType, membership } = useWorkspace();

  const { data: officials, isLoading, isError } = useOfficials(workspaceId);
  const submitMutation = useSubmitOfficialRating(workspaceId);

  const canViewDetail = canViewRatingDetail(membership?.role, workspaceType);

  return (
    <div>
      <PageHeader
        title="Official accountability"
        subtitle="Chamas mostly fail when a trusted official misuses funds, not when a member defaults. Rate the people who hold custody over the group's money."
      />

      <Card>
        <CardContent className="px-5">
          {isLoading && (
            <div className="py-12">
              <Spinner label="Loading officials" />
            </div>
          )}

          {isError && (
            <p className="py-8 text-center text-sm text-red-600">
              Couldn't load officials. Try again in a moment.
            </p>
          )}

          {!isLoading && !isError && (!officials || officials.length === 0) && (
            <p className="py-12 text-center text-sm text-slate-500">
              This chama has no officials to rate yet.
            </p>
          )}

          {!isLoading && !isError && officials && officials.length > 0 && (
            <div>
              {officials.map((official) => (
                <OfficialRatingCard
                  key={official.membershipId}
                  official={official}
                  chamaId={workspaceId}
                  canViewDetail={canViewDetail}
                  isSubmitting={submitMutation.isPending}
                  onSubmitRating={(payload) => submitMutation.mutate(payload)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
