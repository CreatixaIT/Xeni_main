'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe2, Trash2, CheckCircle, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';

interface ConnectedPage {
  id: string;
  page_id: string;
  page_name: string;
  page_picture_url: string | null;
  webhook_subscribed: boolean;
  is_active: boolean;
  connected_at: string;
}

export default function PagesPage() {
  const [pages, setPages] = useState<ConnectedPage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPages = async () => {
    try {
      const res = await api.get('/pages');
      setPages(res.data.data || []);
    } catch {
      setPages([]);
    }
    setLoading(false);
  };

  useEffect(() => { 
    // Handle OAuth callback status
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('oauth') === 'success') {
      toast.success('Facebook Pages connected successfully! 🎉');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('error')) {
      toast.error('Failed to connect Facebook Pages: ' + urlParams.get('error'));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    fetchPages(); 
  }, []);

  const connectPageOAuth = () => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) {
      toast.error('Authentication Error');
      return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    window.location.href = `${apiUrl}/api/oauth/pages/facebook?token=${accessToken}`;
  };

  const disconnectPage = async (id: string) => {
    if (!confirm('Disconnect this page? You will stop receiving messages.')) return;
    try {
      await api.delete(`/pages/${id}`);
      toast.success('Page disconnected');
      fetchPages();
    } catch {
      toast.error('Failed');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <Globe2 className="w-7 h-7 text-primary" /> Facebook Pages
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Connect your Facebook Pages to auto-reply to messages and generate posts.</p>
        </div>
        <button onClick={connectPageOAuth} className="btn-primary flex items-center gap-2 text-sm shadow-lg shadow-blue-500/20 bg-[#1877F2] hover:bg-[#1864D9] text-white border-0">
          <ExternalLink className="w-4 h-4" /> Connect with Facebook
        </button>
      </div>

      {/* Pages List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 w-full rounded-2xl" />)
        ) : pages.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Globe2 className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--text-muted)' }} />
            <p className="text-lg font-medium" style={{ color: 'var(--text-muted)' }}>No pages connected</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Connect a Facebook Page to start receiving messages.</p>
          </div>
        ) : (
          pages.map((page, i) => (
            <motion.div key={page.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card-hover p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  {page.page_name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{page.page_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ID: {page.page_id}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {page.webhook_subscribed && <span className="badge-success text-[10px] flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Webhook Active</span>}
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Connected {new Date(page.connected_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => disconnectPage(page.id)} className="p-2 rounded-lg hover:bg-danger/10 transition-colors text-danger/60 hover:text-danger">
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
