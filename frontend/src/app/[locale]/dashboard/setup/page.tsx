'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import {
  Settings, ChevronRight, ExternalLink,
  MessageCircle, CreditCard, Truck, Wand2, BarChart3,
  Globe2, Shield, Check, AlertCircle
} from 'lucide-react';

const sectionConfig = [
  { id: 'facebook', icon: Globe2, color: 'from-blue-500 to-indigo-600', status: 'required' as const, link: '/dashboard/pages' },
  { id: 'shop', icon: Settings, color: 'from-emerald-500 to-green-600', status: 'required' as const, link: '/dashboard/shop' },
  { id: 'payment', icon: CreditCard, color: 'from-pink-500 to-rose-600', status: 'recommended' as const },
  { id: 'courier', icon: Truck, color: 'from-cyan-500 to-blue-600', status: 'recommended' as const },
  { id: 'creative', icon: Wand2, color: 'from-purple-500 to-violet-600', status: 'optional' as const, link: '/dashboard/creative' },
  { id: 'intelligence', icon: BarChart3, color: 'from-amber-500 to-orange-600', status: 'optional' as const, link: '/dashboard/analytics' },
  { id: 'subscription', icon: Shield, color: 'from-rose-500 to-pink-600', status: 'required' as const, link: '/billing' },
];

const linkMap: Record<string, string> = {
  'Go to FB Pages': '/dashboard/pages',
  'FB Pages-এ যান': '/dashboard/pages',
  'Go to My Shop': '/dashboard/shop',
  'My Shop-এ যান': '/dashboard/shop',
  'Go to Products': '/dashboard/products',
  'Products-এ যান': '/dashboard/products',
  'Go to Creative Studio': '/dashboard/creative',
  'Creative Studio-তে যান': '/dashboard/creative',
  'Go to Analytics': '/dashboard/analytics',
  'Analytics-এ যান': '/dashboard/analytics',
  'Go to Billing': '/billing',
  'Billing-এ যান': '/billing',
};

export default function SetupGuidePage() {
  const t = useTranslations('setup');
  const locale = useLocale();
  const [openSection, setOpenSection] = useState<string | null>('facebook');

  const statusColors = {
    required: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    recommended: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    optional: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
          <Settings className="w-7 h-7 text-primary" /> {t('title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {t('subtitle')}
        </p>
      </div>

      {/* Progress */}
      <div className="glass-card p-5 mb-8">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('required')} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(3 {t('steps_label')})</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('recommended')} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(2 {t('steps_label')})</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('optional')} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(2 {t('steps_label')})</span>
            </span>
          </div>
        </div>
      </div>

      {/* Guide Sections */}
      <div className="space-y-3">
        {sectionConfig.map((section) => {
          const Icon = section.icon;
          const isOpen = openSection === section.id;
          const sectionT = t.raw(section.id) as { title: string; steps: { title: string; description: string; action?: string }[] };

          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card overflow-hidden"
            >
              <button
                onClick={() => setOpenSection(isOpen ? null : section.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:dark:bg-white/5 hover:bg-black/5 transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${section.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-6 h-6 dark:text-white text-gray-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                    {sectionT.title}
                  </h3>
                  <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border mt-1 ${statusColors[section.status]}`}>
                    {t(section.status)}
                  </span>
                </div>
                <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </motion.div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4">
                      <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }} />
                      {sectionT.steps.map((step, i) => (
                        <div key={i} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-primary text-sm font-bold">{i + 1}</span>
                            </div>
                            {i < sectionT.steps.length - 1 && (
                              <div className="w-0.5 flex-1 mt-1 rounded-full" style={{ background: 'var(--border-color)' }} />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                              {step.title}
                            </h4>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                              {step.description}
                            </p>
                            {step.action && linkMap[step.action] && (
                              <a
                                href={`/${locale}${linkMap[step.action]}`}
                                className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary font-medium hover:underline"
                              >
                                {step.action} <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Help Footer */}
      <div className="glass-card p-6 mt-8 text-center">
        <h3 className="font-heading font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('need_help')}
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {t('help_text')}
        </p>
        <a
          href="mailto:support@xeni.xentroinfotech.com"
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <MessageCircle className="w-4 h-4" /> {t('contact_support')}
        </a>
      </div>
    </div>
  );
}
