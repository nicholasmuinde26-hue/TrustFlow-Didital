import { Link, useParams } from "react-router-dom";

import Button from "@/shared/components/ui/Button";

export default function FinanceActions() {
  const { workspaceId } = useParams();

  return (
    <div className="flex flex-wrap gap-3">

      <Link
        to={`/workspace/${workspaceId}/finance/record-contribution`}
      >
        <Button>
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
  );
}
