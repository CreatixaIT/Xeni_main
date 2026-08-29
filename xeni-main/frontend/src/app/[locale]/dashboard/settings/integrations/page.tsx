"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { 
  Store, 
  CreditCard, 
  Truck, 
  CheckCircle2,
  AlertCircle,
  ChevronRight
} from "lucide-react";

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // States to track what is configured
  const [configured, setConfigured] = useState({
    bkash: false,
    nagad: false,
    pathao: false,
    steadfast: false
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState('bkash');

  const [formData, setFormData] = useState({
    bkash_app_key: "",
    bkash_app_secret: "",
    bkash_username: "",
    bkash_password: "",
    nagad_merchant_id: "",
    nagad_merchant_key: "",
    pathao_client_id: "",
    pathao_client_secret: "",
    pathao_username: "",
    pathao_password: "",
    steadfast_api_key: "",
    steadfast_secret_key: "",
  });

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const res = await api.get("/shops/integrations");
      if (res.data?.success && res.data?.data) {
        setConfigured({
          bkash: res.data.data.bkash?.is_configured || false,
          nagad: res.data.data.nagad?.is_configured || false,
          pathao: res.data.data.pathao?.is_configured || false,
          steadfast: res.data.data.steadfast?.is_configured || false,
        });
        
        // If configured, we display them as masked passwords "********" so the user 
        // knows it's there. The backend ignores "********" on save.
        setFormData({
          bkash_app_key: res.data.data.bkash?.is_configured ? "********" : "",
          bkash_app_secret: res.data.data.bkash?.is_configured ? "********" : "",
          bkash_username: res.data.data.bkash?.is_configured ? "********" : "",
          bkash_password: res.data.data.bkash?.is_configured ? "********" : "",
          nagad_merchant_id: res.data.data.nagad?.is_configured ? "********" : "",
          nagad_merchant_key: res.data.data.nagad?.is_configured ? "********" : "",
          pathao_client_id: res.data.data.pathao?.is_configured ? "********" : "",
          pathao_client_secret: res.data.data.pathao?.is_configured ? "********" : "",
          pathao_username: res.data.data.pathao?.is_configured ? "********" : "",
          pathao_password: res.data.data.pathao?.is_configured ? "********" : "",
          steadfast_api_key: res.data.data.steadfast?.is_configured ? "********" : "",
          steadfast_secret_key: res.data.data.steadfast?.is_configured ? "********" : "",
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = async (integrationType: string) => {
    try {
      setSaving(true);
      
      // Filter out only the fields that belong to this integration type
      const payload: any = {};
      Object.keys(formData).forEach((key) => {
        if (key.startsWith(integrationType)) {
          payload[key] = (formData as any)[key];
        }
      });

      const res = await api.put("/shops/integrations", payload);

      if (res.data?.success) {
        toast.success(`${integrationType.charAt(0).toUpperCase() + integrationType.slice(1)} integration updated successfully!`);
        loadIntegrations();
      } else {
        toast.error(res.data?.message || "Failed to update integration");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand text-brand"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'bkash', name: 'bKash API', icon: CreditCard, isConfigured: configured.bkash },
    { id: 'nagad', name: 'Nagad API', icon: CreditCard, isConfigured: configured.nagad },
    { id: 'pathao', name: 'Pathao Courier', icon: Truck, isConfigured: configured.pathao },
    { id: 'steadfast', name: 'SteadFast Courier', icon: Truck, isConfigured: configured.steadfast },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand to-brand-accent mb-2">
          Merchant API Integrations
        </h1>
        <p className="text-[var(--text-secondary)]">
          Connect your payment and delivery gateways to fully automate your shop&apos;s operations. Xeni AI will automatically verify payments and book couriers on your behalf.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-brand/10 text-brand font-medium shadow-sm border border-brand/20'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-layer-2)] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </div>
                {tab.isConfigured ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500 opacity-60" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[var(--bg-layer-1)] rounded-2xl shadow-xl border border-[var(--border-color)] overflow-hidden">
          <div className="p-6 md:p-8">
            
            {/* bKash Panel */}
            {activeTab === 'bkash' && (
              <div className="animate-fade-in text-left">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold mb-1 text-[var(--text-primary)]">bKash Integration</h2>
                    <p className="text-[var(--text-secondary)] text-sm">Automate bKash tokenized payment verification</p>
                  </div>
                  {configured.bkash && (
                    <span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-semibold rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Connected
                    </span>
                  )}
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">App Key</label>
                      <input
                        type="text"
                        name="bkash_app_key"
                        value={formData.bkash_app_key}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                        placeholder="e.g. 5xXb8k..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">App Secret</label>
                      <input
                        type="password"
                        name="bkash_app_secret"
                        value={formData.bkash_app_secret}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Username</label>
                      <input
                        type="text"
                        name="bkash_username"
                        value={formData.bkash_username}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                        placeholder="Sandbox/Production Username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Password</label>
                      <input
                        type="password"
                        name="bkash_password"
                        value={formData.bkash_password}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => handleSave('bkash')}
                      disabled={saving}
                      className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save bKash Keys"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Nagad Panel */}
            {activeTab === 'nagad' && (
              <div className="animate-fade-in text-left">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold mb-1 text-[var(--text-primary)]">Nagad Integration</h2>
                    <p className="text-[var(--text-secondary)] text-sm">Automate Nagad payment verification</p>
                  </div>
                  {configured.nagad && (
                    <span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-semibold rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Connected
                    </span>
                  )}
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Merchant ID</label>
                    <input
                      type="text"
                      name="nagad_merchant_id"
                      value={formData.nagad_merchant_id}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                      placeholder="e.g. 683002..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Merchant Key / PGP Key</label>
                    <input
                      type="password"
                      name="nagad_merchant_key"
                      value={formData.nagad_merchant_key}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => handleSave('nagad')}
                      disabled={saving}
                      className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Nagad Keys"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Pathao Panel */}
            {activeTab === 'pathao' && (
              <div className="animate-fade-in text-left">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold mb-1 text-[var(--text-primary)]">Pathao Integration</h2>
                    <p className="text-[var(--text-secondary)] text-sm">Automate courier parcel booking for verified orders</p>
                  </div>
                  {configured.pathao && (
                    <span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-semibold rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Connected
                    </span>
                  )}
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Client ID</label>
                      <input
                        type="text"
                        name="pathao_client_id"
                        value={formData.pathao_client_id}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Client Secret</label>
                      <input
                        type="password"
                        name="pathao_client_secret"
                        value={formData.pathao_client_secret}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Username (Email)</label>
                      <input
                        type="email"
                        name="pathao_username"
                        value={formData.pathao_username}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Password</label>
                      <input
                        type="password"
                        name="pathao_password"
                        value={formData.pathao_password}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => handleSave('pathao')}
                      disabled={saving}
                      className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Pathao Keys"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Steadfast Panel */}
            {activeTab === 'steadfast' && (
              <div className="animate-fade-in text-left">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold mb-1 text-[var(--text-primary)]">Steadfast Integration</h2>
                    <p className="text-[var(--text-secondary)] text-sm">Automate Steadfast parcel booking</p>
                  </div>
                  {configured.steadfast && (
                    <span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-semibold rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Connected
                    </span>
                  )}
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">API Key</label>
                    <input
                      type="text"
                      name="steadfast_api_key"
                      value={formData.steadfast_api_key}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Secret Key</label>
                    <input
                      type="password"
                      name="steadfast_secret_key"
                      value={formData.steadfast_secret_key}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-layer-2)] text-[var(--text-primary)] focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => handleSave('steadfast')}
                      disabled={saving}
                      className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Steadfast Keys"}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
