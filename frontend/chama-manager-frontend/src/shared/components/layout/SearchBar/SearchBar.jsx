import { Search } from "lucide-react";

export default function SearchBar() {
  return (
    <div className="relative hidden md:block">
      <Search
        size={18}
        className="
          absolute
          left-4
          top-1/2
          -translate-y-1/2
          text-slate-400
        "
      />

      <input
        type="text"
        placeholder="Search workspaces, members, transactions..."
        className="
          h-11
          w-80
          rounded-xl
          border
          border-slate-200
          bg-slate-50
          pl-11
          pr-4
          text-sm
          outline-none
          transition-all
          duration-200

          placeholder:text-slate-400

          focus:border-primary
          focus:bg-white
          focus:ring-4
          focus:ring-primary/10

          dark:border-slate-700
          dark:bg-slate-800
          dark:text-white
          dark:placeholder:text-slate-500
          dark:focus:border-primary
          dark:focus:bg-slate-900
        "
      />
    </div>
  );
}