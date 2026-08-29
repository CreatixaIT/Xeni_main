'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, Send, Bot, User, ToggleLeft, ToggleRight, 
  Search, Filter, CheckCircle2, AlertCircle, ShoppingBag, 
  MoreVertical, ShieldAlert, Archive, Trash2, ExternalLink
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useXeniSocket } from '@/hooks/useXeniSocket';
import { useTranslations } from 'next-intl';
import CreateOrderModal from './CreateOrderModal';

interface Conversation {
  id: string;
  customer_psid: string;
  customer_name: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  handling_mode: 'ai' | 'human';
  status: 'open' | 'resolved' | 'archived';
  page_id: string;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'ai' | 'human' | 'system';
  content_type: 'text' | 'image' | 'template';
  content_text: string | null;
  sent_at: string;
}

interface Order {
  id: string;
  total_bdt: number;
  status: string;
  created_at: string;
}

export default function ConversationsPage() {
  const t = useTranslations();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'ai' | 'human' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  // Real-time message listener
  const handleNewMessage = useCallback((payload: { conversation_id: string; message: Message }) => {
    if (selected?.id === payload.conversation_id) {
      setMessages(prev => [...prev, payload.message]);
      scrollToBottom();
    }
    // Update thread list
    setConversations(prev => {
      const index = prev.findIndex(c => c.id === payload.conversation_id);
      if (index === -1) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        last_message_preview: payload.message.content_text,
        last_message_at: payload.message.sent_at,
        unread_count: selected?.id === payload.conversation_id ? 0 : updated[index].unread_count + 1
      };
      // Move to top
      const item = updated.splice(index, 1)[0];
      return [item, ...updated];
    });
  }, [selected?.id]);

  const handleMessageReplied = useCallback((payload: { conversation_id: string; message: Message }) => {
    if (selected?.id === payload.conversation_id) {
      setMessages(prev => [...prev, payload.message]);
      scrollToBottom();
    }
  }, [selected?.id]);

  useXeniSocket('new_message', handleNewMessage);
  useXeniSocket('message_replied', handleMessageReplied);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/conversations', { params: { per_page: 50 } });
      setConversations(res.data.data || []);
    } catch {
      // Mock data for development
      setConversations([
        { id: '1', customer_psid: '12345678', customer_name: 'Rahim Ahmed', last_message_preview: 'How much for the Premium Bag?', last_message_at: new Date().toISOString(), unread_count: 2, handling_mode: 'ai', status: 'open', page_id: 'p1' },
         { id: '2', customer_psid: '87654321', customer_name: 'Fatima Begum', last_message_preview: 'Can I pay via bKash?', last_message_at: new Date(Date.now() - 3600000).toISOString(), unread_count: 0, handling_mode: 'human', status: 'open', page_id: 'p1' },
      ]);
    }
    setLoading(false);
  };

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const selectConversation = async (conv: Conversation) => {
    setSelected(conv);
    setMessages([]);
    try {
      const [msgRes, orderRes] = await Promise.all([
        api.get(`/conversations/${conv.id}/messages`),
        api.get(`/orders`, { params: { psid: conv.customer_psid } })
      ]);
      setMessages((msgRes.data.data?.messages || []).reverse());
      setCustomerOrders(orderRes.data.data || []);
      
      // Mark as read
      if (conv.unread_count > 0) {
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
      }
    } catch {
      setMessages([
        { id: 'm1', direction: 'inbound', sender_type: 'customer', content_type: 'text', content_text: conv.last_message_preview, sent_at: conv.last_message_at || '' },
        { id: 'm2', direction: 'outbound', sender_type: 'ai', content_type: 'text', content_text: 'Hello! Xeni AI here. How can I help you today?', sent_at: new Date().toISOString() }
      ]);
    }
    scrollToBottom();
  };

  const toggleMode = async () => {
    if (!selected) return;
    const newMode = selected.handling_mode === 'ai' ? 'human' : 'ai';
    try {
      await api.put(`/conversations/${selected.id}/mode`, { mode: newMode });
      setSelected({ ...selected, handling_mode: newMode });
      setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, handling_mode: newMode } : c));
      
      // Add system message
      const systemMsg: Message = {
        id: `sys-${Date.now()}`,
        direction: 'outbound',
        sender_type: 'system',
        content_type: 'text',
        content_text: newMode === 'human' ? 'You have taken over. Xeni is now silent.' : 'Xeni AI has taken over the conversation.',
        sent_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, systemMsg]);
      toast.success(newMode === 'human' ? 'Handled by You' : 'Handled by AI');
    } catch {
      toast.error('Failed to switch mode');
    }
  };

  const sendMessage = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      const res = await api.post(`/conversations/${selected.id}/messages`, { text: reply });
      const newMsg: Message = res.data.data || {
        id: Date.now().toString(),
        direction: 'outbound',
        sender_type: 'human',
        content_type: 'text',
        content_text: reply,
        sent_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMsg]);
      setReply('');
      scrollToBottom();
    } catch {
      toast.error('Failed to send message');
    }
    setSending(false);
  };

  const filteredConversations = conversations.filter(c => {
    const matchesSearch = c.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.customer_psid.includes(searchQuery);
    if (!matchesSearch) return false;
    if (activeTab === 'ai') return c.handling_mode === 'ai';
    if (activeTab === 'human') return c.handling_mode === 'human';
    if (activeTab === 'unread') return c.unread_count > 0;
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      
      {/* Panel 1: Thread List (280px) */}
      <div className="w-[300px] border-r dark:border-white/5 border-black/5 flex flex-col shrink-0" style={{ background: 'var(--bg-secondary)' }}>
        <div className="p-4 border-b dark:border-white/5 border-black/5">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-600 dark:text-dark-700" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-xl py-2 pl-10 pr-4 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-primary/50 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex dark:bg-white/5 bg-black/5 p-1 rounded-xl gap-1">
            {['all', 'ai', 'human', 'unread'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:text-dark-300'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
             <div className="p-4 space-y-4">
               {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
             </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm italic">No chats found</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full text-left px-4 py-4 border-b border-white/5 transition-all flex items-start gap-3 group relative ${selected?.id === conv.id ? 'bg-primary/10' : 'hover:bg-white/5'}`}
              >
                {selected?.id === conv.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold">
                    {(conv.customer_name || 'C').charAt(0)}
                  </div>
                  <div className={`absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 flex items-center justify-center ${conv.handling_mode === 'ai' ? 'bg-violet-500' : 'bg-blue-500'}`}>
                    {conv.handling_mode === 'ai' ? <Bot className="w-2 h-2 dark:text-white text-gray-900" /> : <User className="w-2 h-2 dark:text-white text-gray-900" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <p className="text-sm font-bold dark:text-white text-gray-900 truncate">{conv.customer_name || `PSID: ${conv.customer_psid}`}</p>
                    <span className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 whitespace-nowrap">
                      {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-xs truncate ${conv.unread_count > 0 ? 'dark:text-white text-gray-900 font-medium' : 'text-slate-600 dark:text-slate-600 dark:text-dark-700'}`}>
                      {conv.last_message_preview || 'No messages...'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg shadow-primary/20">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Panel 2: Chat Window (Flex) */}
      <div className="flex-1 flex flex-col relative" style={{ background: 'var(--bg-primary)' }}>
        {selected ? (
          <>
            {/* Header */}
            <div className="h-16 px-6 border-b dark:border-white/5 border-black/5 flex items-center justify-between backdrop-blur-xl bg-black/20 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                  {(selected.customer_name || 'C').charAt(0)}
                </div>
                <div>
                   <h2 className="text-sm font-bold dark:text-white text-gray-900 leading-none">{selected.customer_name}</h2>
                   <p className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 mt-1 uppercase tracking-widest font-bold">PSID: {selected.customer_psid}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                 <div className="flex items-center dark:bg-white/5 bg-black/5 p-1 rounded-xl border dark:border-white/5 border-black/5">
                    <button 
                      onClick={() => selected.handling_mode !== 'ai' && toggleMode()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${selected.handling_mode === 'ai' ? 'bg-violet-600 dark:text-white text-gray-900 shadow-lg' : 'text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:text-dark-300'}`}
                    >
                      <Bot className="w-3.5 h-3.5" /> AI Mode
                    </button>
                    <button 
                      onClick={() => selected.handling_mode !== 'human' && toggleMode()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${selected.handling_mode === 'human' ? 'bg-blue-600 dark:text-white text-gray-900 shadow-lg' : 'text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:text-dark-300'}`}
                    >
                      <User className="w-3.5 h-3.5" /> Human Mode
                    </button>
                 </div>
                 <button className="p-2 h-10 w-10 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors">
                   <MoreVertical className="w-5 h-5" />
                 </button>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
               {messages.map((msg, i) => {
                 const isSameSender = i > 0 && messages[i-1].sender_type === msg.sender_type;
                 
                 if (msg.sender_type === 'system') {
                   return (
                     <div key={msg.id} className="flex justify-center">
                        <span className="px-3 py-1 rounded-full dark:bg-white/5 bg-black/5 text-[10px] font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-widest border dark:border-white/5 border-black/5">
                          {msg.content_text}
                        </span>
                     </div>
                   );
                 }

                 return (
                   <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} ${isSameSender ? '-mt-4' : ''}`}>
                      <div className={`max-w-[70%] group`}>
                         <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed relative ${
                           msg.direction === 'outbound' 
                             ? msg.sender_type === 'ai' 
                               ? 'bg-violet-600/20 text-violet-200 border border-violet-500/20 rounded-br-sm' 
                               : 'bg-primary text-white shadow-lg shadow-primary/10 rounded-br-sm'
                             : 'dark:bg-white/5 bg-black/5 text-dark-200 border dark:border-white/10 border-black/10 rounded-bl-sm'
                         }`}>
                           {msg.sender_type === 'ai' && !isSameSender && (
                             <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 block mb-1">Xeni AI</span>
                           )}
                           <p>{msg.content_text}</p>
                           <span className="absolute -bottom-5 right-0 text-[9px] text-slate-600 dark:text-slate-600 dark:text-dark-700 opacity-0 group-hover:opacity-100 transition-opacity">
                             {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                         </div>
                      </div>
                   </div>
                 );
               })}
               <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t dark:border-white/5 border-black/5 backdrop-blur-xl bg-black/20">
               {selected.handling_mode === 'ai' ? (
                 <div className="bg-violet-500/10 border border-violet-500/20 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                       <Bot className="w-6 h-6 text-violet-400" />
                       <div>
                          <p className="text-sm font-bold dark:text-white text-gray-900 leading-none">Xeni AI is Handling</p>
                          <p className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 mt-1">AI responds automatically based on shop settings.</p>
                       </div>
                    </div>
                    <button 
                      onClick={toggleMode}
                      className="btn-primary py-2 px-6 text-xs font-bold"
                    >
                      Take Over Control
                    </button>
                 </div>
               ) : (
                 <div className="flex items-end gap-3">
                   <div className="flex-1 dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-2xl p-2 focus-within:border-primary/50 transition-all flex flex-col">
                      <textarea 
                        placeholder="Write a reply..."
                        rows={1}
                        className="w-full bg-transparent border-0 ring-0 focus:ring-0 p-2 text-sm dark:text-white text-gray-900 resize-none"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <div className="flex items-center justify-between px-2 pt-2 pb-1 border-t dark:border-white/5 border-black/5 mt-2">
                         <div className="flex items-center gap-2">
                            <button className="p-1.5 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors"><ShoppingBag className="w-4 h-4" /></button>
                            <button className="p-1.5 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors"><Bot className="w-4 h-4" /></button>
                         </div>
                         <span className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 font-medium">Shift + Enter for new line</span>
                      </div>
                   </div>
                   <button 
                    disabled={!reply.trim() || sending}
                    onClick={sendMessage}
                    className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 disabled:grayscale"
                   >
                     <Send className="w-5 h-5" />
                   </button>
                 </div>
               )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-40">
             <div className="w-20 h-20 rounded-3xl dark:bg-white/5 bg-black/5 flex items-center justify-center mb-6 border dark:border-white/5 border-black/5">
                <MessageCircle className="w-10 h-10 text-slate-600 dark:text-slate-600 dark:text-dark-700" />
             </div>
             <h2 className="text-xl font-heading font-bold dark:text-white text-gray-900 mb-2">No Conversation Selected</h2>
             <p className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700 max-w-xs mx-auto">Select a chat from the left to start communicating with your customers.</p>
          </div>
        )}
      </div>

      {/* Panel 3: Customer Info (240px) */}
      <div className={`w-[260px] border-l dark:border-white/5 border-black/5 flex flex-col shrink-0 transition-all ${selected ? 'translate-x-0' : 'translate-x-full'}`} style={{ background: 'var(--bg-secondary)' }}>
        {selected && (
          <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="p-6 text-center border-b dark:border-white/5 border-black/5">
               <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent mx-auto mb-4 border-4 border-slate-900 shadow-xl flex items-center justify-center text-2xl font-black text-white">
                 {(selected.customer_name || 'C').charAt(0)}
               </div>
               <h3 className="font-heading font-bold dark:text-white text-gray-900 mb-1">{selected.customer_name}</h3>
               <p className="text-[10px] font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-widest">{selected.status}</p>
            </div>

            <div className="p-6 space-y-6">
               {/* Quick Info */}
               <div>
                  <h4 className="text-[10px] font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-widest mb-3">Customer Details</h4>
                  <div className="space-y-3">
                     <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600 dark:text-dark-600">PSID</span>
                        <code className="text-[11px] dark:text-white text-gray-900 dark:bg-white/5 bg-black/5 px-2 py-0.5 rounded">{selected.customer_psid}</code>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600 dark:text-dark-600">Total Orders</span>
                        <span className="text-xs font-bold dark:text-white text-gray-900">{customerOrders.length}</span>
                     </div>
                  </div>
               </div>

               {/* Recent Orders */}
               <div>
                  <h4 className="text-[10px] font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-widest mb-3">Recent Orders</h4>
                  <div className="space-y-2">
                    {customerOrders.length === 0 ? (
                       <p className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 italic">No orders yet</p>
                    ) : (
                      customerOrders.slice(0, 3).map(order => (
                        <div key={order.id} className="p-3 dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-xl flex items-center justify-between">
                           <div>
                              <p className="text-xs font-bold dark:text-white text-gray-900">#XENI-{order.id.slice(0,4)}</p>
                              <p className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700">{new Date(order.created_at).toLocaleDateString()}</p>
                           </div>
                           <span className="text-xs font-bold text-primary">৳{order.total_bdt}</span>
                        </div>
                      ))
                    )}
                    <button className="w-full text-center py-2 text-[10px] font-bold text-slate-600 dark:text-slate-600 dark:text-dark-700 uppercase tracking-widest hover:text-primary transition-colors flex items-center justify-center gap-1">
                      View All Orders <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
               </div>

               {/* Actions */}
               <div className="pt-4 space-y-2">
                  <button onClick={() => setIsCreateOrderOpen(true)} className="w-full btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                    <ShoppingBag className="w-4 h-4" /> Create New Order
                  </button>
                  <button className="w-full py-2.5 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-gray-900 rounded-xl text-xs font-bold transition-all border dark:border-white/10 border-black/10">
                    Mark as Resolved
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                     <button className="py-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-emerald-500/20 transition-all">
                       Archive
                     </button>
                     <button className="py-2 bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-rose-500/20 transition-all">
                       Block
                     </button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>

      <CreateOrderModal 
        isOpen={isCreateOrderOpen}
        onClose={() => setIsCreateOrderOpen(false)}
        customerName={selected?.customer_name || ''}
        customerPsid={selected?.customer_psid || ''}
        onSuccess={() => {
           if (selected) {
              // Refresh orders list
              api.get(`/orders`, { params: { psid: selected.customer_psid } })
                 .then(res => setCustomerOrders(res.data.data || []));
           }
        }}
      />
    </div>
  );
}

