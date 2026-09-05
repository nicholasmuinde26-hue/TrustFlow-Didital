import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  CircleDollarSign,
  ShieldAlert,
  Megaphone,
  Mail,
  MessageCircle,
  Info,
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  User,
  Calendar,
  FileText,
  CreditCard,
  Settings,
  Activity,
} from "lucide-react";
import {
  useUnreadNotifications,
  useNotificationCounts,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "@/modules/notifications/hooks/useNotifications";

function getTimeAgo(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getCategoryIcon(category) {
  switch (category) {
    case "financial":
      return <CircleDollarSign className="text-emerald-500" size={16} />;
    case "approval":
      return <ShieldAlert className="text-amber-500" size={16} />;
    case "governance":
      return <Megaphone className="text-violet-500" size={16} />;
    case "membership":
      return <User className="text-blue-500" size={16} />;
    case "system":
      return <Settings className="text-slate-500" size={16} />;
    case "alert":
      return <AlertTriangle className="text-red-500" size={16} />;
    case "burial":
      return <Sparkles className="text-purple-500" size={16} />;
    default:
      return <Info className="text-cyan-500" size={16} />;
  }
}

function getPriorityBadge(priority) {
  switch (priority) {
    case "urgent":
      return <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">URGENT</span>;
    case "high":
      return <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">HIGH</span>;
    case "normal":
      return null;
    case "low":
      return null;
    default:
      return null;
  }
}

export default function NotificationButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const popoverRef = useRef(null);
  const navigate = useNavigate();

  const { data: notifications, isLoading } = useUnreadNotifications({ limit: 20 });
  const { data: counts } = useNotificationCounts();

  const markReadMutation = useMarkNotificationAsRead();
  const markAllReadMutation = useMarkAllNotificationsAsRead();

  const notificationList = notifications || [];
  const unreadCount = counts?.unread || 0;

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  function handleNotificationClick(item) {
    if (item.state !== 'read') {
      markReadMutation.mutate(item._id);
    }
    setIsOpen(false);
    if (item.action_url) {
      navigate(item.action_url);
    }
  }

  function handleMarkAllRead() {
    markAllReadMutation.mutate();
  }

  const tabs = [
    { id: "all", label: "All" },
    { id: "financial", label: "Financial" },
    { id: "approval", label: "Approvals" },
    { id: "governance", label: "Governance" },
    { id: "membership", label: "Members" },
    { id: "system", label: "System" },
  ];

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Notifications"
        aria-label="Notifications"
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
          text-slate-600
          shadow-sm
          transition-all
          duration-200

          hover:scale-105
          hover:border-slate-300
          hover:bg-slate-100
          hover:text-slate-900

          dark:border-slate-800
          dark:bg-slate-900
          dark:text-slate-300
          dark:hover:border-slate-700
          dark:hover:bg-slate-800
          dark:hover:text-white
        "
      >
        <Bell size={19} />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white shadow-md animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Drawer */}
      {isOpen && (
        <div
          className="
            absolute
            right-0
            top-14
            z-50
            w-80
            sm:w-96
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-0
            shadow-2xl
            backdrop-blur-xl

            dark:border-slate-800
            dark:bg-slate-900
          "
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 overflow-x-auto scrollbar-none dark:border-slate-800/80 dark:bg-slate-950/40">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : notificationList.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No notifications</p>
                <p className="text-[11px] text-slate-400 mt-0.5">You're all caught up!</p>
              </div>
            ) : (
              notificationList.map((item) => (
                <div
                  key={item._id}
                  onClick={() => handleNotificationClick(item)}
                  className={`
                    group flex cursor-pointer items-start gap-3 p-3.5 transition-colors
                    ${
                      item.state === 'read'
                        ? "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60 opacity-80"
                        : "bg-violet-50/40 hover:bg-violet-50/80 dark:bg-violet-950/20 dark:hover:bg-violet-950/40"
                    }
                  `}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                    {item.icon || getCategoryIcon(item.category)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {getPriorityBadge(item.priority)}
                        <span className="text-[10px] font-medium text-slate-400">
                          {getTimeAgo(item.created_at)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                      {item.message}
                    </p>

                    {item.requires_action && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Action Required
                        </span>
                        {item.action_deadline && (
                          <span className="text-[9px] text-slate-400">
                            Due: {getTimeAgo(item.action_deadline)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {item.state === 'unread' && (
                    <span className="mt-2 h-2 w-2 rounded-full bg-violet-600 dark:bg-violet-400 shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer link */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-2.5 text-center dark:border-slate-800 dark:bg-slate-950/30">
            <button
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}