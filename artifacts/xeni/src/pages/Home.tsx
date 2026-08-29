import React, { useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { Services } from '@/components/Services';
import { Statement } from '@/components/Statement';
import { Contact } from '@/components/Contact';
import { CustomCursor } from '@/components/CustomCursor';

export default function Home() {
  // Ensure window is scrolled to top on mount if there's no hash
  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <CustomCursor />
      <Navbar />
      
      <main>
        <Hero />
        <Services />
        <Statement />
        <Contact />
      </main>
    </div>
  );
}
