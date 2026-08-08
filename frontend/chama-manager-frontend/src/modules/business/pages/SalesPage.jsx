import React from "react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useBusinessSales } from "../hooks/useBusiness";
import PageHeader from "../../../shared/components/ui/PageHeader";
import Spinner from "../../../shared/components/ui/Spinner";

export default function SalesPage() {
  const { workspaceId } = useWorkspace();
  const { sales, isLoading, refetch } = useBusinessSales(workspaceId);

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
        title="Sales Transactions"
        description="View and manage all recorded customer sales"
        onRefresh={refetch}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
          <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-6 py-3">Receipt / ID</th>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Amount (KES)</th>
              <th className="px-6 py-3">Payment Method</th>
              <th className="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sales.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  No sales recorded yet.
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale._id || sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {sale.receiptNo || sale.id || sale._id}
                  </td>
                  <td className="px-6 py-4">{sale.customerName || sale.customer || "Walk-in"}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                    {Number(sale.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">{sale.paymentMethod || "M-Pesa"}</td>
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