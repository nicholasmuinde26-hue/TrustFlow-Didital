export default function CardHeader({
  title,
  subtitle,
  action,
}) {
  return (
    <div
      className="
      flex
      items-center
      justify-between
      border-b
      border-slate-200
      p-6
      dark:border-slate-800
      "
    >
      <div>
        <h3 className="font-semibold text-lg">
          {title}
        </h3>

        {subtitle && (
          <p className="mt-1 text-sm text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}