import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { matchPath } from "react-router-dom";
import toast, { useToasterStore } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

import useAuth from "@/app/hooks/useAuth";
import { useSocket } from "@/app/providers/SocketProvider";
import {
  useNotificationCounts,
  useUnreadNotifications,
  useNotificationPreferences,
} from "../hooks/useNotifications";
import notificationsApi from "../api/notifications.api";
import NotificationToast from "./NotificationToast";
import ActionRequiredModal from "./ActionRequiredModal";

/**
 * Turns notifications into on-screen popups, the way a production app does.
 *
 * Three sources feed it, all de-duplicated by notification id:
 *   1. Socket "notification:new"  - instant, from the server.
 *   2. Socket "toast:new"         - short confirmations from the server.
 *   3. Polling fallback           - the bell already polls every 10s; any
 *                                   unread item we have not shown yet is
 *                                   popped up. This keeps demos and flaky
 *                                   networks working even if the socket is
 *                                   down.
 *
 * Officials are handled differently. For the treasurer, chairperson and
 * secretary, anything that needs a decision or is urgent opens a blocking
 * "needs your attention" popup (ActionRequiredModal) instead of a toast that
 * can be missed. It points at the real page, reappears every 30 minutes
 * until the page has been opened, and stops once the badge is cleared.
 *
 * It also refreshes the bell instantly and puts the unread count in the
 * browser tab title, e.g. "(3) Chama Manager".
 *
 * Mounted once in App.jsx. It renders only the officials' attention popup.
 */

const MAX_VISIBLE = 3;
const FRESH_WINDOW_MS = 2 * 60 * 1000;

// "Remind me later" snoozes the popup for this long (per notification).
const NAG_MS = 30 * 60 * 1000;
const DISMISSED_KEY = "cm:attention-dismissed";

const OFFICIAL_ROLES = new Set(["treasurer", "chairperson", "secretary"]);

// Officials get the blocking popup for things they must decide (high priority
// and requires action) and for anything urgent. Routine reminders stay as
// ordinary toasts.
function needsAttention(notification) {
  if (!OFFICIAL_ROLES.has(notification?.recipient_role)) return false;
  if (notification.action_completed_at) return false;
  return (
    notification.priority === "urgent" ||
    (notification.requires_action && notification.priority === "high")
  );
}

function chamaIdOf(notification) {
  const chama = notification?.chama_id;
  return String(typeof chama === "object" ? chama?._id || "" : chama || "");
}

function readDismissed() {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDismissed(value) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable: the snooze simply will not survive a reload
  }
}

function durationFor(notification) {
  // Things that need a decision stay until dismissed.
  if (notification.priority === "urgent" || notification.requires_action) {
    return Infinity;
  }
  if (notification.priority === "high") return 10000;
  return 6000;
}

function notificationId(notification) {
  return String(notification?._id || notification?.id || "");
}

function isFresh(notification) {
  const stamp =
    notification.createdAt ||
    notification.created_at ||
    notification.event_timestamp;
  if (!stamp) return true;
  const age = Date.now() - new Date(stamp).getTime();
  return Number.isNaN(age) || age < FRESH_WINDOW_MS;
}

// This host is mounted above <RouterProvider> (see App.jsx), so router hooks such as
// useParams are not available here. Subscribe to the router object directly and read the
// chama id from the URL instead.
function useActiveWorkspaceId(router) {
  const pathname = useSyncExternalStore(
    (onChange) => (router ? router.subscribe(onChange) : () => {}),
    () => (router ? router.state.location.pathname : window.location.pathname),
    () => ""
  );
  const match = matchPath({ path: "/workspace/:workspaceId", end: false }, pathname);
  return match?.params?.workspaceId ? String(match.params.workspaceId) : "";
}

function useActivePathname(router) {
  return useSyncExternalStore(
    (onChange) => (router ? router.subscribe(onChange) : () => {}),
    () => (router ? router.state.location.pathname : window.location.pathname),
    () => ""
  );
}

function Inner({ onNavigate, router }) {
  const activeWorkspaceId = useActiveWorkspaceId(router);
  const activePathname = useActivePathname(router);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { data: notificationPreferences } = useNotificationPreferences();

  const seen = useRef(new Set());
  const seeded = useRef(false);
  const baseTitle = useRef(null);

  const userId = String(user?._id ?? user?.id ?? "");

  function toastEnabled(category = "system") {
    if (notificationPreferences?.default_channels?.toast === false) return false;
    return notificationPreferences?.category_preferences?.[category]?.toast !== false;
  }

  function show(notification) {
    const id = notificationId(notification);
    if (!id || seen.current.has(id)) return;
    seen.current.add(id);

    if (!toastEnabled(notification.category)) return;

    if (notification.state && notification.state !== "unread") return;

    // Officials' decisions and urgent items use the attention popup below.
    if (needsAttention(notification)) return;

    // Only ever pop up notifications addressed to this person.
    if (
      notification.recipient_user_id &&
      userId &&
      String(notification.recipient_user_id) !== userId
    ) {
      return;
    }

    // The chat page owns a conversation-aware toast while it is open. This
    // prevents the global notification toast from duplicating that message.
    const openChat = matchPath({ path: "/workspace/:workspaceId/chat", end: true }, activePathname);
    const notificationWorkspaceId = chamaIdOf(notification) ||
      notification.action_url?.match(/^\/workspace\/([^/?]+)\/chat/)?.[1];
    if (
      notification.notification_type === "CHAT_MESSAGE_RECEIVED" &&
      openChat?.params?.workspaceId &&
      notificationWorkspaceId === openChat.params.workspaceId
    ) {
      return;
    }

    toast.custom(
      (t) => (
        <NotificationToast
          t={t}
          notification={notification}
          onView={(n) => {
            if (n.action_url) onNavigate?.(n.action_url);
          }}
        />
      ),
      { id: `notification-${id}`, duration: durationFor(notification) }
    );
  }

  // 1 + 2: instant events from the server.
  useEffect(() => {
    if (!socket) return undefined;

    function onNew(notification) {
      show(notification);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }

    function onToast(payload) {
      if (!payload) return;
      if (payload.notification) {
        show(payload.notification);
        return;
      }
      if (!toastEnabled(payload.category)) return;
      const text = payload.title || payload.message;
      if (!text) return;
      toast(text, {
        icon: payload.icon || undefined,
        duration: payload.duration || 3500,
      });
    }

    function onCount(payload) {
      if (typeof payload?.unread !== "number") return;
      queryClient.setQueryData(["notifications", "counts"], (old) => ({
        ...(old || {}),
        unread: payload.unread,
      }));
    }

    socket.on("notification:new", onNew);
    socket.on("toast:new", onToast);
    socket.on("notification:count", onCount);

    return () => {
      socket.off("notification:new", onNew);
      socket.off("toast:new", onToast);
      socket.off("notification:count", onCount);
    };
    // `show` only reads refs and stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, queryClient, userId, notificationPreferences, activePathname]);

  // 3: polling fallback (same query key as the bell, so no extra requests).
  const { data: unread } = useUnreadNotifications({ limit: 20 });

  useEffect(() => {
    const list = Array.isArray(unread) ? unread : unread?.notifications;
    if (!Array.isArray(list)) return;

    // The first load only records what is already there; no popups for
    // old unread items when someone opens the app.
    if (!seeded.current) {
      list.forEach((n) => seen.current.add(notificationId(n)));
      seeded.current = true;
      return;
    }

    [...list]
      .reverse()
      .filter(isFresh)
      .forEach(show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  // Attention popup for officials. Driven straight from the unread list the
  // nav badges already use (same query key, no extra requests), so it also
  // catches items that were waiting before the person opened the app.
  const { data: unreadAll } = useUnreadNotifications({ limit: 100 });
  const [dismissed, setDismissed] = useState(readDismissed);
  const [tick, setTick] = useState(0);

  // Re-evaluate once a minute so a snoozed item comes back after NAG_MS.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const attentionItems = useMemo(() => {
    // The "needs your attention" popup belongs to a chama: only show it while the person is
    // inside that chama's workspace, and only for that chama's items. Not on login, the
    // workspace picker, or inside a different chama. Everything stays in the bell regardless.
    if (!activeWorkspaceId) return [];
    const list = Array.isArray(unreadAll) ? unreadAll : [];
    const now = Date.now();
    return list.filter((notification) => {
      if (!needsAttention(notification)) return false;
      if (chamaIdOf(notification) !== activeWorkspaceId) return false;
      if (
        notification.recipient_user_id &&
        userId &&
        String(notification.recipient_user_id) !== userId
      ) {
        return false;
      }
      const snoozedAt = dismissed[notificationId(notification)];
      return !(snoozedAt && now - snoozedAt < NAG_MS);
    });
    // `tick` is intentional: it re-runs this when a snooze expires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadAll, dismissed, tick, userId, activeWorkspaceId]);

  function snooze(notifications) {
    const now = Date.now();
    setDismissed((previous) => {
      const next = { ...previous };
      notifications.forEach((item) => {
        next[notificationId(item)] = now;
      });
      writeDismissed(next);
      return next;
    });
  }

  function reviewAttention(notification) {
    snooze([notification]);
    notificationsApi
      .markNotificationAsRead(notification._id)
      .catch(() => null)
      .finally(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));

    const chamaId = chamaIdOf(notification);
    onNavigate?.(
      notification.action_url ||
        (chamaId ? `/workspace/${chamaId}/notifications` : "/home")
    );
  }

  function openAllAttention() {
    const chamaId = chamaIdOf(attentionItems[0]);
    snooze(attentionItems);
    if (chamaId) onNavigate?.(`/workspace/${chamaId}/notifications`);
  }

  // Unread count in the tab title.
  const { data: counts } = useNotificationCounts();
  const unreadCount = counts?.unread || 0;

  useEffect(() => {
    if (baseTitle.current === null) {
      baseTitle.current = document.title.replace(/^\(\d+\)\s*/, "");
    }
    document.title =
      unreadCount > 0
        ? `(${unreadCount > 99 ? "99+" : unreadCount}) ${baseTitle.current}`
        : baseTitle.current;
  }, [unreadCount]);

  useEffect(
    () => () => {
      if (baseTitle.current !== null) document.title = baseTitle.current;
    },
    []
  );

  // Never let popups pile up: keep the newest few, dismiss the rest.
  const { toasts } = useToasterStore();
  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .slice(MAX_VISIBLE)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  return (
    <ActionRequiredModal
      items={attentionItems}
      onReview={reviewAttention}
      onLater={() => snooze(attentionItems)}
      onOpenAll={openAllAttention}
    />
  );
}

export default function RealtimeNotificationHost({ onNavigate, router }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return <Inner onNavigate={onNavigate} router={router} />;
}
