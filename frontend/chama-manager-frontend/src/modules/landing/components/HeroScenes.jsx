/* ============================================================
   HERO SCENES
   Four illustrated "photographs" drawn in SVG so the hero has real
   imagery with no downloads or licences. Each fills its container
   (slice) and is tuned so the left third stays calm for headline
   text. To use a real photo instead, drop a file into
   public/landing/ (see HeroSlider SLIDES[].photo) and it will be
   layered over the scene automatically.
============================================================ */

function Frame({ children }) {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const MEMBER_COLORS = ["#6ee0b6", "#7dd3fc", "#fcd34d", "#f9a8d4", "#a5b4fc", "#fdba74", "#86efac", "#fca5a5"];
const CX = 1100;
const CY = 450;
const MEMBERS = MEMBER_COLORS.map((color, k) => {
  const a = (k * 45 - 90) * (Math.PI / 180);
  return { color, x: CX + 300 * Math.cos(a), y: CY + 300 * Math.sin(a) };
});

/* 1 — Chama: a circle of members around the shared pot, seen from above. */
export function SceneChama() {
  return (
    <Frame>
      <defs>
        <radialGradient id="s1bg" cx="68%" cy="50%" r="75%">
          <stop offset="0" stopColor="#15503f" />
          <stop offset="0.55" stopColor="#0d2722" />
          <stop offset="1" stopColor="#08130f" />
        </radialGradient>
        <radialGradient id="s1pot">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#s1bg)" />

      {[150, 240, 340, 450, 570, 710].map((r, i) => (
        <circle
          key={r}
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke="#6ee0b6"
          strokeOpacity={0.05 + (i % 3) * 0.025}
          strokeWidth="2"
          strokeDasharray={i % 2 ? "3 12" : undefined}
        />
      ))}

      {MEMBERS.map((m, i) => (
        <line
          key={`l${i}`}
          x1={m.x}
          y1={m.y}
          x2={CX}
          y2={CY}
          stroke="#6ee0b6"
          strokeOpacity="0.55"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="2 16"
          className="lp-dash"
          style={{ animationDelay: `${i * 0.25}s` }}
        />
      ))}

      <circle cx={CX} cy={CY} r="185" fill="#13302a" stroke="#6ee0b6" strokeOpacity="0.35" strokeWidth="2" />
      <circle cx={CX} cy={CY} r="140" fill="none" stroke="#6ee0b6" strokeOpacity="0.18" strokeDasharray="6 10" />
      <circle cx={CX} cy={CY} r="130" fill="url(#s1pot)" className="lp-pulse" />
      {[3, 2, 1, 0].map((k) => (
        <g key={k}>
          <rect x={CX - 48} y={CY + 12 - k * 15} width="96" height="15" fill="#d97706" />
          <ellipse cx={CX} cy={CY + 27 - k * 15} rx="48" ry="15" fill="#d97706" />
          <ellipse cx={CX} cy={CY + 12 - k * 15} rx="48" ry="15" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
        </g>
      ))}

      {MEMBERS.map((m, i) => (
        <g key={i} transform={`translate(${m.x} ${m.y})`}>
          <g className="lp-float" style={{ "--d": `${i * 0.4}s` }}>
            <circle r="62" fill={m.color} opacity="0.12" />
            <circle r="46" fill={m.color} opacity="0.92" />
            <ellipse cx="0" cy="22" rx="27" ry="14" fill="#0d1917" opacity="0.28" />
            <circle cx="0" cy="-8" r="17" fill="#0d1917" opacity="0.34" />
          </g>
        </g>
      ))}

      {[[260, 760, 14], [420, 640, 10], [180, 520, 9], [520, 820, 12], [640, 150, 10], [300, 120, 8]].map(([x, y, r], i) => (
        <g key={i} className="lp-float" style={{ "--d": `${i * 0.7}s` }}>
          <circle cx={x} cy={y} r={r} fill="#fbbf24" opacity="0.85" />
          <circle cx={x} cy={y} r={r * 0.6} fill="none" stroke="#b45309" strokeWidth="2" />
        </g>
      ))}
    </Frame>
  );
}

/* 2 — Collections: an STK prompt on a phone, payments flowing to the ledger. */
export function SceneCollections() {
  const flows = [
    ["M -40 760 C 380 760 520 560 980 560", "#6ee0b6"],
    ["M -40 560 C 300 560 520 430 1000 450", "#7dd3fc"],
    ["M -40 330 C 360 330 560 420 1000 380", "#fcd34d"],
  ];
  return (
    <Frame>
      <defs>
        <radialGradient id="s2bg" cx="70%" cy="50%" r="80%">
          <stop offset="0" stopColor="#10475a" />
          <stop offset="0.55" stopColor="#0b2530" />
          <stop offset="1" stopColor="#07121a" />
        </radialGradient>
        <linearGradient id="s2screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f3d33" />
          <stop offset="1" stopColor="#081a16" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#s2bg)" />

      {[200, 320, 440].map((r) => (
        <circle key={r} cx="1180" cy="450" r={r} fill="none" stroke="#7dd3fc" strokeOpacity="0.06" strokeWidth="2" />
      ))}

      {flows.map(([d, c], i) => (
        <g key={i}>
          <path d={d} fill="none" stroke={c} strokeOpacity="0.14" strokeWidth="10" strokeLinecap="round" />
          <path
            d={d}
            fill="none"
            stroke={c}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="1 34"
            className="lp-dash"
            style={{ animationDelay: `${i * 0.5}s` }}
          />
        </g>
      ))}

      {/* ledger card behind the phone */}
      <g transform="rotate(8 1400 440)">
        <rect x="1230" y="210" width="340" height="440" rx="26" fill="#12302b" stroke="#6ee0b6" strokeOpacity="0.25" strokeWidth="2" />
        <rect x="1262" y="248" width="120" height="14" rx="7" fill="#6ee0b6" opacity="0.5" />
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <g key={r}>
            <rect x="1262" y={294 + r * 54} width={150 + (r % 3) * 30} height="12" rx="6" fill="#e8f5ef" opacity="0.16" />
            <rect x="1470" y={294 + r * 54} width="64" height="12" rx="6" fill={r % 2 ? "#fcd34d" : "#6ee0b6"} opacity="0.6" />
          </g>
        ))}
      </g>

      {/* phone */}
      <g transform="translate(1000 110) rotate(-7 150 330)">
        <rect x="-10" y="-10" width="320" height="640" rx="56" fill="#6ee0b6" opacity="0.08" />
        <rect width="300" height="620" rx="46" fill="#07100e" stroke="#2a4a42" strokeWidth="4" />
        <rect x="14" y="14" width="272" height="592" rx="34" fill="url(#s2screen)" />
        <rect x="100" y="26" width="100" height="16" rx="8" fill="#000" />
        <text x="150" y="92" textAnchor="middle" fontSize="18" fontWeight="800" fill="#6ee0b6" fontFamily="Inter, system-ui, sans-serif" letterSpacing="2">
          STK PUSH
        </text>
        <rect x="34" y="124" width="232" height="270" rx="22" fill="#f8fafc" />
        <text x="150" y="162" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a" fontFamily="Inter, system-ui, sans-serif">
          Upper Kyati Women's Group
        </text>
        <text x="150" y="184" textAnchor="middle" fontSize="12" fill="#64748b" fontFamily="Inter, system-ui, sans-serif">
          Monthly dues
        </text>
        <text x="150" y="238" textAnchor="middle" fontSize="36" fontWeight="800" fill="#0f172a" fontFamily="Inter, system-ui, sans-serif">
          KES 2,000
        </text>
        <text x="150" y="272" textAnchor="middle" fontSize="12" fill="#64748b" fontFamily="Inter, system-ui, sans-serif">
          Enter your PIN to pay
        </text>
        {[0, 1, 2, 3].map((k) => (
          <circle key={k} cx={102 + k * 32} cy="306" r="9" fill={k < 3 ? "#0f172a" : "none"} stroke="#0f172a" strokeWidth="2" />
        ))}
        <rect x="58" y="338" width="184" height="38" rx="19" fill="#16a34a" />
        <text x="150" y="363" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui, sans-serif">
          Pay
        </text>
        {[0, 1, 2].map((k) => (
          <rect key={k} x="34" y={430 + k * 44} width={232 - k * 50} height="14" rx="7" fill="#e8f5ef" opacity="0.14" />
        ))}
      </g>

      {/* "matched" badge */}
      <g transform="translate(930 560)">
        <g className="lp-float">
          <circle r="60" fill="#6ee0b6" opacity="0.14" className="lp-pulse" />
          <circle r="38" fill="#6ee0b6" />
          <path d="M-15 2 L-4 14 L17 -12" fill="none" stroke="#08201a" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </Frame>
  );
}

/* 3 — Business: a lit shopfront at dusk. */
const BOXES = [
  [890, 458, 46, 32, "#6ee0b6"], [946, 450, 40, 40, "#fcd34d"], [996, 462, 52, 28, "#f9a8d4"], [1058, 454, 40, 36, "#7dd3fc"], [1108, 460, 56, 30, "#fdba74"],
  [892, 538, 56, 32, "#a5b4fc"], [958, 530, 40, 40, "#6ee0b6"], [1008, 540, 50, 30, "#fca5a5"], [1068, 532, 44, 38, "#fcd34d"], [1122, 542, 48, 28, "#86efac"],
];
const STARS = [[120, 80], [340, 150], [520, 60], [700, 120], [880, 70], [1100, 40], [1300, 110], [1480, 60], [200, 230], [620, 240], [1420, 220]];

export function SceneBusiness() {
  return (
    <Frame>
      <defs>
        <linearGradient id="s3bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1650" />
          <stop offset="0.55" stopColor="#0f3b3d" />
          <stop offset="1" stopColor="#08130f" />
        </linearGradient>
        <radialGradient id="s3glow">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#s3bg)" />

      {STARS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 1.6 : 2.4} fill="#fff" opacity="0.7" className="lp-twinkle" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
      <circle cx="260" cy="170" r="150" fill="url(#s3glow)" />
      <circle cx="260" cy="170" r="54" fill="#fef3c7" opacity="0.9" />

      <rect y="760" width="1600" height="140" fill="#0a1512" />
      <rect y="756" width="1600" height="6" fill="#6ee0b6" opacity="0.1" />

      {/* shop */}
      <rect x="830" y="300" width="640" height="460" fill="#16312b" stroke="#6ee0b6" strokeOpacity="0.22" strokeWidth="2" />
      {Array.from({ length: 10 }).map((_, i) => {
        const c = i % 2 ? "#0f766e" : "#6ee0b6";
        return (
          <g key={i}>
            <rect x={820 + i * 66} y="300" width="66" height="64" fill={c} />
            <circle cx={853 + i * 66} cy="364" r="33" fill={c} />
          </g>
        );
      })}
      <rect x="820" y="292" width="660" height="12" fill="#0b1715" />

      <rect x="872" y="426" width="324" height="250" rx="14" fill="#fde68a" opacity="0.16" stroke="#fde68a" strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="1034" cy="550" r="190" fill="url(#s3glow)" opacity="0.5" />
      {[494, 574].map((y) => (
        <rect key={y} x="880" y={y} width="308" height="6" fill="#0b1715" opacity="0.7" />
      ))}
      {BOXES.map(([x, , w, h, c], i) => (
        <rect key={i} x={x} y={(i < 5 ? 494 : 574) - h} width={w} height={h} rx="5" fill={c} opacity="0.9" />
      ))}
      <rect x="880" y="620" width="308" height="50" rx="8" fill="#0b1715" opacity="0.55" />

      <rect x="1262" y="426" width="150" height="334" rx="12" fill="#0b1715" stroke="#6ee0b6" strokeOpacity="0.25" strokeWidth="2" />
      <circle cx="1392" cy="600" r="7" fill="#fcd34d" />
      <rect x="1280" y="446" width="114" height="46" rx="10" fill="none" stroke="#f472b6" strokeWidth="3" className="lp-pulse" />
      <text x="1337" y="480" textAnchor="middle" fontSize="26" fontWeight="800" fill="#f472b6" fontFamily="Inter, system-ui, sans-serif" letterSpacing="3" className="lp-pulse">
        OPEN
      </text>

      {/* hanging lamps */}
      {[[900, 300], [1100, 300], [1300, 300]].map(([x], i) => (
        <g key={i}>
          <line x1={x} y1="364" x2={x} y2="392" stroke="#0b1715" strokeWidth="3" />
          <circle cx={x} cy="402" r="12" fill="#fde68a" />
          <circle cx={x} cy="402" r="46" fill="url(#s3glow)" className="lp-pulse" style={{ animationDelay: `${i * 0.6}s` }} />
        </g>
      ))}

      {/* crates + produce */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${780 + i * 110} 700)`}>
          <rect width="96" height="62" rx="6" fill="#7c4a1d" stroke="#4a2a0d" strokeWidth="3" />
          <rect y="22" width="96" height="6" fill="#4a2a0d" opacity="0.6" />
          {[0, 1, 2, 3].map((k) => (
            <circle key={k} cx={18 + k * 20} cy="2" r="13" fill={["#f97316", "#84cc16", "#ef4444", "#facc15"][(k + i) % 4]} />
          ))}
        </g>
      ))}
      {[[420, 786], [560, 800]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="40" fill="#fde68a" opacity="0.05" />
      ))}
    </Frame>
  );
}

/* 4 — Trust: a verified chain of blocks under a shield. */
const BLOCKS = [
  ["#1", "9f3a…c1"],
  ["#2", "b72e…04"],
  ["#3", "5d1c…ae"],
  ["#4", "e08b…77"],
];

export function SceneTrust() {
  return (
    <Frame>
      <defs>
        <radialGradient id="s4bg" cx="68%" cy="42%" r="80%">
          <stop offset="0" stopColor="#12493e" />
          <stop offset="0.55" stopColor="#0b2420" />
          <stop offset="1" stopColor="#070f0d" />
        </radialGradient>
        <linearGradient id="s4shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b6fbe0" />
          <stop offset="1" stopColor="#2fbf8c" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#s4bg)" />

      {/* perspective floor */}
      <g stroke="#6ee0b6" strokeOpacity="0.12" strokeWidth="1.5">
        {Array.from({ length: 21 }).map((_, i) => (
          <line key={i} x1="1000" y1="520" x2={-600 + i * 190} y2="900" />
        ))}
        {Array.from({ length: 8 }).map((_, i) => {
          const y = 520 + 380 * Math.pow((i + 1) / 8, 2);
          return <line key={`h${i}`} x1="0" y1={y} x2="1600" y2={y} />;
        })}
      </g>

      {/* shield */}
      <g transform="translate(1130 230)">
        <g className="lp-float">
          <circle r="150" fill="#6ee0b6" opacity="0.1" className="lp-pulse" />
          <path d="M0 -100 L88 -66 V12 C88 66 44 100 0 124 C-44 100 -88 66 -88 12 V-66 Z" fill="url(#s4shield)" />
          <path d="M-38 6 L-9 36 L42 -24" fill="none" stroke="#08201a" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>

      {/* chain */}
      {BLOCKS.map(([n, h], i) => {
        const x = 640 + i * 210;
        return (
          <g key={n}>
            {i < BLOCKS.length - 1 && (
              <g>
                <line x1={x + 160} y1="520" x2={x + 210} y2="520" stroke="#6ee0b6" strokeOpacity="0.6" strokeWidth="3" />
                <circle cx={x + 185} cy="520" r="7" fill="#6ee0b6" className="lp-pulse" style={{ animationDelay: `${i * 0.5}s` }} />
              </g>
            )}
            <g className="lp-pulse" style={{ animationDelay: `${i * 0.5}s` }}>
              <rect x={x} y="460" width="160" height="120" rx="18" fill="#10302a" stroke="#6ee0b6" strokeOpacity="0.7" strokeWidth="2.5" />
            </g>
            <text x={x + 18} y="494" fontSize="15" fontWeight="800" fill="#6ee0b6" fontFamily="ui-monospace, monospace">
              BLOCK {n}
            </text>
            <text x={x + 18} y="524" fontSize="15" fill="#e8f5ef" opacity="0.8" fontFamily="ui-monospace, monospace">
              {h}
            </text>
            <rect x={x + 18} y="542" width="90" height="8" rx="4" fill="#e8f5ef" opacity="0.18" />
            <rect x={x + 18} y="558" width="60" height="8" rx="4" fill="#e8f5ef" opacity="0.12" />
          </g>
        );
      })}

      {/* reflections */}
      {BLOCKS.map((b, i) => (
        <rect key={i} x={640 + i * 210} y="596" width="160" height="60" rx="14" fill="#6ee0b6" opacity="0.05" />
      ))}
    </Frame>
  );
}
