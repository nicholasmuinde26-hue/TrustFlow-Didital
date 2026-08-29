import React, { useMemo } from "react";
import HeroBanner from "./HeroBanner";
import ProductCard from "./ProductCard";
import { getItemId, getDiscountPercent, getStockState, sortItems } from "../utils/storefront.utils";

export default function HomeTab({
  storefront,
  items,
  cart,
  currency,
  primaryColor,
  onAdd,
  onChangeQty,
  onOpenDetail,
  onBrowseCategory,
  categories,
}) {
  const deals = useMemo(() => {
    const discounted = items.filter((i) => getStockState(i) !== "out" && getDiscountPercent(i));
    return sortItems(discounted, "relevance").slice(0, 8);
  }, [items]);

  const picks = useMemo(() => sortItems(items, "relevance").slice(0, 12), [items]);

  return (
    <div className="pb-4">
      <HeroBanner storefront={storefront} primaryColor={primaryColor} />

      {categories.length > 0 && (
        <div className="border-b border-gray-100 px-4 py-4 sm:px-8">
          <div className="flex gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onBrowseCategory(cat)}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-extrabold"
                  style={{ backgroundColor: `${primaryColor}1A`, color: primaryColor }}
                >
                  {cat.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[64px] truncate text-[10px] font-semibold text-gray-600">{cat}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {deals.length > 0 && (
        <Section title="Deals right now" onSeeAll={() => onBrowseCategory("All")}>
          {deals.map((item) => {
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
        </Section>
      )}

      <Section title="From this store" onSeeAll={() => onBrowseCategory("All")}>
        {picks.length === 0 ? (
          <p className="col-span-full py-10 text-center text-sm text-gray-400">
            No products are listed online right now.
          </p>
        ) : (
          picks.map((item) => {
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
          })
        )}
      </Section>
    </div>
  );
}

function Section({ title, onSeeAll, children }) {
  return (
    <div className="px-4 py-4 sm:px-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-gray-900">{title}</h2>
        <button onClick={onSeeAll} className="text-[11px] font-bold text-gray-400">
          See all
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}
