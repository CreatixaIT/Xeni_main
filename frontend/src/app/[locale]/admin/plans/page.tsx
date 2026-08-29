'use client';

import { useState } from 'react';
import { Shield, Sparkles, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const MOCK_PLANS = [
  { id: 'starter', name: 'Starter', price: 2500, orders: 100, pages: 1, storage: 1, active: true },
  { id: 'professional', name: 'Professional', price: 7500, orders: 1000, pages: 3, storage: 5, active: true },
  { id: 'premium', name: 'Premium', price: 25000, orders: 'Unlimited', pages: 10, storage: 20, active: true },
];

export default function PlanManagerPage() {
  const [plans, setPlans] = useState(MOCK_PLANS);

  const handleSave = () => {
    toast.success('Plan configuration saved!');
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto pb-24 h-full">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold dark:text-white text-gray-900 mb-2">Plan Manager</h1>
          <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700">Edit billing tiers and their associated limits directly. Sync to SSLCommerz.</p>
        </div>
        <button onClick={() => toast.success('Syncing with SSLCommerz...')} className="btn-accent py-2.5 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Sync SSLCommerz
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan, i) => (
          <div key={plan.id} className="glass-card p-6 border-t-4 border-t-primary">
            <div className="flex items-center justify-between mb-4">
              <input 
                type="text" 
                defaultValue={plan.name} 
                className="bg-transparent text-xl font-heading font-bold dark:text-white text-gray-900 w-40 focus:outline-none focus:border-b focus:border-primary px-1"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked={plan.active} className="rounded dark:border-white/10 border-black/10 bg-dark w-4 h-4 text-primary focus:ring-primary focus:ring-offset-dark" />
                <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">Active</span>
              </label>
            </div>
            
            <div className="mb-6 flex items-baseline">
              <span className="text-2xl text-slate-600 dark:text-slate-600 dark:text-dark-700 mr-1">৳</span>
              <input type="number" defaultValue={plan.price} className="bg-transparent text-4xl font-bold dark:text-white text-gray-900 w-28 focus:outline-none focus:border-b focus:border-primary px-1 font-mono" />
              <span className="text-slate-600 dark:text-slate-600 dark:text-dark-700">/mo</span>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700">Max Orders</span>
                <input type="text" defaultValue={plan.orders} className="bg-dark/50 border dark:border-white/10 border-black/10 rounded-lg px-2 py-1 text-sm dark:text-white text-gray-900 w-20 text-right focus:outline-none focus:border-primary" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700">FB Pages</span>
                <input type="number" defaultValue={plan.pages} className="bg-dark/50 border dark:border-white/10 border-black/10 rounded-lg px-2 py-1 text-sm dark:text-white text-gray-900 w-20 text-right focus:outline-none focus:border-primary" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700">Storage (GB)</span>
                <input type="number" defaultValue={plan.storage} className="bg-dark/50 border dark:border-white/10 border-black/10 rounded-lg px-2 py-1 text-sm dark:text-white text-gray-900 w-20 text-right focus:outline-none focus:border-primary" />
              </div>
            </div>

            <button onClick={handleSave} className="w-full btn-secondary py-2 border-primary/30 dark:text-white text-gray-900 hover:border-primary transition-all">
              Save Plan
            </button>
          </div>
        ))}
      </div>
      
      {/* Danger Zone */}
      <div className="mt-12 border border-danger/30 rounded-2xl p-6 bg-danger/5">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-danger/10 text-danger rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold dark:text-white text-gray-900 mb-1">Danger Zone</h4>
            <p className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-4">Actions here are irreversible and affect active users.</p>
            <button className="btn-secondary py-2 text-danger border-danger/30 hover:border-danger hover:bg-danger/10 text-sm">Force downgrade obsolete plan users</button>
          </div>
        </div>
      </div>
    </div>
  );
}
