import React from "react";
import { RefreshCw } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useBusinessSales } from "../hooks/useBusiness";
import PageHeader from "../../../shared/components/ui/PageHeader";
import Spinner from "../../../shared/components/ui/Spinner";

export default function SalesPage() {
  const { workspaceId, currentWorkspace } = useWorkspace();
  const { sales, isLoading, refetch, isRefetching } = useBusinessSales(workspaceId);

  const isRental = currentWorkspace?.category === "rental";
  const copy = isRental
    ? {
        title: "Rent Payments",
        subtitle: "View and manage all recorded completed rent payments.",
        partyColumn: "Tenant",
        emptyMessage: "No rent payments recorded yet.",
        walkIn: "Unassigned",
      }
    : {
        title: "Sales Transactions",
        subtitle: "View and manage all recorded completed customer sales.",
        partyColumn: "Customer",
        emptyMessage: "No completed sales recorded yet.",
        walkIn: "Walk-in",
      };

  const completedSales = (Array.isArray(sales) ? sales : []).filter(
    (sale) => !sale.status || sale.status === "completed"
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        action={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
          >
            <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
          <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-6 py-3">Receipt / ID</th>
              <th className="px-6 py-3">{copy.partyColumn}</th>
              <th className="px-6 py-3">Amount (KES)</th>
              <th className="px-6 py-3">Payment Method</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {completedSales.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  {copy.emptyMessage}
                </td>
              </tr>
            ) : (
              completedSales.map((sale) => (
                <tr key={sale._id || sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 font-medium font-mono text-gray-900 dark:text-white">
                    {sale.mpesa_receipt_number || sale.external_reference || sale.receiptNo || sale.id || sale._id}
                  </td>
                  <td className="px-6 py-4">{sale.customer_name || sale.customerName || sale.customer || copy.walkIn}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                    {Number(sale.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-mono uppercase">{sale.payment_channel || sale.paymentMethod || "M-Pesa"}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Completed
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : "N/A"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}