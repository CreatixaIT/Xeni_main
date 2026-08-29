'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, Globe, Bell, Save, Lock, Smartphone, Cloud, Loader2, Brain } from 'lucide-react';
import { Link } from '@/i18n/routing';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function AdminSettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [globalRules, setGlobalRules] = useState('');

  useEffect(() => {
    fetchglobalRules();
  }, []);

  const fetchglobalRules = async () => {
    try {
      const res = await api.get('/admin/settings/global_agent_rules');
      if (res.data.data?.setting_value) {
        setGlobalRules(res.data.data.setting_value);
      }
    } catch (err) {
      console.error('Failed to load global rules:', err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/admin/settings/global_agent_rules', {
        value: globalRules,
        description: 'Global Master Prompt for all AI workers across the platform'
      });
      toast.success('System settings updated successfully');
    } catch (err) {
      toast.error('Failed to update system settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-[1200px] mx-auto pb-24 h-full flex flex-col">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold dark:text-white text-gray-900 mb-2">System Settings</h1>
          <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700">Configure global platform parameters and infrastructure links.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-glow"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
          Save Config
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* AI Master Rules */}
          <section className="glass-card p-6 space-y-6 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-3 border-b dark:border-white/5 border-black/5 pb-4">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                 <h3 className="text-lg font-heading font-bold dark:text-white text-gray-900">AI Global Agent Rules</h3>
                 <p className="text-[11px] text-slate-600 dark:text-slate-600 dark:text-dark-700 mt-1">Manage structured, priority-based platform constraints for all AI agents.</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm text-dark-300">The legacy text-based rule editor has been upgraded to a powerful, two-tier Rules Engine.</p>
              <Link href="/admin/rules" className="btn-primary inline-flex items-center gap-2 mt-2">
                <Brain className="w-4 h-4" /> Go to New Rules Engine
              </Link>
            </div>
          </section>

          {/* Branding & Identity */}
          <section className="glass-card p-6 space-y-6">
            <div className="flex items-center gap-3 border-b dark:border-white/5 border-black/5 pb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-heading font-bold dark:text-white text-gray-900">Platform Branding</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-wider">Site Name</label>
                <input type="text" defaultValue="Xeni AI" className="input-field" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-wider">Support Email</label>
                <input type="email" defaultValue="support@xeni.ai" className="input-field" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-wider">Logo URL (Dark Mode)</label>
              <div className="flex gap-4">
                <input type="text" defaultValue="/logo-full.png" className="input-field flex-1" />
                <button className="btn-secondary px-4 text-xs">Preview</button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Status & Toggles */}
        <div className="space-y-8">
          <section className="glass-card p-6 space-y-6">
            <h3 className="font-heading font-bold dark:text-white text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" /> Maintenance
            </h3>
            
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-sm font-bold dark:text-white text-gray-900">System Status</div>
                <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">Operational</div>
              </div>
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-300">Public Registration</span>
                <div className="w-10 h-5 bg-primary rounded-full relative">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
