import { Bell } from "lucide-react";

export default function NotificationButton() {
  const unreadCount = 3;

  return (
    <button
      className="
      relative
      flex
      h-11
      w-11
      items-center
      justify-center
      rounded-xl
      border
      border-slate-200
      bg-white
      transition-all
      duration-200

      hover:scale-105
      hover:bg-slate-100

      dark:border-slate-700
      dark:bg-slate-800
      dark:hover:bg-slate-700
      "
    >
      <Bell
        size={20}
        className="text-slate-600 dark:text-slate-300"
      />

      {unreadCount > 0 && (
        <span
          className="
          absolute
          -right-1
          -top-1
          flex
          h-5
          min-w-[20px]
          items-center
          justify-center
          rounded-full
          bg-red-500
          px-1
          text-[10px]
          font-bold
          text-white
          "
        >
          {unreadCount}
        </span>
      )}
    </button>
  );
}