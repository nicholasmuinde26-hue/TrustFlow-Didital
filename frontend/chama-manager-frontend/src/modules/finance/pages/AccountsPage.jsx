import { useParams } from "react-router-dom";

import Spinner from "@/shared/components/ui/Spinner";

import useAccounts from "../hooks/useAccounts";
import AccountCard from "../components/AccountCard";

export default function AccountsPage() {
  const { workspaceId } = useParams();

  const {
    accounts,
    loading,
    error,
  } = useAccounts(workspaceId);

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        Failed to load accounts.
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div>

        <h1 className="text-3xl font-bold">
          Chart of Accounts
        </h1>

        <p className="text-slate-500">
          Financial accounts used by the Finance Engine.
        </p>

      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

        {accounts.map((account) => (
          <AccountCard
            key={account._id}
            account={account}
          />
        ))}

      </div>

    </div>
  );
}