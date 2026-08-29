'use client';

import { motion } from 'framer-motion';
import { Gavel, CheckCircle, AlertTriangle, HelpCircle, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';

export default function TermsOfServicePage() {
  const terms = [
    {
      title: '1. Service Scope',
      icon: CheckCircle,
      content: 'Xeni AI provides an automated business operating system specifically designed for e-commerce and F-commerce in Bangladesh. Our services include 5 AI agents (Conversation, Order, Inventory, Creative, Sales) to automate customer interaction and backend management.'
    },
    {
      title: '2. User Responsibilities',
      icon: Gavel,
      content: 'As a user of Xeni AI, you agree to provide accurate information for account registration, maintain the security of your credentials, and utilize our AI services only for lawful business purposes. You are responsible for any actions taken through your account.'
    },
    {
      title: '3. Subscription and Billing',
      icon: AlertTriangle,
      content: 'Subscription fees are billed monthly or annually via SSLCommerz. We do not store your credit card information directly. Access to premium AI features is dependent on an active subscription. Failure to pay may result in suspension of AI automation services.'
    },
    {
      title: '4. AI Disclaimer',
      icon: HelpCircle,
      content: 'Our services utilize advanced AI models to generate text, images, and sales insights. While we strive for accuracy, AI outputs should be reviewed before final publication or order fulfillment. Xentro Infotech is not liable for any errors caused by AI misconceptions.'
    }
  ];

  return (
    <div className="min-h-screen bg-dark-950 font-sans text-white/90 selection:bg-primary/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors mb-12 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Landing
        </Link>
        
        <header className="mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 text-accent mb-4"
          >
            <Gavel className="w-8 h-8" />
            <span className="text-sm font-bold tracking-widest uppercase">Policies</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-heading font-bold dark:text-white text-gray-900 mb-6"
          >
            Terms of Service
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-600 dark:text-dark-600"
          >
            Please read these terms carefully before using the Xeni AI platform.
          </motion.p>
        </header>

        <div className="space-y-12">
          {terms.map((term, idx) => (
            <motion.section 
              key={idx}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card p-8 dark:border-white/5 border-black/5 relative overflow-hidden group hover:dark:border-white/10 hover:border-black/10 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent flex-shrink-0 group-hover:scale-110 transition-transform">
                  <term.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold dark:text-white text-gray-900 mb-4">{term.title}</h2>
                  <p className="text-slate-600 dark:text-dark-600 leading-relaxed italic">
                    {term.content}
                  </p>
                </div>
              </div>
            </motion.section>
          ))}
        </div>

        <footer className="mt-20 pt-12 border-t dark:border-white/10 border-black/10 text-center text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm">
          <p>© {new Date().getFullYear()} Xentro Infotech. All rights reserved.</p>
          <p className="mt-2 text-dark-600">Headquarters: Dhaka, Bangladesh</p>
        </footer>
      </div>
    </div>
  );
}
