import SidebarItem from "./SidebarItem";

export default function SidebarSection({
  title,
  items,
}) {
  return (
    <section className="space-y-2">
      <p
        className="
        px-4
        text-xs
        font-semibold
        uppercase
        tracking-wider
        text-slate-400
        dark:text-slate-500
        "
      >
        {title}
      </p>

      <div className="space-y-1">
        {items.map((item) => (
          <SidebarItem
            key={item.title}
            {...item}
          />
        ))}
      </div>
    </section>
  );
}