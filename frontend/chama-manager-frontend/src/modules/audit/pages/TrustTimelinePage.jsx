import { useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import Card from "@/shared/components/ui/Card/Card";
import CardContent from "@/shared/components/ui/Card/CardContent";
import PageHeader from "@/shared/components/ui/PageHeader";
import Button from "@/shared/components/ui/Button/Button";
import Spinner from "@/shared/components/ui/Spinner";

import { useTrustTimeline } from "../hooks/useTrustTimeline";
import TrustTimelineEvent from "../components/TrustTimelineEvent";
import ChainIntegrityCheck from "../components/ChainIntegrityCheck";

export default function TrustTimelinePage() {
  const { workspaceId } = useParams();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isFetching } = useTrustTimeline(workspaceId, {
    page,
    limit: 20,
  });

  const events = data?.events || [];
  const pagination = data?.pagination;

  return (
    <div>
      <PageHeader
        title="Trust Timeline"
        subtitle="Every membership, loan, and governance decision in this chama — visible to every member, not just officials."
      />

      <Card>
        {/* Rendered directly rather than inside <CardHeader>, which takes
            title/subtitle/action props and ignores children entirely -
            the previous header here passed children and className and so
            rendered nothing at all.

            The copy it was silently failing to show asserted the record
            couldn't be edited. This offers to prove it instead: claim and
            check in the same place, so the promise is falsifiable rather
            than decorative. */}
        <ChainIntegrityCheck chamaId={workspaceId} />

        <CardContent className="px-5">
          {isLoading && (
            <div className="py-12">
              <Spinner label="Loading trust timeline" />
            </div>
          )}

          {isError && (
            <p className="py-8 text-center text-sm text-red-600">
              Couldn't load the trust timeline. Try again in a moment.
            </p>
          )}

          {!isLoading && !isError && events.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">
              No trust events recorded yet. Loan decisions, membership
              changes, and payouts will show up here as they happen.
            </p>
          )}

          {!isLoading && !isError && events.length > 0 && (
            <div>
              {events.map((event) => (
                <TrustTimelineEvent key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasPreviousPage || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasNextPage || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}