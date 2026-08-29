'use client';

import { StatCard } from '@/components/admin/StatCard';
import { Bot, MessageSquare, ShoppingBag, Box, Palette, LineChart } from 'lucide-react';
import { DataTable } from '@/components/admin/DataTable';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function AgentUsagePage() {
  const { data: agentStats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-agent-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/tasks/stats');
      return res.data.data.agents;
    }
  });

  const { data: failedTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['admin-failed-tasks'],
    queryFn: async () => {
      const res = await api.get('/admin/tasks', { params: { status: 'failed', limit: 10 } });
      return res.data.data;
    }
  });

  const getAgentStat = (type: string) => {
     return agentStats?.find((s: any) => s.agent_type === type);
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto pb-24 overflow-y-auto">
      <div>
        <h1 className="text-3xl font-heading font-bold dark:text-white text-gray-900 mb-2">Agent Performance</h1>
        <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700">Monitor utilization, success rates, and errors across the 5 specialized agents.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Front Desk', type: 'conversation', icon: MessageSquare, color: 'text-cyan-400' },
          { label: 'Ops Lead', type: 'order', icon: ShoppingBag, color: 'text-emerald-400' },
          { label: 'Inventory', type: 'inventory', icon: Box, color: 'text-violet-400' },
          { label: 'Creative', type: 'creative', icon: Palette, color: 'text-pink-400' },
          { label: 'Intelligence', type: 'intelligence', icon: LineChart, color: 'text-amber-400' }
        ].map((agent, i) => {
          const stat = getAgentStat(agent.type);
          return (
            <StatCard 
              key={agent.type}
              label={agent.label} 
              value={stat?.total_tasks ?? 0} 
              icon={agent.icon} 
              color={agent.color} 
              change={{value: `${stat?.success_rate?.toFixed(1) ?? 100}%`, isPositive: (stat?.success_rate ?? 100) > 90}} 
              delay={0.1 * i}
            />
          );
        })}
      </div>

      <div className="glass-card p-6 border border-danger/30">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-heading font-semibold text-danger flex items-center gap-2">
             Dead-Letter Queue (Failed Tasks)
          </h3>
          <button className="btn-secondary py-1.5 text-xs dark:text-white text-gray-900 dark:border-white/20 border-black/20">Bulk Retry All</button>
        </div>
        
        <DataTable 
          columns={[
            { header: 'Task ID', accessorKey: 'id', cell: (info: any) => <span className="font-mono text-[10px] uppercase">{info.getValue().substring(0, 8)}...</span> },
            { header: 'Agent', accessorKey: 'agent_type', cell: (info: any) => <span className="badge bg-white/10 uppercase text-[10px]">{info.getValue()}</span> },
            { header: 'Error Log', accessorKey: 'error_message', cell: (info: any) => <span className="text-danger/80 text-xs font-mono">{info.getValue() || 'Unknown Error'}</span> },
            { header: 'Time', accessorKey: 'created_at', cell: (info: any) => <span className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-xs">{new Date(info.getValue()).toLocaleString()}</span> },
            { header: '', id: 'actions', cell: () => <button className="text-primary-400 hover:dark:text-white hover:text-gray-900 text-xs">Retry Task</button> }
          ]} 
          data={failedTasks || []} 
          isLoading={tasksLoading}
        />
      </div>
    </div>
  );
}
