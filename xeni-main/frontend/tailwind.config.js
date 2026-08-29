/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#7C3AED', 50: '#F3EEFF', 100: '#E5D4FF', 200: '#C9A8FF', 300: '#A97BFF', 400: '#8B4FFF', 500: '#7C3AED', 600: '#6D28D9', 700: '#5B21B6', 800: '#4C1D95', 900: '#3B0764' },
        accent: { DEFAULT: '#06B6D4', 50: '#ECFEFF', 100: '#CFFAFE', 200: '#A5F3FC', 300: '#67E8F9', 400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2', 700: '#0E7490', 800: '#155E75', 900: '#164E63' },
        success: { DEFAULT: '#10B981', 50: '#ECFDF5', 500: '#10B981', 600: '#059669' },
        danger: { DEFAULT: '#EF4444', 50: '#FEF2F2', 500: '#EF4444', 600: '#DC2626' },
        bkash: { DEFAULT: '#E2136E' },
        dark: { DEFAULT: '#0F0F23', 50: '#1A1A2E', 100: '#16213E', 200: '#1E293B', 300: '#334155', 400: '#475569', 500: '#64748B', 600: '#94A3B8', 700: '#CBD5E1', 800: '#E2E8F0', 900: '#F1F5F9' },
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        bangla: ['Hind Siliguri', 'sans-serif'],
      },
      backdropBlur: { glass: '16px' },
      boxShadow: {
        glow: '0 0 20px rgba(124, 58, 237, 0.3)',
        'glow-accent': '0 0 20px rgba(6, 182, 212, 0.3)',
        'glow-success': '0 0 20px rgba(16, 185, 129, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        glow: { '0%': { boxShadow: '0 0 5px rgba(124,58,237,0.2)' }, '100%': { boxShadow: '0 0 20px rgba(124,58,237,0.5)' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
