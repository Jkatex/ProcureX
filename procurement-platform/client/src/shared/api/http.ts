import axios from 'axios';
import { currentRequestLanguage } from '@/i18n';
import { getStoredAuthToken } from './authToken';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const language = currentRequestLanguage();
  config.headers['X-ProcureX-Language'] = language;
  config.headers['Accept-Language'] = language === 'sw' ? 'sw-TZ,sw;q=0.9,en;q=0.5' : 'en-TZ,en;q=0.9,sw;q=0.5';
  return config;
});
