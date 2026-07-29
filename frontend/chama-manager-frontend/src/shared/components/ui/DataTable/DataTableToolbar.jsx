import { Search } from "lucide-react";

export default function DataTableToolbar({
  placeholder,
  actions,
}) {
  return (
    <div
      className="
      flex
      items-center
      justify-between
      p-6
      "
    >
      <div className="relative">

        <Search
          size={18}
          className="
            absolute
            left-3
            top-1/2
            -translate-y-1/2
            text-slate-400
          "
        />

        <input
          placeholder={placeholder}
          className="
            h-11
            w-72
            rounded-xl
            border
            pl-10
            pr-4
          "
        />

      </div>

      {actions}

    </div>
  );
}