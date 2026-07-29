export default function Input({
  label,
  error,
  className = "",
  ...props
}) {
  return (
    <div className="space-y-2">

      {label && (
        <label className="font-medium text-sm">
          {label}
        </label>
      )}

      <input
        className={`
          w-full
          rounded-xl
          border
          border-slate-300
          px-4
          py-3
          bg-white
          dark:bg-slate-900
          focus:ring-2
          focus:ring-blue-500
          outline-none
          ${className}
        `}
        {...props}
      />

      {error && (
        <p className="text-red-500 text-sm">
          {error}
        </p>
      )}

    </div>
  );
}