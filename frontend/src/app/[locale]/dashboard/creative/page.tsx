'use client';

import { useState, useEffect, useRef } from 'react';

import { motion } from 'framer-motion';
import { Image as ImageIcon, Send, Sparkles, Wand2, Type, Hash, Loader2, CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function CreativePage() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ caption: string | null; imageUrl: string | null }>({ caption: null, imageUrl: null });
  const [activeTab, setActiveTab] = useState<'caption' | 'image'>('caption');
  const [taskStatus, setTaskStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const pendingTaskIdRef = useRef<string | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken); // reactive — re-renders on token refresh

  // Connect WebSocket and listen for task results
  useEffect(() => {
    if (!accessToken) return;

    // Derive WS URL from API URL (avoid double-pathing from NEXT_PUBLIC_WS_URL)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://xeni.xentroinfotech.com';
    const wsBase = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const wsUrl = `${wsBase}/ws?token=${accessToken}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket received event:", data);
        // Only handle events for our pending task
        if (data.task_id && data.task_id !== pendingTaskIdRef.current) return;

        if (data.event === 'task.completed') {
          setTaskStatus('completed');
          setLoading(false);
          
          const agentData = data.payload?.data || {};
          const generated = agentData.generated_content;
          
          if (generated) {
            if (activeTab === 'caption') {
              const caption = `${generated.caption_bn}\n\n${generated.caption_en}\n\n${generated.hashtags?.join(' ')}`;
              setResult(prev => ({ ...prev, caption }));
            } else {
              setResult(prev => ({ ...prev, imageUrl: generated.image_url }));
            }
            toast.success('AI content generated! ✨');
          } else {
            // fallback if structure was unexpected
            const summary = data.payload?.summary || '';
            if (summary) {
              setResult(prev => ({ ...prev, caption: summary }));
            }
          }
        } else if (data.event === 'task.failed') {
          setTaskStatus('failed');
          setLoading(false);
          toast.error('Creative Agent failed. Please try again.');
        } else if (data.event === 'task.processing') {
          setTaskStatus('processing');
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      // WebSocket unavailable — silent
    };

    return () => {
      ws.close();
    };
  }, [accessToken, activeTab]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setLoading(true);
    setTaskStatus('queued');
    setResult({ caption: null, imageUrl: null });

    try {
      const response = await api.post('/agents/creative/run', {
        payload: {
          product_name: prompt,
          price: 999,
          content_type: activeTab,
        }
      });

      const data = response.data.data;
      pendingTaskIdRef.current = data.task_id;
      toast.success('Task queued! AI is generating your content...');
    } catch (e: any) {
      setLoading(false);
      setTaskStatus('failed');
      const errMsg = e.response?.data?.error || 'Failed to submit task.';
      if (errMsg.includes('Upgrade')) {
        toast.error('Creative Agent requires Premium plan.');
      } else {
        toast.error(errMsg);
      }
    }
  };

  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    if (!result) return;
    setPublishing(true);
    try {
      // 1. Fetch connected pages
      const pagesRes = await api.get('/pages');
      const pages = pagesRes.data.data;
      
      if (!pages || pages.length === 0) {
        toast.error('No Facebook page connected. Please connect a page in Setup Guide first.');
        setPublishing(false);
        return;
      }
      
      // 2. Publish to the first connected page
      const pageId = pages[0].page_id;
      const payload: any = { page_id: pageId };
      
      if (result.caption) {
        payload.message = result.caption;
      }
      if (result.imageUrl) {
        payload.image_url = result.imageUrl;
      }
      
      if (!payload.message && !payload.image_url) {
        toast.error("Nothing to publish!");
        setPublishing(false);
        return;
      }
      
      await api.post('/pages/publish', payload);
      toast.success(`Successfully published to ${pages[0].page_name}! 🎉`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to publish to Facebook. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 mb-4 shadow-lg shadow-pink-500/20">
          <Sparkles className="w-8 h-8 dark:text-white text-gray-900" />
        </div>
        <h1 className="text-3xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>Creative Studio</h1>
        <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: 'var(--text-muted)' }}>
          Generate high-converting product descriptions, social media captions, and engaging images powered by AI.
        </p>
      </div>

      <div className="glass-card p-2 mb-8 inline-flex rounded-xl mx-auto flex justify-center w-full sm:w-auto overflow-hidden">
        <button 
          onClick={() => setActiveTab('caption')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'caption' ? 'bg-primary text-white shadow-md' : 'hover:bg-white/5 text-muted-foreground'}`}
        >
          <Type className="w-4 h-4" /> SEO Caption
        </button>
        <button 
          onClick={() => setActiveTab('image')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'image' ? 'bg-primary text-white shadow-md' : 'hover:bg-white/5 text-muted-foreground'}`}
        >
          <ImageIcon className="w-4 h-4" /> Ad Image
        </button>
      </div>

      <div className="glass-card p-6 md:p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Wand2 className="w-4 h-4 text-primary" /> Describe your product or offer
          </label>
          <textarea
            className="input-field min-h-[120px] resize-y"
            placeholder={activeTab === 'caption' ? "e.g., A premium leather wallet, 20% off for Eid..." : "e.g., A sleek smartwatch floating on a vibrant colorful background..."}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <button 
          onClick={handleGenerate} 
          disabled={loading || !prompt.trim()}
          className="btn-primary w-full py-4 flex items-center justify-center gap-2 font-semibold"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {loading ? 'Generating Magic...' : `Generate ${activeTab === 'caption' ? 'Caption' : 'Image'}`}
        </button>

        {/* Real-time Task Status Indicator */}
        {taskStatus !== 'idle' && taskStatus !== 'completed' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
            {taskStatus === 'queued' && <><Clock className="w-5 h-5 text-amber-400 animate-pulse" /><span className="text-sm font-medium text-amber-400">Task queued — AI worker is starting...</span></>}
            {taskStatus === 'processing' && <><Loader2 className="w-5 h-5 text-primary animate-spin" /><span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>AI is crafting your content...</span></>}
            {taskStatus === 'failed' && <><span className="text-sm font-medium text-red-400">Generation failed. Please try again.</span></>}
          </motion.div>
        )}


        {/* Results Area */}
        {(result.caption || result.imageUrl) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <h3 className="font-heading font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Hash className="w-5 h-5 text-primary" /> Generated Result
            </h3>
            
            <div className="bg-black/20 p-5 rounded-xl border flex flex-col gap-4" style={{ borderColor: 'var(--border-color)' }}>
              
              {result.imageUrl && (
                <div className="relative w-full min-h-[300px] rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={result.imageUrl} alt="Generated AI Image" className="object-contain w-full max-h-[500px] rounded-lg shadow-xl" />
                </div>
              )}

              {result.caption && (
                <p className="whitespace-pre-wrap leading-relaxed text-sm" style={{ color: 'var(--text-primary)' }}>{result.caption}</p>
              )}
            </div>
            
            <div className="flex gap-3 mt-4">
              <button 
                className="btn-secondary flex-1 py-2 text-sm"
                onClick={() => {
                  navigator.clipboard.writeText(result.caption || '');
                  toast.success('Copied to clipboard!');
                }}
              >
                Copy Caption
              </button>
              <button 
                className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2" 
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 
                {publishing ? 'Publishing...' : 'Publish to Facebook'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
