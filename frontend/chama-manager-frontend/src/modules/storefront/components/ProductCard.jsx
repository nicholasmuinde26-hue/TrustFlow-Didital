import { useState } from "react";
import { ShoppingCart, Heart, Star } from "lucide-react";

export default function ProductCard({ product, onAddToCart, onViewDetails }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const discountPercentage = product.compare_price 
    ? Math.round(((product.compare_price - product.base_price) / product.compare_price) * 100)
    : 0;

  return (
    <div
      className="group relative bg-white rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onViewDetails && onViewDetails(product)}
    >
      {/* Product Image */}
      <div className="relative aspect-square bg-slate-100 dark:bg-slate-900 overflow-hidden">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <span className="text-4xl">📦</span>
          </div>
        )}

        {/* Discount Badge */}
        {discountPercentage > 0 && (
          <div className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            -{discountPercentage}%
          </div>
        )}

        {/* Featured Badge */}
        {product.is_featured && (
          <div className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            Featured
          </div>
        )}

        {/* Quick Actions */}
        <div
          className={`absolute bottom-3 right-3 flex flex-col gap-2 transition-all duration-300 ${
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsWishlisted(!isWishlisted);
            }}
            className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
          >
            <Heart
              size={18}
              className={isWishlisted ? "fill-rose-500 text-rose-500" : "text-slate-600 dark:text-slate-400"}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart && onAddToCart(product);
            }}
            className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-colors"
          >
            <ShoppingCart size={18} />
          </button>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Category */}
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
          {product.category}
        </div>

        {/* Title */}
        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
          {product.title}
        </h3>

        {/* Rating */}
        {product.rating > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={i < Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}
                />
              ))}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({product.review_count})
            </span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
            {product.currency} {product.base_price.toLocaleString()}
          </span>
          {product.compare_price && (
            <span className="text-sm text-slate-400 line-through">
              {product.currency} {product.compare_price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Stock Status */}
        <div className="mt-2">
          {product.stock > 0 ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              In Stock ({product.stock} available)
            </span>
          ) : (
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              Out of Stock
            </span>
          )}
        </div>
      </div>
    </div>
  );
}