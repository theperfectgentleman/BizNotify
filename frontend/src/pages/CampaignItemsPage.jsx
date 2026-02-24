import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import PropTypes from 'prop-types';
import { ArrowLeft, CalendarPlus, Copy, Edit3, Save, Clock3, MessageSquare, Users, ChevronRight, ChevronDown, PlusCircle } from 'lucide-react';

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
    const [campaigns, setCampaigns] = useState([]);
    const [campaign, setCampaign] = useState(null);
    const [selectedCampaignId, setSelectedCampaignId] = useState(null);
    const [items, setItems] = useState([]);
    const [groups, setGroups] = useState([]);
    const [showCreateMessage, setShowCreateMessage] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
    const [campaignSearch, setCampaignSearch] = useState('');
    const campaignDropdownRef = useRef(null);

    const [campaignMode, setCampaignMode] = useState('edit'); // edit | create
    const [campaignForm, setCampaignForm] = useState({ title: '', channel: 'generic' });

    const [createForm, setCreateForm] = useState({
        title: '',
        message_body: '',
        scheduled_at: '',
        group_ids: [],
        message_type: 'plain',
    });

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', message_body: '', scheduled_at: '' });
    const [selectedItemId, setSelectedItemId] = useState(null);

    const selectedGroups = useMemo(
        () => groups.filter((group) => createForm.group_ids.includes(group.id)),
        [groups, createForm.group_ids]
    );

    const filteredCampaigns = useMemo(() => {
        const keyword = campaignSearch.trim().toLowerCase();
        if (!keyword) return campaigns;
        return campaigns.filter((entry) => entry.title?.toLowerCase().includes(keyword));
    }, [campaigns, campaignSearch]);

    const activeCampaignSummary = useMemo(
        () => campaigns.find((entry) => entry.id === selectedCampaignId) || null,
        [campaigns, selectedCampaignId]
    );

    const loadWorkspace = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data: campaignsData }, { data: groupsData }] = await Promise.all([
                api.get('/messages/campaigns'),
                api.get('/groups'),
            ]);

            const campaignList = Array.isArray(campaignsData) ? campaignsData : [];
            setCampaigns(campaignList);
            setGroups(groupsData || []);

            let nextCampaignId = null;
            if (campaignId && campaignList.some((entry) => entry.id === campaignId)) {
                nextCampaignId = campaignId;
            } else if (selectedCampaignId && campaignList.some((entry) => entry.id === selectedCampaignId)) {
                nextCampaignId = selectedCampaignId;
            } else if (campaignList.length > 0) {
                nextCampaignId = campaignList[0].id;
            }

            if (nextCampaignId) {
                setSelectedCampaignId(nextCampaignId);
                setCampaignMode('edit');
            } else {
                setSelectedCampaignId(null);
                setCampaign(null);
                setItems([]);
                setCampaignMode('create');
                setCampaignForm({ title: '', channel: 'generic' });
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load campaigns');
            navigate('/app/analytics');
        } finally {
            setLoading(false);
        }
    }, [campaignId, navigate, selectedCampaignId]);

    const loadCampaignItems = useCallback(async (activeCampaignId) => {
        if (!activeCampaignId) {
            setCampaign(null);
            setItems([]);
            setSelectedItemId(null);
            return;
        }

        try {
            const { data } = await api.get(`/messages/campaigns/${activeCampaignId}/items`);
            const nextItems = data.items || [];
            setCampaign(data.campaign || null);
            setItems(nextItems);
            setSelectedItemId((prev) => {
                if (nextItems.length === 0) return null;
                if (prev && nextItems.some((item) => item.id === prev)) return prev;
                return nextItems[0].id;
            });

            if (data.campaign) {
                const normalizedChannel = data.campaign.channel === 'whatsapp' ? 'whatsapp' : 'generic';
                setCampaignForm({ title: data.campaign.title || '', channel: normalizedChannel });
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load campaign details');
        }
    }, []);

    useEffect(() => {
        loadWorkspace();
    }, [loadWorkspace]);

    useEffect(() => {
        if (campaignMode === 'edit') {
            loadCampaignItems(selectedCampaignId);
        }
    }, [campaignMode, selectedCampaignId, loadCampaignItems]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!campaignDropdownRef.current) return;
            if (!campaignDropdownRef.current.contains(event.target)) {
                setShowCampaignDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleGroup = (id) => {
        setCreateForm((prev) => ({
            ...prev,
            group_ids: prev.group_ids.includes(id)
                ? prev.group_ids.filter((groupId) => groupId !== id)
                : [...prev.group_ids, id],
        }));
    };

    const startNewCampaign = () => {
        setCampaignMode('create');
        setCampaignForm({ title: '', channel: 'generic' });
        setShowCreateMessage(false);
        setShowCampaignDropdown(false);
    };

    const selectCampaign = (id) => {
        setCampaignMode('edit');
        setSelectedCampaignId(id);
        setShowCreateMessage(false);
        setEditingId(null);
        setShowCampaignDropdown(false);
        setCampaignSearch('');
    };

    const saveCampaign = async () => {
        const title = String(campaignForm.title || '').trim();
        if (!title) return toast.error('Campaign title is required');

        setSaving(true);
        try {
            if (campaignMode === 'create') {
                const { data } = await api.post('/messages/campaigns', {
                    title,
                    channel: campaignForm.channel,
                });

                const createdCampaign = data?.campaign;
                if (!createdCampaign?.id) {
                    throw new Error('Campaign creation failed');
                }

                toast.success('Campaign created');
                setCampaignMode('edit');
                setSelectedCampaignId(createdCampaign.id);
                setShowCampaignDropdown(false);
                setCampaignSearch('');
                await loadWorkspace();
            } else if (selectedCampaignId) {
                await api.patch(`/messages/campaigns/${selectedCampaignId}`, {
                    title,
                    channel: campaignForm.channel,
                });
                toast.success('Campaign updated');
                await loadWorkspace();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Failed to save campaign');
        } finally {
            setSaving(false);
        }
    };

    const createItem = async (e) => {
        e.preventDefault();
        if (!selectedCampaignId) return toast.error('Create or select a campaign first');

        const scheduledAtIso = toIsoOrNull(createForm.scheduled_at);
        if (!createForm.message_body.trim()) return toast.error('Message body is required');
        if (!scheduledAtIso) return toast.error('Valid schedule date is required');
        if (!createForm.group_ids.length) return toast.error('Select at least one group');

        setSaving(true);
        try {
            await api.post(`/messages/campaigns/${selectedCampaignId}/items`, {
                title: createForm.title || null,
                message_body: createForm.message_body,
                scheduled_at: scheduledAtIso,
                group_ids: createForm.group_ids,
                message_type: createForm.message_type,
                channel: campaign?.channel === 'whatsapp' ? 'whatsapp' : 'generic',
            });
            toast.success('Scheduled message created');
            setCreateForm({ title: '', message_body: '', scheduled_at: '', group_ids: [], message_type: 'plain' });
            setShowCreateMessage(false);
            await loadCampaignItems(selectedCampaignId);
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
            await loadCampaignItems(selectedCampaignId);
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
            await loadCampaignItems(selectedCampaignId);
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
                    <div className="page-title" style={{ marginTop: 10 }}>{campaign?.title || 'Campaigns'}</div>
                    <div className="page-subtitle">Create campaigns, schedule timeline messages, and manage delivery status in one workspace</div>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowCreateMessage((value) => !value)}
                    disabled={campaignMode !== 'edit' || !selectedCampaignId}
                    title={campaignMode !== 'edit' ? 'Create or select a campaign first' : 'Add timeline message'}
                >
                    <CalendarPlus size={15} /> {showCreateMessage ? 'Close Composer' : 'Add Message'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 20, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="card" style={{ background: 'var(--clr-surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <MessageSquare size={16} style={{ color: 'var(--clr-accent)' }} />
                                Campaigns
                            </div>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={startNewCampaign}>
                                <PlusCircle size={14} /> New Campaign
                            </button>
                        </div>

                        {campaigns.length > 0 ? (
                            <div style={{ position: 'relative' }} ref={campaignDropdownRef}>
                                <button
                                    type="button"
                                    className="form-input"
                                    onClick={() => setShowCampaignDropdown((value) => !value)}
                                    disabled={campaignMode === 'create'}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        minHeight: 44,
                                        cursor: campaignMode === 'create' ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <span style={{ color: activeCampaignSummary ? 'var(--clr-text-1)' : 'var(--clr-text-3)', fontWeight: 500 }}>
                                        {activeCampaignSummary?.title || 'Select campaign'}
                                    </span>
                                    <ChevronDown size={16} style={{ color: 'var(--clr-text-3)' }} />
                                </button>

                                {showCampaignDropdown && campaignMode !== 'create' && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 8px)',
                                        left: 0,
                                        right: 0,
                                        background: 'var(--clr-surface)',
                                        border: '1px solid var(--clr-border)',
                                        borderRadius: 12,
                                        boxShadow: 'var(--shadow-md)',
                                        zIndex: 30,
                                        padding: 10,
                                    }}>
                                        <input
                                            className="form-input"
                                            value={campaignSearch}
                                            onChange={(event) => setCampaignSearch(event.target.value)}
                                            placeholder="Search campaigns..."
                                            autoFocus
                                        />

                                        <div style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {filteredCampaigns.length === 0 ? (
                                                <div style={{ fontSize: 12, color: 'var(--clr-text-3)', padding: '8px 4px' }}>
                                                    No campaigns match your search.
                                                </div>
                                            ) : (
                                                filteredCampaigns.map((entry) => {
                                                    const isActive = entry.id === selectedCampaignId;
                                                    return (
                                                        <button
                                                            key={entry.id}
                                                            type="button"
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => selectCampaign(entry.id)}
                                                            style={{
                                                                justifyContent: 'space-between',
                                                                width: '100%',
                                                                borderColor: isActive ? 'var(--clr-accent-glow)' : undefined,
                                                                background: isActive ? 'var(--clr-accent-dim)' : undefined,
                                                            }}
                                                        >
                                                            <span style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {entry.title}
                                                            </span>
                                                            <StatusBadge status={entry.status} />
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ fontSize: 13, color: 'var(--clr-text-3)' }}>No campaigns yet. Create your first campaign from the right panel.</div>
                        )}

                        {campaignMode === 'edit' && campaign && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
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
                        )}
                    </div>

                    {showCreateMessage && campaignMode === 'edit' && selectedCampaignId && (
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
                                        onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                                        placeholder="e.g. Christmas Eve Reminder"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Schedule Date &amp; Time *</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={createForm.scheduled_at}
                                        onChange={(event) => setCreateForm((prev) => ({ ...prev, scheduled_at: event.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label">Audience Groups *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 170, overflowY: 'auto', padding: 10, border: '1px solid var(--clr-border)', borderRadius: 10, background: 'var(--clr-surface-2)' }}>
                                    {groups.map((group) => (
                                        <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--clr-text-2)' }}>
                                            <input
                                                type="checkbox"
                                                checked={createForm.group_ids.includes(group.id)}
                                                onChange={() => toggleGroup(group.id)}
                                                style={{ accentColor: 'var(--clr-accent)' }}
                                            />
                                            <span>{group.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {selectedGroups.length > 0 && (
                                    <div style={{ fontSize: 12, color: 'var(--clr-text-3)', marginTop: 8 }}>
                                        Selected: {selectedGroups.map((group) => group.name).join(', ')}
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label">Message Body *</label>
                                <textarea
                                    className="form-textarea"
                                    style={{ minHeight: 120 }}
                                    value={createForm.message_body}
                                    onChange={(event) => setCreateForm((prev) => ({ ...prev, message_body: event.target.value }))}
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

                        {campaignMode !== 'edit' ? (
                            <div className="empty-state" style={{ padding: '30px 12px' }}>
                                <div className="empty-title">Create a campaign first</div>
                                <div className="empty-desc">Use the campaign form on the right, then add timeline messages.</div>
                            </div>
                        ) : items.length === 0 ? (
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
                        <div style={{ fontWeight: 600 }}>{campaignMode === 'create' ? 'Create Campaign' : 'Campaign Details'}</div>
                        {campaignMode === 'edit' && campaign && <StatusBadge status={campaign.status} />}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Campaign Title</label>
                        <input
                            className="form-input"
                            value={campaignForm.title}
                            onChange={(event) => setCampaignForm((prev) => ({ ...prev, title: event.target.value }))}
                            placeholder="e.g. Holiday Blast"
                        />
                    </div>

                    <div className="form-group" style={{ marginTop: 10 }}>
                        <label className="form-label">Default Channel</label>
                        <select
                            className="form-input"
                            value={campaignForm.channel}
                            onChange={(event) => setCampaignForm((prev) => ({ ...prev, channel: event.target.value }))}
                        >
                            <option value="generic">SMS</option>
                            <option value="whatsapp">WhatsApp</option>
                        </select>
                    </div>

                    <div style={{ marginTop: 14 }}>
                        <button type="button" className="btn btn-primary" onClick={saveCampaign} disabled={saving}>
                            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />} {campaignMode === 'create' ? 'Create Campaign' : 'Save Campaign'}
                        </button>
                    </div>

                    {campaignMode === 'edit' && selectedItem && (
                        <>
                            <div style={{ borderTop: '1px solid var(--clr-border)', marginTop: 18, paddingTop: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <div style={{ fontWeight: 600 }}>Message Details</div>
                                    <StatusBadge status={selectedItem.status} />
                                </div>

                                {editingId === selectedItem.id ? (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Title</label>
                                            <input className="form-input" value={editForm.title} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} />
                                        </div>
                                        <div className="form-group" style={{ marginTop: 10 }}>
                                            <label className="form-label">Schedule Date &amp; Time</label>
                                            <input type="datetime-local" className="form-input" value={editForm.scheduled_at} onChange={(event) => setEditForm((prev) => ({ ...prev, scheduled_at: event.target.value }))} />
                                        </div>
                                        <div className="form-group" style={{ marginTop: 10 }}>
                                            <label className="form-label">Message Body</label>
                                            <textarea className="form-textarea" style={{ minHeight: 120 }} value={editForm.message_body} onChange={(event) => setEditForm((prev) => ({ ...prev, message_body: event.target.value }))} />
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
                                        <div style={{ border: '1px solid var(--clr-border)', borderRadius: 12, padding: 12, background: 'var(--clr-surface-2)', marginBottom: 10 }}>
                                            <div style={{ fontWeight: 600 }}>{selectedItem.title || `Message ${selectedItem.position}`}</div>
                                            <div style={{ fontSize: 12, color: 'var(--clr-text-3)', marginTop: 2 }}>{new Date(selectedItem.scheduled_at).toLocaleString()}</div>
                                        </div>
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
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
