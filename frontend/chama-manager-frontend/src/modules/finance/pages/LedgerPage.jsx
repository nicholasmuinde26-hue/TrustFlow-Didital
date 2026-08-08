import { useParams } from "react-router-dom";

import Spinner from "@/shared/components/ui/Spinner";

import useLedger from "../hooks/useLedger";

import LedgerTable from "../components/LedgerTable";

export default function LedgerPage() {
  const { workspaceId } = useParams();

  const {
    entries,
    loading,
    error,
  } = useLedger(workspaceId);

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-700">
          Unable to load General Ledger
        </h2>

        <p className="mt-2 text-sm text-red-600">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div>

        <h1 className="text-3xl font-bold">
          General Ledger
        </h1>

        <p className="text-slate-500">
          Every debit and credit posted by the Finance Engine.
        </p>

      </div>

      <LedgerTable entries={entries} />

    </div>
  );
}