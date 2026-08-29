'use client';

import { motion } from 'framer-motion';
import { Shield, Lock, Eye, FileText, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';

export default function PrivacyPolicyPage() {
  const sections = [
    {
      title: '1. Information We Collect',
      icon: Eye,
      content: 'We collect information you provide directly to us when you create an account, such as your name, email address, shop URL, and payment information (handled securely via SSLCommerz). If you connect your Facebook page, we access only the data necessary (messages, page info, post comments) to provide our AI-driven automation services.'
    },
    {
      title: '2. How We Use Information',
      icon: Shield,
      content: 'We use the collected data to provide, maintain, and improve our services, including automating customer messages, processing orders, and analyzing sales trends through our 5 domain-specific AI agents. We do NOT sell your data to third parties.'
    },
    {
      title: '3. Facebook Data Policy',
      icon: Lock,
      content: 'Xeni AI requests specific permissions from Facebook (pages_messaging, pages_read_engagement) to automate your shop operations. This data is processed in real-time and stored securely. You can revoke this access at any time through your Facebook settings or our dashboard.'
    },
    {
      title: '4. Data Retention and Deletion',
      icon: FileText,
      content: 'We store your data for as long as your account is active. You have the right to request deletion of your account and all associated data at any time by contacting us at support@xentroinfotech.com or via the account settings panel.'
    }
  ];

  return (
    <div className="min-h-screen bg-dark-950 font-sans text-white/90 selection:bg-primary/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors mb-12 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Landing
        </Link>
        
        <header className="mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 text-primary mb-4"
          >
            <Shield className="w-8 h-8" />
            <span className="text-sm font-bold tracking-widest uppercase">Legal</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-heading font-bold dark:text-white text-gray-900 mb-6"
          >
            Privacy Policy
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-600 dark:text-dark-600"
          >
            At Xeni AI, your privacy is our priority. This policy outlines how we handle and protect your data.
          </motion.p>
        </header>

        <div className="space-y-12">
          {sections.map((section, idx) => (
            <motion.section 
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card p-8 dark:border-white/5 border-black/5 relative overflow-hidden"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <section.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold dark:text-white text-gray-900 mb-4">{section.title}</h2>
                  <p className="text-slate-600 dark:text-dark-600 leading-relaxed italic line-height-relaxed">
                    {section.content}
                  </p>
                </div>
              </div>
            </motion.section>
          ))}
        </div>

        <footer className="mt-20 pt-12 border-t dark:border-white/10 border-black/10 text-center text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm">
          <p>© {new Date().getFullYear()} Xentro Infotech. All rights reserved.</p>
          <p className="mt-2">Last Updated: April 8, 2026</p>
        </footer>
      </div>
    </div>
  );
}
