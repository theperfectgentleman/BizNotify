import { useState, useEffect } from 'react';
import api from '../services/api';
import { BarChart2, CheckCircle2, XCircle, Send, Clock, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

function StatusBadge({ status }) {
    return <span className={`badge badge-${status}`}>{status}</span>;
}

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
        return (
            <div style={{ background: 'var(--clr-surface-2)', border: '1px solid var(--clr-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                {payload.map(p => (
                    <div key={p.name} style={{ color: p.fill, display: 'flex', gap: 8 }}>
                        <span>{p.name}:</span>
                        <span style={{ fontWeight: 600 }}>{p.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

StatusBadge.propTypes = {
    status: PropTypes.string,
};

CustomTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
        value: PropTypes.number,
        fill: PropTypes.string,
    })),
    label: PropTypes.string,
};

export default function AnalyticsPage() {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState([]);
    const [stats, setStats] = useState(null);
    const [inbox, setInbox] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/messages/campaigns'),
            api.get('/messages/stats'),
            api.get('/termii/history').catch(() => ({ data: [] }))
        ]).then(([c, s, h]) => {
            setCampaigns(c.data);
            setStats(s.data);
            setInbox(Array.isArray(h.data) ? h.data.slice(0, 15) : []);
        }).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-center"><span className="spinner spinner-lg" /></div>;

    const createSeriesCampaign = async () => {
        const title = window.prompt('Campaign title');
        if (!title || !title.trim()) return;
        try {
            const now = new Date();
            const endAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const { data } = await api.post('/messages/campaigns', {
                title: title.trim(),
                channel: 'generic',
                start_at: now.toISOString(),
                end_at: endAt.toISOString(),
            });
            navigate(`/app/campaigns/${data.campaign.id}/items`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create campaign');
        }
    };

    // Chart data
    const chartData = campaigns.slice(0, 10).map(c => ({
        name: c.title.length > 18 ? c.title.slice(0, 18) + '…' : c.title,
        Delivered: parseInt(c.delivered) || 0,
        Failed: parseInt(c.failed) || 0,
        Sent: parseInt(c.sent) || 0,
    })).reverse();

    return (
        <>
            <div className="page-header">
                <div>
                    <div className="page-title">Analytics</div>
                    <div className="page-subtitle">Campaign performance and delivery breakdown</div>
                </div>
                <button className="btn btn-primary" onClick={createSeriesCampaign}>
                    <Send size={14} /> New Series Campaign
                </button>
            </div>

            {/* Overall Stats */}
            <div className="stats-grid" style={{ marginBottom: 28 }}>
                {[
                    { icon: <Send size={20} />, label: 'Total Messages', value: Number(stats?.total || 0).toLocaleString(), color: 'teal' },
                    { icon: <CheckCircle2 size={20} />, label: 'Delivered', value: Number(stats?.delivered || 0).toLocaleString(), color: 'green' },
                    { icon: <XCircle size={20} />, label: 'Failed', value: Number(stats?.failed || 0).toLocaleString(), color: 'red' },
                    { icon: <Clock size={20} />, label: 'In Queue', value: Number(stats?.queued || 0).toLocaleString(), color: 'amber' },
                    { icon: <BarChart2 size={20} />, label: 'Total Campaigns', value: Number(stats?.total_campaigns || 0).toLocaleString(), color: 'blue' },
                ].map(s => (
                    <div key={s.label} className={`stat-card ${s.color}`}>
                        <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                        <div className="stat-value">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Bar Chart */}
            {chartData.length > 0 && (
                <div className="card mb-6">
                    <div style={{ fontWeight: 600, marginBottom: 24 }}>Campaign Performance (Last 10)</div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={chartData} barSize={18} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                            <Bar dataKey="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Campaign Table */}
            <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 20 }}>All Campaigns</div>

                {campaigns.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><BarChart2 size={28} /></div>
                        <div className="empty-title">No campaigns yet</div>
                        <div className="empty-desc">Your campaign history will appear here once you send your first campaign.</div>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Channel</th>
                                    <th>Window</th>
                                    <th>Status</th>
                                    <th>Total</th>
                                    <th>Delivered</th>
                                    <th>Failed</th>
                                    <th>Delivery Rate</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map((c) => {
                                    const total = parseInt(c.total_messages) || 0;
                                    const delivered = parseInt(c.delivered) || 0;
                                    const failed = parseInt(c.failed) || 0;
                                    const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;
                                    const failRate = total > 0 ? Math.round((failed / total) * 100) : 0;

                                    return (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 500, maxWidth: 200 }}>
                                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--clr-text-3)' }}>{c.channel}</span>
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--clr-text-2)', minWidth: 180 }}>
                                                {c.start_at && c.end_at
                                                    ? `${new Date(c.start_at).toLocaleDateString()} - ${new Date(c.end_at).toLocaleDateString()}`
                                                    : 'Not set'}
                                            </td>
                                            <td><StatusBadge status={c.status} /></td>
                                            <td>{total.toLocaleString()}</td>
                                            <td className="text-green">{delivered.toLocaleString()}</td>
                                            <td className="text-red">{failed.toLocaleString()}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <div style={{ flex: 1, height: 6, background: 'var(--clr-surface-3)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                                                            <div style={{ width: `${rate}%`, background: '#10b981', transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                                                            <div style={{ width: `${failRate}%`, background: '#ef4444' }} />
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>{rate}% delivered</span>
                                                </div>
                                            </td>
                                            <td style={{ fontSize: 13 }}>{new Date(c.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => navigate(`/app/campaigns/${c.id}/items`)}
                                                >
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Termii Network Inbox History */}
            <div className="card" style={{ marginTop: 24 }}>
                <div style={{ fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Inbox size={18} style={{ color: 'var(--clr-accent)' }} />
                    Recent Network History (Termii Inbox)
                </div>

                {inbox.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><Inbox size={28} /></div>
                        <div className="empty-title">No network history</div>
                        <div className="empty-desc">No recent messages found in your Termii inbox.</div>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Receiver</th>
                                    <th>Sender</th>
                                    <th>Message ID</th>
                                    <th>Channel</th>
                                    <th>Status</th>
                                    <th>Sent Via</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inbox.map((msg, idx) => (
                                    <tr key={idx}>
                                        <td style={{ fontWeight: 500 }}>{msg.receiver}</td>
                                        <td>{msg.sender || '—'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--clr-text-3)' }}>{msg.message_id}</td>
                                        <td><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--clr-text-3)' }}>{msg.sms_type}</span></td>
                                        <td><StatusBadge status={msg.status} /></td>
                                        <td><span className="badge" style={{ background: 'var(--clr-surface-3)', color: 'var(--clr-text-2)' }}>{msg.send_by}</span></td>
                                        <td style={{ fontSize: 13 }}>{new Date(msg.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
