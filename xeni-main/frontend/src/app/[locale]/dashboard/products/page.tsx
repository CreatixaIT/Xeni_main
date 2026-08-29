'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Search, Edit, Trash2, X, AlertTriangle, Facebook, Loader2, Send, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  name_bn: string | null;
  price: number;
  sku: string | null;
  current_stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_out_of_stock: boolean;
  has_variants: boolean;
  total_sold: number;
  variants?: { id: string; sku: string; color: string | null; size: string | null; stock: number; price_modifier: number }[];
  images: string[];
  created_at: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ 
    name: '', name_bn: '', price: 0, sku: '', 
    initial_stock: 0, low_stock_threshold: 5, 
    has_variants: false,
    variants: [] as { sku: string; color: string; size: string; stock: number; price_modifier: number }[],
    images: [] as string[] 
  });
  const [uploading, setUploading] = useState(false);
  
  // Facebook Post State
  const [fbProduct, setFbProduct] = useState<Product | null>(null);
  const [showFBModal, setShowFBModal] = useState(false);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatedPost, setGeneratedPost] = useState('');
  const [refinement, setRefinement] = useState('');
  const [selectedPage, setSelectedPage] = useState('');
  const [connectedPages, setConnectedPages] = useState<any[]>([]);
  const [publishing, setPublishing] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/products', { params: { search, per_page: 50 } });
      setProducts(res.data.data || []);
    } catch {
      setProducts([]);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openNew = () => {
    setEditing(null);
    setForm({ 
      name: '', name_bn: '', price: 0, sku: '', 
      initial_stock: 0, low_stock_threshold: 5, 
      has_variants: false,
      variants: [],
      images: [] 
    });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ 
      name: p.name, name_bn: p.name_bn || '', price: p.price, sku: p.sku || '', 
      initial_stock: p.current_stock, low_stock_threshold: p.low_stock_threshold, 
      has_variants: p.has_variants,
      variants: p.variants?.map(v => ({ sku: v.sku, color: v.color || '', size: v.size || '', stock: v.stock, price_modifier: v.price_modifier })) || [],
      images: p.images || [] 
    });
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const res = await api.post('/products/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm(prev => ({ ...prev, images: [...prev.images, res.data.data.url] }));
      toast.success('Image uploaded');
    } catch {
      toast.error('Failed to upload image');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, { 
          name: form.name, 
          name_bn: form.name_bn || null, 
          price: form.price, 
          sku: form.sku || null, 
          current_stock: form.initial_stock, 
          low_stock_threshold: form.low_stock_threshold, 
          has_variants: form.has_variants,
          variants: form.variants,
          images: form.images 
        });
        toast.success('Product updated');
      } else {
        await api.post('/products', {
          ...form,
          name_bn: form.name_bn || null,
          sku: form.sku || null
        });
        toast.success('Product created! 🎉');
      }
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const runAIAudit = async () => {
    toast.loading('AI is analyzing your inventory...', { id: 'ai-inventory' });
    try {
      await api.post('/agents/inventory/run', {
        payload: {
          shop_id: 'auto-resolved-by-backend',
          products: products.map(p => ({
            name: p.name,
            sku: p.sku,
            price: p.price,
            current_stock: p.current_stock,
            low_stock_threshold: p.low_stock_threshold
          }))
        }
      });
      toast.success('Inventory Audit dispatched! Check dashboard later.', { id: 'ai-inventory' });
    } catch {
      toast.error('Failed to trigger AI', { id: 'ai-inventory' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Deleted');
      fetchProducts();
    } catch { toast.error('Failed to delete'); }
  };

  const openFBModal = async (product: Product) => {
    setFbProduct(product);
    setShowFBModal(true);
    setGeneratedPost('');
    setRefinement('');
    
    // Fetch pages if not already fetched
    if (connectedPages.length === 0) {
      try {
        const res = await api.get('/pages');
        setConnectedPages(res.data.data || []);
        if (res.data.data?.length > 0) {
          setSelectedPage(res.data.data[0].page_id);
        }
      } catch (err) {
        console.error('Failed to fetch pages', err);
      }
    }

    generateFBPost(product);
  };

  const generateFBPost = async (product: Product, instructions?: string) => {
    if (!product) return;
    setGeneratingPost(true);
    toast.loading(instructions ? 'Regenerating post...' : 'AI is writing your post...', { id: 'fb-gen' });
    
    try {
      const res = await api.post(`/agents/creative/run`, {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        content_type: 'facebook_post',
        instructions: instructions || `Create an engaging Facebook post for ${product.name} priced at ৳${product.price}`,
        context: 'facebook_post_generation'
      });
      
      const { task_id } = res.data.data;
      pollTaskStatus(task_id, product);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to start AI generation';
      toast.error(errorMsg, { id: 'fb-gen' });
      setGeneratingPost(false);
    }
  };

  const pollTaskStatus = async (taskId: string, product?: Product) => {
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setGeneratingPost(false);
        toast.error('Generation timed out. Please try again.', { id: 'fb-gen' });
        return;
      }
      try {
        const res = await api.get(`/agents/creative/tasks/${taskId}`);
        const task = res.data.data;
        
        if (task.status === 'completed') {
          clearInterval(interval);
          setGeneratingPost(false);
          
          // Extract AI-generated content from the result
          // The creative agent returns: { generated_content: { caption_en, caption_bn, hashtags, ... }, ... }
          const result = task.result || {};
          const generated = result.generated_content || {};
          const captionBn = generated.caption_bn || '';
          const captionEn = generated.caption_en || '';
          const hashtags = (generated.hashtags || []).join(' ');
          const productName = result.product_name || product?.name || '';
          
          let postContent = '';
          if (captionBn) postContent += captionBn + '\n\n';
          if (captionEn) postContent += captionEn + '\n\n';
          if (hashtags) postContent += hashtags;
          
          // Fallback if AI returned empty content
          if (!postContent.trim()) {
            postContent = task.summary || `🔥 ${productName} — Order now!`;
          }
          
          setGeneratedPost(postContent.trim());
          toast.success('Post generated! ✍️', { id: 'fb-gen' });
        } else if (task.status === 'failed') {
          clearInterval(interval);
          setGeneratingPost(false);
          toast.error(task.error_message || 'AI generation failed', { id: 'fb-gen' });
        }
      } catch (err) {
        clearInterval(interval);
        setGeneratingPost(false);
        toast.error('Error checking status', { id: 'fb-gen' });
      }
    }, 2000);
  };

  const publishToFB = async () => {
    if (!selectedPage) { toast.error('Please select a Facebook Page'); return; }
    if (!generatedPost) { toast.error('Post content is empty'); return; }
    
    setPublishing(true);
    const toastId = toast.loading('Publishing to Facebook...', { id: 'fb-pub' });
    
    try {
      await api.post('/pages/publish', {
        page_id: selectedPage,
        message: generatedPost,
        image_url: fbProduct?.images?.[0] || ''
      });
      toast.success('Published successfully! 🚀', { id: 'fb-pub' });
      setShowFBModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to publish', { id: 'fb-pub' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <Package className="w-7 h-7 text-primary" /> Products
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{products.length} products</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runAIAudit} className="btn-secondary flex items-center gap-2 text-sm bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
            <span className="text-lg">🤖</span> AI Audit
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input className="input-field pl-10" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Products Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Product</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Price</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Stock</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="skeleton h-8 w-full" /></td></tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>No products yet. Add your first product!</td></tr>
              ) : (
                products.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b last:border-0 hover:dark:bg-white/5 hover:bg-black/5 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images && p.images.length > 0 ? (
                          <div className="w-9 h-9 relative rounded-lg overflow-hidden shrink-0">
                            <Image src={p.images[0]} alt={p.name} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}><Package className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></div>
                        )}
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.name_bn && <span className="text-[10px] px-1.5 py-0.5 rounded dark:bg-white/5 bg-black/5" style={{ color: 'var(--text-muted)' }}>{p.name_bn}</span>}
                            {p.sku && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">#{p.sku}</span>}
                            {p.has_variants && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">{p.variants?.length} variants</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>৳{p.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'var(--text-primary)' }}>{p.current_stock}</span>
                          {p.current_stock <= p.low_stock_threshold && p.current_stock > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.total_sold} sold</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.is_out_of_stock ? <span className="badge-danger">Out of Stock</span> :
                       p.current_stock <= p.low_stock_threshold ? <span className="badge-warning">Low Stock</span> :
                       <span className="badge-success">In Stock</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openFBModal(p)} className="p-2 rounded-lg hover:bg-blue-500/10 transition-colors text-blue-400/60 hover:text-blue-400" title="Generate FB Post"><Facebook className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:dark:bg-white/10 hover:bg-black/10 transition-colors"><Edit className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-danger/10 transition-colors text-danger/60 hover:text-danger"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="glass-card p-6 w-full max-w-md space-y-4" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-heading font-bold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Product' : 'New Product'}</h2>
                <button onClick={() => setShowModal(false)}><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="input-field" placeholder="Product name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className="input-field" type="number" placeholder="Price (৳) *" value={form.price || ''} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
              </div>
              <input className="input-field" placeholder="নাম (বাংলা)" value={form.name_bn} onChange={e => setForm({ ...form, name_bn: e.target.value })} />
              
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10">
                  <input type="checkbox" id="has_variants" checked={form.has_variants} onChange={e => setForm({ ...form, has_variants: e.target.checked })} className="w-4 h-4 accent-primary" />
                  <label htmlFor="has_variants" className="text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>Has Variations</label>
                </div>
                {!form.has_variants ? (
                  <input className="input-field" placeholder="Base SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value.toUpperCase() })} />
                ) : (
                   <div className="text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>Stock tracked per variant</div>
                )}
              </div>

              {!form.has_variants ? (
                <div className="grid grid-cols-2 gap-3">
                  <input className="input-field" type="number" placeholder="Initial Stock" value={form.initial_stock || ''} onChange={e => setForm({ ...form, initial_stock: Number(e.target.value) })} />
                  <input className="input-field" type="number" placeholder="Low stock at" value={form.low_stock_threshold || ''} onChange={e => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-xl dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 shadow-inner">
                  <div className="flex items-center justify-between border-b dark:border-white/5 border-black/5 pb-2">
                     <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Variations</span>
                     <button onClick={() => {
                       const nextSku = (form.sku || form.name.substring(0,3).toUpperCase()) + "-" + (form.variants.length + 1);
                       setForm({ ...form, variants: [...form.variants, { sku: nextSku, color: '', size: '', stock: 0, price_modifier: 0 }] });
                     }} className="btn-secondary py-1 px-3 text-[10px] font-bold">+ Add Variant</button>
                  </div>
                  
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {form.variants.map((v, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center dark:bg-black/40 bg-[rgba(0,0,0,0.02)] p-2.5 rounded-lg border dark:border-white/10 border-black/10 group">
                        <div className="col-span-3">
                          <label className="text-[9px] uppercase font-bold text-muted block mb-1">Color</label>
                          <input className="w-full dark:bg-white/5 bg-black/5 text-xs outline-none border dark:border-white/10 border-black/10 rounded px-1.5 py-1 focus:border-primary/50 transition-colors" placeholder="e.g. Red" value={v.color} onChange={e => {
                            const newVariants = [...form.variants];
                            newVariants[idx].color = e.target.value;
                            setForm({ ...form, variants: newVariants });
                          }} />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[9px] uppercase font-bold text-muted block mb-1">Size</label>
                          <input className="w-full dark:bg-white/5 bg-black/5 text-xs outline-none border dark:border-white/10 border-black/10 rounded px-1.5 py-1 focus:border-primary/50 transition-colors" placeholder="e.g. XL" value={v.size} onChange={e => {
                            const newVariants = [...form.variants];
                            newVariants[idx].size = e.target.value;
                            setForm({ ...form, variants: newVariants });
                          }} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[9px] uppercase font-bold text-muted block mb-1">Stock</label>
                          <input className="w-full dark:bg-white/5 bg-black/5 text-xs outline-none border dark:border-white/10 border-black/10 rounded px-1.5 py-1 focus:border-primary/50 transition-colors" type="number" placeholder="0" value={v.stock || ''} onChange={e => {
                            const newVariants = [...form.variants];
                            newVariants[idx].stock = Number(e.target.value);
                            setForm({ ...form, variants: newVariants });
                          }} />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[9px] uppercase font-bold text-muted block mb-1">SKU</label>
                          <input className="w-full dark:bg-white/5 bg-black/5 text-[10px] font-mono outline-none border dark:border-white/10 border-black/10 rounded px-1.5 py-1 focus:border-primary/50 transition-colors" placeholder="SKU" value={v.sku} onChange={e => {
                            const newVariants = [...form.variants];
                             newVariants[idx].sku = e.target.value.toUpperCase();
                             setForm({ ...form, variants: newVariants });
                          }} />
                        </div>
                        <div className="col-span-1 pt-4">
                          <button onClick={() => setForm({ ...form, variants: form.variants.filter((_, i) => i !== idx) })} className="text-danger opacity-40 hover:opacity-100 transition-opacity flex justify-center w-full"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {form.variants.length === 0 && (
                    <div className="text-center py-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>No variants added yet. Click &quot;+ Add Variant&quot;</div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Product Images</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {form.images.map((img, idx) => (
                     <div key={idx} className="w-16 h-16 relative rounded-lg overflow-hidden border shadow-sm" style={{ borderColor: 'var(--border-color)' }}>
                       <Image src={img} alt="Product preview" fill className="object-cover" />
                     </div>
                  ))}
                </div>
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer" style={{ color: 'var(--text-muted)' }} />
                {uploading && <span className="text-xs text-primary animate-pulse w-full block mt-1">Uploading image to DigitalOcean Spaces...</span>}
              </div>
              <button onClick={handleSave} className="btn-primary w-full">{editing ? 'Save Changes' : 'Create Product'}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FB Post Modal */}
      <AnimatePresence>
        {showFBModal && fbProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={() => setShowFBModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} onClick={e => e.stopPropagation()} className="glass-card p-0 w-full max-w-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              
              {/* Left Side: Image Preview (Static) */}
              <div className="w-full md:w-2/5 aspect-square md:aspect-auto bg-black/20 relative">
                {fbProduct.images?.[0] ? (
                  <div className="w-full h-full bg-black/5 flex items-center justify-center">
                    <Image src={fbProduct.images[0]} alt={fbProduct.name} fill className="object-contain" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted"><Package className="w-12 h-12 opacity-20" /></div>
                )}
                <div className="absolute top-4 left-4">
                  <span className="badge-primary shadow-xl flex items-center gap-1.5 backdrop-blur-md bg-primary/80 border-0">
                    <Facebook className="w-3.5 h-3.5" /> Post Preview
                  </span>
                </div>
              </div>

              {/* Right Side: Content & Controls */}
              <div className="w-full md:w-3/5 p-6 flex flex-col gap-5 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>Generate AI Post</h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Creating a post for <span className="font-medium text-primary">{fbProduct.name}</span></p>
                  </div>
                  <button onClick={() => setShowFBModal(false)} className="p-2 hover:dark:bg-white/5 hover:bg-black/5 rounded-full transition-colors"><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
                </div>

                {/* Page Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Select Facebook Page</label>
                  {connectedPages.length > 0 ? (
                    <select className="input-field cursor-pointer" value={selectedPage} onChange={e => setSelectedPage(e.target.value)}>
                      {connectedPages.map(p => (
                        <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-200/70 text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      No pages connected. Go to <a href="/dashboard/pages" className="underline font-bold">Pages</a> first.
                    </div>
                  )}
                </div>

                {/* Main Content Area */}
                <div className="space-y-2 flex-grow">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Post Content</label>
                    {generatingPost && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>
                  <textarea 
                    className="input-field min-h-[180px] text-sm leading-relaxed resize-none" 
                    placeholder={generatingPost ? "AI is typing..." : "Post content will appear here..."}
                    value={generatedPost}
                    onChange={e => setGeneratedPost(e.target.value)}
                    disabled={generatingPost}
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  />
                </div>

                {/* Refinement / Regeneration */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ask AI for changes</label>
                  <div className="flex gap-2">
                    <input 
                      className="input-field py-2.5" 
                      placeholder="e.g. Make it more professional..." 
                      value={refinement}
                      onChange={e => setRefinement(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && generateFBPost(fbProduct, refinement)}
                    />
                    <button 
                      onClick={() => generateFBPost(fbProduct, refinement)} 
                      disabled={generatingPost || !refinement.trim()}
                      className="p-2.5 rounded-xl dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 text-primary transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-5 h-5 ${generatingPost ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowFBModal(false)} className="btn-secondary flex-1 py-3 border-0 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10">Discard</button>
                  <button 
                    onClick={publishToFB} 
                    disabled={publishing || !generatedPost || !selectedPage}
                    className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                    Publish Post
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
