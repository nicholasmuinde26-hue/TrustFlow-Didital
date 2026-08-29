import React from "react";

export default function HeroBanner({ storefront, primaryColor }) {
  const badges = storefront.badges || [];

  return (
    <div
      className="px-4 pb-6 pt-7 text-white sm:px-8 sm:pt-9"
      style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #111827 130%)` }}
    >
      <h1 className="max-w-lg text-xl font-extrabold leading-snug sm:text-3xl">{storefront.headline}</h1>
      <p className="mt-2 max-w-md text-xs leading-relaxed opacity-85 sm:text-sm">{storefront.subtitle}</p>

      {badges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
          {badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
