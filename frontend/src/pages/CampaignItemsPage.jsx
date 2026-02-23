import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { ArrowLeft, CalendarPlus, Copy, Edit3, Save } from 'lucide-react';

function StatusBadge({ status }) {
    return <span className={`badge badge-${status}`}>{status}</span>;
}

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

    const load = async () => {
        setLoading(true);
        try {
            const [{ data: itemData }, { data: groupData }] = await Promise.all([
                api.get(`/messages/campaigns/${campaignId}/items`),
                api.get('/groups'),
            ]);
            setCampaign(itemData.campaign);
            setItems(itemData.items || []);
            setGroups(groupData || []);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load campaign schedule');
            navigate('/app/analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [campaignId]);

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
                    <div className="page-subtitle">Plan, edit, and clone scheduled message items under one campaign</div>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)}>
                    <CalendarPlus size={15} /> {showCreate ? 'Close' : 'Create Message'}
                </button>
            </div>

            {showCreate && (
                <form className="card" onSubmit={createItem} style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, marginBottom: 14 }}>New Scheduled Message</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                            <label className="form-label">Item Title (optional)</label>
                            <input
                                className="form-input"
                                value={createForm.title}
                                onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                                placeholder="e.g. Christmas Eve Reminder"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Schedule Date & Time</label>
                            <input
                                type="datetime-local"
                                className="form-input"
                                value={createForm.scheduled_at}
                                onChange={(e) => setCreateForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 10 }}>
                        <label className="form-label">Audience Groups *</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 180, overflowY: 'auto', padding: 8, border: '1px solid var(--clr-border)', borderRadius: 8 }}>
                            {groups.map((g) => (
                                <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
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

                    <div className="form-group" style={{ marginTop: 10 }}>
                        <label className="form-label">Message Body *</label>
                        <textarea
                            className="form-textarea"
                            style={{ minHeight: 130 }}
                            value={createForm.message_body}
                            onChange={(e) => setCreateForm((p) => ({ ...p, message_body: e.target.value }))}
                            placeholder="Hello {{first_name}}, holiday update from us..."
                            required
                        />
                    </div>

                    <div style={{ marginTop: 14 }}>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />} Save Scheduled Message
                        </button>
                    </div>
                </form>
            )}

            <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 14 }}>Scheduled Messages</div>

                {items.length === 0 ? (
                    <div className="empty-state" style={{ padding: '28px 12px' }}>
                        <div className="empty-title">No scheduled messages yet</div>
                        <div className="empty-desc">Create your first message item for this campaign.</div>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Title</th>
                                    <th>Status</th>
                                    <th>Scheduled</th>
                                    <th>Sent</th>
                                    <th>Failed</th>
                                    <th>Queued</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td>{item.position}</td>
                                        <td style={{ maxWidth: 260 }}>
                                            <div style={{ fontWeight: 500 }}>{item.title || `Message ${item.position}`}</div>
                                            <div style={{ fontSize: 12, color: 'var(--clr-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.message_body}
                                            </div>
                                        </td>
                                        <td><StatusBadge status={item.status} /></td>
                                        <td>{new Date(item.scheduled_at).toLocaleString()}</td>
                                        <td className="text-green">{Number(item.sent_messages || 0).toLocaleString()}</td>
                                        <td className="text-red">{Number(item.failed_messages || 0).toLocaleString()}</td>
                                        <td>{Number(item.queued_messages || 0).toLocaleString()}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {item.can_edit ? (
                                                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => startEdit(item)}>
                                                        <Edit3 size={13} /> Edit
                                                    </button>
                                                ) : (
                                                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => cloneItem(item.id)} disabled={saving}>
                                                        <Copy size={13} /> Clone
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editingId && (
                <div className="card" style={{ marginTop: 20 }}>
                    <div style={{ fontWeight: 600, marginBottom: 12 }}>Edit Scheduled Message</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                            <label className="form-label">Title</label>
                            <input className="form-input" value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Schedule Date & Time</label>
                            <input type="datetime-local" className="form-input" value={editForm.scheduled_at} onChange={(e) => setEditForm((p) => ({ ...p, scheduled_at: e.target.value }))} />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginTop: 10 }}>
                        <label className="form-label">Message Body</label>
                        <textarea className="form-textarea" style={{ minHeight: 120 }} value={editForm.message_body} onChange={(e) => setEditForm((p) => ({ ...p, message_body: e.target.value }))} />
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                        <button className="btn btn-primary" type="button" onClick={() => saveEdit(editingId)} disabled={saving}>
                            <Save size={14} /> Save Changes
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => setEditingId(null)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
