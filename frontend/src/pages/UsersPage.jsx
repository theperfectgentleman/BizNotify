import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { UserPlus, KeyRound, Trash2, X, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/* ─── Create User Modal ──────────────────────────────────────────── */
function CreateUserModal({ onClose, onSaved }) {
    const [form, setForm] = useState({ email: '', password: '', role: 'staff' });
    const [loading, setLoading] = useState(false);

    const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/users', form);
            toast.success(`Account created for ${form.email}`);
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">Create Account</div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Email Address *</label>
                            <input
                                className="form-input"
                                name="email"
                                type="email"
                                placeholder="user@company.com"
                                value={form.email}
                                onChange={handle}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password *</label>
                            <input
                                className="form-input"
                                name="password"
                                type="password"
                                placeholder="Min. 8 characters"
                                value={form.password}
                                onChange={handle}
                                required
                                minLength={8}
                            />
                            <div className="form-hint">The user can change this after logging in.</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role *</label>
                            <select className="form-select" name="role" value={form.role} onChange={handle}>
                                <option value="staff">Staff — can view &amp; use the app</option>
                                <option value="admin">Admin — full access incl. user management</option>
                            </select>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <UserPlus size={14} />}
                            Create Account
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Reset Password Modal ───────────────────────────────────────── */
function ResetPasswordModal({ user: targetUser, onClose }) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (password !== confirm) {
            toast.error('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await api.patch(`/users/${targetUser.id}/reset-password`, { password });
            toast.success(`Password reset for ${targetUser.email}`);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">Reset Password</div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                            Resetting password for: <strong>{targetUser.email}</strong>
                        </div>
                        <div className="form-group">
                            <label className="form-label">New Password *</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="Min. 8 characters"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirm Password *</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="Repeat new password"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <KeyRound size={14} />}
                            Reset Password
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Role Badge ─────────────────────────────────────────────────── */
function RoleBadge({ role }) {
    const isAdmin = role === 'admin';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600, padding: '3px 10px',
            borderRadius: 99,
            background: isAdmin ? 'var(--clr-accent-dim)' : 'var(--clr-surface-3)',
            color: isAdmin ? 'var(--clr-accent)' : 'var(--clr-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
            {isAdmin ? <ShieldCheck size={11} /> : <User size={11} />}
            {role}
        </span>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [resetTarget, setResetTarget] = useState(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/users');
            setUsers(data);
        } catch (err) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const deleteUser = async (u) => {
        if (!confirm(`Delete account for ${u.email}? This cannot be undone.`)) return;
        try {
            await api.delete(`/users/${u.id}`);
            toast.success('User deleted');
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Delete failed');
        }
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <div className="page-title">Manage Users</div>
                    <div className="page-subtitle">{users.length} account{users.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <UserPlus size={15} /> Create Account
                    </button>
                </div>
            </div>

            <div className="table-wrapper">
                {loading ? (
                    <div className="loading-center"><span className="spinner" /></div>
                ) : users.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">👥</div>
                        <div className="empty-title">No users found</div>
                        <div className="empty-desc">Create the first account to get started.</div>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Created</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <span style={{ fontWeight: 500 }}>{u.email}</span>
                                        {u.id === currentUser?.id && (
                                            <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 7px', borderRadius: 99, background: 'var(--clr-surface-3)', color: 'var(--clr-text-3)' }}>
                                                You
                                            </span>
                                        )}
                                    </td>
                                    <td><RoleBadge role={u.role} /></td>
                                    <td style={{ fontSize: 13, color: 'var(--clr-text-2)' }}>
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => setResetTarget(u)}
                                                title="Reset password"
                                            >
                                                <KeyRound size={13} /> Reset Password
                                            </button>
                                            {u.id !== currentUser?.id && (
                                                <button
                                                    className="btn btn-icon btn-danger btn-sm"
                                                    onClick={() => deleteUser(u)}
                                                    title="Delete user"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showCreate && (
                <CreateUserModal onClose={() => setShowCreate(false)} onSaved={fetchUsers} />
            )}
            {resetTarget && (
                <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />
            )}
        </>
    );
}
