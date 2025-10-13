import axios from 'axios';

// Dynamically determine backend URL based on current host
const getBackendUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    console.log('🌐 Using env variable:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }

  // If accessing from network (not localhost), use the same host IP
  const currentHost = window.location.hostname;
  console.log('🌐 Current hostname:', currentHost);
  console.log('🌐 Full location:', window.location.href);

  if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
    const url = `http://${currentHost}:3000/api`;
    console.log('🌐 ✅ Using network backend URL:', url);
    return url;
  }

  console.log('🌐 ⚠️ Using localhost backend URL');
  return 'http://localhost:3000/api';
};

const API_BASE_URL = getBackendUrl();
const BACKEND_URL = API_BASE_URL.replace('/api', '');
console.log('🔧 Final API configuration:');
console.log('   - API Base URL:', API_BASE_URL);
console.log('   - Backend URL:', BACKEND_URL);

// Helper function to get full image URL
export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BACKEND_URL}${path}`;
};

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
