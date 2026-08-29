'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/routing';
import { Sparkles, Mail } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('If this email exists, a reset code has been sent.');
    } catch {
      toast.error(t('errors.server_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-950 via-gray-900 to-violet-950 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ x: [0, 60, 0], y: [0, 100, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -left-[5%] w-[45%] h-[45%] bg-primary/10 rounded-full blur-[120px]" 
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md z-10">
        <div className="glass-card p-8 dark:border-white/10 border-black/10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-glow-sm">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-heading font-black dark:text-white text-gray-900 tracking-tight">{t('auth.forgot_password')}</h1>
              <p className="text-slate-600 dark:text-dark-600 text-sm mt-2 font-medium">Enter your email to receive a reset code.</p>
            </div>

            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest ml-1">{t('auth.email')}</label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-dark-700 group-focus-within:text-primary transition-colors" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="input-field pl-11 dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10 focus:dark:bg-white/10 focus:bg-black/10" required />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-sm uppercase tracking-widest font-black shadow-glow">
                  {loading ? t('common.loading') : t('common.submit')}
                </button>
              </form>
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-success/15 flex items-center justify-center mx-auto mb-6 border border-success/20 shadow-glow-sm glow-emerald">
                  <Mail className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-xl font-bold dark:text-white text-gray-900 mb-2">Check your email!</h3>
                <p className="text-slate-600 dark:text-dark-600 text-sm mb-8 leading-relaxed">
                  We sent a 6-digit code to <br/>
                  <span className="text-primary font-bold">{email}</span>
                </p>
                <Link href={`/reset-password?email=${encodeURIComponent(email)}`} className="btn-primary w-full py-4 text-sm uppercase tracking-widest font-black shadow-glow">
                  Enter Reset Code
                </Link>
              </div>
            )}

            <div className="mt-8 text-center">
              <Link href="/login" className="text-primary font-bold hover:text-primary-400 transition-colors text-sm flex items-center justify-center gap-2">
                <span className="text-slate-600 dark:text-slate-600 dark:text-dark-700 font-medium">Wait, I remember!</span> {t('common.back')} to Login
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
