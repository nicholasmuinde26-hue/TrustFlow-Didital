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

const SocketContext = createContext(null);

/**
 * The backend runs a real Socket.IO server (see
 * modules/realtime/socketServer.js on the backend - `new Server(server, ...)`
 * from the "socket.io" package). Socket.IO is NOT plain WebSocket: it has
 * its own handshake/framing (Engine.IO) on top of it, plus auth, rooms,
 * automatic reconnection with backoff, etc.
 *
 * This provider previously opened a raw browser `WebSocket` directly to
 * the API host. That connection could never actually complete a Socket.IO
 * handshake, and the object it exposed had no `.on()`/`.off()` - so every
 * consumer that expected a socket.io-client instance (see
 * shared/hooks/useStkPushFlow.js) silently detected "no on/off" and fell
 * straight back to HTTP polling. Nothing was actually broken loudly; the
 * app just never got any real-time event, ever, from any STK push,
 * notification, or chat feature that depends on this provider.
 */

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
    // Socket.IO is mounted on the same HTTP server as the REST API, at its
    // own default path ("/socket.io"), not under "/api/v1" or whatever
    // path prefix the REST API uses - so only the origin (protocol + host
    // + port) is relevant here. socket.io-client handles the ws(s)://
    // upgrade itself; it wants an http(s):// origin, not ws(s)://.
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

function getStoredToken() {
  return (
    localStorage.getItem("accessToken") ||
    localStorage.getItem("access_token") ||
    null
  );
}

export default function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const mountedRef = useRef(false);

  const [status, setStatus] = useState("disconnected");

  const socketOrigin = useMemo(() => getSocketOrigin(), []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    if (socketRef.current?.connected) {
      return;
    }

    setStatus("connecting");

    try {
      const socket = ioClient(socketOrigin, {
        // Reads the token fresh on every (re)connection attempt, so a
        // login that happens after this provider first mounts - or a
        // token refresh - is picked up on the next reconnect without
        // needing to tear down and recreate the whole provider.
        auth: (callback) => callback({ token: getStoredToken() }),
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        withCredentials: true,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setStatus("connected");
      });

      socket.on("disconnect", () => {
        if (!mountedRef.current) return;
        setStatus("disconnected");
      });

      socket.on("connect_error", (error) => {
        console.warn("[SocketProvider] Connection error:", error?.message);
        setStatus("error");
      });

      socket.onAny((event, payload) => {
        window.dispatchEvent(
          new CustomEvent("chamamanager:socket-message", {
            detail: { event, payload },
          })
        );
      });
    } catch (error) {
      console.error("[SocketProvider] Connection failed:", error);
      setStatus("error");
    }
  }, [socketOrigin]);

  const send = useCallback((event, payload) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      return false;
    }
    try {
      socket.emit(event, payload);
      return true;
    } catch (error) {
      console.error("[SocketProvider] Send failed:", error);
      return false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    connect();

    return () => {
      mountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  const value = useMemo(
    () => ({
      socket: socketRef.current,
      status,
      connected: status === "connected",
      connecting: status === "connecting",
      unavailable: !socketOrigin && status === "error",
      connect,
      disconnect,
      send,
    }),
    [status, socketOrigin, connect, disconnect, send]
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
    throw new Error(
      "useSocket must be used inside a SocketProvider"
    );
  }

  return context;
}

export { SocketContext };
