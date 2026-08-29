'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, Filter, Eye, ChevronDown, CheckCircle2, 
  MapPin, Phone, CreditCard, Truck, Calendar, 
  ArrowRight, Search, Zap, Clock, X, Printer, User, DollarSign,
  AlertTriangle, Copy, Image as ImageIcon, Shield, XCircle, Brain
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Order {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address?: string | null;
  total_amount: number;
  payment_method: string | null;
  payment_trx_id?: string | null;
  payment_screenshot_url?: string | null;
  payment_status: 'pending' | 'verified' | 'failed' | 'manual_required';
  delivery_status: 'pending' | 'booked' | 'in_transit' | 'delivered' | 'returned';
  tracking_number?: string | null;
  courier_name?: string | null;
  placed_by: 'ai' | 'manual';
  verified_by?: string | null;
  verified_at?: string | null;
  admin_note?: string | null;
  created_at: string;
}

const statusSteps = [
  { id: 'placed', label: 'Placed', icon: Clock },
  { id: 'paid', label: 'Paid', icon: CreditCard },
  { id: 'processing', label: 'Processing', icon: Zap },
  { id: 'shipped', label: 'Shipped', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'manual_review'>('all');
  const [manualReviewOrders, setManualReviewOrders] = useState<Order[]>([]);
  const [manualReviewCount, setManualReviewCount] = useState(0);
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [paymentTrxId, setPaymentTrxId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [editCourierName, setEditCourierName] = useState('');
  const [editDeliveryStatus, setEditDeliveryStatus] = useState('pending');
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editPaymentStatus, setEditPaymentStatus] = useState('pending');
  const [editPaymentTrxId, setEditPaymentTrxId] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const params: any = { per_page: 50 };
      if (paymentFilter) params.payment_status = paymentFilter;
      if (deliveryFilter) params.delivery_status = deliveryFilter;
      const res = await api.get('/orders', { params });
      setOrders(res.data.data || []);
    } catch {
      setOrders([]);
    }
    setLoading(false);
  }, [paymentFilter, deliveryFilter]);

  const fetchManualReview = useCallback(async () => {
    try {
      const res = await api.get('/orders/manual-review');
      const data = res.data.data || [];
      setManualReviewOrders(data);
      setManualReviewCount(data.length);
    } catch {
      setManualReviewOrders([]);
    }
  }, []);

  useEffect(() => { 
    fetchOrders(); 
    fetchManualReview();
  }, [fetchOrders, fetchManualReview]);

  const getCurrentStepIndex = (order: Order) => {
    if (order.delivery_status === 'delivered') return 4;
    if (order.delivery_status === 'in_transit' || order.delivery_status === 'booked') return 3;
    if (order.payment_status === 'verified') return 2;
    if (order.payment_status === 'pending') return 1;
    return 0;
  };

  const updateOrder = async (id: string, updates: any) => {
    try {
      await api.put(`/orders/${id}`, updates);
      toast.success('Order status updated');
      fetchOrders();
      fetchManualReview();
      setSelectedOrder(null);
    } catch { toast.error('Failed to update'); }
  };

  const confirmPayment = async (id: string) => {
    try {
      await api.put(`/orders/${id}/confirm-payment`, { 
        admin_note: confirmNote || undefined,
        payment_trx_id: paymentTrxId || undefined
      });
      toast.success('✅ Payment confirmed!');
      setConfirmNote('');
      setPaymentTrxId('');
      fetchOrders();
      fetchManualReview();
      setSelectedOrder(null);
    } catch { toast.error('Failed to confirm payment'); }
  };

  const rejectPayment = async (id: string) => {
    try {
      await api.put(`/orders/${id}/reject-payment`, { reason: rejectReason || undefined });
      toast.success('Payment rejected');
      setRejectReason('');
      fetchOrders();
      fetchManualReview();
      setSelectedOrder(null);
    } catch { toast.error('Failed to reject payment'); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const dispatchToCourier = async (order: Order) => {
    toast.loading('🚚 AI is booking delivery...', { id: 'courier-dispatch' });
    try {
      await api.post('/agents/order/run', {
        order_id: order.id,
        payment_method: order.payment_method || 'bkash',
        trx_id: order.payment_trx_id || `TRX${Math.floor(Math.random() * 1000000)}`,
        amount: order.total_amount,
        customer_phone: order.customer_phone || '',
        customer_address: order.customer_address || 'Dhaka, Bangladesh',
      });
      toast.success('Order dispatched to courier!', { id: 'courier-dispatch' });
      setSelectedOrder(null);
      setTimeout(fetchOrders, 3000);
    } catch (err: any) {
      toast.error('Failed to dispatch to courier', { id: 'courier-dispatch' });
    }
  };

  const displayOrders = activeTab === 'manual_review' ? manualReviewOrders : orders;
  const filteredOrders = displayOrders.filter(o => 
    o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.id.includes(searchQuery)
  );

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-success/10 text-success border-success/20';
      case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'manual_required': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'failed': return 'bg-danger/10 text-danger border-danger/20';
      default: return 'bg-dark-500/10 text-slate-600 dark:text-dark-600 dark:border-white/5 border-black/5';
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-heading font-bold dark:text-white text-gray-900 mb-1 flex items-center gap-3">
             <ShoppingBag className="w-8 h-8 text-primary" /> Order Management
          </h1>
          <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700 text-sm">{orders.length} total orders processed</p>
        </div>
        <div className="flex items-center gap-3">
           <button className="glass-card px-4 py-2 text-sm dark:text-white text-gray-900 flex items-center gap-2 hover:dark:bg-white/10 hover:bg-black/10 transition-all">
             <Printer className="w-4 h-4 text-slate-600 dark:text-slate-600 dark:text-dark-700" /> Bulk Invoices
           </button>
           <button onClick={() => { fetchOrders(); fetchManualReview(); }} className="btn-primary flex items-center gap-2">
             <Zap className="w-4 h-4" /> Refresh Data
           </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 mb-6">
        <button 
          onClick={() => setActiveTab('all')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
            activeTab === 'all' 
              ? 'bg-primary/20 text-primary border-primary/30 shadow-lg shadow-primary/10' 
              : 'dark:bg-white/5 bg-black/5 text-slate-600 dark:text-dark-600 dark:border-white/5 border-black/5 hover:dark:bg-white/10 hover:bg-black/10'
          }`}
        >
          All Orders
        </button>
        <button 
          onClick={() => setActiveTab('manual_review')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border flex items-center gap-2 ${
            activeTab === 'manual_review' 
              ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-lg shadow-orange-500/10' 
              : 'dark:bg-white/5 bg-black/5 text-slate-600 dark:text-dark-600 dark:border-white/5 border-black/5 hover:dark:bg-white/10 hover:bg-black/10'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Manual Review
          {manualReviewCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 dark:text-white text-gray-900 animate-pulse">
              {manualReviewCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters & Search */}
      {activeTab === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-600 dark:text-dark-700" />
            <input 
              type="text" 
              placeholder="Search by ID or customer name..." 
              className="w-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-xl py-2.5 pl-10 pr-4 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-primary/50 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="md:col-span-3 relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-600 dark:text-dark-700" />
             <select className="w-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-xl py-2.5 pl-10 pr-8 text-sm dark:text-white text-gray-900 appearance-none focus:outline-none focus:border-primary/50" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
               <option value="">All Payments</option>
               <option value="pending">Pending</option>
               <option value="verified">Verified</option>
               <option value="manual_required">Manual Review</option>
               <option value="failed">Failed</option>
             </select>
             <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-600 dark:text-dark-700 pointer-events-none" />
          </div>
          <div className="md:col-span-3 relative">
             <select className="w-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-xl py-2.5 px-4 pr-8 text-sm dark:text-white text-gray-900 appearance-none focus:outline-none focus:border-primary/50" value={deliveryFilter} onChange={e => setDeliveryFilter(e.target.value)}>
               <option value="">All Deliveries</option>
               <option value="pending">Pending</option>
               <option value="booked">Booked</option>
               <option value="in_transit">In Transit</option>
               <option value="delivered">Delivered</option>
             </select>
             <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-600 dark:text-dark-700 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b dark:border-white/5 border-black/5 dark:bg-white/5 bg-black/5">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-dark-600 uppercase tracking-wider text-[10px]">Order ID</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-dark-600 uppercase tracking-wider text-[10px]">Customer</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-dark-600 uppercase tracking-wider text-[10px]">Total</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-dark-600 uppercase tracking-wider text-[10px]">Payment</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-dark-600 uppercase tracking-wider text-[10px]">Delivery</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-dark-600 uppercase tracking-wider text-[10px]">Date</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-dark-600 uppercase tracking-wider text-[10px] text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b dark:border-white/5 border-black/5"><td colSpan={7} className="px-6 py-4"><div className="skeleton h-10 w-full rounded-lg" /></td></tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-20 text-slate-600 dark:text-slate-600 dark:text-dark-700 italic">
                  {activeTab === 'manual_review' ? '🎉 No orders awaiting manual review!' : 'No orders matching your criteria...'}
                </td></tr>
              ) : (
                filteredOrders.map((o, i) => (
                  <motion.tr 
                    key={o.id} 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    transition={{ delay: i * 0.02 }}
                    className={`border-b dark:border-white/5 border-black/5 last:border-0 hover:dark:bg-white/5 hover:bg-black/5 transition-colors group ${
                      o.payment_status === 'manual_required' ? 'bg-orange-500/[0.03]' : ''
                    }`}
                  >
                    <td className="px-6 py-4 font-mono text-[11px] dark:text-white text-gray-900">#XENI-{o.id.slice(0, 8)}</td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">{(o.customer_name || 'C').charAt(0)}</div>
                         <div>
                            <p className="dark:text-white text-gray-900 font-medium">{o.customer_name || 'Guest'}</p>
                            <p className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700">{o.customer_phone}</p>
                         </div>
                       </div>
                    </td>
                    <td className="px-6 py-4 font-bold dark:text-white text-gray-900">৳{o.total_amount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getPaymentStatusBadge(o.payment_status)}`}>
                         {o.payment_status === 'manual_required' ? '⚠ Review' : o.payment_status}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                         o.delivery_status === 'delivered' ? 'bg-success/10 text-success border-success/20' : 
                         o.delivery_status === 'pending' ? 'bg-dark-500/10 text-slate-600 dark:text-dark-600 dark:border-white/5 border-black/5' : 
                         'bg-primary/10 text-primary border-primary/20'
                       }`}>
                         {o.delivery_status.replace('_', ' ')}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-[11px] text-slate-600 dark:text-slate-600 dark:text-dark-700">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button onClick={() => setSelectedOrder(o)} className="p-2.5 rounded-xl bg-white/5 hover:bg-primary/20 hover:text-primary transition-all">
                         <Eye className="w-4 h-4" />
                       </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            onClick={() => setSelectedOrder(null)} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass-card w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-6 border-b dark:border-white/5 border-black/5 flex items-center justify-between dark:bg-white/5 bg-black/5">
               <div>
                 <h2 className="text-xl font-heading font-bold dark:text-white text-gray-900">Order Details</h2>
                 <p className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 font-mono mt-1">#XENI-{selectedOrder.id}</p>
               </div>
               <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-full hover:dark:bg-white/10 hover:bg-black/10 text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-all">
                 <X className="w-5 h-5" />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
               {/* Visual Stepper */}
               <div className="relative pt-4 pb-8">
                  <div className="absolute top-[38px] left-[10%] right-[10%] h-0.5 dark:bg-white/5 bg-black/5" />
                  <div className="absolute top-[38px] left-[10%] h-0.5 bg-primary transition-all duration-1000" 
                       style={{ width: `${(getCurrentStepIndex(selectedOrder) / 4) * 80}%` }} />
                  
                  <div className="flex justify-between relative">
                     {statusSteps.map((step, idx) => {
                       const active = idx <= getCurrentStepIndex(selectedOrder);
                       return (
                         <div key={idx} className="flex flex-col items-center gap-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-all ${
                              active ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-900 border-white/10 text-slate-600 dark:text-slate-600 dark:text-dark-700'
                            }`}>
                               <step.icon className="w-5 h-5" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'dark:text-white text-gray-900' : 'text-slate-600 dark:text-slate-600 dark:text-dark-700'}`}>{step.label}</span>
                         </div>
                       );
                     })}
                  </div>
               </div>

               {/* Manual Review Alert */}
               {selectedOrder.payment_status === 'manual_required' && (
                 <motion.div 
                   initial={{ opacity: 0, y: -10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20"
                 >
                   <div className="flex items-start gap-3">
                     <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                     <div>
                       <p className="text-sm font-bold text-orange-300">Payment Verification Required</p>
                       <p className="text-xs text-orange-300/70 mt-1">
                         This order requires manual payment verification. Review the screenshot/TrxID below and confirm or reject.
                       </p>
                     </div>
                   </div>
                 </motion.div>
               )}

               {/* Two Column Info */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <h3 className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest flex items-center gap-2">
                       <User className="w-4 h-4" /> Customer Info
                     </h3>
                     <div className="space-y-4">
                        <div className="flex items-center gap-4">
                           <div className="p-2.5 rounded-xl dark:bg-white/5 bg-black/5 text-slate-600 dark:text-slate-600 dark:text-dark-700"><Phone className="w-4 h-4" /></div>
                           <div>
                              <p className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 font-bold uppercase">Phone Number</p>
                              <p className="text-sm dark:text-white text-gray-900">{selectedOrder.customer_phone}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="p-2.5 rounded-xl dark:bg-white/5 bg-black/5 text-slate-600 dark:text-slate-600 dark:text-dark-700"><MapPin className="w-4 h-4" /></div>
                           <div>
                              <p className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 font-bold uppercase">Shipping Address</p>
                              <p className="text-sm dark:text-white text-gray-900">{selectedOrder.customer_address || 'Not provided'}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <h3 className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest flex items-center gap-2">
                       <DollarSign className="w-4 h-4" /> Payment & Billing
                     </h3>
                     <div className="space-y-4">
                        <div className="flex items-center gap-4">
                           <div className="p-2.5 rounded-xl dark:bg-white/5 bg-black/5 text-slate-600 dark:text-slate-600 dark:text-dark-700"><CreditCard className="w-4 h-4" /></div>
                           <div>
                              <p className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 font-bold uppercase">Method & Amount</p>
                              <p className="text-sm dark:text-white text-gray-900"><span className="uppercase">{selectedOrder.payment_method}</span> — <span className="font-bold">৳{selectedOrder.total_amount.toLocaleString()}</span></p>
                           </div>
                        </div>
                        {selectedOrder.payment_trx_id && (
                          <div className="flex items-center gap-4">
                             <div className="p-2.5 rounded-xl dark:bg-white/5 bg-black/5 text-slate-600 dark:text-slate-600 dark:text-dark-700"><Zap className="w-4 h-4" /></div>
                             <div className="flex-1">
                                <p className="text-[10px] text-slate-600 dark:text-slate-600 dark:text-dark-700 font-bold uppercase">Transaction ID</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm dark:text-white text-gray-900 font-mono">{selectedOrder.payment_trx_id}</p>
                                  <button 
                                    onClick={() => copyToClipboard(selectedOrder.payment_trx_id!)}
                                    className="p-1 rounded-md hover:dark:bg-white/10 hover:bg-black/10 transition-all"
                                  >
                                    <Copy className="w-3 h-3 text-slate-600 dark:text-slate-600 dark:text-dark-700" />
                                  </button>
                                </div>
                             </div>
                          </div>
                        )}
                     </div>
                  </div>
               </div>

               {/* Payment Screenshot */}
               {selectedOrder.payment_screenshot_url && (
                 <div className="space-y-3">
                   <h3 className="text-xs font-bold text-slate-600 dark:text-dark-600 uppercase tracking-widest flex items-center gap-2">
                     <ImageIcon className="w-4 h-4" /> Payment Screenshot
                   </h3>
                   <div 
                     className="relative w-full max-w-[300px] rounded-2xl overflow-hidden border dark:border-white/10 border-black/10 cursor-pointer group hover:border-primary/30 transition-all"
                     onClick={() => setScreenshotModal(selectedOrder.payment_screenshot_url!)}
                   >
                     <img 
                       src={selectedOrder.payment_screenshot_url} 
                       alt="Payment Screenshot" 
                       className="w-full h-auto object-cover"
                     />
                     <div className="absolute inset-0 dark:bg-black/40 bg-[rgba(0,0,0,0.02)] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                       <Eye className="w-6 h-6 dark:text-white text-gray-900" />
                     </div>
                   </div>
                 </div>
               )}

               {/* Verified By Info */}
               {selectedOrder.verified_by && (
                 <div className="p-4 bg-success/5 border border-success/20 rounded-2xl flex items-center gap-3">
                   <Shield className="w-5 h-5 text-success" />
                   <div>
                     <p className="text-xs font-bold text-success flex items-center gap-2">
                       {selectedOrder.verified_by.includes('_api') ? (
                         <><Brain className="w-3 h-3" /> Auto-Verified by API</>
                       ) : (
                         <><User className="w-3 h-3" /> Manually Verified by: <span className="capitalize">{selectedOrder.verified_by}</span></>
                       )}
                       {selectedOrder.verified_at && <span className="text-success/70 font-normal">— {new Date(selectedOrder.verified_at).toLocaleString()}</span>}
                     </p>
                     {selectedOrder.admin_note && (
                       <p className="text-[10px] text-success/70 mt-1">Note: {selectedOrder.admin_note}</p>
                     )}
                   </div>
                 </div>
               )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-6 border-t dark:border-white/5 border-black/5 dark:bg-white/5 bg-black/5 flex flex-col gap-4">
               {/* Manual Review Actions */}
               {selectedOrder.payment_status === 'manual_required' && (
                 <div className="space-y-3">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                     <div>
                       <input 
                         type="text" 
                         placeholder="Transaction ID (e.g. 9X2A...)" 
                         value={paymentTrxId}
                         onChange={(e) => setPaymentTrxId(e.target.value)}
                         className="w-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-xl py-2 px-3 text-xs dark:text-white text-gray-900 focus:outline-none focus:border-brand/50"
                       />
                     </div>
                     <div>
                       <input 
                         type="text" 
                         placeholder="Add a note (optional)..." 
                         value={confirmNote}
                         onChange={(e) => setConfirmNote(e.target.value)}
                         className="w-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-xl py-2 px-3 text-xs dark:text-white text-gray-900 focus:outline-none focus:border-success/50"
                       />
                     </div>
                     <div>
                       <input 
                         type="text" 
                         placeholder="Rejection reason (optional)..." 
                         value={rejectReason}
                         onChange={(e) => setRejectReason(e.target.value)}
                         className="w-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-xl py-2 px-3 text-xs dark:text-white text-gray-900 focus:outline-none focus:border-danger/50"
                       />
                     </div>
                   </div>
                   <div className="flex gap-3">
                     <button 
                       onClick={() => confirmPayment(selectedOrder.id)}
                       className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-all"
                     >
                       <CheckCircle2 className="w-5 h-5" /> ✅ Confirm Payment
                     </button>
                     <button 
                       onClick={() => rejectPayment(selectedOrder.id)}
                       className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 transition-all"
                     >
                       <XCircle className="w-5 h-5" /> ❌ Reject Payment
                     </button>
                   </div>
                 </div>
               )}

               {/* Standard Actions / Full Edit Mode */}
               <div className="flex flex-col gap-4">
                 {(isEditingDelivery || isEditingPayment) ? (
                   <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-black/10 dark:border-white/10 space-y-4">
                     <div className="flex items-center justify-between">
                       <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                         {isEditingDelivery ? '✏️ Update Delivery Details' : '💳 Update Payment Details'}
                       </h4>
                       <button 
                         onClick={() => {
                           setIsEditingDelivery(false);
                           setIsEditingPayment(false);
                         }} 
                         className="text-xs text-danger font-medium hover:underline"
                       >
                         Cancel
                       </button>
                     </div>
                     
                     {isEditingDelivery ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         <div>
                           <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Delivery Status</label>
                           <select 
                             value={editDeliveryStatus} 
                             onChange={(e) => setEditDeliveryStatus(e.target.value)}
                             className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none"
                           >
                             <option value="pending">Pending</option>
                             <option value="booked">Booked</option>
                             <option value="in_transit">In Transit</option>
                             <option value="delivered">Delivered</option>
                             <option value="returned">Returned</option>
                           </select>
                         </div>
                         <div>
                           <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Courier Name (optional)</label>
                           <input 
                             type="text" 
                             value={editCourierName} 
                             onChange={(e) => setEditCourierName(e.target.value)}
                             className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none"
                             placeholder="Pathao, Steadfast..."
                           />
                         </div>
                         <div className="md:col-span-2 lg:col-span-1">
                           <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Tracking Number (optional)</label>
                           <input 
                             type="text" 
                             value={editTrackingNumber} 
                             onChange={(e) => setEditTrackingNumber(e.target.value)}
                             className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none"
                             placeholder="Ex: PH-123456"
                           />
                         </div>
                       </div>
                     ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                           <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Payment Status</label>
                           <select 
                             value={editPaymentStatus} 
                             onChange={(e) => setEditPaymentStatus(e.target.value)}
                             className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none"
                           >
                             <option value="pending">Pending</option>
                             <option value="verified">Verified</option>
                             <option value="manual_required">Manual Required</option>
                             <option value="failed">Failed</option>
                           </select>
                         </div>
                         <div>
                           <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Transaction ID</label>
                           <input 
                             type="text" 
                             value={editPaymentTrxId} 
                             onChange={(e) => setEditPaymentTrxId(e.target.value)}
                             className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none"
                             placeholder="Enter Trx ID..."
                           />
                         </div>
                       </div>
                     )}

                     <div className="flex justify-end pt-2">
                       <button 
                         onClick={() => {
                           if (isEditingDelivery) {
                             updateOrder(selectedOrder.id, {
                               delivery_status: editDeliveryStatus,
                               tracking_number: editTrackingNumber || undefined,
                               courier_name: editCourierName || undefined
                             });
                             setIsEditingDelivery(false);
                           } else {
                             updateOrder(selectedOrder.id, {
                               payment_status: editPaymentStatus,
                               payment_trx_id: editPaymentTrxId || undefined
                             });
                             setIsEditingPayment(false);
                           }
                         }}
                         className="btn-primary py-2.5 px-6 text-xs font-bold"
                       >
                         Save Updates
                       </button>
                     </div>
                   </div>
                 ) : (
                   <div className="flex flex-col md:flex-row gap-4">
                     {selectedOrder.delivery_status === 'pending' && selectedOrder.payment_status === 'verified' ? (
                       <button 
                         onClick={() => dispatchToCourier(selectedOrder)}
                         className="btn-primary flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2"
                       >
                         <Truck className="w-5 h-5" /> Dispatch via AI Agent
                       </button>
                     ) : selectedOrder.delivery_status !== 'pending' ? (
                       <div className="flex-1 flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-xl">
                          <CheckCircle2 className="w-5 h-5 text-success" />
						  <div className="flex flex-col">
                            <span className="text-xs text-success font-bold">Successfully Booked with {selectedOrder.courier_name || 'Courier'}</span>
                            {selectedOrder.tracking_number && <span className="text-[10px] text-success/80">Tracking: {selectedOrder.tracking_number}</span>}
                          </div>
                       </div>
                     ) : null}
                     
                     <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                        <button 
                          onClick={() => {
                            setEditDeliveryStatus(selectedOrder.delivery_status);
                            setEditCourierName(selectedOrder.courier_name || '');
                            setEditTrackingNumber(selectedOrder.tracking_number || '');
                            setIsEditingDelivery(true);
                            setIsEditingPayment(false);
                          }} 
                          className="px-6 py-3 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-gray-900 rounded-xl text-xs font-bold transition-all border dark:border-white/10 border-black/10 flex-1 md:flex-none flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                          📝 Edit Delivery
                        </button>

                        <button 
                          onClick={() => {
                            setEditPaymentStatus(selectedOrder.payment_status);
                            setEditPaymentTrxId(selectedOrder.payment_trx_id || '');
                            setIsEditingPayment(true);
                            setIsEditingDelivery(false);
                          }} 
                          className="px-6 py-3 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-gray-900 rounded-xl text-xs font-bold transition-all border dark:border-white/10 border-black/10 flex-1 md:flex-none flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                          💳 Edit Payment
                        </button>

                        {selectedOrder.payment_status === 'pending' && (
                          <button 
                            onClick={() => updateOrder(selectedOrder.id, { payment_status: 'verified' })} 
                            className="px-6 py-3 dark:bg-green-500/10 bg-green-500/5 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-xl text-xs font-bold transition-all border border-green-500/20 flex items-center gap-2 whitespace-nowrap"
                          >
                            <CreditCard className="w-4 h-4" /> Quick Verify
                          </button>
                        )}
                     </div>
                   </div>
                 )}
               </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Screenshot Full View Modal */}
      <AnimatePresence>
        {screenshotModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-lg" 
              onClick={() => setScreenshotModal(null)} 
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative z-10 max-w-lg w-full max-h-[85vh]"
            >
              <button
                onClick={() => setScreenshotModal(null)}
                className="absolute -top-12 right-0 p-2 rounded-full dark:bg-white/10 bg-black/10 dark:text-white text-gray-900 hover:dark:bg-white/20 hover:bg-black/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="relative w-full aspect-[3/4] rounded-2xl border dark:border-white/10 border-black/10 overflow-hidden">
                <Image src={screenshotModal} alt="Payment Screenshot" fill className="object-contain" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
