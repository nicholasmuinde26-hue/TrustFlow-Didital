import React from "react";

export default function HeroBanner({ storefront, primaryColor, onShopNow }) {
  const badges = storefront.badges || [];

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-8 text-white sm:px-10 sm:py-12"
      style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #111827 130%)` }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full opacity-20"
        style={{ background: "radial-gradient(closest-side, #fff, transparent)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full opacity-10"
        style={{ background: "radial-gradient(closest-side, #fff, transparent)" }}
      />

      <p className="relative text-xs font-extrabold uppercase tracking-[0.2em] text-white/70">
        Welcome to {storefront.name}
      </p>
      <h1 className="relative mt-2 max-w-lg text-2xl font-extrabold leading-snug sm:text-4xl">
        {storefront.headline}
      </h1>
      <p className="relative mt-3 max-w-md text-xs leading-relaxed text-white/80 sm:text-sm">
        {storefront.subtitle}
      </p>

      <button
        type="button"
        onClick={onShopNow}
        className="relative mt-6 rounded-lg bg-white px-6 py-2.5 text-sm font-extrabold text-gray-900 transition hover:bg-white/90"
      >
        Shop Now
      </button>

      {badges.length > 0 && (
        <div className="relative mt-6 flex flex-wrap gap-2">
          {badges.slice(0, 3).map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold backdrop-blur-sm"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
