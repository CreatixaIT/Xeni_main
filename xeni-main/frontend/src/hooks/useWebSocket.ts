import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

interface WSEvent {
  event: string;
  task_id?: string;
  payload: Record<string, any>;
}

export function useWebSocket(onEvent?: (event: WSEvent) => void) {
  const socketRef = useRef<WebSocket | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();

  const connect = useCallback(() => {
    if (!accessToken || !isAuthenticated) return;

    const ws = new WebSocket(`${WS_URL}?token=${accessToken}`);

    ws.onopen = () => console.log('[WS] Connected');

    ws.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data);

        if (data.event === 'task.completed') {
          toast.success(data.payload?.summary || 'Task completed!');
        } else if (data.event === 'task.failed') {
          toast.error('Task failed. Please try again.');
        } else if (data.event === 'subscription.updated') {
          toast.success('Subscription updated!');
        }

        onEvent?.(data);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 3s...');
      setTimeout(connect, 3000);
    };

    ws.onerror = (err) => console.error('[WS] Error:', err);

    socketRef.current = ws;
  }, [accessToken, isAuthenticated, onEvent]);

  useEffect(() => {
    connect();
    return () => { socketRef.current?.close(); };
  }, [connect]);

  return socketRef;
}
