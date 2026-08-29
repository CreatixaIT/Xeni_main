'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard } from '@/components/admin/StatCard';
import { RevenueChart } from '@/components/admin/charts/RevenueChart';
import { UserGrowthChart } from '@/components/admin/charts/UserGrowthChart';
import { ConversationMetricsChart } from '@/components/admin/charts/ConversationMetricsChart';
import { ActivityFeed } from '@/components/admin/ActivityFeed';
import { Users, DollarSign, CreditCard, Zap, PieChart } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip as PieTooltip } from 'recharts';
import { Link } from '@/i18n/routing';

const MOCK_REVENUE_DATA = [
  { month: 'Jan', Starter: 40000, Professional: 24000, Premium: 24000 },
  { month: 'Feb', Starter: 30000, Professional: 13980, Premium: 22100 },
  { month: 'Mar', Starter: 20000, Professional: 98000, Premium: 22900 },
  { month: 'Apr', Starter: 27800, Professional: 39080, Premium: 20000 },
  { month: 'May', Starter: 18900, Professional: 48000, Premium: 21810 },
  { month: 'Jun', Starter: 23900, Professional: 38000, Premium: 25000 },
  { month: 'Jul', Starter: 34900, Professional: 43000, Premium: 21000 },
];

const MOCK_GROWTH_DATA = [
  { month: 'Jan', users: 100 }, { month: 'Feb', users: 150 }, { month: 'Mar', users: 280 },
  { month: 'Apr', users: 450 }, { month: 'May', users: 800 }, { month: 'Jun', users: 1200 },
];

const MOCK_PLAN_DISTRIBUTION = [
  { name: 'Starter', value: 400, color: '#06B6D4' },
  { name: 'Professional', value: 300, color: '#7C3AED' },
  { name: 'Premium', value: 300, color: '#10B981' },
];

export default function AdminOverview() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const res = await api.get('/admin/overview');
      return res.data.data;
    }
  });

  const metrics = overview?.stats;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto pb-24">
      <div>
        <h1 className="text-3xl font-heading font-bold dark:text-white text-gray-900 mb-2">Overview Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700">Platform analytics and real-time performance metrics.</p>
      </div>

      {/* Top Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 ml:grid-cols-4 gap-6">
        <StatCard 
          label="Total Users" 
          value={(metrics?.totalUsers ?? 0).toLocaleString()} 
          icon={Users} color="text-cyan-400"
          change={{ value: `${metrics?.userChange ?? 0}%`, isPositive: (metrics?.userChange ?? 0) >= 0 }}
          delay={0.1}
        />
        <StatCard 
          label="Monthly Revenue" 
          value={`৳${(metrics?.monthlyRevenue ?? 0).toLocaleString()}`} 
          icon={DollarSign} color="text-emerald-400"
          change={{ value: `${metrics?.revenueChange ?? 0}%`, isPositive: (metrics?.revenueChange ?? 0) >= 0 }}
          delay={0.2}
        />
        <StatCard 
          label="Active Subscriptions" 
          value={(metrics?.activeSubscriptions ?? 0).toLocaleString()} 
          icon={CreditCard} color="text-primary-400"
          change={{ value: `${Math.abs(metrics?.subChange ?? 0)}%`, isPositive: (metrics?.subChange ?? 0) >= 0 }}
          delay={0.3}
        />
        <StatCard 
          label="AI Tasks Today" 
          value={(metrics?.tasksToday ?? 0).toLocaleString()} 
          icon={Zap} color="text-amber-400"
          change={{ value: `${metrics?.taskChange ?? 0}%`, isPositive: (metrics?.taskChange ?? 0) >= 0 }}
          delay={0.4}
        />
      </div>

      {/* Primary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="text-lg font-heading font-semibold dark:text-white text-gray-900 mb-6">Revenue Over Time</h3>
          <RevenueChart data={overview?.revenue_chart || []} />
        </div>
        <div className="glass-card p-6">
          <h3 className="text-lg font-heading font-semibold dark:text-white text-gray-900 mb-6">User Growth</h3>
          <UserGrowthChart data={overview?.user_growth_chart || []} />
        </div>
      </div>

      {/* Analytics Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="glass-card p-6 lg:col-span-1">
          <h3 className="text-lg font-heading font-semibold dark:text-white text-gray-900 mb-6">Global AI Messages</h3>
          <ConversationMetricsChart 
            aiMessages={metrics?.totalAIMessages || 0} 
            humanMessages={metrics?.totalHumanMessages || 0} 
          />
        </div>
        <div className="glass-card p-6 lg:col-span-2 bg-gradient-to-br from-primary/10 to-transparent flex flex-col justify-center">
            <h2 className="text-2xl font-black dark:text-white text-gray-900 mb-4">AI Escalation Alert</h2>
            <p className="text-dark-300 mb-6 max-w-lg">
                Currently, <span className="dark:text-white text-gray-900 font-bold">{metrics?.escalationRate?.toFixed(1) || 0}%</span> of conversations are escalated to humans across the platform. A high rate indicates that the AI prompts need refinement or shop catalogs are incomplete.
            </p>
            <div className="flex items-center gap-6">
                <div className="p-4 dark:bg-white/5 bg-black/5 rounded-xl border dark:border-white/10 border-black/10">
                    <div className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase font-bold mb-1">Total Auto-Replied</div>
                    <div className="text-xl font-black text-primary-400">{metrics?.totalAIMessages?.toLocaleString() || 0}</div>
                </div>
                <div className="p-4 bg-danger/10 rounded-xl border border-danger/20">
                    <div className="text-xs text-danger uppercase font-bold mb-1">Human Fallback</div>
                    <div className="text-xl font-black text-danger">{metrics?.totalHumanMessages?.toLocaleString() || 0}</div>
                </div>
            </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Plan Distribution */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-heading font-semibold dark:text-white text-gray-900 mb-6 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" /> Plan Distribution
          </h3>
          <div className="h-[250px] relative">
            {!mounted ? (
              <div className="w-full h-full dark:bg-white/5 bg-black/5 animate-pulse rounded-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie 
                    data={overview?.plan_distribution || []} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    paddingAngle={5}
                  >
                    {(overview?.plan_distribution || []).map((entry: any, index: number) => {
                      const COLORS = ['#06B6D4', '#7C3AED', '#10B981', '#F59E0B', '#EF4444'];
                      return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.1)" />;
                    })}
                  </Pie>
                  <PieTooltip contentStyle={{ backgroundColor: '#0f0f23', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                </RechartsPie>
              </ResponsiveContainer>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700">Total Active</span>
              <span className="text-xl font-bold dark:text-white text-gray-900">{overview?.plan_distribution?.reduce((acc: number, curr: any) => acc + (curr.value || curr.count || 0), 0) || '0'}</span>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-4 flex-wrap">
            {(overview?.plan_distribution || []).map((plan: any, index: number) => {
              const COLORS = ['#06B6D4', '#7C3AED', '#10B981', '#F59E0B', '#EF4444'];
              return (
                <div key={plan.name || plan.plan} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  {plan.name || plan.plan} ({plan.value || plan.count || 0})
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Users */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-heading font-semibold dark:text-white text-gray-900 mb-6">Top Active Users</h3>
          <div className="space-y-4">
            {isLoading ? (
              [1,2,3,4].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" />)
            ) : overview?.top_users?.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl hover:dark:bg-white/5 hover:bg-black/5 transition-colors group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 font-bold border border-cyan-500/20 group-hover:border-cyan-500/50 transition-colors">
                    {u.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium dark:text-white text-gray-900 group-hover:text-cyan-400 transition-colors truncate">{u.full_name}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">{u.plan || 'No Plan'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-400">৳{u.total_spent?.toLocaleString()}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">Total Spend</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time feed */}
        <ActivityFeed />

      </div>
    </div>
  );
}
