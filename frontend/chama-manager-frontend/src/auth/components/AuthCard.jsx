export default function AuthCard({
  children,
}) {
  return (
    <div
      className="
      rounded-3xl
      bg-white
      shadow-xl
      p-8
      dark:bg-slate-900
      "
    >
      {children}
    </div>
  );
}