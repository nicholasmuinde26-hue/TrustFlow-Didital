import React from "react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useBusinessInventory } from "../hooks/useBusiness";
import PageHeader from "../../../shared/components/ui/PageHeader";
import Spinner from "../../../shared/components/ui/Spinner";

export default function InventoryPage() {
  const { workspaceId } = useWorkspace();
  const { inventory, isLoading, refetch } = useBusinessInventory(workspaceId);

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
        title="Inventory & Stock"
        description="Track product stock levels and unit prices"
        onRefresh={refetch}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {inventory.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
            No inventory items found.
          </div>
        ) : (
          inventory.map((item) => (
            <div
              key={item._id || item.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">{item.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">SKU: {item.sku || "N/A"}</p>
              
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500">In Stock</span>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{item.quantity || 0}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Unit Price</span>
                  <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
                    KES {Number(item.price || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}