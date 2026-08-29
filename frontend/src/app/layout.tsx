import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'XENI — AI Business OS',
  description: 'Your AI-powered business operating system. 6 specialized agents for marketing, content, and analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
