import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import PropTypes from 'prop-types';
import { ArrowLeft, CalendarPlus, Edit3, Save, Clock3, MessageSquare, Users, ChevronRight, ChevronDown, PlusCircle } from 'lucide-react';

function StatusBadge({ status }) {
    return <span className={`badge badge-${status}`}>{status}</span>;
}

StatusBadge.propTypes = {
    status: PropTypes.string,
};

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
    const [showCampaignForm, setShowCampaignForm] = useState(true);
    const [campaignSearch, setCampaignSearch] = useState('');
    const campaignDropdownRef = useRef(null);

    const [campaignMode, setCampaignMode] = useState('edit'); // edit | create
    const [campaignForm, setCampaignForm] = useState({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        target_reach: '',
    });
    const isMockMode = true;

    const [createForm, setCreateForm] = useState({
        title: '',
        message_body: '',
        scheduled_at: '',
        group_ids: [],
        channel: 'generic',
        message_type: 'plain',
    });

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
                setCampaignForm({
                    title: '',
                    description: '',
                    start_date: '',
                    end_date: '',
                    target_reach: '',
                });
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
                setCampaignForm((prev) => ({
                    ...prev,
                    title: data.campaign.title || '',
                }));
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
        setCampaignForm({
            title: '',
            description: '',
            start_date: '',
            end_date: '',
            target_reach: '',
        });
        setShowCreateMessage(false);
        setShowCampaignDropdown(false);
    };

    const selectCampaign = (id) => {
        setCampaignMode('edit');
        setSelectedCampaignId(id);
        setShowCreateMessage(false);
        setShowCampaignDropdown(false);
        setCampaignSearch('');
    };

    const saveCampaign = async () => {
        const title = String(campaignForm.title || '').trim();
        if (!title) return toast.error('Campaign title is required');

        if (isMockMode) {
            toast('Mockup mode: campaign save is disabled for now.');
            return;
        }

        setSaving(true);
        try {
            if (campaignMode === 'create') {
                const { data } = await api.post('/messages/campaigns', {
                    title,
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

        if (isMockMode) {
            toast('Mockup mode: adding timeline messages is disabled for now.');
            return;
        }

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
                channel: createForm.channel,
            });
            toast.success('Scheduled message created');
            setCreateForm({ title: '', message_body: '', scheduled_at: '', group_ids: [], channel: 'generic', message_type: 'plain' });
            setShowCreateMessage(false);
            await loadCampaignItems(selectedCampaignId);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create schedule item');
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.45fr', gap: 20, alignItems: 'stretch', minHeight: 'calc(100vh - 220px)' }}>
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

                        <div style={{ marginTop: 14, borderTop: '1px solid var(--clr-border)', paddingTop: 14 }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowCampaignForm((value) => !value)}
                                style={{ marginBottom: showCampaignForm ? 10 : 0 }}
                            >
                                <ChevronDown size={14} style={{ transform: showCampaignForm ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                                {showCampaignForm ? 'Hide Campaign Form' : 'Show Campaign Form'}
                            </button>

                            {showCampaignForm && (
                                <>
                                    <div style={{ fontWeight: 600, marginBottom: 10 }}>{campaignMode === 'create' ? 'Create Campaign' : 'Edit Campaign'}</div>
                                    <div className="form-group">
                                        <label className="form-label">Title</label>
                                        <input
                                            className="form-input"
                                            value={campaignForm.title}
                                            onChange={(event) => setCampaignForm((prev) => ({ ...prev, title: event.target.value }))}
                                            placeholder="e.g. Holiday Blast"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginTop: 10 }}>
                                        <label className="form-label">Description</label>
                                        <textarea
                                            className="form-textarea"
                                            style={{ minHeight: 80 }}
                                            value={campaignForm.description}
                                            onChange={(event) => setCampaignForm((prev) => ({ ...prev, description: event.target.value }))}
                                            placeholder="Campaign summary..."
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                                        <div className="form-group">
                                            <label className="form-label">Start Date</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={campaignForm.start_date}
                                                onChange={(event) => setCampaignForm((prev) => ({ ...prev, start_date: event.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">End Date</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={campaignForm.end_date}
                                                onChange={(event) => setCampaignForm((prev) => ({ ...prev, end_date: event.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginTop: 10 }}>
                                        <label className="form-label">Target Reach</label>
                                        <input
                                            className="form-input"
                                            value={campaignForm.target_reach}
                                            onChange={(event) => setCampaignForm((prev) => ({ ...prev, target_reach: event.target.value }))}
                                            placeholder="e.g. 10,000"
                                        />
                                    </div>
                                    <div style={{ marginTop: 12 }}>
                                        <button type="button" className="btn btn-primary" onClick={saveCampaign} disabled={saving}>
                                            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />} {campaignMode === 'create' ? 'Create Campaign' : 'Save Campaign'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="card" style={{ opacity: 0.92 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontWeight: 600 }}>Message Details</div>
                            <StatusBadge status={selectedItem?.status || 'draft'} />
                        </div>

                        <fieldset disabled style={{ border: 'none', padding: 0, margin: 0 }}>
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input className="form-input" value={selectedItem?.title || ''} readOnly />
                            </div>
                            <div className="form-group" style={{ marginTop: 10 }}>
                                <label className="form-label">Schedule Date &amp; Time</label>
                                <input className="form-input" value={selectedItem ? new Date(selectedItem.scheduled_at).toLocaleString() : ''} readOnly />
                            </div>
                            <div className="form-group" style={{ marginTop: 10 }}>
                                <label className="form-label">Channel</label>
                                <input className="form-input" value={selectedItem ? (selectedItem.channel === 'whatsapp' ? 'WhatsApp' : 'SMS') : ''} readOnly />
                            </div>
                            <div className="form-group" style={{ marginTop: 10 }}>
                                <label className="form-label">Message Body</label>
                                <textarea className="form-textarea" style={{ minHeight: 120 }} value={selectedItem?.message_body || ''} readOnly />
                            </div>
                        </fieldset>

                        <div style={{ marginTop: 12 }}>
                            <button type="button" className="btn btn-secondary" disabled>
                                <Edit3 size={14} /> Edit Message
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0, height: '100%' }}>
                    <div className="card" style={{ background: 'var(--clr-surface)' }}>
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

                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Clock3 size={15} style={{ color: 'var(--clr-accent)' }} />
                                Timeline Messages
                            </div>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => setShowCreateMessage((value) => !value)}
                                disabled={campaignMode !== 'edit' || !selectedCampaignId}
                                title={campaignMode !== 'edit' ? 'Create or select a campaign first' : 'Add timeline message'}
                                type="button"
                            >
                                <CalendarPlus size={14} /> {showCreateMessage ? 'Close' : 'Add Message'}
                            </button>
                        </div>

                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
                            {campaignMode !== 'edit' ? (
                                <div className="empty-state" style={{ padding: '30px 12px' }}>
                                    <div className="empty-title">Create a campaign first</div>
                                    <div className="empty-desc">Use the campaign card on the left, then add timeline messages.</div>
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

                        {showCreateMessage && campaignMode === 'edit' && selectedCampaignId && (
                            <form className="card" onSubmit={createItem} style={{ marginTop: 14, background: 'var(--clr-surface-2)' }}>
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
                                    <label className="form-label">Channel</label>
                                    <div className="toggle-group">
                                        <button
                                            type="button"
                                            className={`toggle-btn ${createForm.channel !== 'whatsapp' ? 'active' : ''}`}
                                            onClick={() => setCreateForm((prev) => ({ ...prev, channel: 'generic' }))}
                                        >
                                            SMS
                                        </button>
                                        <button
                                            type="button"
                                            className={`toggle-btn ${createForm.channel === 'whatsapp' ? 'active' : ''}`}
                                            onClick={() => setCreateForm((prev) => ({ ...prev, channel: 'whatsapp' }))}
                                        >
                                            WhatsApp
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginTop: 12 }}>
                                    <label className="form-label">Audience Groups *</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 170, overflowY: 'auto', padding: 10, border: '1px solid var(--clr-border)', borderRadius: 10, background: 'var(--clr-surface)' }}>
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
                    </div>

                </div>
            </div>
        </>
    );
}
