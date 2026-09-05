import React from "react";
import { getCategoryEmoji } from "../utils/storefront.utils";
import { ChevronRight } from "./icons";

export default function CategorySidebar({ categories, activeCategory, onSelectCategory }) {
  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="sticky top-4 overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <p className="border-b border-gray-100 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-gray-500">
          All Categories
        </p>
        <nav className="max-h-[520px] overflow-y-auto py-1.5">
          <CategoryLink
            label="All products"
            emoji="🛍️"
            active={activeCategory === "All"}
            onClick={() => onSelectCategory("All")}
          />
          {categories.map((cat) => (
            <CategoryLink
              key={cat}
              label={cat}
              emoji={getCategoryEmoji(cat)}
              active={activeCategory === cat}
              onClick={() => onSelectCategory(cat)}
            />
          ))}
          {categories.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-400">No categories yet.</p>
          )}
        </nav>
      </div>
    </aside>
  );
}

function CategoryLink({ label, emoji, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] font-semibold transition"
      style={{ color: active ? "#111827" : "#4B5563", backgroundColor: active ? "#F9FAFB" : "transparent" }}
    >
      <span className="text-base leading-none" aria-hidden>
        {emoji}
      </span>
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />
    </button>
  );
}
