export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint text-sm font-black tracking-tight text-obsidian-rail">
        CM
      </div>

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