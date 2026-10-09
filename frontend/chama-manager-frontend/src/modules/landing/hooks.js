import { useEffect, useState } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts from 0 up to `value` while `active` is true; resets to 0 when it flips off. */
export function useCountUp(value, active, duration = 1400) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) {
      setN(0);
      return undefined;
    }
    if (prefersReducedMotion()) {
      setN(value);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setN(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, active, duration]);
  return n;
}

export const isFinePointer = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * Smooth (eased) wheel scrolling plus eased anchor-link jumps, with no dependency.
 * Only runs for mouse/trackpad users who haven't asked for reduced motion; touch devices
 * keep their native momentum scrolling. Keyboard, scrollbar dragging and nested scroll
 * areas are left alone. Everything is undone when the page unmounts.
 */
export function useSmoothScroll({ ease = 0.09 } = {}) {
  useEffect(() => {
    if (!isFinePointer() || prefersReducedMotion()) return undefined;

    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto"; // we drive the easing ourselves

    let target = window.scrollY;
    let current = target;
    let running = false;
    let raf = 0;

    const maxY = () => Math.max(0, root.scrollHeight - window.innerHeight);
    const clamp = (v) => Math.min(Math.max(v, 0), maxY());
    const jump = (y) => window.scrollTo({ top: y, behavior: "instant" });

    const tick = () => {
      const diff = target - current;
      if (Math.abs(diff) < 0.4) {
        current = target;
        jump(current);
        running = false;
        return;
      }
      current += diff * ease;
      jump(current);
      raf = requestAnimationFrame(tick);
    };
    const run = () => {
      if (running) return;
      running = true;
      current = window.scrollY;
      raf = requestAnimationFrame(tick);
    };

    const insideScrollable = (node) => {
      for (let el = node; el && el !== document.body && el !== root; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return true;
      }
      return false;
    };

    const onWheel = (e) => {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (insideScrollable(e.target) || maxY() === 0) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!running) target = window.scrollY;
      target = clamp(target + dy);
      run();
    };

    // keyboard / scrollbar / browser jumps: stay in sync
    const onScroll = () => {
      if (!running) target = current = window.scrollY;
    };

    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = decodeURIComponent(a.getAttribute("href").slice(1));
      const el = id && document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      const offset = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      const from = running ? current : window.scrollY;
      target = clamp(el.getBoundingClientRect().top + from - offset);
      run();
    };

    const onResize = () => {
      target = clamp(target);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onClick);
      root.style.scrollBehavior = previous;
    };
  }, [ease]);
}