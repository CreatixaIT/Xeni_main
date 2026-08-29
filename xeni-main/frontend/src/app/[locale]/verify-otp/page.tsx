'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Link, useRouter } from '@/i18n/routing';
import { Sparkles, Shield } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';

export default function VerifyOTPPage() {
  const t = useTranslations();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').slice(0, 6);
    const digits = pasted.split('');
    const newCode = [...code];
    digits.forEach((d, i) => { if (i < 6) newCode[i] = d; });
    setCode(newCode);
  };

  const handleVerify = async () => {
    const otp = code.join('');
    if (otp.length !== 6) return;

    setLoading(true);
    try {
      await api.post('/auth/verify-email', { email, code: otp });
      toast.success('Email verified! You can now log in.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post('/auth/resend-otp', { email });
      toast.success('New code sent to your email!');
    } catch {
      toast.error('Failed to resend code.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-950 via-gray-900 to-violet-950 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, -40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[10%] -right-[10%] w-[45%] h-[45%] bg-accent/10 rounded-full blur-[120px]" 
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md z-10">
        <div className="glass-card p-8 text-center dark:border-white/10 border-black/10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-6 border border-primary/20 shadow-glow-sm">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-heading font-black dark:text-white text-gray-900 tracking-tight mb-2">{t('auth.verify_title')}</h1>
            <p className="text-slate-600 dark:text-dark-600 text-sm mb-2 font-medium">{t('auth.verify_subtitle')}</p>
            {email && <div className="badge bg-primary/10 text-primary-300 border-primary/20 font-bold px-4 py-1.5 mb-8">{email}</div>}

            {/* OTP Inputs */}
            <div className="flex gap-3 justify-center mb-10" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value.replace(/\D/, ''))}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-12 h-14 text-center text-2xl font-mono font-black glass-card dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10 focus:dark:bg-white/10 focus:bg-black/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all shadow-glow-sm"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button 
              onClick={handleVerify} 
              disabled={loading || code.join('').length !== 6} 
              className="btn-primary w-full py-4 text-sm uppercase tracking-widest font-black shadow-glow mb-6 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? t('common.loading') : t('common.confirm')}
            </button>

            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm font-medium">
                Didn&apos;t receive the code?{' '}
                <button onClick={handleResend} className="text-primary hover:text-primary-400 font-bold transition-colors">Resend</button>
              </p>
              <Link href="/login" className="text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
