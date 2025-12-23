import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "/";

export function useSocket(organizationId) {
  const socketRef = useRef(null);
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;
    if (organizationId) {
      socket.emit("join:organization", organizationId);
    }
    return () => {
      if (organizationId) {
        socket.emit("leave:organization", organizationId);
      }
      socket.disconnect();
    };
  }, [organizationId]);
  return socketRef.current;
}

export function useSocketEvent(event, handler, organizationId) {
  const socket = useSocket(organizationId);
  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [event, handler, socket]);
}
