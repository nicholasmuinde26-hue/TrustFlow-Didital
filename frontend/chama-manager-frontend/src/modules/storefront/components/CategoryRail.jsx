import React from "react";
import { SORT_OPTIONS } from "../utils/storefront.utils";

export default function CategoryRail({
  categories,
  activeCategory,
  onSelectCategory,
  sortValue,
  onSortChange,
  primaryColor,
}) {
  return (
    <div className="sticky top-14 z-10 border-b border-gray-100 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-8">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CategoryChip
            label="All"
            active={activeCategory === "All"}
            onClick={() => onSelectCategory("All")}
            primaryColor={primaryColor}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              active={activeCategory === cat}
              onClick={() => onSelectCategory(cat)}
              primaryColor={primaryColor}
            />
          ))}
        </div>

        <select
          value={sortValue}
          onChange={(e) => onSortChange(e.target.value)}
          className="shrink-0 rounded-lg border border-gray-200 bg-white py-1.5 pl-2 pr-6 text-[11px] font-semibold text-gray-600 outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick, primaryColor }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold transition"
      style={
        active
          ? { backgroundColor: primaryColor, color: "#fff" }
          : { backgroundColor: "#F3F4F6", color: "#4B5563" }
      }
    >
      {label}
    </button>
  );
}
