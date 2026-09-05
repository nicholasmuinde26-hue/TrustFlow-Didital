import React, { useState } from "react";
import { X, ChevronRight, Filter, Check, CheckCheck, Archive, ExternalLink } from "lucide-react";
import {
  useUnreadNotifications,
  useActionRequiredNotifications,
  useHighPriorityNotifications,
  useNotificationsByCategory,
  useNotificationCounts,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsArchived,
  useMarkActionCompleted,
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
      return "💰";
    case "approval":
      return "⚠️";
    case "governance":
      return "🏛️";
    case "membership":
      return "👤";
    case "system":
      return "⚙️";
    case "alert":
      return "🚨";
    case "burial":
      return "🪦";
    default:
      return "🔔";
  }
}

function getPriorityBadge(priority) {
  switch (priority) {
    case "urgent":
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">URGENT</span>;
    case "high":
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">HIGH</span>;
    case "normal":
      return null;
    case "low":
      return null;
    default:
      return null;
  }
}

export default function NotificationCenter() {
  const [activeTab, setActiveTab] = useState("unread");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: unreadNotifications, isLoading: unreadLoading } = useUnreadNotifications({ limit: 20 });
  const { data: actionNotifications, isLoading: actionLoading } = useActionRequiredNotifications({ limit: 10 });
  const { data: highPriorityNotifications, isLoading: highPriorityLoading } = useHighPriorityNotifications({ limit: 10 });
  const { data: categoryNotifications, isLoading: categoryLoading } = useNotificationsByCategory(selectedCategory, { limit: 20 });
  const { data: counts } = useNotificationCounts();

  const markReadMutation = useMarkNotificationAsRead();
  const markAllReadMutation = useMarkAllNotificationsAsRead();
  const markArchivedMutation = useMarkNotificationAsArchived();
  const markActionCompletedMutation = useMarkActionCompleted();

  const getNotifications = () => {
    switch (activeTab) {
      case "unread":
        return unreadNotifications || [];
      case "action-required":
        return actionNotifications || [];
      case "high-priority":
        return highPriorityNotifications || [];
      case "category":
        return categoryNotifications || [];
      default:
        return unreadNotifications || [];
    }
  };

  const isLoading = unreadLoading || actionLoading || highPriorityLoading || categoryLoading;

  const handleNotificationClick = (notification) => {
    if (notification.state !== 'read') {
      markReadMutation.mutate(notification._id);
    }
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  const handleArchive = (notificationId) => {
    markArchivedMutation.mutate(notificationId);
  };

  const handleActionCompleted = (notificationId, actionTaken) => {
    markActionCompletedMutation.mutate({ notificationId, actionTaken, metadata: {} });
  };

  const categories = [
    { id: "financial", label: "Financial", icon: "💰" },
    { id: "approval", label: "Approvals", icon: "⚠️" },
    { id: "governance", label: "Governance", icon: "🏛️" },
    { id: "membership", label: "Members", icon: "👤" },
    { id: "system", label: "System", icon: "⚙️" },
    { id: "alert", label: "Alerts", icon: "🚨" },
    { id: "burial", label: "Burial", icon: "🪦" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Notification Center</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Manage your notifications and stay updated with chama activities
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-black text-slate-900 dark:text-white">{counts?.unread || 0}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Unread</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-black text-slate-900 dark:text-white">{counts?.pending || 0}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Action Required</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-black text-slate-900 dark:text-white">{counts?.read || 0}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Read</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-black text-slate-900 dark:text-white">{counts?.archived || 0}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Archived</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => { setActiveTab("unread"); setSelectedCategory(null); }}
          className={`px-4 py-2 text-sm font-bold transition-all ${
            activeTab === "unread"
              ? "bg-violet-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Unread
        </button>
        <button
          onClick={() => { setActiveTab("action-required"); setSelectedCategory(null); }}
          className={`px-4 py-2 text-sm font-bold transition-all ${
            activeTab === "action-required"
              ? "bg-violet-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Action Required
        </button>
        <button
          onClick={() => { setActiveTab("high-priority"); setSelectedCategory(null); }}
          className={`px-4 py-2 text-sm font-bold transition-all ${
            activeTab === "high-priority"
              ? "bg-violet-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          High Priority
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Filter size={16} />
        </button>
      </div>

      {/* Category Filter */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                setActiveTab("category");
                setSelectedCategory(category.id);
                setShowFilters(false);
              }}
              className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-all ${
                selectedCategory === category.id
                  ? "bg-violet-600 text-white"
                  : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
              }`}
            >
              {category.icon} {category.label}
            </button>
          ))}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {activeTab === "unread" && "Unread Notifications"}
          {activeTab === "action-required" && "Action Required"}
          {activeTab === "high-priority" && "High Priority"}
          {activeTab === "category" && categories.find(c => c.id === selectedCategory)?.label}
        </h2>
        {counts?.unread > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading notifications...</div>
        ) : getNotifications().length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🔔</div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No notifications</p>
            <p className="text-xs text-slate-400 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {getNotifications().map((notification) => (
              <div
                key={notification._id}
                className={`p-4 transition-colors ${
                  notification.state === 'read'
                    ? "bg-white dark:bg-slate-800 opacity-70"
                    : "bg-violet-50/30 dark:bg-violet-950/20"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-2xl">
                    {notification.icon || getCategoryIcon(notification.category)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {notification.title}
                        </h3>
                        {getPriorityBadge(notification.priority)}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400">
                          {getTimeAgo(notification.created_at)}
                        </span>
                        <button
                          onClick={() => handleArchive(notification._id)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          title="Archive"
                        >
                          <Archive size={14} />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                      {notification.message}
                    </p>

                    {notification.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {notification.description}
                      </p>
                    )}

                    {/* Action Required */}
                    {notification.requires_action && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 text-[10px] font-bold rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Action Required
                        </span>
                        {notification.action_deadline && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            Due: {getTimeAgo(notification.action_deadline)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {notification.requires_action && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleActionCompleted(notification._id, 'approved')}
                          className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleActionCompleted(notification._id, 'rejected')}
                          className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Reject
                        </button>
                        {notification.action_url && (
                          <a
                            href={notification.action_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
                          >
                            View Details <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}