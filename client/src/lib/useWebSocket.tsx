import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

type AuthUser = {
  id: string;
  organizationId?: string | null;
};

const WebSocketContext = createContext<WebSocketContextValue>({
  socket: null,
  isConnected: false,
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
  });

  useEffect(() => {
    // Wait for user data to be available
    if (!user?.organizationId) {
      // Disconnect if user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Only create one socket connection
    if (socketRef.current) {
      // If socket exists but org changed, disconnect and reconnect
      if (socketRef.current.connected) {
        return;
      }
    }

    // Connect to WebSocket server with robust options
    const socket = io(undefined as any, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);

      // Join organization-specific room for multi-tenant isolation
      if (user.organizationId) {
        socket.emit('join:organization', user.organizationId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);

      if (reason === "io server disconnect") {
        // the disconnection was initiated by the server, you need to reconnect manually
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    // Global Event Handlers for Organization Data
    // These ensure data stays fresh across the app without manual refetching

    // Call Events - Direct cache updates for seamless UI (no loading flicker)
    socket.on('call:created', (newCall: any) => {
      if (newCall && newCall.id) {
        // Directly add the new call to the cache
        queryClient.setQueryData(['/api/calls'], (oldData: any[] | undefined) => {
          if (!oldData) return [newCall];
          // Prepend new call to the list (most recent first)
          // Avoid duplicates
          const exists = oldData.some((c: any) => c.id === newCall.id);
          if (exists) return oldData;
          return [newCall, ...oldData];
        });
        console.log('📞 [WebSocket] Call created, cache updated:', newCall.id);
      }
      // Still invalidate metrics as they need recalculation
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
    });

    socket.on('call:updated', (updatedCall: any) => {
      if (updatedCall && updatedCall.id) {
        // Directly update the call in the cache
        queryClient.setQueryData(['/api/calls'], (oldData: any[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((call: any) =>
            call.id === updatedCall.id ? { ...call, ...updatedCall } : call
          );
        });
        // Also update individual call cache if it exists
        queryClient.setQueryData([`/api/calls/${updatedCall.id}`], (oldData: any) => {
          if (!oldData) return updatedCall;
          return { ...oldData, ...updatedCall };
        });
        console.log('📞 [WebSocket] Call updated, cache updated:', updatedCall.id, updatedCall.status);
      }
      // Invalidate metrics for status changes (completed calls affect stats)
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
    });

    socket.on('call:deleted', (callId: string) => {
      if (callId) {
        // Remove the call from cache
        queryClient.setQueryData(['/api/calls'], (oldData: any[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter((call: any) => call.id !== callId);
        });
        // Remove individual call cache
        queryClient.removeQueries({ queryKey: [`/api/calls/${callId}`] });
        console.log('📞 [WebSocket] Call deleted, removed from cache:', callId);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
    });

    // Agent Events
    socket.on('agent:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
    });

    // Lead Events
    socket.on('lead:created', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
    });

    return () => {
      if (socket) {
        if (user.organizationId) {
          socket.emit('leave:organization', user.organizationId);
        }
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, queryClient]);

  return (
    <WebSocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook to access the shared WebSocket connection
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

// Hook for listening to specific events
export function useWebSocketEvent<T = any>(
  eventName: string,
  handler: (data: T) => void,
  dependency: any = null
) {
  const { socket, isConnected } = useWebSocket();
  // We use a ref to store the handler so we don't re-subscribe when handler function changes
  const handlerRef = useRef(handler);

  // Update handler ref when handler function changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const eventHandler = (data: T) => {
      if (handlerRef.current) {
        handlerRef.current(data);
      }
    };

    socket.on(eventName, eventHandler);

    return () => {
      socket.off(eventName, eventHandler);
    };
  }, [socket, isConnected, eventName, dependency]); // Re-subscribe if socket, connection, or optional dependency changes
}
