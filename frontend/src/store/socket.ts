import { create } from 'zustand';
import { useAuthStore } from './auth';

export type SocketEvent =
  | 'new_message'
  | 'message_replied'
  | 'order_created'
  | 'order_updated'
  | 'stock_alert'
  | 'task_completed'
  | 'task_failed'
  | 'escalation_needed'
  | 'subscription_updated'
  | 'admin.activity';

interface WSPayload {
  event: SocketEvent;
  payload: any;
  task_id?: string;
}

interface SocketState {
  ws: WebSocket | null;
  isConnected: boolean;
  lastEvent: { event: SocketEvent; payload: unknown; timestamp: number } | null;
  handlers: Map<string, Set<(payload: any) => void>>;
  connect: () => void;
  disconnect: () => void;
  on: (event: SocketEvent, handler: (payload: unknown) => void) => void;
  off: (event: SocketEvent, handler: (payload: unknown) => void) => void;
}

const getWsUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (envUrl) return envUrl;
  
  // Fallback / Detection
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // If we're on the production domain, use the /ws endpoint on the same host
    if (host.includes('xentroinfotech.com')) {
      return `${protocol}//${host}/ws`;
    }
  }
  return 'ws://localhost:8080/ws';
};

export const useSocketStore = create<SocketState>()((set, get) => ({
  ws: null,
  isConnected: false,
  lastEvent: null,
  handlers: new Map(),

  connect: () => {
    const existing = get().ws;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;

    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return;

    const url = getWsUrl();
    console.log(`[WS] Connecting to ${url}...`);
    
    const ws = new WebSocket(`${url}?token=${accessToken}`);

    ws.onopen = () => {
      console.log('[WS] Connected successfully');
      set({ isConnected: true });
    };

    ws.onmessage = (event) => {
      try {
        const data: WSPayload = JSON.parse(event.data);
        const { event: eventName, payload } = data;
        
        // Update last event
        set({ lastEvent: { event: eventName, payload, timestamp: Date.now() } });

        // Trigger handlers
        const handlers = get().handlers.get(eventName);
        if (handlers) {
          handlers.forEach(handler => handler(payload));
        }
      } catch (e) {
        console.error('[WS] Message parse error:', e);
      }
    };

    ws.onclose = (e) => {
      set({ isConnected: false, ws: null });
      if (e.code !== 1000) { // Not normal closure
        console.log('[WS] Connection lost, reconnecting in 3s...');
        setTimeout(() => get().connect(), 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] WebSocket Error:', err);
    };

    set({ ws });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close(1000); // Normal closure
      set({ ws: null, isConnected: false });
    }
  },

  on: (event, handler) => {
    const handlers = get().handlers;
    if (!handlers.has(event)) {
      handlers.set(event, new Set());
    }
    handlers.get(event)?.add(handler);
  },

  off: (event, handler) => {
    const handlers = get().handlers;
    handlers.get(event)?.delete(handler);
  },
}));
