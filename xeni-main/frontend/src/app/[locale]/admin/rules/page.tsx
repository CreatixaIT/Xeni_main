'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, Edit2, Trash2, Shield, Search, Globe, Power, Check } from 'lucide-react';
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

export default function AdminRulesPage() {
  const [rules, setRules] = useState<AgentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AgentRule | null>(null);
  const [form, setForm] = useState({
    category: 'communication',
    title: '',
    rule: '',
    priority: 5
  });
  const [saving, setSaving] = useState(false);

  const categories = [
    'privacy', 'communication', 'product_pricing', 'ordering', 'escalation', 'compliance'
  ];

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/rules');
      setRules(res.data.data || []);
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
        category: 'communication',
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
        await api.put(`/admin/rules/${editingRule.id}`, form);
        toast.success('Rule updated');
      } else {
        await api.post('/admin/rules', form);
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
      await api.patch(`/admin/rules/${id}/toggle`, { is_active: !currentStatus });
      setRules(rules.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
      toast.success('Rule status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this global rule? It affects all shops.')) return;
    try {
      await api.delete(`/admin/rules/${id}`);
      setRules(rules.filter(r => r.id !== id));
      toast.success('Rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const filteredRules = rules.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) || 
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-heading font-bold dark:text-white text-gray-900 flex items-center gap-3">
            <Globe className="w-7 h-7 text-primary" />
            Global AI Rules Engine
          </h1>
          <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700 mt-1">Manage platform-wide behaviors and restrictions for the conversational AI.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Global Rule
        </button>
      </div>

      <div className="glass-card mb-6 p-2 flex items-center w-full max-w-md">
        <div className="p-3 text-slate-600 dark:text-slate-600 dark:text-dark-700"><Search className="w-5 h-5" /></div>
        <input 
          type="text" 
          placeholder="Search rules..." 
          className="bg-transparent border-none outline-none dark:text-white text-gray-900 w-full pr-4"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRules.map(rule => (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={rule.id} 
              className={`glass-card p-5 border relative overflow-hidden transition-all ${
                rule.is_active ? 'border-primary/20 hover:border-primary/40' : 'dark:border-white/5 border-black/5 opacity-70'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-primary/20 text-primary-300">
                  {rule.category}
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
              
              <h3 className="font-bold dark:text-white text-gray-900 text-lg mb-2 leading-tight pr-8">{rule.title}</h3>
              <p className="text-sm text-slate-600 dark:text-dark-600 line-clamp-3">{rule.rule}</p>
              
              <div className="mt-4 pt-3 border-t dark:border-white/5 border-black/5 flex justify-between items-center text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">
                <span>Priority: {rule.priority}</span>
                {rule.is_active && <span className="flex items-center gap-1 text-green-400"><Check className="w-3 h-3"/> Active</span>}
              </div>
            </motion.div>
          ))}
          {filteredRules.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-600 dark:text-slate-600 dark:text-dark-700">
              No global rules found.
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[var(--bg-secondary)] border dark:border-white/10 border-black/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="p-6 border-b dark:border-white/10 border-black/10 flex items-center justify-between dark:bg-black/40 bg-[rgba(0,0,0,0.02)]">
                <h3 className="text-xl font-bold dark:text-white text-gray-900">{editingRule ? 'Edit Global Rule' : 'New Global Rule'}</h3>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-dark-600 mb-1">Category</label>
                    <select className="input-field" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                      {categories.map(c => <option key={c} value={c}>{c.replace('_', ' ').toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-dark-600 mb-1">Priority (1=High, 10=Low)</label>
                    <input type="number" min="1" max="20" className="input-field" value={form.priority} onChange={e => setForm({...form, priority: parseInt(e.target.value)})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-dark-600 mb-1">Title</label>
                  <input type="text" className="input-field" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Respectful Tone" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-dark-600 mb-1">Rule Definition</label>
                  <textarea className="input-field min-h-[120px] font-mono text-sm" value={form.rule} onChange={e => setForm({...form, rule: e.target.value})} placeholder="Write the exact instruction for the AI..." />
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t dark:border-white/10 border-black/10">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium dark:text-white text-gray-900 hover:dark:bg-white/10 hover:bg-black/10 transition-colors">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary py-2 text-sm">{saving ? 'Saving...' : 'Save Rule'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
