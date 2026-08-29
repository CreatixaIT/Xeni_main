import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, ShoppingBag } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  current_stock: number;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerPsid: string;
  onSuccess: () => void;
}

export default function CreateOrderModal({ isOpen, onClose, customerName, customerPsid, onSuccess }: CreateOrderModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    customer_name: customerName || '',
    customer_phone: '',
    customer_address: '',
    payment_method: 'cod',
    notes: '',
  });

  const [items, setItems] = useState<{product_id: string; quantity: number; price: number}[]>([]);

  useEffect(() => {
    if (isOpen) {
      setForm(prev => ({ ...prev, customer_name: customerName || '' }));
      fetchProducts();
    }
  }, [isOpen, customerName]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products', { params: { per_page: 100 } });
      setProducts(res.data.data || []);
    } catch {
      toast.error('Failed to load catalog');
    }
    setLoading(false);
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1, price: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'product_id') {
      const prod = products.find(p => p.id === value);
      newItems[index] = { ...newItems[index], product_id: value, price: prod ? prod.price : 0 };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || items.some(i => !i.product_id)) {
      toast.error('Please add at least one valid product');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/orders', {
        ...form,
        total_amount: totalAmount,
        order_items: items
      });
      toast.success('Order created successfully!');
      onSuccess();
      onClose();
      // Reset form
      setItems([]);
      setForm({
        customer_name: customerName || '',
        customer_phone: '',
        customer_address: '',
        payment_method: 'cod',
        notes: '',
      });
    } catch {
      toast.error('Failed to create order');
    }
    setSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-2xl bg-zinc-900 border dark:border-white/10 border-black/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b dark:border-white/5 border-black/5 flex items-center justify-between">
            <h2 className="text-lg font-bold dark:text-white text-gray-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" /> Create Manual Order
            </h2>
            <button onClick={onClose} className="p-2 text-slate-600 dark:text-dark-600 hover:dark:text-white hover:text-gray-900 transition-colors dark:bg-white/5 bg-black/5 rounded-xl hover:dark:bg-white/10 hover:bg-black/10">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <form id="orderForm" onSubmit={handleSubmit} className="space-y-6">
              
              {/* Customer Details */}
              <div>
                <h3 className="text-sm font-bold dark:text-white text-gray-900 mb-4 uppercase tracking-wider">Customer Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-none">
                  <div>
                    <label className="text-xs font-bold text-dark-300 mb-1 block">Full Name</label>
                    <input required type="text" className="input-field" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} placeholder="e.g. Rahim Ahmed" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-dark-300 mb-1 block">Phone Number</label>
                    <input required type="tel" className="input-field" value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} placeholder="e.g. 01700000000" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-dark-300 mb-1 block">Delivery Address</label>
                    <textarea required className="input-field h-20" value={form.customer_address} onChange={e => setForm({...form, customer_address: e.target.value})} placeholder="Full standard address for courier" />
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold dark:text-white text-gray-900 uppercase tracking-wider">Order Items</h3>
                  <button type="button" onClick={addItem} className="text-xs font-bold text-primary hover:text-white transition-colors flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20">
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>
                
                {loading ? (
                  <p className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 italic">Loading catalog...</p>
                ) : items.length === 0 ? (
                  <div className="p-6 text-center border border-dashed dark:border-white/10 border-black/10 rounded-xl dark:bg-white/5 bg-black/5">
                    <ShoppingBag className="w-8 h-8 text-slate-600 dark:text-slate-600 dark:text-dark-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-600 dark:text-dark-600">No items added to this order.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3 dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-xl">
                        <div className="flex-1 w-full">
                          <select required className="input-field" value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)}>
                            <option value="">Select a Product</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name} - ৳{p.price}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-full md:w-24">
                          <input required type="number" min="1" className="input-field text-center" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value))} placeholder="Qty" />
                        </div>
                        <div className="w-full md:w-28 text-right px-2">
                          <span className="text-sm font-bold dark:text-white text-gray-900">৳{item.price * item.quantity}</span>
                        </div>
                        <button type="button" onClick={() => removeItem(idx)} className="p-2 text-rose-500 bg-rose-500/10 rounded-lg hover:bg-rose-500 hover:dark:text-white hover:text-gray-900 transition-all w-full md:w-auto flex justify-center">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary & Meta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t dark:border-white/5 border-black/5">
                <div>
                    <label className="text-xs font-bold text-dark-300 mb-1 block">Payment Method</label>
                    <select className="input-field" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                      <option value="cod">Cash on Delivery (COD)</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                    </select>
                    
                    <label className="text-xs font-bold text-dark-300 mt-4 mb-1 block">Internal Notes (Optional)</label>
                    <input type="text" className="input-field" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes for admin..." />
                </div>
                <div className="dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 p-4 rounded-xl flex flex-col justify-center">
                   <div className="flex justify-between text-sm mb-2 text-dark-300">
                     <span>Subtotal:</span>
                     <span>৳{totalAmount}</span>
                   </div>
                   <div className="flex justify-between text-sm mb-4 text-dark-300">
                     <span>Delivery Charge:</span>
                     <span>To be calculated</span>
                   </div>
                   <div className="flex justify-between text-lg font-bold text-primary pt-3 border-t dark:border-white/10 border-black/10">
                     <span>Grand Total:</span>
                     <span>৳{totalAmount}</span>
                   </div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t dark:border-white/5 border-black/5 flex justify-end gap-3 dark:bg-white/5 bg-black/5">
            <button type="button" onClick={onClose} className="px-5 py-2 text-xs font-bold dark:text-white text-gray-900 hover:dark:bg-white/10 hover:bg-black/10 rounded-xl transition-colors">
              Cancel
            </button>
            <button form="orderForm" type="submit" disabled={submitting || items.length === 0} className="btn-primary px-6 py-2 text-xs font-bold shadow-lg shadow-primary/20 flex items-center gap-2">
              {submitting ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
