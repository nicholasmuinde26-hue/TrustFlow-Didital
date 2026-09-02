import React, { useMemo } from "react";
import HeroBanner from "./HeroBanner";
import WelcomePanel from "./WelcomePanel";
import CategoryIconRow from "./CategoryIconRow";
import ProductCard from "./ProductCard";
import TrustStrip from "./TrustStrip";
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
  onShopNow,
  onSignIn,
  onTrackOrder,
}) {
  const deals = useMemo(() => {
    const discounted = items.filter((i) => getStockState(i) !== "out" && getDiscountPercent(i));
    return sortItems(discounted, "relevance").slice(0, 12);
  }, [items]);

  const picks = useMemo(() => sortItems(items, "relevance").slice(0, 16), [items]);

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Hero + welcome panel */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <HeroBanner storefront={storefront} primaryColor={primaryColor} onShopNow={onShopNow} />
        </div>
        <WelcomePanel
          storefront={storefront}
          primaryColor={primaryColor}
          onSignIn={onSignIn}
          onTrackOrder={onTrackOrder}
        />
      </div>

      {/* Category icons */}
      {categories.length > 0 && (
        <CategoryIconRow
          categories={categories}
          primaryColor={primaryColor}
          onSelectCategory={onBrowseCategory}
        />
      )}

      {/* Deals — a horizontal scroll strip on phones (matches a dense
          "swipe through deals" storefront layout), a wrapping grid from
          tablet width up where there's room to see more at once. */}
      {deals.length > 0 && (
        <Section title="Top Deals For You" onSeeAll={() => onBrowseCategory("All")} scrollOnMobile>
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

      {/* Everything else */}
      <Section title={`More from ${storefront.name}`} onSeeAll={() => onBrowseCategory("All")}>
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

      <TrustStrip />
    </div>
  );
}

function Section({ title, onSeeAll, children, scrollOnMobile = false }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-gray-900 sm:text-base">{title}</h2>
        <button onClick={onSeeAll} className="text-[11px] font-bold text-gray-400 hover:text-gray-600">
          See all
        </button>
      </div>
      {scrollOnMobile ? (
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-4 xl:grid-cols-6">
          {React.Children.map(children, (child) => (
            <div className="w-[42%] shrink-0 snap-start sm:w-auto sm:shrink">{child}</div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{children}</div>
      )}
    </div>
  );
}
