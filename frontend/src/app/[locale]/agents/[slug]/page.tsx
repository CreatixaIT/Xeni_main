'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ArrowLeft, Zap, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Link } from '@/i18n/routing';
import toast from 'react-hot-toast';

interface Task { task_id: string; status: string; agent_type: string; created_at: string; duration_ms?: number; error_message?: string; }

export default function AgentPage() {
  const t = useTranslations();
  const params = useParams();
  const slug = params.slug as string;
  const agentKey = slug.replace(/-/g, '_');

  const [payload, setPayload] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [running, setRunning] = useState(false);
  const [activeTask, setActiveTask] = useState<string | null>(null);

  useWebSocket((event) => {
    if (event.task_id === activeTask) {
      setRunning(false);
      setActiveTask(null);
      loadTasks();
    }
  });

  const loadTasks = useCallback(async () => {
    try {
      const res = await api.get(`/agents/${slug}/tasks`);
      setTasks(res.data.data || []);
    } catch {}
  }, [slug]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const runAgent = async () => {
    setRunning(true);
    try {
      const body = payload ? JSON.parse(payload) : {};
      const res = await api.post(`/agents/${slug}/run`, body);
      setActiveTask(res.data.data.task_id);
      toast.success(t('status.queued'));
      loadTasks();
    } catch (err: any) {
      setRunning(false);
      const error = err.response?.data?.error;
      if (error === 'upgrade_required') {
        toast.error(t('errors.upgrade_required'));
      } else {
        toast.error(error || t('errors.server_error'));
      }
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed': return <XCircle className="w-4 h-4 text-danger" />;
      case 'processing': return <Zap className="w-4 h-4 text-primary animate-pulse" />;
      default: return <Clock className="w-4 h-4 text-slate-600 dark:text-slate-600 dark:text-dark-700" />;
    }
  };

  return (
    <div className="min-h-screen bg-dark px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </Link>

        <h1 className="text-3xl font-heading font-bold dark:text-white text-gray-900 mb-2">{t(`agents.${agentKey}.name`)}</h1>
        <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-8">{t(`agents.${agentKey}.description`)}</p>

        {/* Input Form */}
        <div className="glass-card p-6 mb-8">
          <textarea value={payload} onChange={e => setPayload(e.target.value)} placeholder='{"url": "https://example.com"}' className="input-field min-h-[100px] font-mono text-sm mb-4" />
          <button onClick={runAgent} disabled={running} className="btn-primary flex items-center gap-2">
            {running ? (
              <><Zap className="w-4 h-4 animate-pulse" /> {t('status.processing')}</>
            ) : (
              <><Zap className="w-4 h-4" /> {t(`agents.${agentKey}.run_button`)}</>
            )}
          </button>
        </div>

        {/* Running Status */}
        <AnimatePresence>
          {running && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card p-6 mb-6 border-primary/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                <span className="dark:text-white text-gray-900 font-medium">{t('status.processing')}</span>
              </div>
              <div className="mt-3 space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="skeleton h-4 w-full" style={{ width: `${100 - i * 15}%` }} />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task History */}
        <h2 className="text-xl font-heading font-semibold dark:text-white text-gray-900 mb-4">History</h2>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-center py-8">{t('common.no_results')}</p>
          ) : tasks.map((task, i) => (
            <motion.div key={task.task_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcon(task.status)}
                <div>
                  <p className="dark:text-white text-gray-900 text-sm font-medium">{task.task_id.slice(0, 8)}...</p>
                  <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-xs">{new Date(task.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {task.duration_ms && <span className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-xs">{task.duration_ms}ms</span>}
                <span className={`badge ${task.status === 'completed' ? 'badge-success' : task.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>{t(`status.${task.status}`)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
