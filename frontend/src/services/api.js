import axios from 'axios';

// Production: Nginx proxies /api → backend container (same-origin, no CORS needed)
// Development: use explicit URL from .env (e.g. http://localhost:5000/api)
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 30000,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('biznotify_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Global error handling — 401 → redirect to login
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('biznotify_token');
            localStorage.removeItem('biznotify_user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default api;
