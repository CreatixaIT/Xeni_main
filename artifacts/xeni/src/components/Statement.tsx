import React from 'react';
import { motion } from 'framer-motion';

export function Statement() {
  return (
    <section id="statement" className="py-40 md:py-60 relative flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-serif italic text-white leading-tight">
            "We don't just build digital tools. <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-white to-secondary not-italic">
              We architect intelligent ecosystems.
            </span>"
          </h2>
          
          <motion.div 
            initial={{ scaleX: 0, opacity: 0 }}
            whileInView={{ scaleX: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
            className="w-32 h-px bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mt-12 shadow-[0_0_15px_rgba(0,200,255,0.8)]"
          />
        </motion.div>
      </div>
    </section>
  );
}
