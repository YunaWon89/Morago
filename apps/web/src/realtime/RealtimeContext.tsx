import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "../lib/config";
import { useAuth } from "../auth/AuthContext";

const SocketContext = createContext<Socket | null>(null);

// One socket connection per logged-in user, shared by the whole app.
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token || !user) {
      setSocket(null);
      return;
    }
    const connection = io(API_URL || undefined, { auth: { token } });
    setSocket(connection);
    return () => {
      connection.disconnect();
      setSocket(null);
    };
    // The connection depends on who is logged in, not on every user object update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket(): Socket | null {
  return useContext(SocketContext);
}

// Subscribes to a server event for as long as the component is mounted.
// eslint-disable-next-line react-refresh/only-export-components
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const socket = useSocket();
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: T) => latest.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
