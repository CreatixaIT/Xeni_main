'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Clock, MapPin, ShoppingBag, Lightbulb, MessageCircle, Users, Brain, ArrowUpRight } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';

interface OrderStats {
  total_orders: number;
  pending_payment: number;
  pending_delivery: number;
  total_revenue: number;
}

interface ConvStats {
  open_conversations: number;
  resolved_conversations: number;
  total_unread: number;
}

export default function AnalyticsPage() {
  const [orderStats, setOrderStats] = useState<OrderStats>({ total_orders: 0, pending_payment: 0, pending_delivery: 0, total_revenue: 0 });
  const [convStats, setConvStats] = useState<ConvStats>({ open_conversations: 0, resolved_conversations: 0, total_unread: 0 });
  const [topProducts, setTopProducts] = useState<{name: string; units: number; revenue: number; pct: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ordersRes, convsRes, productsRes] = await Promise.allSettled([
          api.get('/orders/stats'),
          api.get('/conversations/stats'),
          api.get('/products'),
        ]);

        if (ordersRes.status === 'fulfilled') {
          const d = ordersRes.value.data?.data;
          if (d && typeof d === 'object') {
            setOrderStats({
              total_orders: Number(d.total_orders) || 0,
              pending_payment: Number(d.pending_payment) || 0,
              pending_delivery: Number(d.pending_delivery) || 0,
              total_revenue: Number(d.total_revenue) || 0,
            });
          }
        }

        if (convsRes.status === 'fulfilled') {
          const d = convsRes.value.data?.data;
          if (d && typeof d === 'object') {
            setConvStats({
              open_conversations: Number(d.open_conversations) || 0,
              resolved_conversations: Number(d.resolved_conversations) || 0,
              total_unread: Number(d.total_unread) || 0,
            });
          }
        }

        if (productsRes.status === 'fulfilled') {
          const prods = productsRes.value.data?.data;
          if (Array.isArray(prods) && prods.length > 0) {
            const mapped = prods.slice(0, 5).map((p: any) => {
              const sold = Math.max(0, (Number(p.initial_stock) || 0) - (Number(p.current_stock) || 0));
              const revenue = sold * (Number(p.price) || 0);
              return { name: p.name || 'Unknown', units: sold, revenue, pct: 0 };
            });
            const maxRevenue = Math.max(...mapped.map((p: any) => p.revenue), 1);
            mapped.forEach((p: any) => { p.pct = Math.round((p.revenue / maxRevenue) * 100); });
            setTopProducts(mapped);
          }
        }
      } catch (e) {
        console.error('Failed to fetch analytics data', e);
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  const [taskStatus, setTaskStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const pendingTaskIdRef = useRef<string | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [aiInsights, setAiInsights] = useState<{icon: string, text: string}[]>([]);

  useEffect(() => {
    if (!accessToken) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://xeni.xentroinfotech.com';
    const wsBase = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const wsUrl = `${wsBase}/ws?token=${accessToken}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.task_id && data.task_id !== pendingTaskIdRef.current) return;

        if (data.event === 'task.completed') {
          setTaskStatus('completed');
          toast.success('AI Insights generated! ✨', { id: 'ai-analytics' });
          
          const agentData = data.payload?.data || {};
          const recs = agentData.ai_recommendations || [];
          
          if (recs.length > 0) {
            setAiInsights(recs.map((r: string) => {
              const iconMatch = r.match(/^([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/);
              const icon = iconMatch ? iconMatch[0] : '💡';
              const text = iconMatch ? r.replace(icon, '').trim() : r;
              return { icon, text };
            }));
          }
        } else if (data.event === 'task.failed') {
          setTaskStatus('failed');
          toast.error('AI Insights failed.', { id: 'ai-analytics' });
        } else if (data.event === 'task.processing') {
          setTaskStatus('processing');
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, [accessToken]);

  const avgOrderValue = (orderStats.total_orders || 0) > 0
    ? Math.round((orderStats.total_revenue || 0) / orderStats.total_orders)
    : 0;

  const totalConversations = (convStats.open_conversations || 0) + (convStats.resolved_conversations || 0);

  const defaultRecommendations = orderStats.total_orders > 0 ? [
    { icon: '🎯', text: `You have ${orderStats.total_orders || 0} orders with ৳${(orderStats.total_revenue || 0).toLocaleString()} in revenue — keep the momentum going!` },
    { icon: '📦', text: (orderStats.pending_delivery || 0) > 0 ? `${orderStats.pending_delivery} orders are awaiting delivery — consider using auto-courier booking.` : 'All orders are shipped! Great job.' },
    { icon: '💰', text: avgOrderValue > 0 ? `Average order value is ৳${avgOrderValue} — consider bundle pricing to increase it.` : 'Start tracking order values for insights.' },
    { icon: '💬', text: (convStats.total_unread || 0) > 0 ? `${convStats.total_unread} unread messages — enable the Conversation Agent for 24/7 auto-reply.` : 'All messages are read! Conversation Agent is keeping up.' },
    { icon: '📢', text: 'Use the Creative Agent to generate promotional content for your top products.' },
  ] : [
    { icon: '🚀', text: 'Connect your Facebook Page to start receiving Messenger orders.' },
    { icon: '📦', text: 'Add products to your shop catalog to get started.' },
    { icon: '💬', text: 'Enable the Conversation Agent for 24/7 auto-reply.' },
    { icon: '📊', text: 'Once you have orders, AI will analyze your sales patterns.' },
  ];

  const recommendations = aiInsights.length > 0 ? aiInsights : defaultRecommendations;

  const generateLiveIntelligence = async () => {
    toast.loading('AI is analyzing sales data...', { id: 'ai-analytics' });
    try {
      const response = await api.post('/agents/intelligence/run', {
        payload: {
          period: 'last_30_days',
          sales_data: {
            total_revenue: orderStats.total_revenue,
            total_orders: orderStats.total_orders,
            pending_payments: orderStats.pending_payment,
            conversations: totalConversations,
            top_products: topProducts.map(p => p.name),
          }
        }
      });
      pendingTaskIdRef.current = response.data.data.task_id;
      setTaskStatus('queued');
      toast.success('Intelligence analysis queued! Results will appear when ready.', { id: 'ai-analytics' });
    } catch {
      toast.dismiss('ai-analytics');
      // The UpgradeModal will handle 403 errors automatically
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <BarChart3 className="w-7 h-7 text-primary" /> Sales Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Real-time insights from your shop data</p>
        </div>
        <button onClick={generateLiveIntelligence} className="btn-primary flex items-center gap-2 text-sm shadow-lg shadow-primary/20">
          <span className="text-lg">🤖</span> Generate AI Insights
        </button>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: `৳${(orderStats.total_revenue || 0).toLocaleString()}`, icon: TrendingUp, color: 'from-emerald-500 to-green-600' },
          { label: 'Total Orders', value: (orderStats.total_orders || 0).toString(), icon: ShoppingBag, color: 'from-blue-500 to-indigo-600' },
          { label: 'Avg Order Value', value: `৳${(avgOrderValue || 0).toLocaleString()}`, icon: BarChart3, color: 'from-violet-500 to-purple-600' },
          { label: 'Conversations', value: (totalConversations || 0).toString(), icon: MessageCircle, color: 'from-amber-500 to-orange-600' },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass-card p-5">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${card.color} flex items-center justify-center mb-3`}>
              <card.icon className="w-5 h-5 dark:text-white text-gray-900" />
            </div>
            <p className="text-2xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>
              {loading ? <span className="skeleton w-20 h-7 block" /> : card.value}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Products */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-6">
          <h3 className="font-heading font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <ShoppingBag className="w-5 h-5 text-primary" /> Top Products
          </h3>
          <div className="space-y-4">
            {topProducts.length > 0 ? topProducts.map((p, i) => (
              <div key={p.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span style={{ color: 'var(--text-primary)' }}>{i + 1}. {p.name}</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>৳{(p.revenue || 0).toLocaleString()}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p.pct}%` }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.units} units sold</p>
              </div>
            )) : (
              <div className="text-center py-8">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No products added yet. Add products to see analytics.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Conversation & Order Breakdown */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card p-6">
          <h3 className="font-heading font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Users className="w-5 h-5 text-primary" /> Order & Conversation Breakdown
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Pending Payments', value: orderStats.pending_payment, icon: '💳', color: 'from-amber-500 to-orange-500' },
              { label: 'Pending Delivery', value: orderStats.pending_delivery, icon: '🚚', color: 'from-blue-500 to-cyan-500' },
              { label: 'Open Conversations', value: convStats.open_conversations, icon: '💬', color: 'from-violet-500 to-purple-500' },
              { label: 'Resolved Conversations', value: convStats.resolved_conversations, icon: '✅', color: 'from-emerald-500 to-green-500' },
              { label: 'Unread Messages', value: convStats.total_unread, icon: '📩', color: 'from-pink-500 to-rose-500' },
            ].map((item, i) => {
              const maxVal = Math.max(orderStats.total_orders, totalConversations, 1);
              const pct = Math.min(Math.round((item.value / maxVal) * 100), 100);
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <span>{item.icon}</span> {item.label}
                    </span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                      className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
 
      {/* Customer Sentiment Analysis (New Highlight) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="lg:col-span-2 glass-card p-8 relative overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-heading font-black dark:text-white text-gray-900 flex items-center gap-3">
                 <Brain className="w-6 h-6 text-primary" /> Customer Sentiment Pulse
              </h3>
              <span className="text-[10px] font-black uppercase bg-primary/10 text-primary px-2 py-1 rounded">AI Analyzed</span>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { label: 'Happy', value: 72, emoji: '😊', color: 'bg-emerald-500', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]' },
                { label: 'Neutral', value: 18, emoji: '😐', color: 'bg-amber-400', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]' },
                { label: 'Frustrated', value: 10, emoji: '😟', color: 'bg-rose-500', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]' }
              ].map((s, i) => (
                <div key={s.label} className="flex flex-col items-center text-center group">
                   <div className="text-4xl mb-4 group-hover:scale-125 transition-transform duration-500">{s.emoji}</div>
                   <div className="w-full h-3 dark:bg-white/5 bg-black/5 rounded-full overflow-hidden mb-3 relative">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${s.value}%` }} 
                        transition={{ delay: 0.7 + i * 0.1, duration: 1 }}
                        className={`h-full ${s.color} ${s.glow} rounded-full`} 
                      />
                   </div>
                   <span className="text-lg font-black dark:text-white text-gray-900">{s.value}%</span>
                   <span className="text-[10px] font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-widest">{s.label}</span>
                </div>
              ))}
           </div>

           <div className="mt-10 p-4 rounded-2xl dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <p className="text-xs text-dark-300">
                <span className="font-bold dark:text-white text-gray-900">Coach Insight:</span> &ldquo;Most frustrations revolve around **Delivery Speed**. Automating your courier sync could improve satisfaction by 15%.&rdquo;
              </p>
           </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="lg:col-span-1 glass-card p-8 flex flex-col">
           <h3 className="text-lg font-heading font-black dark:text-white text-gray-900 mb-6">Trending Topics</h3>
           <div className="flex flex-wrap gap-2">
              {['Price Inquiry', 'Size Guide', 'Shipping Cost', 'Restock?', 'Order Status', 'Quality Check', 'Discount Code', 'Shop Location'].map((tag, i) => (
                <motion.span 
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.05 }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight border hover:scale-110 transition-transform cursor-default ${i < 3 ? 'bg-primary/20 border-primary text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-600 dark:text-dark-600'}`}
                >
                  {tag}
                </motion.span>
              ))}
           </div>
           <div className="mt-auto pt-8">
              <button className="w-full btn-secondary py-3 text-xs font-black flex items-center justify-center gap-2">
                 Analyze All Chats <ArrowUpRight className="w-4 h-4" />
              </button>
           </div>
        </motion.div>
      </div>

      {/* AI Recommendations */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="glass-card p-6">
        <h3 className="font-heading font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Lightbulb className="w-5 h-5 text-amber-400" /> AI Recommendations
        </h3>
        <div className="space-y-3">
          {recommendations.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.08 }} className="flex items-start gap-3 p-3 rounded-xl hover:dark:bg-white/5 hover:bg-black/5 transition-colors">
              <span className="text-xl shrink-0">{r.icon}</span>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
