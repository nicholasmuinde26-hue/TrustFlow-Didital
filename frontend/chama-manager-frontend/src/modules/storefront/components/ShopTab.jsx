import React, { useMemo } from "react";
import { SearchIcon } from "./icons";
import CategoryRail from "./CategoryRail";
import ProductCard from "./ProductCard";
import { getItemId, sortItems } from "../utils/storefront.utils";

export default function ShopTab({
  items,
  categories,
  category,
  onSelectCategory,
  search,
  onSearchChange,
  sortValue,
  onSortChange,
  cart,
  currency,
  primaryColor,
  onAdd,
  onChangeQty,
  onOpenDetail,
}) {
  const visibleItems = useMemo(() => {
    let list = items;
    if (category !== "All") {
      list = list.filter((item) => (item.category || "General") === category);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.name?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
      );
    }
    return sortItems(list, sortValue);
  }, [items, category, search, sortValue]);

  return (
    <div className="pb-4">
      <div className="border-b border-gray-100 px-4 py-3 sm:px-8">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search this store…"
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm font-medium text-gray-800 outline-none transition focus:border-gray-300 focus:bg-white"
          />
        </div>
      </div>

      <CategoryRail
        categories={categories}
        activeCategory={category}
        onSelectCategory={onSelectCategory}
        sortValue={sortValue}
        onSortChange={onSortChange}
        primaryColor={primaryColor}
      />

      <div className="px-4 py-4 sm:px-8">
        {visibleItems.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            {search || category !== "All"
              ? "No products match your search."
              : "No products are listed online right now."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleItems.map((item) => {
              const itemId = getItemId(item);
              return (
                <ProductCard
                  key={itemId}
                  item={item}
                  qtyInCart={cart[itemId] || 0}
                  currency={currency}
                  primaryColor={primaryColor}
                  onAdd={onAdd}
                  onChangeQty={onChangeQty}
                  onOpenDetail={onOpenDetail}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
