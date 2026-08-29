'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Type, Users, Save, List, AlertCircle, MessageSquare, Star, CheckCircle, Ban, GripVertical, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type TabType = 'hero' | 'pricing' | 'reviews' | 'faq' | 'banner';

export default function ContentControlPage() {
  const [activeTab, setActiveTab] = useState<TabType>('hero');

  const handleSave = () => toast.success('Content published to Landing Page!');

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto pb-24 h-full flex flex-col">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold dark:text-white text-gray-900 mb-2">Content Control (CMS)</h1>
          <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700">Changes made here are instantly reflected on the public landing page via ISR.</p>
        </div>
        <button onClick={handleSave} className="btn-primary py-2.5 flex items-center gap-2">
          <Save className="w-4 h-4" /> Publish Changes
        </button>
      </div>

      <div className="flex gap-2 border-b dark:border-white/10 border-black/10 pb-4">
        {[
          { id: 'hero', label: 'Hero Section', icon: Type },
          { id: 'pricing', label: 'Pricing Editor', icon: List },
          { id: 'reviews', label: 'Testimonials', icon: Users },
          { id: 'faq', label: 'FAQ', icon: MessageSquare },
          { id: 'banner', label: 'Announcements', icon: AlertCircle }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
              activeTab === tab.id ? 'bg-primary text-white shadow-glow' : 'bg-white/5 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:text-white hover:bg-white/10'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="h-full"
          >
            {activeTab === 'hero' && <HeroEditor />}
            {activeTab === 'pricing' && <PricingEditor />}
            {activeTab === 'reviews' && <ReviewsEditor />}
            {activeTab === 'faq' && <FAQEditor />}
            {activeTab === 'banner' && <BannerEditor />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ------ Tab Components ------

function HeroEditor() {
  const queryClient = useQueryClient();
  const { data: heroData, isLoading } = useQuery({
    queryKey: ['admin-hero'],
    queryFn: async () => {
      const res = await api.get('/admin/content/hero');
      return res.data.data;
    }
  });

  const [heroForm, setHeroForm] = useState<any>(null);

  useEffect(() => {
    if (heroData) {
      setHeroForm({
        badge: heroData.en?.badge || '',
        headline_en: heroData.en?.headline || '',
        subheadline_en: heroData.en?.subheadline || '',
        headline_bn: heroData.bn?.headline || '',
        subheadline_bn: heroData.bn?.subheadline || '',
      });
    }
  }, [heroData]);

  const updateMutation = useMutation({
    mutationFn: async (formData: any) => {
      return api.put('/admin/content/hero', {
        en: {
          badge: formData.badge,
          headline: formData.headline_en,
          subheadline: formData.subheadline_en
        },
        bn: {
          headline: formData.headline_bn,
          subheadline: formData.subheadline_bn
        }
      });
    },
    onSuccess: () => {
      toast.success('Hero section updated');
      queryClient.invalidateQueries({ queryKey: ['admin-hero'] });
    }
  });

  if (isLoading || !heroForm) return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      <div className="glass-card p-6 space-y-6 overflow-y-auto min-h-[400px]">
        <div className="flex justify-between items-center">
          <h3 className="font-heading font-bold dark:text-white text-gray-900">Hero Configuration</h3>
          <button 
            onClick={() => updateMutation.mutate(heroForm)}
            disabled={updateMutation.isPending}
            className="btn-primary py-1.5 px-4 text-xs flex items-center gap-2"
          >
            {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Changes
          </button>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-600 dark:text-dark-700 block mb-2">Announcement Badge (Top)</label>
          <input 
            type="text" 
            value={heroForm.badge} 
            onChange={e => setHeroForm({...heroForm, badge: e.target.value})}
            className="input-field" 
          />
        </div>
        <div className="space-y-4">
          <h4 className="text-sm font-bold dark:text-white text-gray-900 uppercase tracking-wider">English Content</h4>
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-600 dark:text-dark-700 block mb-2">Headline (EN)</label>
            <textarea 
              className="input-field min-h-[80px]" 
              value={heroForm.headline_en}
              onChange={e => setHeroForm({...heroForm, headline_en: e.target.value})}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-600 dark:text-dark-700 block mb-2">Subheadline (EN)</label>
            <textarea 
              className="input-field min-h-[120px]" 
              value={heroForm.subheadline_en}
              onChange={e => setHeroForm({...heroForm, subheadline_en: e.target.value})}
            />
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="text-sm font-bold dark:text-white text-gray-900 uppercase tracking-wider text-primary-400">Bangla Content</h4>
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-600 dark:text-dark-700 block mb-2">Headline (BN)</label>
            <textarea 
              className="input-field min-h-[80px] font-bengali" 
              value={heroForm.headline_bn}
              onChange={e => setHeroForm({...heroForm, headline_bn: e.target.value})}
            />
          </div>
        </div>
      </div>
      
      {/* Preview */}
      <div className="glass-card p-6 dark:bg-black/40 bg-[rgba(0,0,0,0.02)] border-dashed flex flex-col justify-center items-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 opacity-50" />
        <div className="text-center z-10 relative">
          <p className="badge bg-primary/20 text-primary mb-6">{heroForm.badge}</p>
          <h1 className="text-4xl font-heading font-bold dark:text-white text-gray-900 mb-4 leading-tight">
            {heroForm.headline_en || 'Your Shop Headline'}
          </h1>
          <p className="text-slate-600 dark:text-dark-600 text-sm max-w-md mx-auto mb-8 whitespace-pre-wrap">{heroForm.subheadline_en}</p>
          <button className="btn-primary">CTA Button</button>
        </div>
      </div>
    </div>
  );
}

function PricingEditor() {
  const queryClient = useQueryClient();
  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const res = await api.get('/billing/plans');
      return res.data.data;
    }
  });

  const [editingPlan, setEditingPlan] = useState<any>(null);

  const updateMutation = useMutation({
    mutationFn: async (plan: any) => {
      return api.put(`/admin/plans/${plan.id}`, plan);
    },
    onSuccess: () => {
      toast.success('Plan updated');
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    }
  });

  if (isLoading) return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full">
      <div className="lg:col-span-3 space-y-6 overflow-y-auto max-h-[70vh] scrollbar-hide pr-2">
        {plans?.map((plan: any) => (
          <div key={plan.id} className={`glass-card p-6 border transition-all ${editingPlan?.id === plan.id ? 'border-primary ring-1 ring-primary/50' : 'dark:border-white/5 border-black/5'}`}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h3 className="font-heading font-bold dark:text-white text-gray-900">{plan.name}</h3>
                <span className="badge bg-primary/20 text-primary text-[10px] uppercase tracking-wider">{plan.tier}</span>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setEditingPlan(plan)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${editingPlan?.id === plan.id ? 'bg-primary text-white' : 'bg-white/5 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:text-white'}`}
                >
                  Edit
                </button>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={plan.is_active} 
                    onChange={e => updateMutation.mutate({...plan, is_active: e.target.checked})}
                    className="rounded dark:border-white/10 border-black/10 bg-dark w-4 h-4 text-primary" 
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">Active</span>
                </label>
              </div>
            </div>

            {editingPlan?.id === plan.id && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-1 block">Monthly Price (BDT)</label>
                    <input 
                      type="number" 
                      value={editingPlan.price_monthly_bdt} 
                      onChange={e => setEditingPlan({...editingPlan, price_monthly_bdt: parseFloat(e.target.value)})}
                      className="input-field" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-1 block">CTA Text</label>
                    <input 
                      type="text" 
                      value={editingPlan.cta_text} 
                      onChange={e => setEditingPlan({...editingPlan, cta_text: e.target.value})}
                      className="input-field" 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-1 block">Tagline (EN)</label>
                  <input 
                    type="text" 
                    value={editingPlan.tagline} 
                    onChange={e => setEditingPlan({...editingPlan, tagline: e.target.value})}
                    className="input-field" 
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-2 block">Features (One per line)</label>
                  <textarea 
                    className="input-field font-mono text-xs min-h-[120px]" 
                    value={Array.isArray(editingPlan.features) ? editingPlan.features.join('\n') : ''}
                    onChange={e => setEditingPlan({...editingPlan, features: e.target.value.split('\n')})}
                  />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                   <button onClick={() => setEditingPlan(null)} className="btn-secondary py-1.5 px-4 text-xs">Cancel</button>
                   <button 
                    onClick={() => {
                      updateMutation.mutate(editingPlan);
                      setEditingPlan(null);
                    }} 
                    disabled={updateMutation.isPending}
                    className="btn-primary py-1.5 px-4 text-xs flex items-center gap-2"
                   >
                     {updateMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Save Plan
                   </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview Section */}
      <div className="lg:col-span-2 glass-card p-8 bg-dark/80 relative flex flex-col justify-center">
        <div className="absolute top-4 right-4 badge bg-primary text-white text-xs">Live Preview</div>
        <div className="border dark:border-white/10 border-black/10 rounded-2xl p-8 dark:bg-white/5 bg-black/5 backdrop-blur-xl shadow-2xl">
          <h4 className="text-2xl font-bold font-heading dark:text-white text-gray-900">{editingPlan?.name || 'Starter'}</h4>
          <p className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-4">{editingPlan?.tagline || 'Select a plan to preview'}</p>
          <div className="text-4xl font-bold dark:text-white text-gray-900 mb-8">
            ৳{(editingPlan?.price_monthly_bdt || 0).toLocaleString()}
            <span className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700 font-normal ml-1">/mo</span>
          </div>
          <button className="w-full btn-secondary mb-8 py-3 border-primary/30 text-primary-300 font-bold uppercase tracking-wider text-xs">
            {editingPlan?.cta_text || 'Get Started'}
          </button>
          <ul className="space-y-4">
            {(editingPlan?.features || []).slice(0, 5).map((f: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm text-slate-600 dark:text-dark-600">
                <CheckCircle className="w-4 h-4 text-primary shrink-0"/> {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ReviewsEditor() {
  const queryClient = useQueryClient();
  
  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => {
      const res = await api.get('/admin/content/reviews');
      return res.data.data; // This endpoint returns all reviews in Admin view
    }
  });

  const reviews = reviewsData || [];
  const pending = reviews.filter((r: any) => r.status === 'pending');
  const live = reviews.filter((r: any) => r.status === 'approved' && r.show_on_landing);

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.put(`/admin/content/reviews/${id}/approve`);
    },
    onSuccess: () => {
      toast.success('Review approved');
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string, note?: string }) => {
      return api.put(`/admin/content/reviews/${id}/reject`, { admin_note: note });
    },
    onSuccess: () => {
      toast.success('Review rejected');
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
    }
  });

  if (isLoading) return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      <div className="glass-card p-6 flex flex-col min-h-0 max-h-[70vh]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-heading font-bold dark:text-white text-gray-900">Pending Approval ({pending.length})</h3>
          <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">Moderation Required</span>
        </div>
        <div className="space-y-4 overflow-y-auto pr-2 scrollbar-hide">
          {pending.map((r: any) => (
            <div key={r.id} className="p-5 dark:bg-white/5 bg-black/5 rounded-2xl border dark:border-white/5 border-black/5 hover:dark:border-white/10 hover:border-black/10 transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                    {r.reviewer_name?.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium dark:text-white text-gray-900 text-sm">{r.reviewer_name}</div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex text-amber-400 gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3 h-3 ${i < r.star_rating ? 'fill-amber-400' : 'dark:text-white text-gray-900/10'}`} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-dark-600 italic mb-6 leading-relaxed">&quot;{r.review_text}&quot;</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => approveMutation.mutate(r.id)}
                  disabled={approveMutation.isPending}
                  className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold py-2.5 rounded-xl transition-all border border-emerald-500/20"
                >
                  Approve
                </button>
                <button 
                  onClick={() => {
                    const note = prompt('Reason for rejection?');
                    if (note !== null) rejectMutation.mutate({ id: r.id, note });
                  }}
                  disabled={rejectMutation.isPending}
                  className="flex-1 bg-danger/10 hover:bg-danger/20 text-danger text-xs font-bold py-2.5 rounded-xl transition-all border border-danger/20"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
          {pending.length === 0 && (
             <div className="text-center py-20 text-dark-600">
               <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
               <p className="text-sm italic">All caught up! No pending reviews.</p>
             </div>
          )}
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col min-h-0 max-h-[70vh]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-heading font-bold dark:text-white text-gray-900">Live on Landing Page ({live.length}/8)</h3>
          <button className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors">Manage Priority</button>
        </div>
        <div className="space-y-3 overflow-y-auto pr-2 scrollbar-hide">
          {live.map((r: any) => (
             <div key={r.id} className="flex items-center gap-4 p-4 bg-black/20 rounded-2xl border dark:border-white/5 border-black/5 hover:dark:border-white/10 hover:border-black/10 transition-colors group">
               <GripVertical className="w-4 h-4 text-dark-700 cursor-move" />
               <div className="flex-1 min-w-0">
                 <div className="text-sm dark:text-white text-gray-900 font-medium truncate">{r.reviewer_name}</div>
                 <div className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 truncate italic">&quot;{r.review_text}&quot;</div>
               </div>
               <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                  onClick={() => rejectMutation.mutate({ id: r.id })}
                  className="p-1.5 bg-danger/10 text-danger rounded-lg hover:bg-danger/20"
                 >
                   <Ban className="w-3.5 h-3.5"/>
                 </button>
               </div>
             </div>
          ))}
          {live.length === 0 && (
            <div className="text-center py-20 text-dark-600 border border-dashed dark:border-white/5 border-black/5 rounded-2xl">
              <Star className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm italic font-heading">No reviews showing yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FAQEditor() {
  const queryClient = useQueryClient();
  const { data: faqData, isLoading } = useQuery({
    queryKey: ['admin-faq'],
    queryFn: async () => {
      const res = await api.get('/admin/content/faq');
      return res.data.data;
    }
  });

  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (faqData?.en?.items) {
      setItems(faqData.en.items);
    }
  }, [faqData]);

  const updateMutation = useMutation({
    mutationFn: async (newItems: any[]) => {
      return api.put('/admin/content/faq', { items: newItems });
    },
    onSuccess: () => {
      toast.success('FAQ updated');
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
    }
  });

  const handleAddItem = () => {
    setItems([...items, { question: '', answer: '', question_bn: '', answer_bn: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  if (isLoading) return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="glass-card p-6 h-full max-w-4xl flex flex-col min-h-0 max-h-[70vh]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-heading font-bold dark:text-white text-gray-900">Frequently Asked Questions</h3>
        <button 
          onClick={() => updateMutation.mutate(items)}
          disabled={updateMutation.isPending}
          className="btn-primary py-1.5 px-4 text-xs flex items-center gap-2"
        >
          {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save FAQ
        </button>
      </div>

      <button 
        onClick={handleAddItem}
        className="btn-secondary py-2 border-primary/30 text-primary hover:border-primary mb-6 w-full flex items-center justify-center gap-2"
      >
        + Add New Question
      </button>

      <div className="space-y-4 overflow-y-auto pr-2 scrollbar-hide flex-1">
        {items.map((item, i) => (
          <div key={i} className="p-5 dark:bg-white/5 bg-black/5 rounded-2xl border dark:border-white/5 border-black/5 flex gap-4 items-start group">
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-1 block uppercase">Question (EN)</label>
                   <input 
                    type="text" 
                    value={item.question} 
                    onChange={e => handleUpdateItem(i, 'question', e.target.value)}
                    className="input-field text-sm font-bold" 
                    placeholder="e.g. How does it work?"
                   />
                </div>
                <div>
                   <label className="text-[10px] text-primary-400 mb-1 block uppercase">Question (BN)</label>
                   <input 
                    type="text" 
                    value={item.question_bn} 
                    onChange={e => handleUpdateItem(i, 'question_bn', e.target.value)}
                    className="input-field text-sm font-bold font-bengali" 
                    placeholder="প্রশ্ন এখানে লিখুন"
                   />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-1 block uppercase">Answer (EN)</label>
                   <textarea 
                    value={item.answer} 
                    onChange={e => handleUpdateItem(i, 'answer', e.target.value)}
                    className="input-field text-sm min-h-[80px]" 
                    placeholder="The AI handles..."
                   />
                </div>
                <div>
                   <label className="text-[10px] text-primary-400 mb-1 block uppercase">Answer (BN)</label>
                   <textarea 
                    value={item.answer_bn} 
                    onChange={e => handleUpdateItem(i, 'answer_bn', e.target.value)}
                    className="input-field text-sm min-h-[80px] font-bengali" 
                    placeholder="উত্তর এখানে লিখুন"
                   />
                </div>
              </div>
            </div>
            <button 
              onClick={() => handleRemoveItem(i)}
              className="text-danger/40 hover:text-danger p-2 hover:bg-danger/10 rounded-lg transition-colors mt-6"
            >
              <Ban className="w-4 h-4"/>
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-20 text-dark-600 border border-dashed dark:border-white/5 border-black/5 rounded-2xl">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm italic">No FAQ items yet. Click add to start.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BannerEditor() {
  const queryClient = useQueryClient();
  const { data: bannerData, isLoading } = useQuery({
    queryKey: ['admin-banner'],
    queryFn: async () => {
      const res = await api.get('/admin/content/banner');
      return res.data.data;
    }
  });

  const [bannerForm, setBannerForm] = useState<any>(null);

  useEffect(() => {
    if (bannerData) {
      setBannerForm({
        text_en: bannerData.en?.text || '',
        text_bn: bannerData.bn?.text || '',
        color: bannerData.en?.color || '#7C3AED',
        is_active: bannerData.en?.is_active || false,
        link: bannerData.en?.link || '',
      });
    }
  }, [bannerData]);

  const updateMutation = useMutation({
    mutationFn: async (formData: any) => {
      return api.put('/admin/content/banner', {
        en: { text: formData.text_en, link: formData.link },
        bn: { text: formData.text_bn },
        color: formData.color,
        is_active: formData.is_active
      });
    },
    onSuccess: () => {
      toast.success('Banner updated');
      queryClient.invalidateQueries({ queryKey: ['admin-banner'] });
    }
  });

  if (isLoading || !bannerForm) return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="glass-card p-8 h-full max-w-3xl space-y-8">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-heading font-bold dark:text-white text-gray-900 text-lg">Announcement Banner</h3>
        <button 
          onClick={() => updateMutation.mutate(bannerForm)}
          disabled={updateMutation.isPending}
          className="btn-primary py-2 px-6 flex items-center gap-2"
        >
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Banner
        </button>
      </div>

      <div className="flex items-center justify-between p-4 dark:bg-white/5 bg-black/5 rounded-2xl border dark:border-white/5 border-black/5">
        <div className="space-y-1">
          <label className="dark:text-white text-gray-900 font-medium block">Active Status</label>
          <p className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">Banner will be visible globally when active.</p>
        </div>
        <button 
          onClick={() => setBannerForm({...bannerForm, is_active: !bannerForm.is_active})}
          className={`w-12 h-6 rounded-full relative transition-all ${bannerForm.is_active ? 'bg-primary shadow-glow' : 'bg-[var(--bg-secondary)]'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${bannerForm.is_active ? 'right-1' : 'left-1'}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase block mb-2">Banner Text (EN)</label>
          <input 
            type="text" 
            value={bannerForm.text_en} 
            onChange={e => setBannerForm({...bannerForm, text_en: e.target.value})}
            className="input-field" 
            placeholder="e.g. Flash Sale Live!"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-primary-400 uppercase block mb-2">Banner Text (BN)</label>
          <input 
            type="text" 
            value={bannerForm.text_bn} 
            onChange={e => setBannerForm({...bannerForm, text_bn: e.target.value})}
            className="input-field font-bengali" 
            placeholder="বাংলা টেক্সট..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase block mb-2">Banner Color</label>
          <div className="flex gap-3 flex-wrap">
            {['#7C3AED', '#06B6D4', '#10B981', '#EF4444', '#F59E0B'].map(c => (
              <button 
                key={c}
                onClick={() => setBannerForm({...bannerForm, color: c})}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${bannerForm.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase block mb-2">Redirect URL (Optional)</label>
          <input 
            type="text" 
            value={bannerForm.link} 
            onChange={e => setBannerForm({...bannerForm, link: e.target.value})}
            className="input-field" 
            placeholder="/pricing"
          />
        </div>
      </div>
      
      {/* Visual Preview */}
      <div className="pt-6">
        <label className="text-xs font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase block mb-4">Desktop Preview</label>
        <div className="w-full h-12 rounded-xl flex items-center justify-center text-sm font-bold dark:text-white text-gray-900 shadow-lg overflow-hidden animate-pulse" style={{ backgroundColor: bannerForm.color }}>
          {bannerForm.text_en || 'Your Banner Message'}
        </div>
      </div>
    </div>
  );
}
