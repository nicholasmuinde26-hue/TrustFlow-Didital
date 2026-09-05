import { useState } from "react";
import { Search, Filter, Grid, List, SlidersHorizontal } from "lucide-react";

export default function ProductFilters({ filters, onFilterChange, categories }) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-6">
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Search products..."
          value={filters.search || ""}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </div>

      {/* Filter Toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-4"
      >
        <SlidersHorizontal size={18} />
        {showFilters ? "Hide Filters" : "Show Filters"}
      </button>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Category
            </label>
            <select
              value={filters.category || ""}
              onChange={(e) => onFilterChange({ ...filters, category: e.target.value || null })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Price Range
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.min_price || ""}
                onChange={(e) => onFilterChange({ ...filters, min_price: e.target.value ? Number(e.target.value) : null })}
                className="w-1/2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.max_price || ""}
                onChange={(e) => onFilterChange({ ...filters, max_price: e.target.value ? Number(e.target.value) : null })}
                className="w-1/2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Stock Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Availability
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.in_stock || false}
                onChange={(e) => onFilterChange({ ...filters, in_stock: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">In Stock Only</span>
            </label>
          </div>
        </div>
      )}

      {/* Sort Options */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Sort by:
        </span>
        <select
          value={`${filters.sort_by || "created_at"}-${filters.sort_order || "desc"}`}
          onChange={(e) => {
            const [sort_by, sort_order] = e.target.value.split("-");
            onFilterChange({ ...filters, sort_by, sort_order });
          }}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        >
          <option value="created_at-desc">Newest</option>
          <option value="created_at-asc">Oldest</option>
          <option value="base_price-asc">Price: Low to High</option>
          <option value="base_price-desc">Price: High to Low</option>
          <option value="sales_count-desc">Best Selling</option>
          <option value="rating-desc">Highest Rated</option>
          <option value="title-asc">Alphabetical</option>
        </select>
      </div>
    </div>
  );
}