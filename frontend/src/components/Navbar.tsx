'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { Sparkles, LayoutDashboard, CreditCard, Settings, LogOut, Shield, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function Navbar() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    logout();
    toast.success('Logged out');
    router.push('/');
  };

  const navLinks = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/billing', label: t('nav.billing'), icon: CreditCard },
    { href: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  if (!isAuthenticated) return null;

  return (
    <nav className="sticky top-0 z-50 glass-card border-none border-b" style={{ borderColor: 'var(--border-color)' }}>
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <Sparkles className="w-7 h-7 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-xl font-heading font-bold gradient-text">XENI</span>
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.map(link => {
            const isActive = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-primary/20 text-primary' : 'hover:bg-white/5'}`} style={{ color: isActive ? undefined : 'var(--text-muted)' }}>
                <link.icon className="w-4 h-4" />
                <span className="hidden md:inline">{link.label}</span>
              </Link>
            );
          })}

          {user?.role === 'super_admin' && (
            <Link href="/admin" className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${pathname === '/admin' ? 'bg-primary/20 text-primary' : 'hover:bg-white/5'}`} style={{ color: pathname === '/admin' ? undefined : 'var(--text-muted)' }}>
              <Shield className="w-4 h-4" />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}

          <div className="w-px h-6 mx-2" style={{ background: 'var(--border-color)' }} />

          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--bg-card)' }}>
            <button onClick={() => router.replace(pathname || '/', { locale: 'en' })} className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${locale === 'en' ? 'bg-primary text-white' : ''}`} style={locale !== 'en' ? { color: 'var(--text-muted)' } : undefined}>EN</button>
            <button onClick={() => router.replace(pathname || '/', { locale: 'bn' })} className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${locale === 'bn' ? 'bg-primary text-white' : ''}`} style={locale !== 'bn' ? { color: 'var(--text-muted)' } : undefined}>বাং</button>
          </div>

          {/* Theme Toggle */}
          <button onClick={toggleTheme} className="p-2 rounded-lg transition-all" style={{ background: 'var(--bg-card)' }}>
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          <div className="w-px h-6 mx-2" style={{ background: 'var(--border-color)' }} />

          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-danger/70 hover:text-danger hover:bg-danger/10 transition-all">
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">{t('nav.logout')}</span>
          </button>

          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white text-xs font-bold ml-2">
            {user?.full_name?.charAt(0) || 'X'}
          </div>
        </div>
      </div>
    </nav>
  );
}
