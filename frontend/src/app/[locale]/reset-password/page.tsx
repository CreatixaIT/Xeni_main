'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { useRouter, Link } from '@/i18n/routing';
import { Sparkles, Lock, Key } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, code, new_password: newPassword });
      toast.success('Password reset successfully! Please log in.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-950 via-gray-900 to-violet-950 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ x: [0, -80, 0], y: [0, 120, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" 
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
              <h1 className="text-3xl font-heading font-black dark:text-white text-gray-900 tracking-tight">Reset Password</h1>
              <p className="text-slate-600 dark:text-dark-600 text-sm mt-2 font-medium">Enter the code from your email and set a new password.</p>
              {email && <div className="mt-4 badge bg-primary/10 text-primary-300 border-primary/20 font-bold px-4">{email}</div>}
            </div>

            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest ml-1">Verification Code</label>
                <div className="relative group">
                  <Key className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-dark-700 group-focus-within:text-primary transition-colors" />
                  <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="000 000" className="input-field pl-11 text-center tracking-[0.5em] font-black dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10 focus:dark:bg-white/10 focus:bg-black/10" maxLength={6} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest ml-1">{t('settings.new_password')}</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-dark-700 group-focus-within:text-primary transition-colors" />
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="input-field pl-11 dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10 focus:dark:bg-white/10 focus:bg-black/10" required minLength={8} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest ml-1">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-dark-700 group-focus-within:text-primary transition-colors" />
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="input-field pl-11 dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10 focus:dark:bg-white/10 focus:bg-black/10" required minLength={8} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-sm uppercase tracking-widest font-black shadow-glow mt-4">
                {loading ? t('common.loading') : 'Update Password'}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link href="/login" className="text-primary font-bold hover:text-primary-400 transition-colors text-sm flex items-center justify-center gap-2">
                {t('common.back')} to Login
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
