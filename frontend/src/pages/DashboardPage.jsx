import { useState, useEffect } from 'react';
import api from '../services/api';
import { Send, Users, MessageSquare, CheckCircle2, XCircle, Wallet, TrendingUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function StatCard({ icon, label, value, color, sub }) {
    return (
        <div className={`stat-card ${color}`}>
            <div className={`stat-icon ${color}`}>{icon}</div>
            <div className="stat-value">{value ?? '—'}</div>
            <div className="stat-label">{label}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--clr-text-3)', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

function StatusBadge({ status }) {
    return <span className={`badge badge-${status}`}>{status}</span>;
}

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/dashboard/summary')
            .then(r => setData(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="loading-center">
            <span className="spinner spinner-lg" />
        </div>
    );

    const stats = data?.stats || {};
    const balance = data?.balance;
    const recent = data?.recent_campaigns || [];

    return (
        <>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-title">Dashboard</div>
                    <div className="page-subtitle">Campaign overview and delivery insights</div>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/app/compose')}>
                    <Send size={15} /> New Campaign
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <StatCard
                    icon={<TrendingUp size={20} />}
                    label="Delivery Rate"
                    value={`${stats.delivery_rate ?? 0}%`}
                    color="teal"
                />
                <StatCard
                    icon={<MessageSquare size={20} />}
                    label="Total Sent"
                    value={Number(stats.total || 0).toLocaleString()}
                    color="blue"
                />
                <StatCard
                    icon={<CheckCircle2 size={20} />}
                    label="Delivered"
                    value={Number(stats.delivered || 0).toLocaleString()}
                    color="green"
                />
                <StatCard
                    icon={<XCircle size={20} />}
                    label="Failed"
                    value={Number(stats.failed || 0).toLocaleString()}
                    color="red"
                />
                <StatCard
                    icon={<Clock size={20} />}
                    label="In Queue"
                    value={Number(stats.queued || 0).toLocaleString()}
                    color="amber"
                />
                {balance?.success && (
                    <StatCard
                        icon={<Wallet size={20} />}
                        label="Termii Balance"
                        value={`${balance.currency || ''} ${balance.balance ?? '—'}`}
                        color="teal"
                    />
                )}
            </div>

            {/* Recent Campaigns */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>Recent Campaigns</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/analytics')}>
                        View all →
                    </button>
                </div>

                {recent.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 24px' }}>
                        <div className="empty-icon"><Users size={28} /></div>
                        <div className="empty-title">No campaigns yet</div>
                        <div className="empty-desc">Create your first campaign to start reaching your audience.</div>
                        <button className="btn btn-primary mt-4" onClick={() => navigate('/app/compose')}>
                            <Send size={14} /> Create Campaign
                        </button>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Channel</th>
                                    <th>Status</th>
                                    <th>Messages</th>
                                    <th>Delivered</th>
                                    <th>Rate</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent.map((c) => {
                                    const total = parseInt(c.total_messages) || 0;
                                    const delivered = parseInt(c.delivered) || 0;
                                    const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;
                                    return (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 500 }}>{c.title}</td>
                                            <td><span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em', color: 'var(--clr-text-3)' }}>{c.channel}</span></td>
                                            <td><StatusBadge status={c.status} /></td>
                                            <td>{total.toLocaleString()}</td>
                                            <td className="text-green">{delivered.toLocaleString()}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div className="progress-bar" style={{ width: 80 }}>
                                                        <div className="progress-fill green" style={{ width: `${rate}%` }} />
                                                    </div>
                                                    <span style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>{rate}%</span>
                                                </div>
                                            </td>
                                            <td style={{ fontSize: 13 }}>{new Date(c.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
