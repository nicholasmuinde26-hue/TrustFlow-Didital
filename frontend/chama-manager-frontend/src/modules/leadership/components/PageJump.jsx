import { useEffect, useRef, useState } from "react";

// "On this page" chips for long tabs. It reads the SectionCards the active tab
// has rendered (they all carry data-desk-section), so tabs get in-page
// navigation without knowing this component exists. It re-scans when a tab
// loads more cards after its data arrives.
export default function PageJump({ containerRef, watchKey }) {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const observer = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    let frame;
    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const found = [...root.querySelectorAll("[data-desk-section]")].map((node) => ({
          id: node.id,
          title: node.getAttribute("data-desk-section"),
        }));
        setItems((previous) =>
          previous.length === found.length && previous.every((item, index) => item.id === found[index].id)
            ? previous
            : found
        );
      });
    };

    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [containerRef, watchKey]);

  useEffect(() => {
    observer.current?.disconnect();
    if (items.length < 3) return undefined;
    observer.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" }
    );
    items.forEach((item) => {
      const node = document.getElementById(item.id);
      if (node) observer.current.observe(node);
    });
    return () => observer.current?.disconnect();
  }, [items]);

  // Three or fewer cards fit on one screen; a jump bar would just be noise.
  if (items.length < 3) return null;

  return (
    <nav aria-label="On this page" className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
      <span className="shrink-0 pr-1 text-xs font-semibold text-slate-400">On this page</span>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          aria-current={activeId === item.id ? "true" : undefined}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${
            activeId === item.id
              ? "border-slate-800 bg-slate-800 text-white dark:border-mint dark:bg-mint dark:text-obsidian-rail"
              : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-obsidian-border dark:text-slate-300"
          }`}
        >
          {item.title}
        </button>
      ))}
    </nav>
  );
}
