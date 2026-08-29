import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConnectedPage {
  id: string;
  name: string;
  page_id: string;
  access_token?: string;
  picture_url?: string;
  status: 'connected' | 'error' | 'disconnected';
  webhook_subscribed: boolean;
}

interface Shop {
  id: string;
  name: string;
  name_bn?: string;
  description?: string;
  description_bn?: string;
  logo_url?: string;
  bkash_merchant?: string;
  nagad_merchant?: string;
  preferred_courier: 'pathao' | 'steadfast' | 'auto';
  auto_reply_enabled: boolean;
  auto_order_enabled: boolean;
}

interface ShopState {
  shop: Shop | null;
  connectedPages: ConnectedPage[];
  setShop: (shop: Shop) => void;
  updateShop: (updates: Partial<Shop>) => void;
  setConnectedPages: (pages: ConnectedPage[]) => void;
  addConnectedPage: (page: ConnectedPage) => void;
  removeConnectedPage: (pageId: string) => void;
  reset: () => void;
}

export const useShopStore = create<ShopState>()(
  persist(
    (set) => ({
      shop: null,
      connectedPages: [],
      setShop: (shop) => set({ shop }),
      updateShop: (updates) =>
        set((state) => ({
          shop: state.shop ? { ...state.shop, ...updates } : null,
        })),
      setConnectedPages: (connectedPages) => set({ connectedPages }),
      addConnectedPage: (page) =>
        set((state) => ({
          connectedPages: [...state.connectedPages, page],
        })),
      removeConnectedPage: (pageId) =>
        set((state) => ({
          connectedPages: state.connectedPages.filter((p) => p.page_id !== pageId),
        })),
      reset: () => set({ shop: null, connectedPages: [] }),
    }),
    { name: 'xeni-shop' }
  )
);
