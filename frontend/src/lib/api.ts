import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { triggerUpgradeModal } from '@/components/UpgradeModal';

// Use an empty string fallback so browser requests become relative (e.g., /api/...)
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor — handle token refresh + subscription gating
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const errorMsg = error.response?.data?.error || '';

    // Handle 403 — Subscription upgrade required
    if (status === 403 && (errorMsg.includes('Upgrade') || errorMsg.includes('upgrade') || errorMsg.includes('plan'))) {
      // Extract required plan from error message (e.g., "Upgrade to premium plan required")
      const planMatch = errorMsg.match(/(?:upgrade to |requires? )(\w+)/i);
      const requiredPlan = planMatch ? planMatch[1].toLowerCase() : 'professional';
      triggerUpgradeModal(requiredPlan, errorMsg || 'This feature requires a plan upgrade. Please subscribe to continue.');
      return Promise.reject(error);
    }

    // Handle 403 — Daily task limit
    if (status === 403 && errorMsg.includes('Daily task limit')) {
      triggerUpgradeModal('professional', 'You\'ve reached your daily task limit. Upgrade your plan for more tasks per day.');
      return Promise.reject(error);
    }

    // Handle 401 — Token refresh
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const { refreshToken, setAuth, logout } = useAuthStore.getState();

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token, user } = res.data.data;
          setAuth(user || useAuthStore.getState().user!, access_token, refresh_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          logout();
        }
      } else {
        logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
