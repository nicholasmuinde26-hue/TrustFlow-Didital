import Button from "./Button";

export default function PageHeader({
  title,
  subtitle,
  action,
}) {
  return (
    <div
      className="
      mb-8
      flex
      flex-col
      gap-4
      lg:flex-row
      lg:items-center
      lg:justify-between
      "
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-2 text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-3">
          {action}
        </div>
      )}
    </div>
  );
}