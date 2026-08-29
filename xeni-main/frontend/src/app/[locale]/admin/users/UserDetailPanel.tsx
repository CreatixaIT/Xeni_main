'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Activity, DollarSign, Bot, MessageSquare, Shield, CreditCard, UserMinus, UserCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface UserDetailPanelProps {
  userId: string | null;
  onClose: () => void;
}

export function UserDetailPanel({ userId, onClose }: UserDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'payments' | 'conversations'>('overview');
  const queryClient = useQueryClient();

  // 1. Fetch User details
  const { data: detailData, isLoading } = useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${userId}`);
      return res.data.data;
    },
    enabled: !!userId,
  });

  const detail = detailData;
  const user = detail?.user;
  const shop = detail?.shop;
  const sub = detail?.subscription;
  const stats = detail?.stats;

  // 2. Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string, reason?: string }) => {
      return api.put(`/admin/users/${userId}/status`, { status, reason });
    },
    onSuccess: () => {
      toast.success('User status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast.error('Failed to update status')
  });

  const changeRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      return api.put(`/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast.success('User role updated');
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update role')
  });

  // 1.5 Fetch Conversations (when tab is active)
  const { data: conversationData, isLoading: isConversationsLoading } = useQuery({
    queryKey: ['admin-user-conversations', userId],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${userId}/conversations`);
      return res.data.data;
    },
    enabled: !!userId && activeTab === 'conversations',
  });

  const conversations = conversationData;

  if (!userId) return <AnimatePresence />;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 bottom-0 w-[520px] bg-dark border-l dark:border-white/10 border-black/10 z-50 flex flex-col shadow-2xl"
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : detail ? (
          <>
            {/* Header */}
            <div className="p-6 border-b dark:border-white/10 border-black/10 bg-black/20">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xl font-bold text-white shadow-glow-accent">
                    {user?.full_name?.charAt(0) || user?.email?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold dark:text-white text-gray-900 truncate">{user?.full_name || 'No Name'}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700 truncate">{user?.email}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`badge ${user?.role === 'user' ? 'bg-white/10 text-slate-600 dark:text-dark-600' : 'bg-primary/20 text-primary'} capitalize`}>{user?.role?.replace('_', ' ')}</span>
                      <span className={`badge ${user?.status === 'active' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'} capitalize`}>{user?.status}</span>
                    </div>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:dark:bg-white/10 hover:bg-black/10 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-1 overflow-x-auto border-b dark:border-white/10 border-black/10 pb-[-1px]">
                {['overview', 'tasks', 'payments', 'conversations'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize whitespace-nowrap ${
                      activeTab === tab 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 hover:dark:border-white/20 hover:border-black/20'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <Bot className="w-5 h-5 text-primary mb-2" />
                      <div className="text-2xl font-bold dark:text-white text-gray-900">{stats?.total_tasks || 0}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">Total Tasks</div>
                    </div>
                    <div className="glass-card p-4">
                      <DollarSign className="w-5 h-5 text-emerald-400 mb-2" />
                      <div className="text-2xl font-bold dark:text-white text-gray-900">৳{(stats?.total_spent_bdt || 0).toLocaleString()}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">Total Spent</div>
                    </div>
                    <div className="glass-card p-4">
                      <Activity className="w-5 h-5 text-cyan-400 mb-2" />
                      <div className="text-2xl font-bold dark:text-white text-gray-900">{stats?.orders_processed || 0}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">Orders Processed</div>
                    </div>
                    <div className="glass-card p-4">
                      <MessageSquare className="w-5 h-5 text-pink-400 mb-2" />
                      <div className="text-2xl font-bold dark:text-white text-gray-900">{stats?.messages_replied || 0}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700">Messages Replied</div>
                    </div>
                  </div>

                  {/* Subscription Info */}
                  <div className="border border-white/10 rounded-2xl p-5 bg-gradient-to-br from-white/5 to-transparent">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold dark:text-white text-gray-900">Subscription Details</h4>
                      <span className={`badge ${sub?.plan?.tier === 'premium' ? 'bg-emerald-500/20 text-emerald-400' : sub?.plan?.tier === 'professional' ? 'bg-violet-500/20 text-violet-400' : 'bg-primary/20 text-primary'} uppercase text-[10px] tracking-wider`}>
                        {sub?.plan?.name || 'No Plan'}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between border-b dark:border-white/5 border-black/5 pb-2">
                        <span className="text-slate-600 dark:text-slate-600 dark:text-dark-700">Status</span>
                        <span className={`capitalize ${sub?.status === 'active' ? 'text-success' : 'text-danger'}`}>{sub?.status || 'n/a'}</span>
                      </div>
                      <div className="flex justify-between border-b dark:border-white/5 border-black/5 pb-2">
                        <span className="text-slate-600 dark:text-slate-600 dark:text-dark-700">Renewal Date</span>
                        <span className="dark:text-white text-gray-900">{sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : 'n/a'}</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="text-slate-600 dark:text-slate-600 dark:text-dark-700">Member Since</span>
                        <span className="dark:text-white text-gray-900 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'n/a'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Connected Pages */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-3 uppercase tracking-wider">Connected FB Pages ({detail?.connected_pages?.length || 0})</h4>
                    <div className="space-y-2">
                      {detail?.connected_pages?.map((page: any) => (
                        <div key={page.id} className="flex items-center gap-3 p-3 dark:bg-white/5 bg-black/5 rounded-xl border dark:border-white/5 border-black/5">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center dark:text-white text-gray-900 font-bold text-xs">FB</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm dark:text-white text-gray-900 truncate">{page.page_name}</div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 truncate">ID: {page.facebook_page_id}</div>
                          </div>
                          <span className="badge bg-success/10 text-success text-[10px]">Active</span>
                        </div>
                      ))}
                      {(!detail?.connected_pages || detail?.connected_pages?.length === 0) && (
                        <div className="text-center py-4 text-xs text-dark-600 border border-dashed dark:border-white/5 border-black/5 rounded-xl">No pages connected</div>
                      )}
                    </div>
                  </div>

                  {/* Admin Actions Section */}
                  <div className="pt-4 space-y-4">
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-wider">Special Actions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => {
                          const newRole = user?.role === 'admin' ? 'user' : 'admin';
                          if (confirm(`Promote/Demote to ${newRole}?`)) changeRoleMutation.mutate(newRole);
                        }}
                        className="flex items-center gap-2 px-4 py-2 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 border dark:border-white/10 border-black/10 rounded-xl text-xs dark:text-white text-gray-900 transition-all disabled:opacity-50"
                        disabled={changeRoleMutation.isPending}
                      >
                         <Shield className="w-3.5 h-3.5 text-primary" /> {user?.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                      </button>
                      <button 
                        onClick={() => toast('Plan Override logic coming soon')}
                        className="flex items-center gap-2 px-4 py-2 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 border dark:border-white/10 border-black/10 rounded-xl text-xs dark:text-white text-gray-900 transition-all"
                      >
                         <CreditCard className="w-3.5 h-3.5 text-emerald-400" /> Force Plan Change
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  {detail?.recent_tasks?.map((task: any) => (
                    <div key={task.id} className="p-3 dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-xl">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-medium dark:text-white text-gray-900 capitalize">{task.agent_type?.replace('_', ' ')}</span>
                        <span className={`text-[10px] badge ${task.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>{task.status}</span>
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 mb-2">{task.created_at ? new Date(task.created_at).toLocaleString() : 'n/a'}</div>
                      <div className="text-[11px] text-dark-300 font-mono bg-black/30 p-2 rounded line-clamp-2">
                        {JSON.stringify(task.input_data)}
                      </div>
                    </div>
                  ))}
                  {(!detail?.recent_tasks || detail.recent_tasks.length === 0) && (
                    <div className="text-center py-10 text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm">No tasks found.</div>
                  )}
                </div>
              )}
              {activeTab === 'payments' && (
                <div className="space-y-3">
                   {detail?.payment_history?.map((pay: any) => (
                    <div key={pay.id} className="flex items-center justify-between p-3 dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-xl">
                      <div>
                        <div className="text-xs font-bold dark:text-white text-gray-900">৳{pay.amount.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700">{new Date(pay.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-600 dark:text-dark-600">{pay.plan?.name || 'Plan'}</div>
                        <span className={`text-[10px] badge ${pay.status === 'success' ? 'badge-success' : 'badge-danger'}`}>{pay.status}</span>
                      </div>
                    </div>
                  ))}
                  {(!detail?.payment_history || detail.payment_history.length === 0) && (
                    <div className="text-center py-10 text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm">No payment history.</div>
                  )}
                </div>
              )}
              {activeTab === 'conversations' && (
                <div className="space-y-4">
                  {isConversationsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-primary/40 animate-spin mb-4" />
                      <p className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700">Loading conversation history...</p>
                    </div>
                  ) : conversations && conversations.length > 0 ? (
                    <div className="space-y-3">
                      {conversations.map((conv: any) => (
                        <div key={conv.id} className="glass-card p-4 hover:border-primary/30 transition-all cursor-default group">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                                <h5 className="text-sm font-semibold dark:text-white text-gray-900 group-hover:text-primary transition-colors">{conv.customer_name || 'Guest User'}</h5>
                                <p className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700">PSID: {conv.customer_psid}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                                <span className={`badge text-[10px] ${conv.handling_mode === 'ai' ? 'bg-primary/20 text-primary' : 'bg-cyan-500/20 text-cyan-400'}`}>
                                    {conv.handling_mode === 'ai' ? '🤖 AI Bot' : '👨‍💼 Human'}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${conv.status === 'open' ? 'border-success text-success' : 'border-dark-600 text-slate-600 dark:text-slate-600 dark:text-dark-700'}`}>
                                    {conv.status}
                                </span>
                            </div>
                          </div>
                          
                          <div className="dark:bg-black/40 bg-[rgba(0,0,0,0.02)] rounded-lg p-2.5 mb-2 border dark:border-white/5 border-black/5">
                            <p className="text-xs text-dark-300 italic line-clamp-2">
                                &ldquo;{conv.last_message_preview || 'No messages yet'}&rdquo;
                            </p>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700">
                             <div className="flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-dark-600" />
                                {conv.unread_count > 0 ? (
                                    <span className="text-pink-400 font-bold">{conv.unread_count} unread</span>
                                ) : (
                                    <span>All read</span>
                                )}
                             </div>
                             <div>
                                Last active: {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : 'n/a'}
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageSquare className="w-12 h-12 text-dark-600 mb-4 opacity-20" />
                      <p className="dark:text-white text-gray-900 font-medium mb-1">No Conversations Found</p>
                      <p className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 px-8">There are no interaction logs available for this user&apos;s shop at the moment.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t dark:border-white/10 border-black/10 bg-black/20 flex gap-3">
              <button className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2">
                 <MessageSquare className="w-4 h-4" /> Send Email
              </button>
              {user?.status === 'active' ? (
                <button 
                  onClick={() => {
                    const reason = prompt('Reason for suspension?');
                    if (reason) updateStatusMutation.mutate({ status: 'suspended', reason });
                  }}
                  disabled={updateStatusMutation.isPending}
                  className="flex-1 btn-secondary py-2.5 text-sm text-danger border-danger/30 hover:border-danger hover:shadow-glow-danger hover:bg-danger/10 flex items-center justify-center gap-2"
                >
                  <UserMinus className="w-4 h-4" /> Suspend User
                </button>
              ) : (
                <button 
                  onClick={() => updateStatusMutation.mutate({ status: 'active' })}
                  disabled={updateStatusMutation.isPending}
                  className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-2.5 text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" /> Activate User
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600 dark:text-slate-600 dark:text-dark-700">User not found</div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

