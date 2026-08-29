'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import {
  Sparkles, LayoutDashboard, Users, FileText, Settings, LogOut,
  CreditCard, Shield, Sun, Moon, ArrowLeft, BarChart3, List
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useState, useEffect } from 'react';

const sidebarLinks = [
  { href: '/admin/overview', label: 'Overview', icon: BarChart3 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/transactions', label: 'Transactions', icon: CreditCard },
  { href: '/admin/agents', label: 'Agent Usage', icon: Shield },
  { href: '/admin/content', label: 'Content Control', icon: FileText },
  { href: '/admin/plans', label: 'Plan Manager', icon: List },
  { href: '/admin/rules', label: 'AI Rules', icon: Sparkles },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'super_admin')) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    logout();
    toast.success('Logged out');
    router.push('/');
  };

  if (!isMounted || !isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-violet-950">
      {/* Sidebar */}
      <aside className="w-[260px] flex flex-col border-r dark:border-white/10 border-black/10 shrink-0 dark:bg-black/40 bg-[rgba(0,0,0,0.02)] backdrop-blur-xl z-10 transition-all duration-300">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-6 border-b dark:border-white/10 border-black/10">
          <Sparkles className="w-6 h-6 text-primary shrink-0" />
          <span className="text-xl font-heading font-bold dark:text-white text-gray-900 tracking-widest">XENI Admin</span>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {sidebarLinks.map(link => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary/20 text-white shadow-glow border border-primary/30'
                    : 'text-dark-600 hover:dark:text-white hover:text-gray-900 hover:dark:bg-white/5 hover:bg-black/5'
                }`}
              >
                <link.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary-300' : 'group-hover:text-primary-300'} transition-colors`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="border-t dark:border-white/10 border-black/10 p-4 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 hover:dark:bg-white/5 hover:bg-black/5 transition-all">
            <ArrowLeft className="w-5 h-5 shrink-0" />
            <span>Back to App</span>
          </Link>
        </div>

        {/* User Section */}
        <div className="border-t dark:border-white/10 border-black/10 px-4 py-4 flex items-center gap-3 bg-black/20">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white font-bold shrink-0 shadow-glow">
            {user?.full_name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold dark:text-white text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-primary-300 truncate">{user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} title="Toggle Theme" className="p-2 rounded-lg hover:dark:bg-white/10 hover:bg-black/10 transition-all text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
            </button>
            <button onClick={handleLogout} title="Logout" className="p-2 rounded-lg hover:bg-danger/20 transition-all text-danger/70 hover:text-danger">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
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
