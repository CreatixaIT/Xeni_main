'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import {
  Sparkles, LayoutDashboard, ShoppingBag, Package, MessageCircle,
  BarChart3, Globe2, Settings, LogOut, CreditCard, Shield,
  Sun, Moon, Store, ChevronLeft, ChevronRight, Wand2, HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useState } from 'react';

const sidebarLinks = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/shop', label: 'My Shop', icon: Store },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/creative', label: 'Creative', icon: Wand2 },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/dashboard/conversations', label: 'Inbox', icon: MessageCircle },
  { href: '/dashboard/pages', label: 'FB Pages', icon: Globe2 },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/rules', label: 'AI Rules Engine', icon: Sparkles },
  { href: '/dashboard/setup', label: 'Setup Guide', icon: HelpCircle },
];

const bottomLinks = [
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    logout();
    toast.success('Logged out');
    router.push('/');
  };

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? 'w-[68px]' : 'w-[240px]'} flex flex-col border-r dark:border-white/10 border-black/10 dark:bg-black/40 bg-[rgba(0,0,0,0.02)] backdrop-blur-xl transition-all duration-300 shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b dark:border-white/10 border-black/10">
          <Sparkles className="w-7 h-7 text-primary shrink-0" />
          {!collapsed && <span className="text-xl font-heading font-bold gradient-text tracking-wider">XENI</span>}
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {sidebarLinks.map(link => {
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary/20 text-white shadow-glow border border-primary/30'
                    : 'text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 hover:dark:bg-white/5 hover:bg-black/5'
                }`}
                title={collapsed ? link.label : undefined}
              >
                <link.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary-300' : 'group-hover:text-primary-300'} transition-colors`} />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="border-t dark:border-white/10 border-black/10 px-2 py-3 space-y-1">
          {user?.role === 'super_admin' && (
            <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 hover:dark:bg-white/5 hover:bg-black/5 transition-all" title={collapsed ? 'Admin' : undefined}>
              <Shield className="w-5 h-5 shrink-0" />
              {!collapsed && <span>Admin</span>}
            </Link>
          )}
          {bottomLinks.map(link => {
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href} 
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                  isActive ? 'bg-primary/20 text-white shadow-glow' : 'text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:text-white hover:bg-white/5'
                }`} 
                title={collapsed ? link.label : undefined}
              >
                <link.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}

          {/* Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm w-full text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 hover:dark:bg-white/5 hover:bg-black/5 transition-all"
          >
            {collapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* User Section */}
        <div className="border-t dark:border-white/10 border-black/10 px-3 py-3 flex items-center gap-3 bg-black/20">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-glow">
            {user?.full_name?.charAt(0) || 'X'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate dark:text-white text-gray-900">{user?.full_name}</p>
              <p className="text-xs truncate text-primary-300">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <div className="flex items-center gap-1">
              <Link href={pathname} locale={locale === 'en' ? 'bn' : 'en'} title="Switch Language" className="p-1.5 rounded-lg hover:dark:bg-white/10 hover:bg-black/10 transition-all text-xs font-bold text-primary flex items-center justify-center min-w-[28px]">
                {locale === 'en' ? 'বাং' : 'EN'}
              </Link>
              <button onClick={toggleTheme} title="Toggle Theme" className="p-1.5 rounded-lg hover:dark:bg-white/10 hover:bg-black/10 transition-all text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900">
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
              <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-danger/20 transition-all text-danger/70 hover:text-danger">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute inset-0 bg-dark/20 backdrop-blur-[2px] pointer-events-none" />
        <div className="relative z-0 h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
