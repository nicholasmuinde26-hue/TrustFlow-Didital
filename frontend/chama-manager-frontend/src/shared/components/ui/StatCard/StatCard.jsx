import {
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import Card from "../Card";

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color = "primary",
}) {
  const colors = {
    primary:
      "bg-primary/10 text-primary",

    success:
      "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",

    warning:
      "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",

    danger:
      "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",

    info:
      "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  };

  return (
    <Card className="transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="p-6">

        <div className="flex items-start justify-between">

          <div>

            <p className="text-sm text-slate-500">
              {title}
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {value}
            </h2>

          </div>

          <div
            className={`
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-2xl
            ${colors[color]}
            `}
          >
            {Icon && <Icon size={24} />}
          </div>

        </div>

        {(trend || trendLabel) && (
          <div className="mt-6 flex items-center gap-2">

            {trend > 0 ? (
              <ArrowUpRight
                size={16}
                className="text-green-500"
              />
            ) : (
              <ArrowDownRight
                size={16}
                className="text-red-500"
              />
            )}

            <span
              className={`text-sm font-semibold ${
                trend > 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {trend > 0 ? "+" : ""}
              {trend}%
            </span>

            <span className="text-sm text-slate-500">
              {trendLabel}
            </span>

          </div>
        )}

      </div>
    </Card>
  );
}