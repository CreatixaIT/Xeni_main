import React from 'react';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';

const EMAIL = 'connect@xeni.xentroinfotech.com';

export function Contact() {
  return (
    <section id="contact" className="py-32 relative border-t border-white/5">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl md:text-4xl font-serif font-medium text-white mb-4">Get in Touch</h2>
          <p className="text-muted-foreground mb-16 font-light">Let's build the future together.</p>

          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex flex-col items-center gap-6 group interactive"
          >
            <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 group-hover:border-primary/40 group-hover:bg-primary/10 transition-all duration-500 shadow-[0_0_0px_rgba(0,200,255,0)] group-hover:shadow-[0_0_30px_rgba(0,200,255,0.25)]">
              <Mail className="w-7 h-7 text-white/50 group-hover:text-primary transition-colors duration-500" />
            </div>

            <div className="relative">
              <span className="text-2xl md:text-4xl lg:text-5xl font-serif font-medium text-transparent bg-clip-text bg-white group-hover:bg-gradient-to-r group-hover:from-primary group-hover:to-secondary transition-all duration-500 break-all">
                {EMAIL}
              </span>
              <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-700 pointer-events-none"></div>
            </div>

            <span className="text-xs font-semibold tracking-widest text-white/30 uppercase group-hover:text-primary/60 transition-colors duration-300">
              Click to send us an email →
            </span>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-40 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground border-t border-white/10 pt-8"
        >
          <p>© {new Date().getFullYear()} XENI Systems. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors interactive">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors interactive">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors interactive">System Status</a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
