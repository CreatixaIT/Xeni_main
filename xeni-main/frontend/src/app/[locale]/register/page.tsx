'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Link, useRouter } from '@/i18n/routing';
import { Sparkles, Mail, Lock, User } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import { useGoogleLogin } from '@react-oauth/google';

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      toast.success('Account created! Check your email for verification code.');
      router.push('/verify-otp?email=' + form.email);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('errors.server_error'));
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        }).then(res => res.json());

        const res = await api.post('/auth/google/callback', {
          google_id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          avatar: userInfo.picture || '',
        });

        const { access_token, refresh_token, user } = res.data.data;
        setAuth(user, access_token, refresh_token);
        toast.success('Account created with Google!');
        router.push('/dashboard');
      } catch (err: any) {
        toast.error('Google signup failed. Please try email registration.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => toast.error('Google sign-up cancelled.'),
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-950 via-gray-900 to-violet-950 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ x: [0, -100, 0], y: [0, 80, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[15%] -right-[10%] w-[45%] h-[45%] bg-accent/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ x: [0, 80, 0], y: [0, -60, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[15%] -left-[10%] w-[55%] h-[55%] bg-primary/10 rounded-full blur-[120px]" 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="relative w-full max-w-md z-10"
      >
        <div className="glass-card p-8 dark:border-white/10 border-black/10 shadow-2xl relative overflow-hidden">
          {/* Subtle reflection effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-glow-sm">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-heading font-black dark:text-white text-gray-900 tracking-tight">{t('auth.register_title')}</h1>
              <p className="text-slate-600 dark:text-dark-600 text-sm mt-2 font-medium">{t('auth.register_subtitle')}</p>
            </div>

            <button 
              type="button" 
              onClick={() => loginWithGoogle()} 
              className="btn-secondary w-full flex items-center justify-center gap-3 mb-8 dark:border-white/5 border-black/5 group hover:border-primary/30 transition-all font-bold"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {t('auth.google_signin')}
            </button>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px dark:bg-white/10 bg-black/10" />
              <span className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-xs font-bold uppercase tracking-widest">{t('auth.or')}</span>
              <div className="flex-1 h-px dark:bg-white/10 bg-black/10" />
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest ml-1">{t('auth.full_name')}</label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-dark-700 group-focus-within:text-primary transition-colors" />
                  <input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="John Doe" className="input-field pl-11 dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10 focus:dark:bg-white/10 focus:bg-black/10" required autoComplete="name" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest ml-1">{t('auth.email')}</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-dark-700 group-focus-within:text-primary transition-colors" />
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@example.com" className="input-field pl-11 dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10 focus:dark:bg-white/10 focus:bg-black/10" required autoComplete="email" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest ml-1">{t('auth.password')}</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-dark-700 group-focus-within:text-primary transition-colors" />
                  <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="••••••••" className="input-field pl-11 dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10 focus:dark:bg-white/10 focus:bg-black/10" required minLength={8} autoComplete="new-password" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-sm uppercase tracking-widest font-black shadow-glow mt-4">
                {loading ? t('common.loading') : t('nav.register')}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm font-medium">
                {t('auth.has_account')}{' '}
                <Link href="/login" className="text-primary font-bold hover:text-primary-400 transition-colors">{t('nav.login')}</Link>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
