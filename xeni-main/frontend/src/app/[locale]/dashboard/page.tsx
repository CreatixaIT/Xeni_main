'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, DollarSign, MessageCircle, AlertTriangle, 
  Package, ArrowUpRight, Wand2, BarChart3, Settings, 
  Lock, Zap, Activity, Clock
} from 'lucide-react';
import api from '@/lib/api';
import { Link } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth';
import { useTranslations } from 'next-intl';
import { Search, Brain, Loader2 } from 'lucide-react';

/* ── COMPONENTS ── */
function HealthScoreGauge({ score }: { score: number }) {
  const color = score > 80 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444';
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center group cursor-help">
      <svg className="w-full h-full -rotate-90">
        <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="dark:text-white text-gray-900/5" />
        <motion.circle 
          cx="48" cy="48" r={radius} stroke={color} strokeWidth="8" fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          className="drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black dark:text-white text-gray-900">{score}</span>
        <span className="text-[8px] font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-widest">Health</span>
      </div>
      {/* Tooltip */}
      <div className="absolute top-full mt-2 hidden group-hover:block z-50 w-48 p-3 glass-card text-[10px] leading-relaxed shadow-2xl">
        <p className="font-bold text-primary mb-1">AI Insights:</p>
        Your store is performing at <span className="dark:text-white text-gray-900 font-bold">{score}%</span> efficiency. Increase stock of top items to boost your score to 90+.
      </div>
    </div>
  );
}

function AskXeniBar() {
  const [query, setQuery] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const placeholders = [
    "How many orders from Dhaka today?",
    "Which products are low in stock?",
    "Generate a post for New Eid Collection",
    "Compare this week's sales to last week",
    "Is the AI agent handling all messages?"
  ];

  useEffect(() => {
    const timer = setInterval(() => setPlaceholderIdx(prev => (prev + 1) % placeholders.length), 4000);
    return () => clearInterval(timer);
  }, [placeholders.length]);

  return (
    <div className="relative group w-full max-w-xl">
       <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Brain className="w-5 h-5 text-primary group-focus-within:animate-pulse" />
       </div>
       <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Ask Xeni: "${placeholders[placeholderIdx]}"`}
          className="w-full glass-card dark:bg-white/5 bg-black/5 py-4 pl-12 pr-4 text-sm dark:text-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:dark:bg-white/10 focus:bg-black/10 focus:border-primary/50 transition-all placeholder:text-slate-600 dark:text-slate-600 dark:text-dark-700 font-medium shadow-glow-sm"
       />
       <div className="absolute inset-y-0 right-4 flex items-center">
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border dark:border-white/10 border-black/10 dark:bg-white/5 bg-black/5 px-1.5 font-mono text-[10px] font-medium text-slate-600 dark:text-slate-600 dark:text-dark-700">
            <span className="text-xs">⌘</span>K
          </kbd>
       </div>
    </div>
  );
}

interface Stats {
  orders: { total_orders: number; pending_payment: number; pending_delivery: number; total_revenue: number };
  conversations: { open_conversations: number; resolved_conversations: number; total_unread: number; messages_replied: number };
}

interface AgentProps {
  name: string;
  icon: any;
  metric: string;
  lastActivity: string;
  status: 'active' | 'processing' | 'idle' | 'error';
  href: string;
  requiredPlan: string;
  available: boolean;
  className?: string;
}

function AgentTile({ name, icon: Icon, metric, lastActivity, status, href, requiredPlan, available, className }: AgentProps) {
  const t = useTranslations();
  
  return (
    <motion.div 
      whileHover={available ? { y: -4 } : {}}
      className={`glass-card p-6 relative overflow-hidden group ${className} ${!available ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${available ? 'bg-primary/10 text-primary' : 'bg-white/5 text-slate-600 dark:text-slate-600 dark:text-dark-700'}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-wider">{status}</span>
           <div className={`w-2 h-2 rounded-full ${
             status === 'active' ? 'bg-success animate-pulse' : 
             status === 'processing' ? 'bg-primary animate-ping' : 
             status === 'idle' ? 'bg-dark-500' : 'bg-danger'
           }`} />
        </div>
      </div>

      <h3 className="text-lg font-heading font-bold dark:text-white text-gray-900 mb-1">{name}</h3>
      <p className="text-sm text-slate-600 dark:text-dark-600 mb-6">{metric}</p>
      
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-600 dark:text-dark-700">
          <Clock className="w-3 h-3" /> {lastActivity}
        </div>
        {available && (
          <Link href={href} className="text-primary text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
            Open <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {!available && (
        <div className="absolute inset-0 backdrop-blur-md bg-black/60 flex flex-col items-center justify-center p-6 text-center">
          <Lock className="dark:text-white text-gray-900/40 w-8 h-8 mb-3" />
          <p className="dark:text-white text-gray-900 text-sm font-bold mb-1">Locked Agent</p>
          <p className="dark:text-white text-gray-900/60 text-xs mb-4">Upgrade to {requiredPlan} to unlock</p>
          <Link href="/billing" className="btn-primary py-2 px-4 text-xs">Upgrade Now</Link>
        </div>
      )}
    </motion.div>
  );
}

function LivePulseMonitor() {
  const [events, setEvents] = useState([
    { id: 1, type: 'ai', text: 'AI replied to Karim regarding "Price of Silk Saree"', time: 'Just now', icon: Brain },
    { id: 2, type: 'order', text: 'New Order #8291 verified via bKash', time: '2 mins ago', icon: ShoppingBag },
    { id: 3, type: 'ai', text: 'Inventory Agent updated stock for "Panjabi Blue"', time: '5 mins ago', icon: Package },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(prev => [
        { 
          id: Date.now(), 
          type: Math.random() > 0.5 ? 'ai' : 'order', 
          text: Math.random() > 0.5 ? 'AI handled shipping query for Dhaka customer' : 'Payment verification successful (৳2,400)', 
          time: 'Just now', 
          icon: Math.random() > 0.5 ? Brain : Zap 
        },
        ...prev.slice(0, 4)
      ]);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {events.map((event) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: 20, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: -20, height: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 group hover:dark:bg-white/10 hover:bg-black/10 hover:border-primary/30 transition-all"
          >
             <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${event.type === 'ai' ? 'bg-primary/20 text-primary glow-violet' : 'bg-emerald-500/20 text-emerald-500 glow-emerald'}`}>
                <event.icon className="w-4 h-4" />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-[11px] dark:text-white text-gray-900 font-medium truncate">{event.text}</p>
                <p className="text-[9px] text-slate-600 dark:text-slate-600 dark:text-dark-700 font-semibold">{event.time}</p>
             </div>
             <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function DashboardOverview() {
  const t = useTranslations();
  const { subscription } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditTasks, setAuditTasks] = useState<any[]>([]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [ordersRes, convsRes, auditRes] = await Promise.allSettled([
          api.get('/orders/stats'),
          api.get('/conversations/stats'),
          api.get('/agents/inventory/tasks?per_page=5')
        ]);
        setStats({
          orders: ordersRes.status === 'fulfilled' ? ordersRes.value.data.data : { total_orders: 0, pending_payment: 0, pending_delivery: 0, total_revenue: 0 },
          conversations: convsRes.status === 'fulfilled' ? convsRes.value.data.data : { open_conversations: 0, resolved_conversations: 0, total_unread: 0, messages_replied: 0 },
        });
        if (auditRes.status === 'fulfilled') {
          setAuditTasks(auditRes.value.data.data || []);
        }
      } catch {
        setStats({
          orders: { total_orders: 0, pending_payment: 0, pending_delivery: 0, total_revenue: 0 },
          conversations: { open_conversations: 0, resolved_conversations: 0, total_unread: 0, messages_replied: 0 },
        });
      }
      setLoading(false);
    }
    fetchStats();
  }, []);

  const planTier = subscription?.plan_tier || 'free';

  const statCards = [
    { title: 'Messages Replied', value: stats?.conversations.messages_replied || 0, icon: MessageCircle, color: 'from-violet-500 to-purple-600' },
    { title: 'Orders Processed', value: stats?.orders.total_orders || 0, icon: ShoppingBag, color: 'from-blue-500 to-indigo-600' },
    { title: 'Revenue Today', value: `৳${(stats?.orders.total_revenue || 0).toLocaleString()}`, icon: DollarSign, color: 'from-emerald-500 to-green-600' },
    { title: 'Stock Alerts', value: '3', icon: AlertTriangle, color: 'from-amber-500 to-orange-600', alert: true },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto min-h-screen">
      {/* Top Header Overhaul */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
        <div className="flex items-center gap-6">
          <HealthScoreGauge score={84} />
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-heading font-black dark:text-white text-gray-900 tracking-tight drop-shadow-glow">Active Pulse</h1>
              <span className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] uppercase tracking-tighter">Live Monitor</span>
            </div>
            <div className="flex items-center gap-3">
               <span className="badge bg-primary/20 text-primary-300 border border-primary/30 px-3 capitalize font-bold shadow-glow-sm">{planTier} Plan</span>
               <span className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm flex items-center gap-1.5 font-medium">
                  <Activity className="w-4 h-4 text-success animate-pulse" /> All systems operational
               </span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex justify-center px-4">
           <AskXeniBar />
        </div>

        <div className="flex items-center gap-3 self-end lg:self-auto">
          <button className="glass-card px-5 py-3 text-sm font-bold dark:text-white text-gray-900 flex items-center gap-2 hover:dark:bg-white/10 hover:bg-black/10 transition-all group dark:border-white/10 border-black/10">
            <Clock className="w-4 h-4 text-slate-600 dark:text-slate-600 dark:text-dark-700 group-hover:text-primary transition-colors" /> Report
          </button>
          <Link href="/dashboard/setup" className="btn-primary flex items-center gap-2 px-6 py-3 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
            <Settings className="w-5 h-5" /> Setup
          </Link>
        </div>
      </div>

      {/* Real-time Stats Strip */}
      {(stats?.conversations as any)?.human_intervention_needed > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 rounded-xl bg-danger/20 border border-danger/50 flex items-center justify-between shadow-[0_0_20px_rgba(239,68,68,0.2)]"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 bg-danger/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-danger animate-pulse" />
            </div>
            <div>
              <h4 className="dark:text-white text-gray-900 font-bold text-sm">Human Intervention Required</h4>
              <p className="text-dark-300 text-xs mt-0.5">There are <strong className="dark:text-white text-gray-900">{(stats?.conversations as any)?.human_intervention_needed}</strong> open chats that AI couldn&apos;t resolve or escalated.</p>
            </div>
          </div>
          <Link href="/dashboard/conversations" className="bg-danger text-white text-xs font-bold px-5 py-2.5 rounded-lg hover:bg-red-600 transition-colors shadow-lg">
            Review Chats
          </Link>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 flex items-center gap-5"
          >
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg shadow-black/20`}>
              <card.icon className="w-6 h-6 dark:text-white text-gray-900" />
            </div>
            <div>
              <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-xs font-bold uppercase tracking-wider mb-1">{card.title}</p>
              <h3 className={`text-2xl font-heading font-bold ${card.alert ? 'text-amber-400' : 'dark:text-white text-gray-900'}`}>
                {loading ? '...' : card.value}
              </h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6 mb-10 auto-rows-[200px]">
        
        {/* Conversation Agent - Large */}
        <AgentTile 
          className="col-span-12 lg:col-span-6 row-span-2"
          name="Conversation Agent"
          icon={MessageCircle}
          metric={`${stats?.conversations.messages_replied || 0} messages replied today`}
          lastActivity="2 minutes ago"
          status="active"
          href="/dashboard/conversations"
          requiredPlan="Starter"
          available={['starter', 'professional', 'premium', 'enterprise'].includes(planTier)}
        />

        {/* Order Processing Agent - Wide */}
        <AgentTile 
          className="col-span-12 lg:col-span-6 row-span-1"
          name="Order Agent"
          icon={ShoppingBag}
          metric={`${stats?.orders.pending_delivery || 0} orders waiting for shipping`}
          lastActivity="15 minutes ago"
          status="idle"
          href="/dashboard/orders"
          requiredPlan="Professional"
          available={['professional', 'premium', 'enterprise'].includes(planTier)}
        />

        {/* Inventory Agent - Wide */}
        <AgentTile 
          className="col-span-12 lg:col-span-6 row-span-1"
          name="Inventory Agent"
          icon={Package}
          metric="Audit completed successfully"
          lastActivity="1 hour ago"
          status="active"
          href="/dashboard/products"
          requiredPlan="Professional"
          available={['professional', 'premium', 'enterprise'].includes(planTier)}
        />

        {/* Creative Agent */}
        <AgentTile 
          className="col-span-12 md:col-span-6 lg:col-span-4 row-span-2"
          name="Creative Studio"
          icon={Wand2}
          metric="AI-generated post ready for review"
          lastActivity="3 hours ago"
          status="active"
          href="/dashboard/creative"
          requiredPlan="Premium"
          available={['premium', 'enterprise'].includes(planTier)}
        />

        {/* Intelligence Agent */}
        <AgentTile 
          className="col-span-12 md:col-span-6 lg:col-span-4 row-span-2"
          name="Sales Intelligence"
          icon={BarChart3}
          metric="New weekly insights generated"
          lastActivity="4 hours ago"
          status="idle"
          href="/dashboard/analytics"
          requiredPlan="Premium"
          available={['premium', 'enterprise'].includes(planTier)}
        />

        {/* Quick Actions & Live Pulse */}
        <div className="col-span-12 lg:col-span-4 row-span-2 flex flex-col gap-6">
           {/* Live Pulse Monitor */}
           <div className="glass-card p-6 flex-1 flex flex-col">
              <h3 className="text-lg font-heading font-bold dark:text-white text-gray-900 mb-6 flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary animate-pulse" /> Live Pulse
              </h3>
              <LivePulseMonitor />
              <div className="mt-auto pt-4 border-t dark:border-white/5 border-black/5 flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 font-bold uppercase tracking-widest">
                 <span>AI Usage This Hour</span>
                 <span className="text-primary">142 Requests</span>
              </div>
           </div>

           {/* Integration Status (Compact) */}
           <div className="glass-card p-5">
              <h4 className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest mb-4">Connectivity</h4>
              <div className="flex gap-4">
                 {[{ i: MessageCircle, s: 'success' }, { i: DollarSign, s: 'success' }, { i: Package, s: 'amber-500' }].map((item, i) => (
                    <div key={i} className={`p-2 rounded-lg dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 text-${item.s} relative`}>
                       <item.i className="w-4 h-4" />
                       <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full bg-${item.s} border-2 border-dark-900`} />
                    </div>
                 ))}
                 <div className="flex-1" />
                 <Link href="/dashboard/setup" className="text-[10px] font-black text-primary hover:underline self-end">View All</Link>
              </div>
           </div>
        </div>
     </div>

      {/* Intelligence Feed (Bottom Full Width) Overhaul */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-heading font-black dark:text-white text-gray-900 flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" /> Intelligence Feed
        </h2>
        <div className="flex items-center gap-2 dark:bg-white/5 bg-black/5 rounded-full px-4 py-1.5">
           <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
           <span className="text-[10px] font-bold text-slate-600 dark:text-dark-600">Tracking 14 channels</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-4">
          <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {auditTasks.length === 0 ? (
               <div className="p-8 text-center text-slate-600 dark:text-slate-600 dark:text-dark-700 font-medium">
                 No AI insights available yet. Run an AI Audit from your Products page!
               </div>
            ) : auditTasks.map((task, i) => (
              <motion.div 
                key={task.task_id || i} 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center justify-between p-5 hover:dark:bg-white/5 hover:bg-black/5 transition-all border-b dark:border-white/5 border-black/5 last:border-0 rounded-2xl group"
              >
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 bg-primary/20 text-primary shadow-[0_0_15px_rgba(124,58,237,0.2)]">
                      <Brain className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-base dark:text-white text-gray-900 font-bold group-hover:text-primary transition-colors">
                        {task.agent_type === 'inventory' ? 'Inventory Optimization' : 'AI Action'}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700 mt-1 leading-relaxed max-w-lg">
                        {task.summary || 'AI task completed.'}
                      </p>
                    </div>
                 </div>
                 <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 font-bold block mb-1">
                      {new Date(task.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                       Insight
                    </span>
                 </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Insight Card (Right Column) */}
        <div className="lg:col-span-1 glass-card p-8 bg-gradient-to-br from-primary/10 to-transparent relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Brain className="w-32 h-32" />
           </div>
           <h3 className="text-xl font-heading font-black dark:text-white text-gray-900 mb-6">Latest Audit Insight</h3>
           <div className="space-y-6 relative z-10">
              <p className="text-sm text-dark-300 italic leading-relaxed shadow-glow-sm">
                {auditTasks[0]?.result?.restock_recommendations?.[0]?.reasoning ? 
                  `"${auditTasks[0].result.restock_recommendations[0].reasoning}"` : 
                  "Run an AI Audit to get inventory insights and smart restocking recommendations for your business."}
              </p>
              {auditTasks[0]?.result?.restock_recommendations?.[0] && (
                 <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 dark:bg-white/10 bg-black/10 rounded-full overflow-hidden">
                       <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="h-full bg-primary" />
                    </div>
                    <span className="text-xs font-bold dark:text-white text-gray-900 text-right">
                       Represents {auditTasks[0].result.restock_recommendations[0].urgency || 'Action Needed'}
                    </span>
                 </div>
              )}
              {auditTasks.length > 0 ? (
                 <Link href="/dashboard/products" className="btn-primary w-full py-4 text-sm font-black shadow-2xl block text-center">Take Action Now</Link>
              ) : (
                 <Link href="/dashboard/products" className="btn-secondary w-full py-4 text-sm font-black shadow-2xl block text-center">Run Audit</Link>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

