export default function AuthCard({
  children,
}) {
  return (
    <div
      className="
      rounded-2xl
      border border-slate-200/80
      bg-white/95
      p-6
      shadow-[0_18px_48px_rgba(15,23,42,0.12)]
      backdrop-blur-sm
      dark:border-slate-700 dark:bg-slate-900
      sm:p-7
      "
    >
      {children}
    </div>
  );
}
