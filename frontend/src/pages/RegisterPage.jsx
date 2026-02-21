import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '', confirm: '' });
    const [loading, setLoading] = useState(false);

    const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirm) {
            toast.error('Passwords do not match');
            return;
        }
        if (form.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            await register(form.email, form.password);
            toast.success('Account created! Welcome to BizNotify.');
            navigate('/app/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-box">
                <div className="auth-logo">
                    <div className="auth-logo-icon">
                        <Zap size={22} color="#060a0f" strokeWidth={2.5} />
                    </div>
                    <div className="auth-logo-name">Biz<span>Notify</span></div>
                </div>

                <div className="auth-card">
                    <div className="auth-heading">Create account</div>
                    <div className="auth-sub">Get started with BizNotify today</div>

                    <form className="auth-form" onSubmit={submit}>
                        <div className="form-group">
                            <label className="form-label">Email address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-3)' }} />
                                <input
                                    className="form-input"
                                    style={{ paddingLeft: 38 }}
                                    type="email"
                                    name="email"
                                    placeholder="you@company.com"
                                    value={form.email}
                                    onChange={handle}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-3)' }} />
                                <input
                                    className="form-input"
                                    style={{ paddingLeft: 38 }}
                                    type="password"
                                    name="password"
                                    placeholder="Min. 8 characters"
                                    value={form.password}
                                    onChange={handle}
                                    required
                                    minLength={8}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-3)' }} />
                                <input
                                    className="form-input"
                                    style={{ paddingLeft: 38 }}
                                    type="password"
                                    name="confirm"
                                    placeholder="Repeat password"
                                    value={form.confirm}
                                    onChange={handle}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                        >
                            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating account…</> : 'Create Account'}
                        </button>
                    </form>

                    <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--clr-text-2)' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: 'var(--clr-accent)', fontWeight: 500 }}>Sign In</Link>
                    </div>
                </div>

                <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <Link to="/" style={{ fontSize: 13, color: 'var(--clr-text-3)' }}>← Back to home</Link>
                </div>
            </div>
        </div>
    );
}
