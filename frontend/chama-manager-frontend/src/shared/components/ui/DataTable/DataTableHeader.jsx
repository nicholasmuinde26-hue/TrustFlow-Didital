export default function DataTableHeader({
  title,
  subtitle,
}) {
  return (
    <div className="border-b p-6">

      <h2 className="text-lg font-bold">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-1 text-sm text-slate-500">
          {subtitle}
        </p>
      )}

    </div>
  );
}