/**
 * Canonical design-system reference for JS consumers.
 *
 * CSS variables in styles/variables.css are the rendering source of truth.
 * These values are useful for charts, document exports and components that
 * need a token outside Tailwind classes.
 */
const designTokens = {
  color: {
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    primarySoft: "#EFF6FF",
    canvas: "#F8FAFC",
    surface: "#FFFFFF",
    ink: "#0F172A",
    muted: "#64748B",
    positive: "#15803D",
    caution: "#B45309",
    negative: "#B91C1C",
    informative: "#0E7490",
  },
  space: {
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
  },
  radius: {
    control: "0.75rem",
    panel: "1rem",
    feature: "1.5rem",
  },
  type: {
    body: "1rem",
    label: "0.75rem",
    title: "1.5rem",
    display: "2.25rem",
  },
};

export default designTokens;
