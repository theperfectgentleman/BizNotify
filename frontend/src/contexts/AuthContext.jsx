import { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('biznotify_user');
        return stored ? JSON.parse(stored) : null;
    });

    const login = useCallback(async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('biznotify_token', data.token);
        localStorage.setItem('biznotify_user', JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
    }, []);

    const register = useCallback(async (email, password) => {
        const { data } = await api.post('/auth/register', { email, password, role: 'admin' });
        localStorage.setItem('biznotify_token', data.token);
        localStorage.setItem('biznotify_user', JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('biznotify_token');
        localStorage.removeItem('biznotify_user');
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
