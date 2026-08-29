
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const SocketContext = createContext(null);

function getSocketUrl() {
  const apiUrl =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    "";

  if (!apiUrl) {
    return null;
  }

  try {
    const url = new URL(apiUrl);

    // Convert HTTP API URL to WebSocket URL.
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

    // Remove /api/v1 or similar API path.
    url.pathname = "";

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export default function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(false);

  const [status, setStatus] = useState("disconnected");

  const socketUrl = useMemo(() => getSocketUrl(), []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setStatus("disconnected");
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    if (!socketUrl) {
      setStatus("unavailable");
      return;
    }

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setStatus("connecting");

    try {
      const socket = new WebSocket(socketUrl);

      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setStatus("connected");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          window.dispatchEvent(
            new CustomEvent("chamamanager:socket-message", {
              detail: data,
            })
          );
        } catch {
          window.dispatchEvent(
            new CustomEvent("chamamanager:socket-message", {
              detail: event.data,
            })
          );
        }
      };

      socket.onerror = () => {
        setStatus("error");
      };

      socket.onclose = () => {
        socketRef.current = null;

        if (!mountedRef.current) {
          setStatus("disconnected");
          return;
        }

        setStatus("disconnected");

        const attempt = reconnectAttemptsRef.current;
        const delay = Math.min(1000 * 2 ** attempt, 30000);

        reconnectAttemptsRef.current += 1;

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (error) {
      console.error("[SocketProvider] Connection failed:", error);
      setStatus("error");
    }
  }, [socketUrl]);

  const send = useCallback((message) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      socket.send(
        typeof message === "string"
          ? message
          : JSON.stringify(message)
      );

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

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const value = useMemo(
    () => ({
      socket: socketRef.current,
      status,
      connected: status === "connected",
      connecting: status === "connecting",
      unavailable: status === "unavailable",
      connect,
      disconnect,
      send,
    }),
    [status, connect, disconnect, send]
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
