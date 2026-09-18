import { Star } from "lucide-react";

export default function StarRatingInput({ value, onChange, size = 20 }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Rate ${n} out of 5`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-colors hover:scale-110"
        >
          <Star
            size={size}
            className={n <= value ? "fill-yellow-400 text-yellow-400" : "text-slate-300 dark:text-slate-600"}
          />
        </button>
      ))}
    </div>
  );
}
