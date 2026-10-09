import { useId } from "react";

/**
 * The VeriCircle mark.
 *
 * Three members sit on a circle (the "circle" - a chama is people passing
 * trust around), joined by three arcs that stop short of every member so the
 * ring reads as a hand-off rather than a closed loop. In the middle a single
 * check stroke marks the "veri": every contribution, loan and payout is
 * verified on a ledger anyone in the group can inspect.
 *
 * It is drawn from one stroke weight, three dots and one check, so it stays
 * legible down to ~16px. The geometry is computed (not hand-typed) so the
 * gaps stay perfectly even if the radius is ever tweaked.
 *
 * `tile` draws the rounded mint square behind it (rail, headers). Without
 * it only the mark is drawn in the current text colour, for tinted
 * backgrounds. Pass `title=""` when it is purely decorative.
 */

const CX = 20;
const CY = 20;
const R = 12;
const NODE_ANGLES = [-90, 30, 150]; // degrees, clockwise from 3 o'clock
const GAP = 17; // degrees trimmed at each end of an arc so it clears the dots

const rad = (deg) => (deg * Math.PI) / 180;
const point = (deg) => [CX + R * Math.cos(rad(deg)), CY + R * Math.sin(rad(deg))];
const fmt = (n) => Number(n.toFixed(2));

const ARCS = NODE_ANGLES.map((start, i) => {
  const end = NODE_ANGLES[(i + 1) % NODE_ANGLES.length] + (i === NODE_ANGLES.length - 1 ? 360 : 0);
  const [x1, y1] = point(start + GAP);
  const [x2, y2] = point(end - GAP);
  return `M${fmt(x1)} ${fmt(y1)}A${R} ${R} 0 0 1 ${fmt(x2)} ${fmt(y2)}`;
});

const NODES = NODE_ANGLES.map(point);

export default function BrandMark({ size = 40, tile = true, className = "", title = "VeriCircle" }) {
  const gradientId = useId().replace(/:/g, "");
  const ink = tile ? "#08201a" : "currentColor";

  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {tile ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#b6fbe0" />
              <stop offset="0.55" stopColor="#6ee0b6" />
              <stop offset="1" stopColor="#2fbf8c" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="11" fill={`url(#${gradientId})`} />
        </>
      ) : null}

      {ARCS.map((d) => (
        <path key={d} d={d} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      ))}

      {NODES.map(([x, y], i) => (
        <circle key={i} cx={fmt(x)} cy={fmt(y)} r="3" fill={ink} />
      ))}

      <path
        d="M15.4 20.4l3.4 3.5 6.2-7.3"
        fill="none"
        stroke={ink}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
