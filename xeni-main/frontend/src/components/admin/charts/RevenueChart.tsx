'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChartData {
  month: string;
  Starter: number;
  Professional: number;
  Premium: number;
}

interface RevenueChartProps {
  data: ChartData[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-full h-[350px] dark:bg-white/5 bg-black/5 animate-pulse rounded-xl" />;

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="month" 
            stroke="rgba(255,255,255,0.3)" 
            fontSize={12} 
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.3)" 
            fontSize={12} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `৳${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(10, 10, 26, 0.9)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)'
            }}
            itemStyle={{ fontSize: '14px', fontWeight: 500 }}
            formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, '']}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
          <Line 
            type="monotone" 
            dataKey="Starter" 
            stroke="#06B6D4" /* Cyan */
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: '#0A0A1A' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
          <Line 
            type="monotone" 
            dataKey="Professional" 
            stroke="#7C3AED" /* Violet */
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: '#0A0A1A' }}
            activeDot={{ r: 6, strokeWidth: 0, filter: 'drop-shadow(0 0 8px rgba(124,58,237,0.5))' }}
          />
          <Line 
            type="monotone" 
            dataKey="Premium" 
            stroke="#10B981" /* Green */
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: '#0A0A1A' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
