import { useParams } from "react-router-dom";

import Spinner from "@/shared/components/ui/Spinner";

import useTransactions from "../hooks/useTransactions";

import TransactionTable from "../components/TransactionTable";

export default function TransactionsPage() {
  const { workspaceId } =
    useParams();

  const {
    transactions,
    loading,
    error,
  } = useTransactions(workspaceId);

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <div>
        Failed to load transactions.
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div>

        <h1 className="text-3xl font-bold">
          Financial Transactions
        </h1>

        <p className="text-slate-500">
          Every financial event recorded by the Finance Engine.
        </p>

      </div>

      <TransactionTable
        transactions={transactions}
      />

    </div>
  );
}