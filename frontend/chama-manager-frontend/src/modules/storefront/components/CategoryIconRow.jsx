import React from "react";
import { getCategoryEmoji } from "../utils/storefront.utils";

export default function CategoryIconRow({ categories, primaryColor, onSelectCategory }) {
  if (!categories.length) return null;

  return (
    <div className="flex gap-5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-7">
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onSelectCategory(cat)}
          className="flex shrink-0 flex-col items-center gap-2"
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-xl sm:h-16 sm:w-16"
            style={{ backgroundColor: `${primaryColor}14` }}
          >
            {getCategoryEmoji(cat)}
          </span>
          <span className="max-w-[76px] truncate text-[11px] font-semibold text-gray-600">{cat}</span>
        </button>
      ))}
    </div>
  );
}
