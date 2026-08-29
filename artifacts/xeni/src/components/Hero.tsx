import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ParticleBackground } from './ParticleBackground';

export function Hero() {
  const handleScroll = () => {
    document.querySelector('#services')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <ParticleBackground />
      
      <div className="relative z-20 max-w-5xl mx-auto px-6 pt-20 text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-3 shadow-[0_0_10px_rgba(0,200,255,0.8)]"></span>
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Xeni OS v2.0 Online</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-serif font-medium leading-tight text-white mb-6 drop-shadow-2xl"
        >
          Designing the Future <br className="hidden md:block" />
          <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            of Digital Intelligence
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 font-light leading-relaxed"
        >
          A unified ecosystem of intelligent tools and services built for speed, automation, and unprecedented growth.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1, ease: "easeOut" }}
          className="flex flex-col sm:flex-row gap-6"
        >
          <Button 
            size="lg" 
            className="rounded-full px-10 text-base tracking-wide shadow-[0_0_30px_rgba(0,200,255,0.25)] hover:shadow-[0_0_40px_rgba(0,200,255,0.4)] interactive"
            onClick={handleScroll}
          >
            Get Access Now
          </Button>
          <Button 
            variant="ghost" 
            size="lg" 
            className="rounded-full px-10 text-base tracking-wide border border-transparent hover:border-white/10 interactive"
            onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Request Access
          </Button>
        </motion.div>
      </div>

      {/* Subtle bottom gradient fade to match next section */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
}
