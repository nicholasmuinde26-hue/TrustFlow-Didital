import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "@/shared/components/ui/Button";
import CreateFundModal from "./CreateFundModal";

export default function FinanceActions({ onRefresh }) {
  const { workspaceId } = useParams();
  const [showCreateFund, setShowCreateFund] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setShowCreateFund(true)} variant="primary">
          + Create Fund
        </Button>

        <Link
          to={`/workspace/${workspaceId}/finance/record-contribution`}
        >
          <Button variant="secondary">
            + Record Contribution
          </Button>
        </Link>

        <Link
          to={`/workspace/${workspaceId}/finance/payouts/new`}
        >
          <Button variant="secondary">
            + Record Payout
          </Button>
        </Link>

        <Link
          to={`/workspace/${workspaceId}/finance/deposits/new`}
        >
          <Button variant="secondary">
            + Deposit
          </Button>
        </Link>

        <Link
          to={`/workspace/${workspaceId}/finance/withdrawals/new`}
        >
          <Button variant="secondary">
            + Withdrawal
          </Button>
        </Link>

        <Link
          to={`/workspace/${workspaceId}/finance/transfers/new`}
        >
          <Button variant="secondary">
            + Transfer
          </Button>
        </Link>
      </div>

      <CreateFundModal
        isOpen={showCreateFund}
        onClose={() => setShowCreateFund(false)}
        workspaceId={workspaceId}
        onCreated={() => onRefresh && onRefresh()}
      />
    </>
  );
}
