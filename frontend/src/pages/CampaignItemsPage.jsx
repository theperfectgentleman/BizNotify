import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import PropTypes from 'prop-types';
import { ArrowLeft, CalendarPlus, Copy, Edit3, Save, Clock3, MessageSquare, Users, ChevronRight } from 'lucide-react';

function StatusBadge({ status }) {
    return <span className={`badge badge-${status}`}>{status}</span>;
}

StatusBadge.propTypes = {
    status: PropTypes.string,
};

function toLocalInputValue(isoDate) {
    if (!isoDate) return '';
    const dt = new Date(isoDate);
    const offset = dt.getTimezoneOffset();
    const local = new Date(dt.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

export default function CampaignItemsPage() {
    const { campaignId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [campaign, setCampaign] = useState(null);
    const [items, setItems] = useState([]);
    const [groups, setGroups] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState(null);

    const [createForm, setCreateForm] = useState({
        title: '',
        message_body: '',
        scheduled_at: '',
        group_ids: [],
        message_type: 'plain',
    });

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', message_body: '', scheduled_at: '' });

    const selectedGroups = useMemo(
        () => groups.filter((g) => createForm.group_ids.includes(g.id)),
        [groups, createForm.group_ids]
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data: itemData }, { data: groupData }] = await Promise.all([
                api.get(`/messages/campaigns/${campaignId}/items`),
                api.get('/groups'),
            ]);
            const nextItems = itemData.items || [];
            setCampaign(itemData.campaign);
            setItems(nextItems);
            setGroups(groupData || []);
            setSelectedItemId((prev) => {
                if (nextItems.length === 0) return null;
                if (prev && nextItems.some((item) => item.id === prev)) return prev;
                return nextItems[0].id;
            });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load campaign schedule');
            navigate('/app/analytics');
        } finally {
            setLoading(false);
        }
    }, [campaignId, navigate]);

    useEffect(() => {
        load();
    }, [load]);

    const toggleGroup = (id) => {
        setCreateForm((prev) => ({
            ...prev,
            group_ids: prev.group_ids.includes(id)
                ? prev.group_ids.filter((g) => g !== id)
                : [...prev.group_ids, id],
        }));
    };

    const createItem = async (e) => {
        e.preventDefault();
        const scheduledAtIso = toIsoOrNull(createForm.scheduled_at);
        if (!createForm.message_body.trim()) return toast.error('Message body is required');
        if (!scheduledAtIso) return toast.error('Valid schedule date is required');
        if (!createForm.group_ids.length) return toast.error('Select at least one group');

        setSaving(true);
        try {
            await api.post(`/messages/campaigns/${campaignId}/items`, {
                title: createForm.title || null,
                message_body: createForm.message_body,
                scheduled_at: scheduledAtIso,
                group_ids: createForm.group_ids,
                message_type: createForm.message_type,
                channel: campaign?.channel === 'whatsapp' ? 'whatsapp' : 'generic',
            });
            toast.success('Scheduled message created');
            setCreateForm({ title: '', message_body: '', scheduled_at: '', group_ids: [], message_type: 'plain' });
            setShowCreate(false);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create schedule item');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setEditForm({
            title: item.title || '',
            message_body: item.message_body || '',
            scheduled_at: toLocalInputValue(item.scheduled_at),
        });
    };

    const saveEdit = async (itemId) => {
        const scheduledAtIso = toIsoOrNull(editForm.scheduled_at);
        if (!editForm.message_body.trim()) return toast.error('Message body is required');
        if (!scheduledAtIso) return toast.error('Valid schedule date is required');

        setSaving(true);
        try {
            await api.patch(`/messages/campaign-items/${itemId}`, {
                title: editForm.title || null,
                message_body: editForm.message_body,
                scheduled_at: scheduledAtIso,
            });
            toast.success('Scheduled item updated');
            setEditingId(null);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update item');
        } finally {
            setSaving(false);
        }
    };

    const cloneItem = async (itemId) => {
        setSaving(true);
        try {
            await api.post(`/messages/campaign-items/${itemId}/clone`, {});
            toast.success('Item cloned (+24h default)');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to clone item');
        } finally {
            setSaving(false);
        }
    };

    const selectedItem = useMemo(
        () => items.find((item) => item.id === selectedItemId) || null,
        [items, selectedItemId]
    );

    const timelineStats = useMemo(() => {
        return items.reduce((acc, item) => {
            acc.total += 1;
            acc.sent += Number(item.sent_messages || 0);
            acc.failed += Number(item.failed_messages || 0);
            acc.queued += Number(item.queued_messages || 0);
            return acc;
        }, { total: 0, sent: 0, failed: 0, queued: 0 });
    }, [items]);

    if (loading) {
        return <div className="loading-center"><span className="spinner spinner-lg" /></div>;
    }

    return (
        <>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/analytics')}>
                        <ArrowLeft size={14} /> Back to Analytics
                    </button>
                    <div className="page-title" style={{ marginTop: 10 }}>{campaign?.title || 'Campaign Schedule'}</div>
                    <div className="page-subtitle">Create a timeline of messages, track status, edit drafts, and clone sent items</div>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)}>
                    <CalendarPlus size={15} /> {showCreate ? 'Close Composer' : 'Add Message'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 20, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="card" style={{ background: 'var(--clr-surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <MessageSquare size={16} style={{ color: 'var(--clr-accent)' }} />
                                Campaign Timeline
                            </div>
                            <StatusBadge status={campaign?.status || 'draft'} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                            <div style={{ border: '1px solid var(--clr-border)', borderRadius: 10, padding: 10, background: 'var(--clr-surface-2)' }}>
                                <div style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>Messages</div>
                                <div style={{ fontWeight: 700, fontSize: 18 }}>{timelineStats.total}</div>
                            </div>
                            <div style={{ border: '1px solid var(--clr-border)', borderRadius: 10, padding: 10, background: 'var(--clr-surface-2)' }}>
                                <div style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>Queued</div>
                                <div style={{ fontWeight: 700, fontSize: 18 }}>{timelineStats.queued.toLocaleString()}</div>
                            </div>
                            <div style={{ border: '1px solid var(--clr-border)', borderRadius: 10, padding: 10, background: 'var(--clr-surface-2)' }}>
                                <div style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>Sent</div>
                                <div style={{ fontWeight: 700, fontSize: 18 }}>{timelineStats.sent.toLocaleString()}</div>
                            </div>
                            <div style={{ border: '1px solid var(--clr-border)', borderRadius: 10, padding: 10, background: 'var(--clr-surface-2)' }}>
                                <div style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>Failed</div>
                                <div style={{ fontWeight: 700, fontSize: 18 }}>{timelineStats.failed.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>

                    {showCreate && (
                        <form className="card" onSubmit={createItem}>
                            <div style={{ fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CalendarPlus size={16} style={{ color: 'var(--clr-accent)' }} />
                                Draft New Timeline Message
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Message Title (optional)</label>
                                    <input
                                        className="form-input"
                                        value={createForm.title}
                                        onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                                        placeholder="e.g. Christmas Eve Reminder"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Schedule Date &amp; Time *</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={createForm.scheduled_at}
                                        onChange={(e) => setCreateForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label">Audience Groups *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 170, overflowY: 'auto', padding: 10, border: '1px solid var(--clr-border)', borderRadius: 10, background: 'var(--clr-surface-2)' }}>
                                    {groups.map((g) => (
                                        <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--clr-text-2)' }}>
                                            <input
                                                type="checkbox"
                                                checked={createForm.group_ids.includes(g.id)}
                                                onChange={() => toggleGroup(g.id)}
                                                style={{ accentColor: 'var(--clr-accent)' }}
                                            />
                                            <span>{g.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {selectedGroups.length > 0 && (
                                    <div style={{ fontSize: 12, color: 'var(--clr-text-3)', marginTop: 8 }}>
                                        Selected: {selectedGroups.map((g) => g.name).join(', ')}
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label">Message Body *</label>
                                <textarea
                                    className="form-textarea"
                                    style={{ minHeight: 120 }}
                                    value={createForm.message_body}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, message_body: e.target.value }))}
                                    placeholder="Hello {{first_name}}, holiday update from us..."
                                    required
                                />
                            </div>

                            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />} Add to Timeline
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Clock3 size={15} style={{ color: 'var(--clr-accent)' }} />
                                Timeline Messages
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>{items.length} item(s)</div>
                        </div>

                        {items.length === 0 ? (
                            <div className="empty-state" style={{ padding: '30px 12px' }}>
                                <div className="empty-icon"><MessageSquare size={24} /></div>
                                <div className="empty-title">No timeline messages yet</div>
                                <div className="empty-desc">Use Add Message to draft and schedule your next touchpoint.</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {items.map((item) => {
                                    const isActive = selectedItemId === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedItemId(item.id);
                                                setEditingId(null);
                                            }}
                                            style={{
                                                width: '100%',
                                                textAlign: 'left',
                                                background: isActive ? 'var(--clr-accent-dim)' : 'var(--clr-surface)',
                                                border: `1px solid ${isActive ? 'var(--clr-accent-glow)' : 'var(--clr-border)'}`,
                                                borderRadius: 12,
                                                padding: '12px 14px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                            }}
                                        >
                                            <div style={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 10,
                                                background: 'var(--clr-surface-2)',
                                                border: '1px solid var(--clr-border)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--clr-text-2)'
                                            }}>
                                                <MessageSquare size={16} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title || `Message ${item.position}`}</div>
                                                    <StatusBadge status={item.status} />
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--clr-text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span>{new Date(item.scheduled_at).toLocaleString()}</span>
                                                    <span>•</span>
                                                    <span>Sent {Number(item.sent_messages || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} style={{ color: 'var(--clr-text-3)' }} />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="card" style={{ position: 'sticky', top: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontWeight: 600 }}>Message Details</div>
                        {selectedItem && <StatusBadge status={selectedItem.status} />}
                    </div>

                    {!selectedItem ? (
                        <div className="empty-state" style={{ padding: '28px 10px' }}>
                            <div className="empty-title">Select a timeline message</div>
                            <div className="empty-desc">Choose a message on the left to view or edit details.</div>
                        </div>
                    ) : (
                        <>
                            <div style={{ border: '1px solid var(--clr-border)', borderRadius: 12, padding: 12, background: 'var(--clr-surface-2)', marginBottom: 14 }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>{selectedItem.title || `Message ${selectedItem.position}`}</div>
                                <div style={{ fontSize: 12, color: 'var(--clr-text-3)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock3 size={12} /> {new Date(selectedItem.scheduled_at).toLocaleString()}</span>
                                    <span>•</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={12} /> Queued {Number(selectedItem.queued_messages || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            {editingId === selectedItem.id ? (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Title</label>
                                        <input className="form-input" value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginTop: 10 }}>
                                        <label className="form-label">Schedule Date &amp; Time</label>
                                        <input type="datetime-local" className="form-input" value={editForm.scheduled_at} onChange={(e) => setEditForm((p) => ({ ...p, scheduled_at: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginTop: 10 }}>
                                        <label className="form-label">Message Body</label>
                                        <textarea className="form-textarea" style={{ minHeight: 120 }} value={editForm.message_body} onChange={(e) => setEditForm((p) => ({ ...p, message_body: e.target.value }))} />
                                    </div>
                                    <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                                        <button className="btn btn-primary" type="button" onClick={() => saveEdit(selectedItem.id)} disabled={saving}>
                                            <Save size={14} /> Save Changes
                                        </button>
                                        <button className="btn btn-secondary" type="button" onClick={() => setEditingId(null)}>
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: 'var(--clr-text-2)', border: '1px solid var(--clr-border)', borderRadius: 12, padding: 12, background: 'var(--clr-surface)' }}>
                                        {selectedItem.message_body}
                                    </div>
                                    <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                        {selectedItem.can_edit ? (
                                            <button className="btn btn-primary" type="button" onClick={() => startEdit(selectedItem)}>
                                                <Edit3 size={14} /> Edit Message
                                            </button>
                                        ) : (
                                            <button className="btn btn-secondary" type="button" onClick={() => cloneItem(selectedItem.id)} disabled={saving}>
                                                <Copy size={14} /> Clone (+24h)
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
