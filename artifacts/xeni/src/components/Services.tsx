import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Cpu, Network, ShieldCheck, Zap, X, Check, Lock, Smartphone } from 'lucide-react';

type Service = {
  id: string;
  title: string;
  shortDesc: string;
  longDesc: string;
  icon: React.ReactNode;
  color: string;
  richModal?: React.ReactNode;
};

const DownloadBadges = () => (
  <div className="border-t border-white/8 pt-5">
    <p className="text-xs font-semibold tracking-widest text-white/30 uppercase mb-3 flex items-center gap-2">
      <Smartphone className="w-3.5 h-3.5" />
      Download the App
    </p>
    <div className="flex flex-col sm:flex-row gap-3">
      <a href="#android" aria-label="Get it on Google Play"
        className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
        <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.18 1.07C2.82 1.45 2.6 2.03 2.6 2.77v18.46c0 .74.22 1.32.58 1.7l.09.08 10.34-10.34v-.24L3.27.99l-.09.08z" fill="#4FC3F7"/>
          <path d="M16.76 17.33l-3.44-3.44v-.24l3.44-3.44.08.04 4.08 2.32c1.16.66 1.16 1.74 0 2.4l-4.08 2.32-.08.04z" fill="#FFD54F"/>
          <path d="M16.84 17.29L13.32 13.77 3.18 23.91c.38.4.99.45 1.68.05l11.98-6.67" fill="#F48FB1"/>
          <path d="M16.84 10.25L4.86 3.58c-.69-.4-1.3-.35-1.68.05L13.32 13.77l3.52-3.52z" fill="#A5D6A7"/>
        </svg>
        <div>
          <p className="text-[10px] text-white/40 font-light leading-none mb-0.5">Get it on</p>
          <p className="text-sm font-semibold text-white/90 leading-none">Google Play</p>
        </div>
      </a>
      <a href="#ios" aria-label="Download on the App Store"
        className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
        <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
        <div>
          <p className="text-[10px] text-white/40 font-light leading-none mb-0.5">Download on the</p>
          <p className="text-sm font-semibold text-white/90 leading-none">App Store</p>
        </div>
      </a>
    </div>
  </div>
);

const XeniAssistanceModal = () => (
  <div className="space-y-6">
    <p className="text-base text-white/50 font-light italic tracking-wide -mt-2">
      Your AI Business Assistant — runs your business so you don't have to.
    </p>
    <p className="text-base text-white/75 leading-relaxed font-light">
      Xeni replies to customers instantly, manages orders, checks inventory, confirms purchases, and notifies you when it's time to ship. She even promotes your products, creates content, and posts for you — all automatically.
    </p>
    <p className="text-sm text-primary/80 font-light">
      Turn your Facebook / WhatsApp page into a fully automated sales machine.
    </p>

    <div className="border-t border-white/8 pt-6 space-y-3">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-4">What Xeni Does</p>
      {[
        { icon: "💬", label: "Auto-replies to customers 24/7", premium: false },
        { icon: "🛒", label: "Confirms & manages orders", premium: false },
        { icon: "📦", label: "Tracks inventory & alerts you", premium: false },
        { icon: "📊", label: "Generates smart reports", premium: false },
        { icon: "🎯", label: "Promotes best-selling products", premium: false },
        { icon: "🎨", label: "Creates & posts content automatically", premium: true },
      ].map((f, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-base w-6 text-center flex-shrink-0">{f.icon}</span>
          <span className="text-sm text-white/70 font-light flex-1">{f.label}</span>
          {f.premium && (
            <span className="text-[10px] font-semibold tracking-widest text-secondary uppercase border border-secondary/30 rounded-full px-2 py-0.5 flex-shrink-0">Premium</span>
          )}
        </div>
      ))}
    </div>

    <div className="border-t border-white/8 pt-5 bg-gradient-to-br from-primary/8 to-transparent rounded-2xl p-4">
      <p className="text-xs font-semibold tracking-widest text-secondary uppercase mb-1">Why Xeni?</p>
      <p className="text-base font-medium text-white/80 italic mt-1">More sales. Less work. Zero missed customers.</p>
    </div>

    <div className="flex flex-col sm:flex-row gap-3">
      <a href="#free" className="flex-1 text-center px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-all">
        Start Free
      </a>
      <a href="#demo" className="flex-1 text-center px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-all">
        Book a Demo
      </a>
      <a href="#download" className="flex-1 text-center px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-secondary text-black text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,200,255,0.3)]">
        Get Started Now
      </a>
    </div>

    <DownloadBadges />
  </div>
);

const XenFiModal = () => (
  <div className="space-y-6">
    <p className="text-base text-white/50 font-light italic tracking-wide -mt-2">
      Track. Grow. Control your money — all in one place.
    </p>
    <p className="text-base text-white/75 leading-relaxed font-light">
      XenFi is a smart financial suite designed for modern individuals and investors. From daily expenses to advanced portfolio insights, everything you need to manage your wealth is finally unified.
    </p>

    <div className="border-t border-white/8 pt-6 space-y-3">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-4">What you can do</p>
      {[
        { label: "Track daily expenses & cash flow", premium: false },
        { label: "Manage loans & repayments effortlessly", premium: false },
        { label: "Monitor investments, assets & net worth", premium: true },
        { label: "Optimize taxes & financial decisions", premium: true },
      ].map((f, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${f.premium ? 'bg-secondary/20 border border-secondary/40' : 'bg-primary/20 border border-primary/40'}`}>
            {f.premium ? <Lock className="w-3 h-3 text-secondary" /> : <Check className="w-3 h-3 text-primary" />}
          </div>
          <span className="text-sm text-white/70 font-light">{f.label}</span>
          {f.premium && <span className="ml-auto text-[10px] font-semibold tracking-widest text-secondary uppercase border border-secondary/30 rounded-full px-2 py-0.5">Premium</span>}
        </div>
      ))}
    </div>

    <div className="border-t border-white/8 pt-6 bg-gradient-to-br from-secondary/10 to-primary/5 rounded-2xl p-5">
      <p className="text-xs font-semibold tracking-widest text-secondary uppercase mb-2">Upgrade to Premium</p>
      <p className="text-sm text-white/60 font-light mb-4">Unlock advanced analytics, portfolio tracking & wealth optimization tools.</p>
      <p className="text-xs text-white/40 italic mb-5">Start Free. Upgrade Anytime.</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button className="flex-1 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-all">
          Get Started Free
        </button>
        <button className="flex-1 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-secondary text-black text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,200,255,0.3)]">
          Upgrade to Premium
        </button>
      </div>
    </div>

    <div className="border-t border-white/8 pt-5">
      <p className="text-xs font-semibold tracking-widest text-white/30 uppercase mb-3 flex items-center gap-2">
        <Smartphone className="w-3.5 h-3.5" />
        Download the App
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Google Play Badge */}
        <a
          href="#android"
          aria-label="Get it on Google Play"
          className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.18 1.07C2.82 1.45 2.6 2.03 2.6 2.77v18.46c0 .74.22 1.32.58 1.7l.09.08 10.34-10.34v-.24L3.27.99l-.09.08z" fill="#4FC3F7"/>
            <path d="M16.76 17.33l-3.44-3.44v-.24l3.44-3.44.08.04 4.08 2.32c1.16.66 1.16 1.74 0 2.4l-4.08 2.32-.08.04z" fill="#FFD54F"/>
            <path d="M16.84 17.29L13.32 13.77 3.18 23.91c.38.4.99.45 1.68.05l11.98-6.67" fill="#F48FB1"/>
            <path d="M16.84 10.25L4.86 3.58c-.69-.4-1.3-.35-1.68.05L13.32 13.77l3.52-3.52z" fill="#A5D6A7"/>
          </svg>
          <div>
            <p className="text-[10px] text-white/40 font-light leading-none mb-0.5">Get it on</p>
            <p className="text-sm font-semibold text-white/90 leading-none">Google Play</p>
          </div>
        </a>

        {/* App Store Badge */}
        <a
          href="#ios"
          aria-label="Download on the App Store"
          className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          <div>
            <p className="text-[10px] text-white/40 font-light leading-none mb-0.5">Download on the</p>
            <p className="text-sm font-semibold text-white/90 leading-none">App Store</p>
          </div>
        </a>
      </div>
    </div>
  </div>
);

const XenitorModal = () => (
  <div className="space-y-6">
    <p className="text-base text-white/50 font-light italic tracking-wide -mt-2">
      Audit everything. Miss nothing.
    </p>
    <p className="text-base text-white/75 leading-relaxed font-light">
      Stop losing money to hidden errors. Xenitor runs 24/7 inside your systems to detect, verify, and prevent financial leaks — before they cost you.
    </p>

    <div className="border-t border-white/8 pt-6 space-y-3">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-4">What Xenitor Does</p>
      {[
        "Auto-match invoices, POs & payments in seconds",
        "Catch duplicate charges & pricing violations",
        "Enforce compliance before transactions happen",
        "Turn emails & contracts into actionable financial intelligence",
      ].map((f, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-primary/20 border border-primary/40">
            <Check className="w-3 h-3 text-primary" />
          </div>
          <span className="text-sm text-white/70 font-light leading-relaxed">{f}</span>
        </div>
      ))}
    </div>

    <div className="border-t border-white/8 pt-6 rounded-2xl">
      <p className="text-xs font-semibold tracking-widest text-secondary uppercase mb-1">Don't just track your capital.</p>
      <p className="text-sm font-medium text-white/60 italic mb-5">Defend it.</p>

      <div className="border border-white/8 rounded-2xl p-4 space-y-2 mb-5 bg-white/[0.02]">
        <p className="text-xs font-semibold tracking-widest text-white/30 uppercase mb-3">Why Xenitor?</p>
        {[
          "Saves thousands in recovered revenue",
          "Eliminates manual audit work",
          "Works inside SAP, Oracle, Gmail & Slack",
          "AI decisions with clear reasoning",
        ].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-secondary text-sm">⚡</span>
            <span className="text-sm text-white/60 font-light">{w}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <a href="#demo" className="flex-1 text-center px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-all">
          Book a Demo
        </a>
        <a href="#pilot" className="flex-1 text-center px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-all">
          Start Free Pilot
        </a>
        <a href="#how" className="flex-1 text-center px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-secondary text-black text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,200,255,0.3)]">
          See How It Works
        </a>
      </div>
    </div>

    <div className="border-t border-white/8 pt-5">
      <p className="text-xs font-semibold tracking-widest text-white/30 uppercase mb-3 flex items-center gap-2">
        <Smartphone className="w-3.5 h-3.5" />
        Download the App
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href="#android"
          aria-label="Get it on Google Play"
          className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.18 1.07C2.82 1.45 2.6 2.03 2.6 2.77v18.46c0 .74.22 1.32.58 1.7l.09.08 10.34-10.34v-.24L3.27.99l-.09.08z" fill="#4FC3F7"/>
            <path d="M16.76 17.33l-3.44-3.44v-.24l3.44-3.44.08.04 4.08 2.32c1.16.66 1.16 1.74 0 2.4l-4.08 2.32-.08.04z" fill="#FFD54F"/>
            <path d="M16.84 17.29L13.32 13.77 3.18 23.91c.38.4.99.45 1.68.05l11.98-6.67" fill="#F48FB1"/>
            <path d="M16.84 10.25L4.86 3.58c-.69-.4-1.3-.35-1.68.05L13.32 13.77l3.52-3.52z" fill="#A5D6A7"/>
          </svg>
          <div>
            <p className="text-[10px] text-white/40 font-light leading-none mb-0.5">Get it on</p>
            <p className="text-sm font-semibold text-white/90 leading-none">Google Play</p>
          </div>
        </a>
        <a
          href="#ios"
          aria-label="Download on the App Store"
          className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          <div>
            <p className="text-[10px] text-white/40 font-light leading-none mb-0.5">Download on the</p>
            <p className="text-sm font-semibold text-white/90 leading-none">App Store</p>
          </div>
        </a>
      </div>
    </div>
  </div>
);

const XeniQModal = () => (
  <div className="space-y-6">
    <p className="text-base text-white/50 font-light italic tracking-wide -mt-2">
      Learn Islam. Live It. Share It.
    </p>
    <p className="text-base text-white/75 leading-relaxed font-light">
      XenQ is your all-in-one Islamic learning and quiz app designed for modern Muslims. Ask questions with <span className="text-primary font-medium">Ask Xeni 🤖</span>, explore the Qur'an with translations, track your daily prayers, and grow your knowledge through fun, interactive quizzes.
    </p>

    <div className="border-t border-white/8 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[
        { icon: "🌙", label: "Daily Hadith & Prophet ﷺ stories" },
        { icon: "📖", label: "Full Qur'an — Arabic + multi-language" },
        { icon: "🧠", label: "Smart quizzes + challenge friends" },
        { icon: "⏰", label: "Prayer tracking & reminders" },
      ].map((f, i) => (
        <div key={i} className="flex items-start gap-3 bg-white/[0.03] border border-white/8 rounded-2xl p-3">
          <span className="text-lg leading-none mt-0.5">{f.icon}</span>
          <span className="text-sm text-white/70 font-light leading-relaxed">{f.label}</span>
        </div>
      ))}
    </div>

    <div className="flex items-center gap-2 flex-wrap">
      {["🇬🇧 English", "🇸🇦 Arabic", "🇧🇩 Bengali", "🇵🇰 Urdu", "🇲🇾 Malay"].map((lang, i) => (
        <span key={i} className="text-xs font-light text-white/50 border border-white/10 rounded-full px-3 py-1 bg-white/[0.03]">{lang}</span>
      ))}
    </div>

    <div className="border-t border-white/8 pt-5">
      <p className="text-xs font-semibold tracking-widest text-secondary uppercase mb-3">Why XenQ?</p>
      <div className="space-y-2 mb-5">
        {[
          { icon: "🚀", label: "Learn Islam in a simple, engaging way" },
          { icon: "🔥", label: "Build consistency with daily streaks" },
          { icon: "📢", label: "Share & challenge friends instantly" },
          { icon: "✨", label: "Personalized, AI-powered experience" },
        ].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-base">{w.icon}</span>
            <span className="text-sm text-white/65 font-light">{w.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-white/30 italic mb-5">Turn learning into a daily habit. Compete. Reflect. Improve.</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <a href="#quiz" className="flex-1 text-center px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-all">
          Challenge Friends
        </a>
        <a href="#share" className="flex-1 text-center px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-all">
          Share with Friends
        </a>
        <a href="#download" className="flex-1 text-center px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-secondary text-black text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,200,255,0.3)]">
          Get Started Now
        </a>
      </div>
    </div>

    <div className="border border-primary/20 rounded-2xl p-4 bg-primary/5 text-center">
      <p className="text-sm font-medium text-white/70 italic">XenQ – Strengthen your knowledge. Elevate your Iman. 🌙</p>
    </div>

    <DownloadBadges />
  </div>
);

const servicesData: Service[] = [
  {
    id: "xeni-assistance",
    title: "Xeni Assistance",
    shortDesc: "Your AI business assistant — replies, manages orders & posts content automatically.",
    longDesc: "",
    icon: <Network className="w-8 h-8 text-primary" />,
    color: "from-primary/20 to-transparent",
    richModal: <XeniAssistanceModal />
  },
  {
    id: "xenfi",
    title: "XenFi",
    shortDesc: "Your complete wealth command center — track, grow, and control your money.",
    longDesc: "",
    icon: <Zap className="w-8 h-8 text-secondary" />,
    color: "from-secondary/20 to-transparent",
    richModal: <XenFiModal />
  },
  {
    id: "xeniq",
    title: "XenQ",
    shortDesc: "Your all-in-one Islamic learning & quiz app — learn, reflect, and grow daily.",
    longDesc: "",
    icon: <Cpu className="w-8 h-8 text-primary" />,
    color: "from-primary/20 to-transparent",
    richModal: <XeniQModal />
  },
  {
    id: "xenitor",
    title: "Xenitor",
    shortDesc: "Autonomous financial smart auditor — stop losing money to hidden errors.",
    longDesc: "",
    icon: <ShieldCheck className="w-8 h-8 text-secondary" />,
    color: "from-secondary/20 to-transparent",
    richModal: <XenitorModal />
  }
];

export function Services() {
  const [selectedService, setSelectedService] = useState<typeof servicesData[0] | null>(null);

  return (
    <section id="services" className="py-32 relative z-20">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mb-20 text-center md:text-left"
        >
          <h2 className="text-4xl md:text-5xl font-serif font-medium text-white mb-4">Our Ecosystem</h2>
          <div className="w-20 h-1 bg-gradient-to-r from-primary to-transparent mx-auto md:mx-0"></div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          {servicesData.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative cursor-pointer"
              onClick={() => setSelectedService(service)}
            >
              <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-xl -z-10"
                   style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }}
              >
                {/* Simulated glow effect using tailwind gradients applied via inline style override in JS or just letting the group hover handle it. We'll use absolute div behind. */}
              </div>
              <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-10 rounded-3xl blur-xl transition-all duration-500`}></div>
              
              <div className="h-full glass-card rounded-3xl p-8 md:p-10 flex flex-col justify-between interactive relative overflow-hidden">
                {/* Decorative mesh background image (subtle) */}
                <div 
                  className="absolute inset-0 opacity-5 mix-blend-screen pointer-events-none transition-opacity duration-500 group-hover:opacity-20"
                  style={{ backgroundImage: `url('${import.meta.env.BASE_URL}images/abstract-mesh.png')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />

                <div>
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-inner">
                    {service.icon}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-serif font-medium text-white mb-4">{service.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {service.shortDesc}
                  </p>
                </div>
                
                <div className="mt-8 flex items-center text-sm font-semibold tracking-wide text-white/70 group-hover:text-primary transition-colors">
                  <span>{service.richModal ? 'Get Started Now' : 'Learn More'}</span>
                  <ArrowRight className="w-4 h-4 ml-2 transform group-hover:translate-x-2 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedService && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedService(null)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full max-w-2xl glass-panel rounded-3xl p-8 md:p-12 relative pointer-events-auto bg-[#111] shadow-[0_0_50px_rgba(0,0,0,0.8)] border-white/10 max-h-[90vh] overflow-y-auto"
              >
                <button 
                  onClick={() => setSelectedService(null)}
                  className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <div className="flex items-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mr-6">
                    {selectedService.icon}
                  </div>
                  <h3 className="text-3xl md:text-4xl font-serif font-medium text-white">{selectedService.title}</h3>
                </div>
                
                {selectedService.richModal ? (
                  <div className="mb-6">{selectedService.richModal}</div>
                ) : (
                  <p className="text-lg text-white/80 leading-relaxed font-light mb-10">
                    {selectedService.longDesc}
                  </p>
                )}
                
                {!selectedService.richModal && (
                  <div className="flex justify-end">
                    <button 
                      className="px-8 py-3 rounded-full bg-white text-black font-semibold tracking-wide hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(0,200,255,0.5)]"
                      onClick={() => setSelectedService(null)}
                    >
                      Close
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
