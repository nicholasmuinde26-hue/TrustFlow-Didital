import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io as ioClient } from "socket.io-client";

import useAuth from "@/app/hooks/useAuth";

const SocketContext = createContext(null);

/**
 * Real-time connection (Socket.IO).
 *
 * WHAT CHANGED (why notifications never popped up):
 *
 * 1. The old provider connected once, when the app first mounted -
 *    before anyone had logged in. The server's auth middleware rejected
 *    that handshake (no token), and Socket.IO does NOT automatically
 *    retry a handshake the server rejected. Nothing reconnected after
 *    login, so the socket stayed dead until a full page refresh.
 *    Now: connect when the user becomes authenticated, disconnect on
 *    logout.
 *
 * 2. `socket` is now React state (not just a ref), so components that
 *    subscribe to events re-run their effects when the socket appears.
 *
 * 3. If a handshake is rejected (e.g. the access token had just expired
 *    and the API interceptor is refreshing it), we retry a few times
 *    with backoff, reading the freshest token each attempt.
 */

const MAX_HANDSHAKE_RETRIES = 6;

function getSocketOrigin() {
  const apiUrl =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    "";

  if (!apiUrl) {
    // Same-origin deployments (API and frontend behind the same host/proxy).
    return undefined;
  }

  try {
    const url = new URL(apiUrl, window.location.origin);
    // Socket.IO is mounted at its own path ("/socket.io"), not under the
    // REST prefix, so only the origin matters here.
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

function getStoredToken() {
  return localStorage.getItem("accessToken");
}

export default function SocketProvider({ children }) {
  const { isAuthenticated } = useAuth();

  const socketRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);

  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState("disconnected");

  const socketOrigin = useMemo(() => getSocketOrigin(), []);

  const disconnect = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    retryCountRef.current = 0;

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setSocket(null);
    setStatus("disconnected");
  }, []);

  const connect = useCallback(() => {
    // Already have a live or in-flight socket.
    if (socketRef.current) return;

    // No token yet -> nothing to authenticate with.
    if (!getStoredToken()) return;

    setStatus("connecting");

    try {
      const next = ioClient(socketOrigin, {
        // Read fresh on every (re)connection attempt so a refreshed token
        // is picked up automatically.
        auth: (callback) => callback({ token: getStoredToken() }),
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        withCredentials: true,
      });

      socketRef.current = next;

      next.on("connect", () => {
        retryCountRef.current = 0;
        setStatus("connected");
      });

      next.on("disconnect", () => {
        if (socketRef.current !== next) return;
        setStatus("disconnected");
      });

      next.on("connect_error", (error) => {
        console.warn("[SocketProvider] Connection error:", error?.message);
        if (socketRef.current !== next) return;
        setStatus("error");

        // `active` is true while Socket.IO is still auto-reconnecting
        // (network errors). It is false after a rejected handshake,
        // which is the case we have to retry ourselves.
        if (next.active) return;
        if (retryCountRef.current >= MAX_HANDSHAKE_RETRIES) return;

        const delay = Math.min(30000, 2000 * 2 ** retryCountRef.current);
        retryCountRef.current += 1;

        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          if (socketRef.current === next) next.connect();
        }, delay);
      });

      // Every server event is also re-broadcast on window, so any part of
      // the app can listen without holding a socket reference.
      next.onAny((event, payload) => {
        window.dispatchEvent(
          new CustomEvent("chamamanager:socket-message", {
            detail: { event, payload },
          })
        );
      });

      setSocket(next);
    } catch (error) {
      console.error("[SocketProvider] Connection failed:", error);
      setStatus("error");
    }
  }, [socketOrigin]);

  const send = useCallback((event, payload) => {
    const current = socketRef.current;
    if (!current || !current.connected) return false;
    try {
      current.emit(event, payload);
      return true;
    } catch (error) {
      console.error("[SocketProvider] Send failed:", error);
      return false;
    }
  }, []);

  // Follow the login state.
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
  }, [isAuthenticated, connect, disconnect]);

  // Clean up on unmount.
  useEffect(() => disconnect, [disconnect]);

  const value = useMemo(
    () => ({
      socket,
      status,
      connected: status === "connected",
      connecting: status === "connecting",
      unavailable: !socketOrigin && status === "error",
      connect,
      disconnect,
      send,
    }),
    [socket, status, socketOrigin, connect, disconnect, send]
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used inside a SocketProvider");
  }

  return context;
}

export { SocketContext };
