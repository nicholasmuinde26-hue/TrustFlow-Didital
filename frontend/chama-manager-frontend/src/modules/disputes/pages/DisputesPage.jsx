import { useState } from "react";
import { Plus } from "lucide-react";

import Card from "@/shared/components/ui/Card/Card";
import CardHeader from "@/shared/components/ui/Card/CardHeader";
import CardContent from "@/shared/components/ui/Card/CardContent";
import PageHeader from "@/shared/components/ui/PageHeader";
import Button from "@/shared/components/ui/Button/Button";
import Spinner from "@/shared/components/ui/Spinner";

import { useWorkspace } from "@/app/hooks/useWorkspace";
import { canManageDisputes } from "@/modules/workspaces/permissions/Permissions";

import { useDisputes, useRaiseDispute, useUpdateDisputeStatus } from "../hooks/useDisputes";
import DisputeCard from "../components/DisputeCard";
import RaiseDisputeForm from "../components/RaiseDisputeForm";

const STATUS_TABS = [
  { value: undefined, label: "All" },
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

export default function DisputesPage() {
  const { workspaceId, workspaceType, membership } = useWorkspace();
  const [status, setStatus] = useState(undefined);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError } = useDisputes(workspaceId, { status });
  const raiseMutation = useRaiseDispute(workspaceId);
  const updateMutation = useUpdateDisputeStatus(workspaceId);

  const canManage = canManageDisputes(membership?.role, workspaceType);
  const disputes = data?.disputes || [];

  return (
    <div>
      <PageHeader
        title="Disputes & appeals"
        subtitle="If something looks wrong — a loan decision, a payout, an official's conduct — this is the formal path to contest it. Control alone isn't trust; recourse is."
        action={
          !showForm && (
            <Button onClick={() => setShowForm(true)}>
              <Plus size={16} />
              Raise a dispute
            </Button>
          )
        }
      />

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Raise a dispute" subtitle="Visible to chama officials with review access." />
          <CardContent>
            <RaiseDisputeForm
              isSubmitting={raiseMutation.isPending}
              onCancel={() => setShowForm(false)}
              onSubmit={(payload, opts) =>
                raiseMutation.mutate(payload, {
                  ...opts,
                  onSuccess: (...args) => {
                    setShowForm(false);
                    opts?.onSuccess?.(...args);
                  },
                })
              }
            />
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.label}
            size="sm"
            variant={status === tab.value ? "primary" : "secondary"}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="px-5">
          {isLoading && (
            <div className="py-12">
              <Spinner label="Loading disputes" />
            </div>
          )}

          {isError && (
            <p className="py-8 text-center text-sm text-red-600">
              Couldn't load disputes. Try again in a moment.
            </p>
          )}

          {!isLoading && !isError && disputes.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">
              {canManage
                ? "No disputes to review."
                : "You haven't raised any disputes."}
            </p>
          )}

          {!isLoading && !isError && disputes.length > 0 && (
            <div>
              {disputes.map((dispute) => (
                <DisputeCard
                  key={dispute.id}
                  dispute={dispute}
                  canManage={canManage}
                  isUpdating={updateMutation.isPending}
                  onUpdateStatus={(payload) => updateMutation.mutate(payload)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
