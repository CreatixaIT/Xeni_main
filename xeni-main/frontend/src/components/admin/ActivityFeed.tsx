'use client';

import { useSocketStore } from '@/store/socket';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, UserPlus, CreditCard, Bot, AlertCircle, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

interface FeedItem {
  id: string;
  message: string;
  timestamp: number;
  type: 'user' | 'payment' | 'agent' | 'system' | 'escalation';
}

const ACTION_LABELS: Record<string, string> = {
  'user.created': 'New user registered',
  'user.status_changed': 'User status changed',
  'user.role_changed': 'User role updated',
  'user.deleted': 'User deleted',
  'payment.created': 'Payment initiated',
  'payment.success': 'Payment succeeded',
  'plan.updated': 'Plan updated',
  'admin.login': 'Admin logged in',
};

function actionToMessage(action: string, userName: string, resource?: string): string {
  const label = ACTION_LABELS[action] || action.replace(/_/g, ' ');
  return `${label}${userName !== 'System' ? ` by ${userName}` : ''}${resource ? ` (${resource})` : ''}`;
}

export function ActivityFeed() {
  const { lastEvent, isConnected } = useSocketStore();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await api.get('/admin/activity?limit=20');
      const items = (res.data.data || []).map((item: any) => ({
        id: item.id,
        message: actionToMessage(item.action, item.user_name, item.resource),
        timestamp: new Date(item.created_at).getTime(),
        type: item.type as FeedItem['type'],
      }));
      setFeed(items);
    } catch (err) {
      console.error('Failed to fetch activity', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + poll every 15s
  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 15000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  // Real-time WebSocket events
  useEffect(() => {
    if (lastEvent && lastEvent.event === 'admin.activity') {
      const payload = lastEvent.payload as any;
      setFeed(prev => [{
        id: Math.random().toString(),
        message: payload?.message || 'Unknown activity',
        timestamp: lastEvent.timestamp,
        type: payload?.type || 'system'
      }, ...prev].slice(0, 20));
    }
  }, [lastEvent]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'user': return <UserPlus className="w-4 h-4 text-cyan-400" />;
      case 'payment': return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'agent': return <Bot className="w-4 h-4 text-primary-400" />;
      case 'escalation': return <AlertCircle className="w-4 h-4 text-danger" />;
      default: return <Activity className="w-4 h-4 text-slate-600 dark:text-dark-600" />;
    }
  };

  const getDotColor = (type: string) => {
    switch (type) {
      case 'user': return 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]';
      case 'payment': return 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
      case 'agent': return 'bg-primary-400 shadow-[0_0_8px_rgba(139,79,255,0.5)]';
      case 'escalation': return 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.5)]';
      default: return 'bg-dark-400';
    }
  };

  return (
    <div className="glass-card flex flex-col h-full max-h-[400px]">
      <div className="px-6 py-4 border-b dark:border-white/5 border-black/5 flex items-center justify-between">
        <h3 className="font-heading font-semibold dark:text-white text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Live Activity
        </h3>
        <div className="flex items-center gap-3">
          <button onClick={fetchActivity} className="text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">WS {isConnected ? 'live' : 'polling'}</span>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          [1,2,3,4].map(i => <div key={i} className="skeleton h-10 w-full rounded-xl" />)
        ) : feed.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm">
            No recent activity found.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {feed.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                className="flex items-start gap-4"
              >
                <div className="relative mt-1">
                  <div className={`w-2 h-2 rounded-full ${getDotColor(item.type)}`} />
                  <div className="absolute top-4 left-[3px] w-[2px] h-[30px] dark:bg-white/5 bg-black/5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-dark-300 group-hover:dark:text-white hover:text-gray-900 transition-colors">
                    {item.message}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 mt-1">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

