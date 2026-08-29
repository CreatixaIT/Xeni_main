'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, Edit2, Trash2, Store, Lock, Search, Power, BrainCircuit, Check } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface AgentRule {
  id: string;
  scope: string;
  category: string;
  title: string;
  rule: string;
  is_active: boolean;
  priority: number;
}

export default function ShopRulesPage() {
  const [globalRules, setGlobalRules] = useState<AgentRule[]>([]);
  const [shopRules, setShopRules] = useState<AgentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'shop' | 'global'>('shop');
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AgentRule | null>(null);
  const [form, setForm] = useState({
    category: 'custom',
    title: '',
    rule: '',
    priority: 5
  });
  const [saving, setSaving] = useState(false);

  const shopCategories = [
    'identity', 'return_policy', 'delivery', 'payment', 'business_hours', 'promotions', 'custom'
  ];

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const [globalRes, shopRes] = await Promise.all([
        api.get('/user/global-rules'), 
        api.get('/shops/rules')
      ]);
      setGlobalRules(globalRes.data.data || []);
      setShopRules(shopRes.data.data || []);
    } catch (err: any) {
      toast.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (rule?: AgentRule) => {
    if (rule) {
      setEditingRule(rule);
      setForm({
        category: rule.category,
        title: rule.title,
        rule: rule.rule,
        priority: rule.priority
      });
    } else {
      setEditingRule(null);
      setForm({
        category: 'custom',
        title: '',
        rule: '',
        priority: 5
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.rule) {
      toast.error('Title and Rule are required');
      return;
    }

    setSaving(true);
    try {
      if (editingRule) {
        await api.put(`/shops/rules/${editingRule.id}`, form);
        toast.success('Rule updated');
      } else {
        await api.post('/shops/rules', form);
        toast.success('Rule created');
      }
      setIsModalOpen(false);
      fetchRules();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/shops/rules/${id}/toggle`, { is_active: !currentStatus });
      setShopRules(shopRules.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
      toast.success('Rule status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom rule?')) return;
    try {
      await api.delete(`/shops/rules/${id}`);
      setShopRules(shopRules.filter(r => r.id !== id));
      toast.success('Rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const filteredShopRules = shopRules.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) || 
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <BrainCircuit className="w-7 h-7 text-primary" />
            AI Rules Engine
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Train your AI Agent. Define how it behaves, responds, and enforces your shop policies.
          </p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Custom Rule
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="flex gap-4 border-b dark:border-white/10 border-black/10 mb-6">
            <button
              onClick={() => setActiveTab('shop')}
              className={`pb-3 border-b-2 font-medium transition-colors ${activeTab === 'shop' ? 'border-primary text-primary' : 'border-transparent text-slate-600 dark:text-dark-600 hover:dark:text-white hover:text-gray-900'}`}
            >
              Custom Rules
            </button>
            <button
              onClick={() => setActiveTab('global')}
              className={`pb-3 border-b-2 font-medium transition-colors ${activeTab === 'global' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-600 dark:text-dark-600 hover:dark:text-white hover:text-gray-900'}`}
            >
              Platform Master Rules
            </button>
          </div>

          {activeTab === 'shop' && (
            <>
              {/* Shop Rules Header line */}
              <div className="flex items-center justify-between mb-4 border-b dark:border-white/5 border-black/5 pb-2">
                <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
                  <Store className="w-5 h-5"/> Your Custom Rules
                </h2>
                <div className="bg-black/20 rounded-lg p-1.5 flex items-center w-full max-w-xs border dark:border-white/5 border-black/5">
                  <Search className="w-4 h-4 text-slate-600 dark:text-slate-600 dark:text-dark-700 ml-2 mr-2" />
                  <input 
                    type="text" 
                    placeholder="Search your rules..." 
                    className="bg-transparent border-none outline-none dark:text-white text-gray-900 text-sm w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-10">
                {filteredShopRules.map(rule => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={rule.id} 
                    className={`glass-card p-5 border relative overflow-hidden transition-all ${
                      rule.is_active ? 'border-primary/20 hover:border-primary/40' : 'dark:border-white/5 border-black/5 opacity-70'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary-300">
                        {rule.category.replace('_', ' ')}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleToggle(rule.id, rule.is_active)} className={`p-1.5 rounded-lg transition-colors ${rule.is_active ? 'text-green-400 hover:dark:bg-white/10 hover:bg-black/10' : 'text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900'}`} title="Toggle Active">
                         <Power className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleOpenModal(rule)} className="p-1.5 rounded-lg hover:dark:bg-white/10 hover:bg-black/10 text-cyan-400 transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded-lg hover:bg-danger/20 text-danger transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-bold dark:text-white text-gray-900 text-lg mb-2 leading-tight">{rule.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-dark-600 line-clamp-3">{rule.rule}</p>
                  </motion.div>
                ))}
                {filteredShopRules.length === 0 && (
                  <div className="col-span-full py-12 text-center border border-dashed dark:border-white/10 border-black/10 rounded-2xl bg-black/10">
                    <BrainCircuit className="w-8 h-8 text-dark-600 mx-auto mb-3" />
                    <p className="text-slate-600 dark:text-dark-600 font-medium">You haven&apos;t defined any custom rules yet.</p>
                    <p className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700 mt-1">Add rules to teach the AI about your shop&apos;s return policy, delivery fees, and identity.</p>
                    <button onClick={() => handleOpenModal()} className="mt-4 px-4 py-2 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 rounded-lg text-sm dark:text-white text-gray-900 transition-colors">
                      Create First Rule
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'global' && (
            <div className="space-y-6">
              <div className="glass-card p-6 border border-amber-500/20 bg-amber-500/5 mb-6">
                 <div className="flex items-start gap-4">
                    <div className="p-2 bg-amber-500/20 rounded-xl shrink-0">
                      <Lock className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-amber-300 font-bold mb-1">Platform Master Rules (Enforced)</h3>
                      <p className="text-sm text-amber-300/80 mb-3">
                        Xeni&apos;s AI is globally restricted from performing certain actions across all shops. These include: never sharing personal data, never making up prices, never discussing politics/religion, and escalating angry customers to humans.
                      </p>
                      <p className="text-xs text-amber-300/60 font-mono">
                        These rules are set by Xeni Administrators and apply to all shops.
                      </p>
                    </div>
                 </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {globalRules.map(rule => (
                  <div key={rule.id} className="glass-card p-5 border border-amber-900/40 dark:bg-black/40 bg-[rgba(0,0,0,0.02)]">
                    <span className="px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-500 mb-3 inline-block">
                      {rule.category.replace('_', ' ')}
                    </span>
                    <h3 className="font-bold dark:text-white text-gray-900 text-[15px] mb-2 leading-tight">{rule.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-dark-600">{rule.rule}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[var(--bg-secondary)] border dark:border-white/10 border-black/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="p-5 border-b dark:border-white/10 border-black/10 dark:bg-black/40 bg-[rgba(0,0,0,0.02)]">
                <h3 className="text-lg font-bold dark:text-white text-gray-900">{editingRule ? 'Edit Shop Rule' : 'New Shop Rule'}</h3>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-dark-600 mb-1">Category</label>
                    <select className="input-field py-2" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                      {shopCategories.map(c => <option key={c} value={c}>{c.replace('_', ' ').toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-dark-600 mb-1">Priority</label>
                    <input type="number" min="1" max="10" className="input-field py-2" value={form.priority} onChange={e => setForm({...form, priority: parseInt(e.target.value)})} title="Priority 1 runs before priority 10" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-dark-600 mb-1">Short Title</label>
                  <input type="text" className="input-field py-2" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Inside Dhaka Delivery" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-dark-600 mb-1">Detailed Instruction for AI</label>
                  <textarea className="input-field min-h-[120px] font-mono text-sm leading-relaxed" value={form.rule} onChange={e => setForm({...form, rule: e.target.value})} placeholder="e.g. 'Inside Dhaka delivery charge is 60 BDT. Outside Dhaka is 120 BDT.'" />
                </div>
                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium dark:text-white text-gray-900 hover:dark:bg-white/10 hover:bg-black/10 transition-colors">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary py-2 px-6 text-sm flex items-center gap-2">
                    {saving ? 'Saving...' : <><Sparkles className="w-4 h-4"/> Save Rule</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
