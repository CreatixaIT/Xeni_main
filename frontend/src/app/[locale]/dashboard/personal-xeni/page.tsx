'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Save, RefreshCw, Sparkles, Target, MessageCircle, Palette, TrendingUp, Users, Share2, Box } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface PersonalXeniConfig {
	business_description?: string;
	brand_identity?: string;
	target_customers?: string;
	preferred_tone?: string;
	writing_style?: string;
	words_to_use?: string;
	words_to_avoid?: string;
	sales_preferences?: string;
	customer_service_preferences?: string;
	social_media_style?: string;
	product_content_style?: string;
}

export default function PersonalXeniPage() {
	const [config, setConfig] = useState<PersonalXeniConfig>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const fetchConfig = async () => {
		try {
			const res = await api.get('/user/global-rules');
			// Parse existing custom rules for personal Xeni configuration
			const rulesText = res.data.data?.setting_value || '';
			// For now, we'll use a simple text-based approach
			// In production, this would be parsed from the rules system
			setConfig({
				business_description: '',
				brand_identity: '',
				target_customers: '',
				preferred_tone: 'friendly',
				writing_style: '',
				words_to_use: '',
				words_to_avoid: '',
				sales_preferences: '',
				customer_service_preferences: '',
				social_media_style: '',
				product_content_style: '',
			});
		} catch {
			setConfig({
				business_description: '',
				brand_identity: '',
				target_customers: '',
				preferred_tone: 'friendly',
				writing_style: '',
				words_to_use: '',
				words_to_avoid: '',
				sales_preferences: '',
				customer_service_preferences: '',
				social_media_style: '',
				product_content_style: '',
			});
		}
		setLoading(false);
	};

	useEffect(() => {
		fetchConfig();
	}, []);

	const handleSave = async () => {
		setSaving(true);
		try {
			// Save the configuration as a custom agent rule
			const configText = Object.entries(config)
				.filter(([_, value]) => value && value.trim())
				.map(([key, value]) => `${key}: ${value}`)
				.join('\n');
			
			await api.post('/user/global-rules', { setting_value: configText });
			toast.success('Personal Xeni configuration saved! 🎉');
		} catch {
			toast.error('Failed to save configuration');
		}
		setSaving(false);
	};

	const handleReset = () => {
		setConfig({
			business_description: '',
			brand_identity: '',
			target_customers: '',
			preferred_tone: 'friendly',
			writing_style: '',
			words_to_use: '',
			words_to_avoid: '',
			sales_preferences: '',
			customer_service_preferences: '',
			social_media_style: '',
			product_content_style: '',
		});
		toast.success('Configuration reset');
	};

	if (loading) {
		return <div className="p-8"><div className="skeleton w-full h-96" /></div>;
	}

	return (
		<div className="p-6 lg:p-8 max-w-4xl">
			<div className="mb-8">
				<h1 className="text-2xl font-heading font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
					<Brain className="w-7 h-7 text-primary" /> Personal Xeni
				</h1>
				<p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
					Train your personal AI assistant to understand your business, brand, and customers.
				</p>
			</div>

			<div className="space-y-6">
				{/* Business Overview */}
				<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
					<div className="flex items-center gap-3 mb-4">
						<div className="p-3 bg-primary/20 rounded-xl">
							<Target className="w-6 h-6 text-primary" />
						</div>
						<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Business Overview</h2>
					</div>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
								Business Description
							</label>
							<textarea
								className="input-field min-h-[100px] resize-none"
								placeholder="Describe your business, what you sell, and what makes you unique..."
								value={config.business_description || ''}
								onChange={(e) => setConfig({ ...config, business_description: e.target.value })}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
								Brand Identity
							</label>
							<input
								className="input-field"
								placeholder="Your brand personality, values, and positioning..."
								value={config.brand_identity || ''}
								onChange={(e) => setConfig({ ...config, brand_identity: e.target.value })}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
								Target Customers
							</label>
							<input
								className="input-field"
								placeholder="Who are your ideal customers? Age, location, interests..."
								value={config.target_customers || ''}
								onChange={(e) => setConfig({ ...config, target_customers: e.target.value })}
							/>
						</div>
					</div>
				</motion.div>

				{/* Communication Style */}
				<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
					<div className="flex items-center gap-3 mb-4">
						<div className="p-3 bg-purple-500/20 rounded-xl">
							<MessageCircle className="w-6 h-6 text-purple-400" />
						</div>
						<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Communication Style</h2>
					</div>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
								Preferred Tone
							</label>
							<select
								className="input-field"
								value={config.preferred_tone || 'friendly'}
								onChange={(e) => setConfig({ ...config, preferred_tone: e.target.value })}
							>
								<option value="friendly">Friendly & Casual</option>
								<option value="professional">Professional & Formal</option>
								<option value="playful">Playful & Fun</option>
								<option value="sophisticated">Sophisticated & Elegant</option>
								<option value="helpful">Helpful & Service-Oriented</option>
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
								Writing Style
							</label>
							<textarea
								className="input-field min-h-[80px] resize-none"
								placeholder="How should Xeni write for you? Short sentences, emojis, formal language..."
								value={config.writing_style || ''}
								onChange={(e) => setConfig({ ...config, writing_style: e.target.value })}
							/>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
									Words to Use
								</label>
								<input
									className="input-field"
									placeholder="Comma-separated words Xeni should use"
									value={config.words_to_use || ''}
									onChange={(e) => setConfig({ ...config, words_to_use: e.target.value })}
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
									Words to Avoid
								</label>
								<input
									className="input-field"
									placeholder="Comma-separated words Xeni should avoid"
									value={config.words_to_avoid || ''}
									onChange={(e) => setConfig({ ...config, words_to_avoid: e.target.value })}
								/>
							</div>
						</div>
					</div>
				</motion.div>

				{/* Business Preferences */}
				<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
					<div className="flex items-center gap-3 mb-4">
						<div className="p-3 bg-green-500/20 rounded-xl">
							<TrendingUp className="w-6 h-6 text-green-400" />
						</div>
						<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Business Preferences</h2>
					</div>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
								Sales Preferences
							</label>
							<textarea
								className="input-field min-h-[80px] resize-none"
								placeholder="How should Xeni handle sales? Aggressive, consultative, discount-focused..."
								value={config.sales_preferences || ''}
								onChange={(e) => setConfig({ ...config, sales_preferences: e.target.value })}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
								Customer Service Style
							</label>
							<textarea
								className="input-field min-h-[80px] resize-none"
								placeholder="How should Xeni handle customer issues? Apologetic, solution-focused, empathetic..."
								value={config.customer_service_preferences || ''}
								onChange={(e) => setConfig({ ...config, customer_service_preferences: e.target.value })}
							/>
						</div>
					</div>
				</motion.div>

				{/* Content & Social Media */}
				<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
					<div className="flex items-center gap-3 mb-4">
						<div className="p-3 bg-pink-500/20 rounded-xl">
							<Palette className="w-6 h-6 text-pink-400" />
						</div>
						<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Content & Social Media</h2>
					</div>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
								Social Media Style
							</label>
							<textarea
								className="input-field min-h-[80px] resize-none"
								placeholder="How should Xeni write social media posts? Trendy, informative, story-driven..."
								value={config.social_media_style || ''}
								onChange={(e) => setConfig({ ...config, social_media_style: e.target.value })}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
								Product Content Style
							</label>
							<textarea
								className="input-field min-h-[80px] resize-none"
								placeholder="How should Xeni write product descriptions? Feature-focused, benefit-focused, emotional..."
								value={config.product_content_style || ''}
								onChange={(e) => setConfig({ ...config, product_content_style: e.target.value })}
							/>
						</div>
					</div>
				</motion.div>

				{/* Save Actions */}
				<div className="flex gap-3">
					<button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
						<Save className="w-4 h-4" />
						{saving ? 'Saving...' : 'Save Configuration'}
					</button>
					<button onClick={handleReset} className="btn-secondary flex items-center gap-2">
						<RefreshCw className="w-4 h-4" />
						Reset
					</button>
				</div>

				{/* Info Box */}
				<div className="mt-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-6">
					<div className="flex items-start gap-4">
						<div className="p-3 bg-primary/20 rounded-xl shrink-0">
							<Sparkles className="w-6 h-6 text-primary" />
						</div>
						<div className="flex-1">
							<h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
								Your Personal Xeni
							</h3>
							<p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
								Xeni will use these preferences when assisting you with customer conversations, 
								generating content, analyzing your business, and making recommendations. 
								The more you configure, the more personalized your AI assistant becomes.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
