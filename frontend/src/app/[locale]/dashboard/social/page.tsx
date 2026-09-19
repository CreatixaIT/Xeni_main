'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Globe2, 
  Trash2, 
  CheckCircle, 
  ExternalLink, 
  Plus,
  Instagram,
  Youtube,
  Linkedin,
  MessageCircle,
  Share2
} from 'lucide-react';
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

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  handle: string;
  is_active: boolean;
}

export default function SocialMediaPage() {
  const [pages, setPages] = useState<ConnectedPage[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLink, setNewLink] = useState({ platform: '', url: '', handle: '' });

  const fetchSocialData = async () => {
    try {
      const [pagesRes, linksRes] = await Promise.allSettled([
        api.get('/pages'),
        api.get('/social/links')
      ]);
      
      if (pagesRes.status === 'fulfilled') {
        setPages(pagesRes.value.data.data || []);
      }
      
      if (linksRes.status === 'fulfilled') {
        setSocialLinks(linksRes.value.data.data || []);
      }
    } catch {
      setPages([]);
      setSocialLinks([]);
    }
    setLoading(false);
  };

  useEffect(() => { 
    // Handle OAuth callback status
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('oauth') === 'success') {
      toast.success('Facebook Pages connected successfully! 🎉');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('error')) {
      toast.error('Failed to connect Facebook Pages: ' + urlParams.get('error'));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    fetchSocialData(); 
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
      fetchSocialData();
    } catch {
      toast.error('Failed');
    }
  };

  const addSocialLink = async () => {
    if (!newLink.platform || !newLink.url) {
      toast.error('Platform and URL are required');
      return;
    }
    try {
      await api.post('/social/links', newLink);
      toast.success('Social link added');
      setNewLink({ platform: '', url: '', handle: '' });
      setShowAddLink(false);
      fetchSocialData();
    } catch {
      toast.error('Failed to add social link');
    }
  };

  const deleteSocialLink = async (id: string) => {
    if (!confirm('Delete this social link?')) return;
    try {
      await api.delete(`/social/links/${id}`);
      toast.success('Social link deleted');
      fetchSocialData();
    } catch {
      toast.error('Failed');
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook': return Globe2;
      case 'instagram': return Instagram;
      case 'youtube': return Youtube;
      case 'linkedin': return Linkedin;
      case 'whatsapp': return MessageCircle;
      default: return Share2;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook': return 'from-blue-500 to-indigo-600';
      case 'instagram': return 'from-pink-500 to-purple-600';
      case 'youtube': return 'from-red-500 to-red-700';
      case 'linkedin': return 'from-blue-600 to-blue-800';
      case 'whatsapp': return 'from-green-500 to-green-700';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Facebook Pages Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
              <Globe2 className="w-7 h-7 text-blue-600" /> Facebook Pages
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Connect your Facebook Pages to auto-reply to messages and generate posts.</p>
          </div>
          <button onClick={connectPageOAuth} className="btn-primary flex items-center gap-2 text-sm shadow-lg shadow-blue-500/20 bg-[#1877F2] hover:bg-[#1864D9] text-white border-0">
            <ExternalLink className="w-4 h-4" /> Connect with Facebook
          </button>
        </div>

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

      {/* Social Links Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-heading font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
              <Share2 className="w-7 h-7 text-purple-600" /> Social Media Links
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Connect your social media profiles to showcase across platforms.</p>
          </div>
          <button onClick={() => setShowAddLink(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Social Link
          </button>
        </div>

        {showAddLink && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Add Social Media Link</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Platform</label>
                <select 
                  className="input-field"
                  value={newLink.platform}
                  onChange={(e) => setNewLink({ ...newLink, platform: e.target.value })}
                >
                  <option value="">Select platform</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="tiktok">TikTok</option>
                  <option value="twitter">Twitter/X</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Profile URL</label>
                <input 
                  className="input-field"
                  placeholder="https://instagram.com/yourbrand"
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Handle (optional)</label>
                <input 
                  className="input-field"
                  placeholder="@yourbrand"
                  value={newLink.handle}
                  onChange={(e) => setNewLink({ ...newLink, handle: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={addSocialLink} className="btn-primary flex-1">Add Link</button>
                <button onClick={() => setShowAddLink(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 w-full rounded-2xl" />)
          ) : socialLinks.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Share2 className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-lg font-medium" style={{ color: 'var(--text-muted)' }}>No social links added</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Add your social media profiles to showcase your presence.</p>
            </div>
          ) : (
            socialLinks.map((link, i) => {
              const Icon = getPlatformIcon(link.platform);
              const gradient = getPlatformColor(link.platform);
              return (
                <motion.div key={link.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card-hover p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${gradient} flex items-center justify-center text-white`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{link.platform}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{link.handle || link.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/10 transition-colors text-blue-400 hover:text-blue-300">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button onClick={() => deleteSocialLink(link.id)} className="p-2 rounded-lg hover:bg-danger/10 transition-colors text-danger/60 hover:text-danger">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
