import { useEffect, useRef } from "react";

import { isFinePointer, prefersReducedMotion } from "../hooks";

/**
 * Custom cursor for the landing page (mouse/trackpad only):
 *   - a dot that follows exactly,
 *   - a ring that trails it and grows over links and buttons,
 *   - a large soft glow that drifts behind.
 * The native cursor is hidden only while this is mounted (html.lp-cursor-on).
 */
export default function Cursor() {
  const glow = useRef(null);
  const ring = useRef(null);
  const dot = useRef(null);

  useEffect(() => {
    if (!isFinePointer() || prefersReducedMotion()) return undefined;

    const root = document.documentElement;
    root.classList.add("lp-cursor-on");

    let mx = -300;
    let my = -300;
    let rx = mx;
    let ry = my;
    let gx = mx;
    let gy = my;
    let raf = 0;
    let running = false;

    const place = (el, x, y) => {
      if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    };

    const tick = () => {
      rx += (mx - rx) * 0.2;
      ry += (my - ry) * 0.2;
      gx += (mx - gx) * 0.08;
      gy += (my - gy) * 0.08;
      place(ring.current, rx, ry);
      place(glow.current, gx, gy);
      const settled = Math.abs(mx - rx) + Math.abs(my - ry) + Math.abs(mx - gx) + Math.abs(my - gy) < 0.3;
      if (settled) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
      place(dot.current, mx, my);
      root.classList.add("lp-cursor-live");
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const onOver = (e) => {
      const t = e.target;
      if (!t || !t.closest || !ring.current) return;
      const state = t.closest("a, button, [data-cursor]") ? "link" : t.closest(".lp-spot, .lp-gborder") ? "card" : "";
      ring.current.dataset.state = state;
    };
    const onDown = () => {
      if (ring.current) ring.current.dataset.down = "1";
    };
    const onUp = () => {
      if (ring.current) ring.current.dataset.down = "0";
    };
    const hide = () => root.classList.remove("lp-cursor-live");

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("mouseleave", hide);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseleave", hide);
      root.classList.remove("lp-cursor-on", "lp-cursor-live");
    };
  }, []);

  return (
    <>
      <div ref={glow} className="lp-cursor lp-cursor-glow" aria-hidden />
      <div ref={ring} className="lp-cursor lp-cursor-ring" aria-hidden />
      <div ref={dot} className="lp-cursor lp-cursor-dot" aria-hidden />
    </>
  );
}