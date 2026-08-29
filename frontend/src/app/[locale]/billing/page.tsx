'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Check, Sparkles, MessageCircle, ShoppingBag, Package, Wand2, BarChart3, Crown, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

interface Plan {
  id: string;
  name: string;
  tier: string;
  price_monthly_bdt: number;
  features: {
    agents: string[];
    max_orders_per_month: number;
    max_pages: number;
    storage_gb: number;
    description?: string;
    custom_pricing?: boolean;
  };
}

const tierIcons: Record<string, typeof MessageCircle> = {
  starter: MessageCircle,
  professional: ShoppingBag,
  premium: Crown,
  enterprise: Sparkles,
};

const tierFeatureLabels: Record<string, string[]> = {
  starter: ['💬 Conversation Agent', '200 orders/month', '1 Facebook Page', '2 GB storage', 'Email support'],
  professional: ['💬 Conversation Agent', '📦 Order Processing Agent', '📊 Inventory Agent', '1,000 orders/month', '3 Facebook Pages', '10 GB storage', 'Priority support'],
  premium: ['All 5 AI Agents', 'Unlimited orders', '10 Facebook Pages', '50 GB storage', '🎨 AI Image Generation', '🧠 Sales Intelligence', 'Dedicated support'],
  enterprise: ['All 5 AI Agents', 'Unlimited everything', 'White-label branding', 'Custom API access', 'ERP Integration', 'Dedicated account manager', 'SLA guarantee'],
};

export default function BillingPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, subscription, setSubscription } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Handle payment return status
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      toast.success('Payment successful! Your plan has been upgraded. 🎉');
      // Refresh subscription
      api.get('/billing/subscription').then(res => {
        if (res.data.data?.plan_tier) setSubscription(res.data.data);
      }).catch(() => {});
      // Redirect to dashboard after 3 seconds
      setTimeout(() => router.push('/dashboard'), 3000);
    } else if (status === 'fail') {
      toast.error('Payment failed. Please try again.');
    } else if (status === 'cancel') {
      toast('Payment was cancelled.', { icon: '⚠️' });
    }
  }, [searchParams, router, setSubscription]);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await api.get('/billing/plans');
      setPlans(res.data.data || []);
    } catch {
      setPlans([]);
    }
    setLoadingPlans(false);
  }, []);

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await api.get('/billing/subscription');
      const sub = res.data.data;
      if (sub && sub.plan_tier) {
        setSubscription(sub);
      }
    } catch {}
  }, [setSubscription]);

  useEffect(() => {
    fetchPlans();
    fetchSubscription();
  }, [fetchPlans, fetchSubscription]);

  const handleSubscribe = async (tier: string) => {
    if (tier === 'enterprise') {
      // Open email for enterprise
      window.location.href = 'mailto:sales@xeni.xentroinfotech.com?subject=Enterprise Plan Inquiry';
      return;
    }
    setLoading(tier);
    try {
      const res = await api.post('/billing/subscribe/sslcommerz', { plan_tier: tier });
      const data = res.data.data;
      if (data.redirect_url || data.session_url) {
        window.location.href = data.redirect_url || data.session_url;
      } else {
        toast.success('Payment initiated! Redirecting...');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error;
      if (err.response?.status === 403) {
        toast.error(msg || t('errors.upgrade_required'));
      } else {
        toast.error(msg || t('errors.server_error'));
      }
    } finally {
      setLoading(null);
    }
  };

  // Use API plans or fallback
  const displayPlans = plans.length > 0
    ? plans.map(p => ({
        tier: p.tier,
        price: p.price_monthly_bdt,
        features: tierFeatureLabels[p.tier] || [],
        popular: p.tier === 'professional',
      }))
    : [
        { tier: 'starter', price: 2500, features: tierFeatureLabels.starter, popular: false },
        { tier: 'professional', price: 7500, features: tierFeatureLabels.professional, popular: true },
        { tier: 'premium', price: 25000, features: tierFeatureLabels.premium, popular: false },
        { tier: 'enterprise', price: 0, features: tierFeatureLabels.enterprise, popular: false },
      ];

  return (
    <div className="px-6 py-12" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto">
        {/* Back to Dashboard */}
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 mb-8 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:dark:bg-white/10 hover:bg-black/10" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-heading font-bold gradient-text mb-3">{t('nav.billing')}</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {t('billing.current_plan')}: <span className="text-primary font-semibold">{subscription?.plan_tier?.toUpperCase() || 'FREE'}</span>
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            All prices in BDT (৳). Pay via bKash, Nagad, or card through SSLCommerz.
          </p>
        </div>

        {loadingPlans ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayPlans.map((plan, i) => {
              const isActive = subscription?.plan_tier === plan.tier;
              const TierIcon = tierIcons[plan.tier] || Sparkles;
              return (
                <motion.div
                  key={plan.tier}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative glass-card p-6 ${plan.popular ? 'border-primary/50 shadow-glow' : ''} ${isActive ? 'ring-2 ring-primary' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-white text-xs font-bold px-4 py-1 rounded-full">
                      POPULAR
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute -top-3 right-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      CURRENT
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <TierIcon className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-heading font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
                      {t(`billing.${plan.tier}`)}
                    </h3>
                  </div>
                  <div className="mb-4">
                    {plan.price > 0 ? (
                      <>
                        <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>৳{plan.price.toLocaleString()}</span>
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('billing.month')}</span>
                      </>
                    ) : (
                      <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('billing.custom_pricing')}</span>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6 text-sm">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <Check className="w-4 h-4 text-success shrink-0" />{f}
                      </li>
                    ))}
                  </ul>

                  {isActive ? (
                    <button disabled className="btn-secondary w-full opacity-50">{t('billing.current')}</button>
                  ) : plan.tier === 'enterprise' ? (
                    <button onClick={() => handleSubscribe('enterprise')} className="btn-secondary w-full">{t('billing.contact_sales')}</button>
                  ) : (
                    <button onClick={() => handleSubscribe(plan.tier)} disabled={loading === plan.tier} className="btn-primary w-full">
                      {loading === plan.tier ? t('common.loading') : t('billing.pay_sslcommerz')}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
