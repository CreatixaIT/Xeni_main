'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  change?: { value: string; isPositive: boolean };
  delay?: number;
}

export function StatCard({ label, value, icon: Icon, color, change, delay = 0 }: StatCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay }} 
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm font-medium">{label}</span>
        <div className={`p-2 rounded-xl dark:bg-white/5 bg-black/5 ${color} shadow-glow`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-heading font-bold dark:text-white text-gray-900">{value}</p>
        {change && (
          <span className={`text-sm font-medium ${change.isPositive ? 'text-success' : 'text-danger'}`}>
            {change.isPositive ? '+' : '-'}{change.value}
          </span>
        )}
      </div>
    </motion.div>
  );
}
