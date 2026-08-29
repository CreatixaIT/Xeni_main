'use client';

import { useEffect } from 'react';
import { useSocketStore, SocketEvent } from '@/store/socket';

/**
 * Custom hook to subscribe to Xeni WebSocket events.
 * @param event The event to listen for.
 * @param handler Callback function when the event is received.
 */
export function useXeniSocket<T = any>(event: SocketEvent, handler: (payload: T) => void) {
  const { on, off, connect, isConnected } = useSocketStore();

  useEffect(() => {
    // Ensure socket is connected
    if (!isConnected) {
      connect();
    }

    on(event, handler as (payload: unknown) => void);

    return () => {
      off(event, handler as (payload: unknown) => void);
    };
  }, [event, handler, isConnected, connect, on, off]);
}
