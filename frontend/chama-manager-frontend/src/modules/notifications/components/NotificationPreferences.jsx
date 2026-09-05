import React, { useState } from "react";
import { Save, Bell, Smartphone, Mail, Clock, Moon, Sun, X, Check, ChevronRight } from "lucide-react";
import {
  useNotificationPreferences,
  useUpdateDefaultChannelPreferences,
  useUpdateCategoryPreferences,
  useUpdateQuietHours,
  useUpdateDoNotDisturb,
  useUpdateMobileSettings,
  useUpdateEmailSettings,
  useUpdateSMSSettings,
  useResetPreferencesToDefaults,
} from "@/modules/notifications/hooks/useNotifications";

export default function NotificationPreferences() {
  const { data: preferences, isLoading } = useNotificationPreferences();

  const updateChannelMutation = useUpdateDefaultChannelPreferences();
  const updateCategoryMutation = useUpdateCategoryPreferences();
  const updateQuietHoursMutation = useUpdateQuietHours();
  const updateDoNotDisturbMutation = useUpdateDoNotDisturb();
  const updateMobileMutation = useUpdateMobileSettings();
  const updateEmailMutation = useUpdateEmailSettings();
  const updateSMSMutation = useUpdateSMSSettings();
  const resetMutation = useResetPreferencesToDefaults();

  const [expandedSection, setExpandedSection] = useState("channels");

  const handleToggleChannel = (channel) => {
    updateChannelMutation.mutate({
      [channel]: !preferences?.default_channels?.[channel]
    });
  };

  const handleToggleCategoryChannel = (category, channel) => {
    updateCategoryMutation.mutate({
      category,
      categoryPreferences: {
        [channel]: !preferences?.category_preferences?.[category]?.[channel]
      }
    });
  };

  const handleToggleQuietHours = () => {
    updateQuietHoursMutation.mutate({
      enabled: !preferences?.quiet_hours?.enabled,
      start_time: preferences?.quiet_hours?.start_time || "22:00",
      end_time: preferences?.quiet_hours?.end_time || "08:00"
    });
  };

  const handleToggleDoNotDisturb = () => {
    updateDoNotDisturbMutation.mutate({
      enabled: !preferences?.do_not_disturb?.enabled,
      until: null
    });
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all preferences to defaults?")) {
      resetMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-slate-400">Loading preferences...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Notification Preferences</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Customize how you receive notifications
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          <Save size={16} />
          Reset to Defaults
        </button>
      </div>

      {/* Default Channels */}
      <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === "channels" ? null : "channels")}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-slate-600 dark:text-slate-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Default Channels</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Default notification delivery methods</p>
            </div>
          </div>
          {expandedSection === "channels" ? <X size={16} /> : <ChevronRight size={16} />}
        </button>

        {expandedSection === "channels" && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
            {[
              { id: "in_app", label: "In-App", icon: "📱" },
              { id: "toast", label: "Toast", icon: "🔔" },
              { id: "push", label: "Push", icon: "📲" },
              { id: "sms", label: "SMS", icon: "💬" },
              { id: "email", label: "Email", icon: "📧" },
            ].map((channel) => (
              <div key={channel.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{channel.icon}</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{channel.label}</span>
                </div>
                <button
                  onClick={() => handleToggleChannel(channel.id)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    preferences?.default_channels?.[channel.id]
                      ? "bg-violet-600"
                      : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      preferences?.default_channels?.[channel.id] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Preferences */}
      <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === "categories" ? null : "categories")}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📂</span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Category Preferences</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Customize notifications by category</p>
            </div>
          </div>
          {expandedSection === "categories" ? <X size={16} /> : <ChevronRight size={16} />}
        </button>

        {expandedSection === "categories" && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
            {[
              { id: "financial", label: "Financial", icon: "💰" },
              { id: "membership", label: "Membership", icon: "👤" },
              { id: "governance", label: "Governance", icon: "🏛️" },
              { id: "burial", label: "Burial", icon: "🪦" },
              { id: "system", icon: "⚙️" },
              { id: "approval", icon: "⚠️" },
              { id: "alert", icon: "🚨" },
            ].map((category) => (
              <div key={category.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{category.icon}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{category.label}</span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {["in_app", "toast", "push", "sms", "email"].map((channel) => (
                    <div key={channel} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">{channel}</span>
                      <button
                        onClick={() => handleToggleCategoryChannel(category.id, channel)}
                        className={`w-10 h-5 rounded-full transition-colors ${
                          preferences?.category_preferences?.[category.id]?.[channel]
                            ? "bg-violet-600"
                            : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            preferences?.category_preferences?.[category.id]?.[channel]
                              ? "translate-x-5"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quiet Hours */}
      <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === "quiet" ? null : "quiet")}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-slate-600 dark:text-slate-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Quiet Hours</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Silence notifications during specific times</p>
            </div>
          </div>
          {expandedSection === "quiet" ? <X size={16} /> : <ChevronRight size={16} />}
        </button>

        {expandedSection === "quiet" && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700 dark:text-slate-300">Enable Quiet Hours</span>
            <button
              onClick={handleToggleQuietHours}
              className={`w-12 h-6 rounded-full transition-colors ${
                preferences?.quiet_hours?.enabled
                  ? "bg-violet-600"
                  : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  preferences?.quiet_hours?.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {preferences?.quiet_hours?.enabled && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                <input
                  type="time"
                  defaultValue={preferences?.quiet_hours?.start_time || "22:00"}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                <input
                  type="time"
                  defaultValue={preferences?.quiet_hours?.end_time || "08:00"}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Do Not Disturb */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === "dnd" ? null : "dnd")}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <div className="flex items-center gap-3">
            <Moon size={20} className="text-slate-600 dark:text-slate-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Do Not Disturb</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Temporarily silence all notifications</p>
            </div>
          </div>
          {expandedSection === "dnd" ? <X size={16} /> : <ChevronRight size={16} />}
        </button>

        {expandedSection === "dnd" && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-700 dark:text-slate-300">Enable Do Not Disturb</span>
            <button
              onClick={handleToggleDoNotDisturb}
              className={`w-12 h-6 rounded-full transition-colors ${
                preferences?.do_not_disturb?.enabled
                  ? "bg-violet-600"
                  : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  preferences?.do_not_disturb?.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {preferences?.do_not_disturb?.enabled && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Do Not Disturb is enabled. Notifications will be silenced until disabled.
            </p>
          )}
        </div>
      )}
    </div>
  );
}