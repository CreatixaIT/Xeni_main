'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Settings, User, Shield, Bell, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const t = useTranslations();
  const { user, updateUser } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState('profile');
  const [name, setName] = useState(user?.full_name || '');
  const [lang, setLang] = useState(user?.preferred_language || 'en');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'profile', label: t('settings.profile'), icon: User },
    { id: 'security', label: t('settings.security'), icon: Shield },
    { id: 'language', label: t('settings.language'), icon: Globe },
  ];

  const saveProfile = async () => {
    setLoading(true);
    try {
      await api.put('/user/me', { full_name: name, preferred_language: lang });
      updateUser({ full_name: name, preferred_language: lang });
      toast.success('Profile updated');
      if (lang !== user?.preferred_language) router.push('/settings');
    } catch { toast.error(t('errors.server_error')); }
    finally { setLoading(false); }
  };

  const changePassword = async () => {
    setLoading(true);
    try {
      await api.put('/user/me/password', { current_password: currentPw, new_password: newPw });
      toast.success('Password changed');
      setCurrentPw(''); setNewPw('');
    } catch (err: any) { toast.error(err.response?.data?.error || t('errors.server_error')); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-dark px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-heading font-bold dark:text-white text-gray-900 mb-8 flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" /> {t('settings.title')}
        </h1>

        <div className="flex gap-2 mb-8">
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${tab === tb.id ? 'bg-primary text-white' : 'bg-white/5 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:bg-white/10'}`}>
              <tb.icon className="w-4 h-4" /> {tb.label}
            </button>
          ))}
        </div>

        <div className="glass-card p-8">
          {tab === 'profile' && (
            <div className="space-y-4">
              <div>
                <label className="block text-dark-600 text-sm mb-1">{t('auth.full_name')}</label>
                <input value={name} onChange={e => setName(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-dark-600 text-sm mb-1">{t('auth.email')}</label>
                <input value={user?.email} disabled className="input-field opacity-50" />
              </div>
              <button onClick={saveProfile} disabled={loading} className="btn-primary">{loading ? t('common.loading') : t('settings.save_changes')}</button>
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-lg font-heading font-semibold dark:text-white text-gray-900">{t('settings.change_password')}</h3>
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder={t('settings.current_password')} className="input-field" />
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder={t('settings.new_password')} className="input-field" />
              <button onClick={changePassword} disabled={loading} className="btn-primary">{loading ? t('common.loading') : t('settings.change_password')}</button>

              <div className="border-t dark:border-white/10 border-black/10 pt-4 mt-6">
                <h3 className="text-lg font-heading font-semibold dark:text-white text-gray-900 mb-2">{t('settings.enable_2fa')}</h3>
                <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm mb-3">Secure your account with Google Authenticator.</p>
                <button className={user?.two_fa_enabled ? 'badge-success' : 'btn-accent text-sm'}>{user?.two_fa_enabled ? '2FA Enabled ✓' : t('settings.enable_2fa')}</button>
              </div>
            </div>
          )}

          {tab === 'language' && (
            <div className="space-y-4">
              <h3 className="text-lg font-heading font-semibold dark:text-white text-gray-900">{t('settings.language')}</h3>
              <div className="flex gap-3">
                {[{ code: 'en', label: 'English' }, { code: 'bn', label: 'বাংলা' }].map(l => (
                  <button key={l.code} onClick={() => setLang(l.code)} className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${lang === l.code ? 'bg-primary text-white shadow-glow' : 'bg-white/5 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:bg-white/10'}`}>{l.label}</button>
                ))}
              </div>
              <button onClick={saveProfile} disabled={loading} className="btn-primary">{loading ? t('common.loading') : t('settings.save_changes')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
