'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ConversationMetricsProps {
  aiMessages: number;
  humanMessages: number;
}

export function ConversationMetricsChart({ aiMessages, humanMessages }: ConversationMetricsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-full h-[350px] dark:bg-white/5 bg-black/5 animate-pulse rounded-xl" />;

  const data = [
    { name: 'AI Handled', value: aiMessages, color: '#7C3AED' }, // Brand Purple
    { name: 'Human Fallback', value: humanMessages, color: '#F43F5E' }, // Rose/Red for warning
  ];

  const COLORS = ['#7C3AED', '#F43F5E'];

  // If no data, show empty state ring
  const hasData = aiMessages > 0 || humanMessages > 0;
  const displayData = hasData ? data : [{ name: 'No Data', value: 1, color: '#334155' }];

  return (
    <div className="w-full h-[350px] flex flex-col relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(10, 10, 26, 0.9)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: '#fff'
            }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: any) => {
              if (!hasData) return ['No messages', 'Status'];
              return [value, 'Messages'];
            }}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingBottom: '10px' }} />
          <Pie
            data={displayData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={120}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {displayData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-[36px]">
        <span className="text-3xl font-bold dark:text-white text-gray-900 tracking-tight">
          {hasData ? Math.round((aiMessages / (aiMessages + humanMessages)) * 100) : 0}%
        </span>
        <span className="text-xs dark:text-white text-gray-900/50 font-medium">AI Success</span>
      </div>
    </div>
  );
}
