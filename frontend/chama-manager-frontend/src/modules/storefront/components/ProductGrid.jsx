import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import ProductCard from "./ProductCard";

export default function ProductGrid({ products, loading, hasMore, onLoadMore, onAddToCart, onViewDetails }) {
  const loaderRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [hasMore, loading, onLoadMore]);

  if (products.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No products found</h3>
        <p className="text-slate-500 dark:text-slate-400 text-center">
          Try adjusting your filters or search terms
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Products Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            onAddToCart={onAddToCart}
            onViewDetails={onViewDetails}
          />
        ))}
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      )}

      {/* Load More Trigger */}
      {hasMore && !loading && (
        <div ref={loaderRef} className="flex justify-center py-8">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      )}

      {/* End of Products */}
      {!hasMore && products.length > 0 && (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          You've reached the end of the product list
        </div>
      )}
    </div>
  );
}