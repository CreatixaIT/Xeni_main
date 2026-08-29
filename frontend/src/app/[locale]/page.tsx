'use client';

import Image from 'next/image';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useRouter } from '@/i18n/routing';
import { useThemeStore } from '@/store/theme';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Sparkles, ArrowRight, Check, ChevronDown, Star, Zap, Shield, Globe,
  Sun, Moon, Menu, X, TrendingUp, Quote, Send,
  MessageCircle, ShoppingBag, Package, Wand2, BarChart3,
  Rocket, Bot, CreditCard, Truck, AlertCircle
} from 'lucide-react';

/* ──────── DATA ──────── */
const agents = [
  { key: 'conversation', icon: MessageCircle, color: 'from-violet-500 to-purple-600', tier: 'Starter+' },
  { key: 'order', icon: ShoppingBag, color: 'from-emerald-500 to-green-600', tier: 'Professional+' },
  { key: 'inventory', icon: Package, color: 'from-cyan-500 to-blue-600', tier: 'Professional+' },
  { key: 'creative', icon: Wand2, color: 'from-pink-500 to-rose-600', tier: 'Premium' },
  { key: 'intelligence', icon: BarChart3, color: 'from-amber-500 to-orange-600', tier: 'Premium' },
];

const plans = [
  {
    tier: 'starter', price: 1000, popular: false,
    features: ['💬 Conversation Agent', '200 orders/month', '1 Facebook Page', '2 GB storage', 'Email support'],
  },
  {
    tier: 'professional', price: 2500, popular: true,
    features: ['💬 Conversation Agent', '📦 Order Processing Agent', '📊 Inventory Agent', '1,000 orders/month', '3 Facebook Pages', '10 GB storage', 'Priority support'],
  },
  {
    tier: 'premium', price: 5000, popular: false,
    features: ['All 5 AI Agents', 'Unlimited orders', '10 Facebook Pages', '50 GB storage', '🎨 AI Image Generation', '🧠 Sales Intelligence', 'Dedicated support'],
  },
  {
    tier: 'enterprise', price: 0, popular: false,
    features: ['All 5 AI Agents', 'Unlimited everything', 'White-label branding', 'Custom API access', 'ERP Integration', 'Dedicated account manager', 'SLA guarantee'],
  },
];

const steps = [
  { icon: Rocket, title: 'Sign Up Free', description: 'Create your account in 30 seconds. No credit card required.' },
  { icon: Bot, title: 'Connect Facebook Page', description: 'Link your Facebook Page so the AI can manage Messenger conversations.' },
  { icon: CreditCard, title: 'Subscribe & Configure', description: 'Choose a plan, set up bKash/Nagad, and configure your AI agents.' },
  { icon: Truck, title: 'Automate & Scale', description: 'AI handles conversations, orders, and deliveries while you focus on growth.' },
];

const testimonials = [
  { name: 'Rahim Uddin', role: 'Owner', company: 'FashionBD', avatar: 'RU', text: 'XENI transformed my F-commerce! The Conversation Agent handles 500+ Messenger DMs daily while I focus on sourcing new products.' },
  { name: 'Fatima Akter', role: 'Founder', company: 'BeautyCorner BD', avatar: 'FA', text: 'The Order Processing Agent with bKash verification saved me hours of manual payment checking. My order processing is now 10x faster.' },
  { name: 'Kamal Hossain', role: 'CEO', company: 'TechMart BD', avatar: 'KH', text: 'Inventory Agent stopped our overselling problem completely. Low-stock alerts and auto-restock suggestions are game changing.' },
];

const faqs = [
  { q: 'What is XENI?', a: 'XENI is an AI-powered e-commerce operating system built for Bangladeshi F-commerce sellers. It automates Messenger conversations, order processing with bKash/Nagad verification, inventory management, content creation, and sales intelligence.' },
  { q: 'How does Messenger automation work?', a: 'Connect your Facebook Page to XENI, and our Conversation Agent will automatically reply to customer messages 24/7 in Bangla and English. It handles product inquiries, order status checks, and can escalate to you when needed.' },
  { q: 'What payment methods does XENI support?', a: 'XENI supports bKash and Nagad payment verification for your customers. For your subscription, you can pay via SSLCommerz (bKash, Nagad, bank cards). All pricing is in BDT.' },
  { q: 'Can I switch plans anytime?', a: 'Absolutely. Upgrade or downgrade your plan at any time. Changes take effect immediately with prorated billing via SSLCommerz.' },
  { q: 'Which courier services are supported?', a: 'XENI integrates with Pathao and Steadfast courier services for automated pickup booking and delivery tracking across Bangladesh.' },
  { q: 'Does XENI support Bangla?', a: 'Yes! XENI fully supports both English and বাংলা. The AI agents can converse with customers in Bangla, and the entire dashboard is bilingual.' },
];

/* ──────── COMPONENTS ──────── */
function FAQItem({ q, a, isOpen, onClick }: { q: string; a: string; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="glass-card overflow-hidden">
      <button onClick={onClick} className="w-full flex justify-between items-center p-5 text-left">
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{q}</span>
        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <p className="px-5 pb-5 text-sm" style={{ color: 'var(--text-secondary)' }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentCard({ agent, index, t, isExpanded, onToggle }: { agent: any; index: number; t: any; isExpanded: boolean; onToggle: () => void }) {
  const Icon = agent.icon;
  const features: string[] = t.raw(`agents.${agent.key}.features`) || [];
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const glowClass = agent.key === 'conversation' ? 'glow-violet' : 
                    agent.key === 'order' ? 'glow-emerald' : 
                    agent.key === 'inventory' ? 'glow-cyan' : 
                    agent.key === 'creative' ? 'glow-pink' : 'glow-amber';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }} 
      whileInView={{ opacity: 1, y: 0 }} 
      transition={{ delay: index * 0.1 }} 
      viewport={{ once: true }} 
      onMouseMove={handleMouseMove}
      style={{ 
        '--mouse-x': `${mousePos.x}px`, 
        '--mouse-y': `${mousePos.y}px` 
      } as any}
      className={`glass-bento p-8 flex flex-col h-full cursor-pointer group ${isExpanded ? 'ring-2 ring-primary/40 ' + glowClass : 'hover:' + glowClass}`} 
      onClick={onToggle}
    >
      <div className="flex items-start justify-between mb-8">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center shadow-2xl relative overflow-hidden group-hover:scale-110 transition-transform duration-500`}>
          <div className="absolute inset-0 dark:bg-white/20 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <Icon className="w-8 h-8 dark:text-white text-gray-900 drop-shadow-md" />
        </div>
        <div className="flex flex-col items-end gap-2">
            <span className="badge bg-white/5 text-dark-300 text-[10px] font-bold uppercase tracking-widest border border-white/10">{agent.tier}</span>
            {isExpanded && <Sparkles className="w-4 h-4 text-primary animate-pulse" />}
        </div>
      </div>

      <h3 className="text-2xl md:text-3xl font-heading font-black mb-4 tracking-tight group-hover:gradient-text transition-all duration-300">
        {t(`agents.${agent.key}.name`)}
      </h3>
      <p className="text-base text-slate-600 dark:text-dark-600 mb-8 leading-relaxed font-medium">
        {t(`agents.${agent.key}.description`)}
      </p>

      <div className="mt-auto">
        <div className="flex items-center justify-between pt-6 border-t dark:border-white/5 border-black/5 transition-colors duration-300">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${agent.color} animate-pulse`} />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 tracking-widest uppercase">{isExpanded ? 'Hide Details' : 'View Capabilities'}</span>
          </div>
          <motion.div 
            animate={{ rotate: isExpanded ? 180 : 0, scale: isExpanded ? 1.2 : 1 }} 
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-primary text-white shadow-glow' : 'bg-white/5 text-slate-600 dark:text-dark-600 group-hover:bg-white/10 group-hover:text-white'}`}
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }} 
                className="overflow-hidden"
            >
              <ul className="pt-8 space-y-4 pb-4">
                {features.map((feature, idx) => (
                  <motion.li 
                    initial={{ opacity: 0, x: -20 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    transition={{ delay: 0.1 + (idx * 0.05) }} 
                    key={idx} 
                    className="flex items-start gap-4 text-sm font-medium text-dark-300"
                  >
                    <div className="mt-0.5 w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="leading-snug">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ──────── MAIN PAGE ──────── */
export default function LandingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { theme, toggleTheme } = useThemeStore();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Queries
  const { data: heroData, isLoading: isHeroLoading } = useQuery({ queryKey: ['hero'], queryFn: async () => (await api.get('/content/hero')).data.data });
  const { data: bannerData } = useQuery({ queryKey: ['banner'], queryFn: async () => (await api.get('/content/banner')).data.data });
  const { data: plansData, isLoading: isPlansLoading } = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/billing/plans')).data.data });
  const { data: reviewsData, isLoading: isReviewsLoading } = useQuery({ queryKey: ['reviews'], queryFn: async () => (await api.get('/content/reviews')).data.data });
  const { data: faqData, isLoading: isFaqLoading } = useQuery({ queryKey: ['faq'], queryFn: async () => (await api.get('/content/faq')).data.data });
  
  const heroEn = heroData?.en;
  const heroBn = heroData?.bn;
  const hero = locale === 'bn' ? heroBn : heroEn;

  // ── SKELETON COMPONENT ──
  const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse dark:bg-white/5 bg-black/5 rounded-lg ${className}`} />
  );

  const bannerEn = bannerData?.en;
  const bannerBn = bannerData?.bn;
  const banner = locale === 'bn' ? bannerBn : bannerEn;
  const isBannerActive = bannerData?.en?.is_active;

  // Fallbacks and Dynamic Data
  const displayPlans = Array.isArray(plansData) && plansData.length > 0 ? plansData : plans;
  const displayFaqs = (locale === 'bn' ? faqData?.bn?.items : faqData?.en?.items);
  const finalFaqs = Array.isArray(displayFaqs) ? displayFaqs : faqs;
  const displayTestimonials = (reviewsData?.reviews && Array.isArray(reviewsData.reviews) && reviewsData.reviews.length > 0) ? reviewsData.reviews : testimonials;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* ═══ BANNER ═══ */}
      <AnimatePresence>
        {isBannerActive && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full relative z-[60] py-2 text-center text-xs md:text-sm font-bold dark:text-white text-gray-900 shadow-lg overflow-hidden animate-pulse-glow"
            style={{ backgroundColor: bannerData?.en?.color || '#7C3AED' }}
          >
            {banner?.link ? (
              <Link href={banner.link} className="hover:underline flex items-center justify-center gap-2">
                 <AlertCircle className="w-3.5 h-3.5" /> {banner.text}
              </Link>
            ) : (
              <span className="flex items-center justify-center gap-2">
                 <AlertCircle className="w-3.5 h-3.5" /> {banner?.text}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ NAVBAR ═══ */}
      <nav className={`fixed ${isBannerActive ? 'top-[36px]' : 'top-0'} w-full z-50 glass-card border-none border-b transition-all duration-300`} style={{ borderColor: 'var(--border-color)' }}>
        <div className="section-container py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group">
            <Sparkles className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-2xl font-heading font-bold gradient-text">XENI</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <a href="#agents" className="btn-ghost text-sm">{t('nav.your_team')}</a>
            <a href="#pricing" className="btn-ghost text-sm">{t('nav.pricing')}</a>
            <a href="#how-it-works" className="btn-ghost text-sm">{t('nav.how_i_work')}</a>
            <a href="#faq" className="btn-ghost text-sm">{t('nav.faq')}</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--bg-card)' }}>
              <Link href="/" locale="en" className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${locale === 'en' ? 'bg-primary text-white' : ''}`} style={locale !== 'en' ? { color: 'var(--text-muted)' } : undefined}>EN</Link>
              <Link href="/" locale="bn" className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${locale === 'bn' ? 'bg-primary text-white' : ''}`} style={locale !== 'bn' ? { color: 'var(--text-muted)' } : undefined}>বাং</Link>
            </div>
            <button onClick={toggleTheme} className="p-2 rounded-lg transition-all" style={{ background: 'var(--bg-card)' }}>
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>
            <Link href="/login" prefetch={true} className="btn-ghost text-sm font-medium">{t('nav.login')}</Link>
            <Link href="/register" prefetch={true} className="btn-primary text-sm py-2 px-5">{t('nav.register')}</Link>
          </div>

          <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2">
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenu && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="md:hidden overflow-hidden border-t" style={{ borderColor: 'var(--border-color)' }}>
              <div className="section-container py-4 flex flex-col gap-2">
                <a href="#agents" className="btn-ghost text-sm" onClick={() => setMobileMenu(false)}>{t('nav.your_team')}</a>
                <a href="#pricing" className="btn-ghost text-sm" onClick={() => setMobileMenu(false)}>{t('nav.pricing')}</a>
                <a href="#how-it-works" className="btn-ghost text-sm" onClick={() => setMobileMenu(false)}>{t('nav.how_i_work')}</a>
                <a href="#faq" className="btn-ghost text-sm" onClick={() => setMobileMenu(false)}>{t('nav.faq')}</a>
                <div className="flex gap-2 pt-2">
                  <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg">{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
                  <Link href="/login" prefetch={true} className="btn-secondary text-sm py-2 flex-1 text-center">{t('nav.login')}</Link>
                  <Link href="/register" prefetch={true} className="btn-primary text-sm py-2 flex-1 text-center">{t('nav.register')}</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative pt-32 pb-20 lg:pt-56 lg:pb-44 overflow-hidden mesh-gradient">
        {/* Animated Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] animate-pulse" />
        
        <div className="section-container relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
            {/* Left Content */}
            <motion.div 
              initial={{ opacity: 0, x: -50 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex-1 text-center lg:text-left"
            >
              {isHeroLoading ? (
                <div className="space-y-6">
                  <Skeleton className="w-64 h-8 rounded-full mx-auto lg:mx-0" />
                  <Skeleton className="w-full h-24 mx-auto lg:mx-0" />
                  <Skeleton className="w-[80%] h-12 mx-auto lg:mx-0" />
                  <div className="flex gap-4 justify-center lg:justify-start">
                    <Skeleton className="w-44 h-16 rounded-xl" />
                    <Skeleton className="w-44 h-16 rounded-xl" />
                  </div>
                </div>
              ) : (
                <>
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-2 dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 backdrop-blur-md rounded-full px-5 py-2 mb-8 shadow-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    <span className="text-xs font-bold text-dark-300 uppercase tracking-[0.2em]">{heroEn?.badge || 'Next-Gen AI Platform'}</span>
                  </motion.div>

                  <h1 className="font-heading font-black mb-8 leading-[0.95] tracking-tight">
                    {(() => {
                      const headline = hero?.headline || "I'm XENI | Your | Smart Assistant";
                      const parts = headline.includes('|') ? headline.split('|') : [headline.split(' ')[0], headline.split(' ').slice(1).join(' ')];
                      return parts.map((part: string, i: number) => (
                        <span 
                          key={i} 
                          className={`block ${i === 0 ? 'text-5xl sm:text-6xl lg:text-8xl dark:text-white text-gray-900' : 'text-3xl sm:text-4xl lg:text-6xl gradient-text'} drop-shadow-2xl mb-2`}
                        >
                          {part.trim()}
                        </span>
                      ));
                    })()}
                  </h1>

                  <p className="text-lg md:text-xl text-slate-600 dark:text-dark-600 mb-12 leading-relaxed font-medium max-w-xl mx-auto lg:mx-0 italic">
                    {hero?.subheadline || 'Scale Your F-commerce Smartly'}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start">
                    <Link href="/register" prefetch={true} className="btn-primary text-lg px-12 py-5 flex items-center justify-center gap-3 shadow-2xl group overflow-hidden">
                      <span className="relative z-10">{t('landing.cta')}</span>
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-1.5 transition-transform" />
                    </Link>
                    <a href="#agents" className="btn-secondary text-lg px-12 py-5 flex items-center justify-center gap-3 group">
                      {t('landing.cta_secondary')} <Bot className="w-5 h-5 opacity-70 group-hover:rotate-12 transition-transform" />
                    </a>
                  </div>

                  {/* Trust Indicators */}
                  <div className="mt-16 flex items-center gap-8 justify-center lg:justify-start grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                     <div className="flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-600 dark:text-dark-700">Shopify Sync</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-600 dark:text-dark-700">Secured Payments</span>
                     </div>
                  </div>
                </>
              )}
            </motion.div>

            {/* Right Mockup */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotateY: 20 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
              className="flex-1 relative perspective-1000 hidden lg:block"
            >
              <div className="relative group">
                {/* Glow effect back */}
                <div className="absolute inset-0 bg-primary/20 rounded-[3rem] blur-[60px] group-hover:bg-primary/30 transition-all duration-700" />
                
                {/* Floating Image */}
                <motion.div
                  animate={{ 
                    y: [0, -20, 0],
                    rotateX: [0, 2, 0],
                    rotateY: [0, -2, 0]
                  }}
                  transition={{ 
                    duration: 6, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="relative z-10 glass-bento p-2 dark:border-white/20 border-black/20 shadow-3xl"
                >
                  <Image 
                    src="/hero-mockup.png" 
                    alt="Xeni AI Dashboard Mockup" 
                    width={1200}
                    height={800}
                    priority
                    className="rounded-[2.5rem] w-full h-auto shadow-2xl"
                  />
                  
                  {/* Floating elements on top of mockup */}
                  <motion.div 
                    animate={{ y: [0, -15, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    className="absolute -top-10 -right-10 glass-card p-4 flex items-center gap-3 border-emerald-500/30 glow-emerald"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700">Sales Growth</div>
                        <div className="text-sm font-black dark:text-white text-gray-900">+142%</div>
                    </div>
                  </motion.div>

                  <motion.div 
                    animate={{ y: [0, 15, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -bottom-10 -left-10 glass-card p-4 flex items-center gap-3 border-primary/30 glow-violet"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700">AI Response</div>
                        <div className="text-sm font-black dark:text-white text-gray-900">Live Automating</div>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Stats Bar (Refined) */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-8 md:gap-20 mt-32 pt-16 border-t dark:border-white/5 border-black/5 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
            {[{ n: '5', l: 'Smart Agents' }, { n: '24/7', l: 'Messenger Auto-Reply' }, { n: '99.9%', l: 'Uptime Guarantee' }, { n: 'বাংলা', l: '& English Support' }].map((s, i) => (
              <div key={s.l} className="text-center group/item relative z-10">
                <motion.div 
                  initial={{ scale: 0.5 }}
                  whileInView={{ scale: 1 }}
                  transition={{ delay: 0.2 + (i * 0.1), type: "spring" }}
                  className="text-4xl md:text-6xl font-heading font-black gradient-text group-hover/item:scale-110 transition-transform duration-500"
                >
                  {s.n}
                </motion.div>
                <div className="text-xs md:text-sm mt-3 font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:text-dark-300 transition-colors" style={{ color: 'var(--text-muted)' }}>{s.l}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" className="section-padding relative overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        <div className="section-container">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="section-title">How It <span className="gradient-text">Works</span></h2>
            <p className="section-subtitle">Start automating your F-commerce in 4 simple steps</p>
          </motion.div>
 
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div 
                key={step.title} 
                initial={{ opacity: 0, scale: 0.9 }} 
                whileInView={{ opacity: 1, scale: 1 }} 
                transition={{ delay: i * 0.15, duration: 0.5 }} 
                viewport={{ once: true }} 
                className="glass-bento p-8 text-center relative group hover:glow-violet transition-all"
              >
                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-2xl bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white text-sm font-black shadow-lg z-20 group-hover:scale-110 transition-transform">{i + 1}</div>
                <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto mb-6 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <step.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-black mb-3 tracking-tight" style={{ color: 'var(--text-primary)' }}>{step.title}</h3>
                <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-muted)' }}>{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AGENTS ═══ */}
      <section id="agents" className="relative section-padding">
        <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />

        <div className="section-container relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="section-title text-5xl mb-6">{t('landing.features_title')}</h2>
            <p className="section-subtitle text-xl max-w-3xl leading-relaxed italic">{t('landing.features_subtitle')}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            {/* Row 1: 2 Columns + 1 Column */}
            <div className="lg:col-span-2">
              <AgentCard
                agent={agents[0]}
                index={0}
                t={t}
                isExpanded={expandedAgent === agents[0].key}
                onToggle={() => setExpandedAgent(expandedAgent === agents[0].key ? null : agents[0].key)}
              />
            </div>
            <div className="lg:col-span-1">
              <AgentCard
                agent={agents[1]}
                index={1}
                t={t}
                isExpanded={expandedAgent === agents[1].key}
                onToggle={() => setExpandedAgent(expandedAgent === agents[1].key ? null : agents[1].key)}
              />
            </div>

            {/* Row 2: 1 Column + 2 Columns */}
            <div className="lg:col-span-1">
              <AgentCard
                agent={agents[2]}
                index={2}
                t={t}
                isExpanded={expandedAgent === agents[2].key}
                onToggle={() => setExpandedAgent(expandedAgent === agents[2].key ? null : agents[2].key)}
              />
            </div>
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                {agents.slice(3).map((agent, i) => (
                  <AgentCard
                    key={agent.key}
                    agent={agent}
                    index={i + 3}
                    t={t}
                    isExpanded={expandedAgent === agent.key}
                    onToggle={() => setExpandedAgent(expandedAgent === agent.key ? null : agent.key)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="section-padding relative overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        <div className="section-container">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="section-title">Simple, Transparent <span className="gradient-text">Pricing</span></h2>
            <p className="section-subtitle">All prices in BDT. Pay with bKash, Nagad, or card via SSLCommerz.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {isPlansLoading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card p-6 h-[420px] flex flex-col animate-pulse">
                  <Skeleton className="w-32 h-6 mb-4" />
                  <Skeleton className="w-24 h-10 mb-2" />
                  <Skeleton className="w-16 h-4 mb-8" />
                  <div className="space-y-3 mb-8">
                    {[1, 2, 3, 4, 5].map(j => <Skeleton key={j} className="w-full h-4" />)}
                  </div>
                  <Skeleton className="w-full h-10 mt-auto rounded-lg" />
                </div>
              ))
            ) : (
              displayPlans.map((plan: any, i: number) => {
                const popular = plan.tier === 'professional';
                return (
                  <motion.div key={plan.id || plan.tier} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                    className={`glass-card p-6 relative ${popular ? 'ring-2 ring-primary shadow-glow' : ''}`}>
                    {popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                        MOST POPULAR
                      </div>
                    )}
                    <h3 className="text-lg font-heading font-bold capitalize mb-1" style={{ color: 'var(--text-primary)' }}>{plan.name || t(`billing.${plan.tier}`)}</h3>
                    <div className="mb-5">
                      {(plan.price_monthly_bdt || plan.price) > 0 ? (
                        <>
                          <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            ৳{(plan.price_monthly_bdt || plan.price).toLocaleString()}
                          </span>
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('billing.month')}</span>
                        </>
                      ) : (
                        <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('billing.custom_pricing')}</span>
                      )}
                    </div>
                    <ul className="space-y-2.5 mb-6">
                      {(() => {
                        let featureList = [];
                        if (Array.isArray(plan.features)) {
                          featureList = plan.features;
                        } else if (typeof plan.features === 'string') {
                          try { featureList = JSON.parse(plan.features); } catch (e) { featureList = []; }
                        }
                        
                        return (Array.isArray(featureList) ? featureList : []).map((f: string) => (
                          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />{f}
                          </li>
                        ));
                      })()}
                    </ul>
                    <Link href="/register" prefetch={true} className={popular ? 'btn-primary w-full text-center text-sm' : 'btn-secondary w-full text-center text-sm'}>
                      {plan.cta_text || (plan.tier === 'enterprise' ? t('billing.contact_sales') : t('billing.subscribe'))}
                    </Link>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="section-padding relative overflow-hidden">
        <div className="section-container">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="section-title">Loved by <span className="gradient-text">Sellers</span> Across Bangladesh</h2>
            <p className="section-subtitle">See what F-commerce owners say about XENI</p>
          </motion.div>
 
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {isReviewsLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="glass-bento p-8 animate-pulse">
                  <div className="w-10 h-10 dark:bg-white/5 bg-black/5 rounded-2xl mb-6" />
                  <Skeleton className="w-full h-4 mb-3" />
                  <Skeleton className="w-[80%] h-4 mb-8" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div>
                      <Skeleton className="w-24 h-4 mb-2" />
                      <Skeleton className="w-16 h-3" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              displayTestimonials.map((testi: any, i: number) => (
                <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 30 }} 
                    whileInView={{ opacity: 1, y: 0 }} 
                    transition={{ delay: i * 0.1, duration: 0.5 }} 
                    viewport={{ once: true }} 
                    className="glass-bento p-8 group hover:glow-cyan transition-all"
                >
                  <Quote className="w-10 h-10 text-primary/20 mb-6 group-hover:text-primary/40 transition-colors" />
                  <p className="text-base mb-8 leading-relaxed min-h-[80px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    &ldquo;{testi.review_text || testi.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-4 mt-auto">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white text-base font-black shadow-lg group-hover:scale-110 transition-transform">
                        {testi.reviewer_name?.charAt(0) || testi.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{testi.reviewer_name || testi.name}</p>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{testi.role}, {testi.company}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-6">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className={`w-4 h-4 ${j < (testi.star_rating || 5) ? 'text-amber-400 fill-amber-400 shadow-glow' : 'dark:text-white text-gray-900/5'}`} />
                    ))}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="section-padding relative overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        <div className="section-container max-w-3xl relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="section-title">Frequently Asked <span className="gradient-text">Questions</span></h2>
            <p className="section-subtitle">Everything you need to know about XENI</p>
          </motion.div>

          <div className="space-y-4">
            {isFaqLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="glass-bento p-6 border dark:border-white/5 border-black/5 animate-pulse">
                  <Skeleton className="w-full h-6" />
                </div>
              ))
            ) : (
              finalFaqs.map((faq: any, i: number) => (
                <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -20 }} 
                    whileInView={{ opacity: 1, x: 0 }} 
                    transition={{ delay: i * 0.1 }} 
                    viewport={{ once: true }}
                >
                    <FAQItem 
                        q={faq.question || faq.q} 
                        a={faq.answer || faq.a} 
                        isOpen={openFAQ === i} 
                        onClick={() => setOpenFAQ(openFAQ === i ? null : i)} 
                    />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="section-padding">
        <div className="section-container">
          <div className="glass-card p-12 lg:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10" />
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Ready to <span className="gradient-text">Automate</span> Your Shop?
              </h2>
              <p className="text-lg mb-8 max-w-lg mx-auto" style={{ color: 'var(--text-muted)' }}>
                Join hundreds of Bangladeshi sellers using XENI to automate their Messenger, orders, and deliveries.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register" prefetch={true} className="btn-primary text-lg px-8 py-4 flex items-center justify-center gap-2 shadow-glow">
                  {t('landing.cta')} <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/login" prefetch={true} className="btn-secondary text-lg px-8 py-4">{t('landing.cta_login')}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ NEWSLETTER ═══ */}
      <section className="section-padding" style={{ background: 'var(--bg-secondary)' }}>
        <div className="section-container max-w-2xl text-center">
          <Send className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-heading font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Stay in the <span className="gradient-text">Loop</span>
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            Get F-commerce tips, product updates, and exclusive offers delivered to your inbox.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); setNewsletterEmail(''); }} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="input-field flex-1 text-sm"
            />
            <button type="submit" className="btn-primary text-sm px-6 py-3 flex items-center justify-center gap-2 whitespace-nowrap">
              Subscribe <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>No spam, ever. Unsubscribe anytime.</p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t py-12 px-6" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
                <span className="text-lg font-heading font-bold gradient-text">XENI</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>AI-powered e-commerce operating system for Bangladeshi F-commerce sellers.</p>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Product</h4>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <li><a href="#agents" className="hover:text-primary transition-colors">AI Agents</a></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a></li>
                <li><a href="#faq" className="hover:text-primary transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Integrations</h4>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <li><span>Facebook Messenger</span></li>
                <li><span>bKash & Nagad</span></li>
                <li><span>Pathao Courier</span></li>
                <li><span>Steadfast Courier</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Legal</h4>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <li><Link href="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Refund Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>© 2026 XENI. All rights reserved.</p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <Link href="/" locale="en" className="text-xs font-medium hover:text-primary transition-colors" style={{ color: 'var(--text-muted)' }}>English</Link>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <Link href="/" locale="bn" className="text-xs font-medium hover:text-primary transition-colors" style={{ color: 'var(--text-muted)' }}>বাংলা</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
