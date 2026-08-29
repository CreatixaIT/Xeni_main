'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '@/i18n/routing';
import { Shield, ArrowRight, X, Crown } from 'lucide-react';

interface UpgradeModalState {
  isOpen: boolean;
  requiredPlan: string;
  message: string;
}

interface UpgradeModalContextType {
  showUpgradeModal: (requiredPlan: string, message?: string) => void;
  hideUpgradeModal: () => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextType>({
  showUpgradeModal: () => {},
  hideUpgradeModal: () => {},
});

export const useUpgradeModal = () => useContext(UpgradeModalContext);

// Global callback for API interceptor to trigger the modal
let globalShowUpgrade: ((plan: string, message?: string) => void) | null = null;
export function triggerUpgradeModal(plan: string, message?: string) {
  if (globalShowUpgrade) globalShowUpgrade(plan, message);
}

const planDetails: Record<string, { name: string; price: string; features: string[] }> = {
  starter: {
    name: 'Starter',
    price: '৳2,500',
    features: ['Conversation Agent', '200 orders/month', '1 Facebook Page'],
  },
  professional: {
    name: 'Professional',
    price: '৳7,500',
    features: ['Conversation + Order + Inventory', '1,000 orders/month', '3 Facebook Pages'],
  },
  premium: {
    name: 'Premium',
    price: '৳25,000',
    features: ['All 5 AI Agents', 'Unlimited orders', '10 Facebook Pages', 'AI Image Generation'],
  },
};

export function UpgradeModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<UpgradeModalState>({
    isOpen: false,
    requiredPlan: 'professional',
    message: '',
  });

  const showUpgradeModal = (requiredPlan: string, message?: string) => {
    setModal({
      isOpen: true,
      requiredPlan: requiredPlan.toLowerCase(),
      message: message || `This feature requires the ${requiredPlan} plan or higher.`,
    });
  };

  const hideUpgradeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    globalShowUpgrade = showUpgradeModal;
    return () => { globalShowUpgrade = null; };
  }, []);

  const details = planDetails[modal.requiredPlan] || planDetails.professional;

  return (
    <UpgradeModalContext.Provider value={{ showUpgradeModal, hideUpgradeModal }}>
      {children}
      <AnimatePresence>
        {modal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={hideUpgradeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 max-w-md w-full relative"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={hideUpgradeModal}
                className="absolute top-4 right-4 p-1 rounded-lg hover:dark:bg-white/10 hover:bg-black/10 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-primary to-accent flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-8 h-8 dark:text-white text-gray-900" />
                </div>
                <h2 className="text-2xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>
                  Upgrade Required
                </h2>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                  {modal.message}
                </p>
              </div>

              <div className="glass-card p-4 mb-6 border border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-heading font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                    {details.name} Plan
                  </span>
                  <span className="text-primary font-bold">{details.price}/mo</span>
                </div>
                <ul className="space-y-2">
                  {details.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Shield className="w-3.5 h-3.5 text-success shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/billing"
                onClick={hideUpgradeModal}
                className="btn-primary w-full flex items-center justify-center gap-2 text-base"
              >
                Upgrade Now <ArrowRight className="w-5 h-5" />
              </Link>
              <button
                onClick={hideUpgradeModal}
                className="w-full text-center text-sm mt-3 py-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Maybe later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </UpgradeModalContext.Provider>
  );
}
