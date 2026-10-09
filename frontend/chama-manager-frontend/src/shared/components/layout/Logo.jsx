import BrandMark from "./BrandMark";

export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      <BrandMark size={44} className="shrink-0" />

      <div>
        <h2 className="text-lg font-black leading-tight text-slate-950 dark:text-mist">
          VeriCircle
        </h2>
        <p className="text-xs text-slate-500 dark:text-mist-muted">
          Trust • Connect • Grow
        </p>
      </div>
    </div>
  );
}