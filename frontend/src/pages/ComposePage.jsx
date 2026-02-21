import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Send, MessageSquare, Type } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';

const MAX_SMS_CHARS = 160;

function CharCounter({ text }) {
    const len = text.length;
    const units = Math.ceil(len / MAX_SMS_CHARS) || 1;
    const cls = len > MAX_SMS_CHARS * units ? 'over' : len > MAX_SMS_CHARS * (units - 1) * 0.9 ? 'warn' : '';
    return (
        <div className={`char-counter ${cls}`}>
            <span>{len} chars</span>
            <span>{units} SMS unit{units > 1 ? 's' : ''} · ~¢{units * 0.5}</span>
        </div>
    );
}

CharCounter.propTypes = {
    text: PropTypes.string.isRequired,
};

export default function ComposePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const mode = location.pathname.includes('/instant') ? 'instant' : 'campaign';

    const [groups, setGroups] = useState([]);
    const [senderIds, setSenderIds] = useState([]);

    const [form, setForm] = useState({
        title: '',
        message_body: '',
        channel: 'generic', // generic, dnd, whatsapp
        message_type: 'plain', // plain, unicode
        sender_id: '',
        group_ids: [],
        target_phones: '',
        sendMode: 'now',
        scheduled_at: '',
    });
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState('');

    useEffect(() => {
        api.get('/groups').then(r => setGroups(r.data));
        api.get('/termii/sender-ids').then(r => {
            const list = r.data?.content || r.data || [];
            if (Array.isArray(list)) {
                const actives = list.filter(s => s.status?.toLowerCase() === 'active' || s.status?.toLowerCase() === 'unblock');
                setSenderIds(actives);
                if (actives.length > 0) {
                    setForm(f => ({ ...f, sender_id: actives[0].sender_id }));
                }
            }
        }).catch(err => console.error('Failed to fetch sender IDs:', err));
    }, []);

    useEffect(() => {
        setPreview(
            form.message_body
                .replace(/\{\{first_name\}\}/gi, 'John')
                .replace(/\{\{last_name\}\}/gi, 'Doe')
                .replace(/\{\{phone\}\}/gi, mode === 'instant' ? (form.target_phones.split(/[,\s]+/)[0] || '2348012345678') : '2348012345678')
        );
    }, [form.message_body, form.target_phones, mode]);

    const toggleGroup = (id) => {
        setForm(f => ({
            ...f,
            group_ids: f.group_ids.includes(id)
                ? f.group_ids.filter(g => g !== id)
                : [...f.group_ids, id]
        }));
    };

    const insertVar = (variable) => {
        setForm(f => ({ ...f, message_body: f.message_body + `{{${variable}}}` }));
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.message_body.trim()) return toast.error('Message body is required');

        if (mode === 'campaign') {
            if (!form.title.trim()) return toast.error('Campaign title is required');
            if (!form.group_ids.length) return toast.error('Select at least one group');
        } else {
            if (!form.target_phones.trim()) return toast.error('Target phone numbers are required');
        }

        setLoading(true);
        try {
            if (mode === 'campaign') {
                const payload = {
                    title: form.title,
                    message_body: form.message_body,
                    channel: form.channel,
                    sender_id: form.sender_id || undefined,
                    message_type: form.message_type,
                    group_ids: form.group_ids,
                    scheduled_at: form.sendMode === 'schedule' && form.scheduled_at ? form.scheduled_at : undefined,
                };
                const { data } = await api.post('/messages/send', payload);
                toast.success(`Campaign queued! ${data.queued} messages scheduled.`);
                navigate('/app/analytics');
            } else {
                const payload = {
                    target_phones: form.target_phones,
                    message_body: form.message_body,
                    channel: form.channel,
                    sender_id: form.sender_id || undefined,
                    message_type: form.message_type
                };
                const { data } = await api.post('/messages/instant', payload);
                toast.success(`Sent successfully to ${data.count || 1} contact(s)!`);
                setForm(f => ({ ...f, target_phones: '', message_body: '' }));
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send message');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {mode === 'campaign' ? 'Compose Campaign' : 'Send Instant Message'}
                    </div>
                    <div className="page-subtitle">
                        {mode === 'campaign' ? 'Write your message and choose your audience' : 'Send a direct message to a single number right now'}
                    </div>
                </div>
            </div>

            <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
                {/* Left: Main form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Campaign title */}
                    {mode === 'campaign' && (
                        <div className="card">
                            <div style={{ marginBottom: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Type size={16} style={{ color: 'var(--clr-accent)' }} />
                                Campaign Details
                            </div>
                            <div className="form-group">
                                <label className="form-label">Campaign Title *</label>
                                <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Black Friday Sale Announcement" required={mode === 'campaign'} />
                            </div>
                        </div>
                    )}

                    <div className="card">
                        <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 14 }}>Settings</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Gateway Route</label>
                                <select className="form-input" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                                    <option value="generic">SMS (Generic/Promotional)</option>
                                    <option value="dnd">SMS (DND/Transactional)</option>
                                    <option value="whatsapp">WhatsApp</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Sender ID / Mask</label>
                                <select className="form-input" value={form.sender_id} onChange={e => setForm(f => ({ ...f, sender_id: e.target.value }))}>
                                    <option value="">-- Use Default --</option>
                                    {senderIds.map((s, idx) => (
                                        <option key={idx} value={s.sender_id}>{s.sender_id}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Message body */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <MessageSquare size={16} style={{ color: 'var(--clr-accent)' }} />
                                Message Body
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {['first_name', 'last_name', 'phone'].map(v => (
                                    <button key={v} type="button" className="btn btn-secondary btn-sm" onClick={() => insertVar(v)}>
                                        {`{{${v}}}`}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <textarea
                            className="form-textarea"
                            style={{ minHeight: 160 }}
                            value={form.message_body}
                            onChange={e => setForm(f => ({ ...f, message_body: e.target.value }))}
                            placeholder={`Hello {{first_name}}, we have an exclusive offer for you!`}
                            required
                        />
                        <CharCounter text={form.message_body} />

                        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                            <label className="form-label" style={{ marginBottom: 0 }}>Message Type:</label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                                <input type="radio" value="plain" checked={form.message_type === 'plain'} onChange={e => setForm(f => ({ ...f, message_type: e.target.value }))} style={{ accentColor: 'var(--clr-accent)' }} /> Plain
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                                <input type="radio" value="unicode" checked={form.message_type === 'unicode'} onChange={e => setForm(f => ({ ...f, message_type: e.target.value }))} style={{ accentColor: 'var(--clr-accent)' }} /> Unicode
                            </label>
                        </div>
                    </div>

                    {/* Schedule toggle */}
                    {mode === 'campaign' && (
                        <div className="card">
                            <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 14 }}>Send Timing</div>
                            <div className="toggle-group" style={{ marginBottom: 16 }}>
                                <button type="button" className={`toggle-btn ${form.sendMode === 'now' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, sendMode: 'now' }))}>
                                    ⚡ Send Now
                                </button>
                                <button type="button" className={`toggle-btn ${form.sendMode === 'schedule' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, sendMode: 'schedule' }))}>
                                    🕐 Schedule
                                </button>
                            </div>
                            {form.sendMode === 'schedule' && (
                                <div className="form-group">
                                    <label className="form-label">Schedule Date &amp; Time</label>
                                    <input
                                        className="form-input"
                                        type="datetime-local"
                                        value={form.scheduled_at}
                                        onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                                        min={new Date().toISOString().slice(0, 16)}
                                        required
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Audience + Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Audience */}
                    {mode === 'campaign' ? (
                        <div className="card">
                            <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 14 }}>Select Audience *</div>
                            {groups.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--clr-text-2)', textAlign: 'center', padding: '20px 0' }}>
                                    No groups yet. Create groups first.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {groups.map(g => (
                                        <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: form.group_ids.includes(g.id) ? 'var(--clr-accent-dim)' : 'var(--clr-surface-2)', border: `1px solid ${form.group_ids.includes(g.id) ? 'var(--clr-accent-glow)' : 'var(--clr-border)'}`, transition: 'all 0.15s' }}>
                                            <input
                                                type="checkbox"
                                                checked={form.group_ids.includes(g.id)}
                                                onChange={() => toggleGroup(g.id)}
                                                style={{ accentColor: 'var(--clr-accent)' }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 14, fontWeight: 500 }}>{g.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>{Number(g.contact_count).toLocaleString()} contacts</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                            {form.group_ids.length > 0 && (
                                <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--clr-surface-2)', borderRadius: 8, fontSize: 13, color: 'var(--clr-accent)' }}>
                                    ~{groups.filter(g => form.group_ids.includes(g.id)).reduce((a, g) => a + Number(g.contact_count), 0).toLocaleString()} recipients
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card">
                            <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 14 }}>Target Numbers *</div>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>Comma separated or new line isolated</label>
                                <textarea
                                    className="form-textarea"
                                    style={{ fontFamily: 'monospace', minHeight: '120px' }}
                                    value={form.target_phones}
                                    onChange={e => setForm(f => ({ ...f, target_phones: e.target.value.replace(/[^0-9,\n\s]/g, '') }))}
                                    placeholder="e.g. 2348012345678, 2349012345678"
                                    required={mode === 'instant'}
                                />
                                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 8 }}>
                                    Found ~{form.target_phones.split(/[,\s]+/).filter(Boolean).length} valid numbers
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Live Preview */}
                    {preview && (
                        <div className="card">
                            <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>Preview</div>
                            <div style={{
                                background: 'var(--clr-surface-2)',
                                border: '1px solid var(--clr-border)',
                                borderRadius: 12,
                                padding: '14px 16px',
                                fontSize: 14, lineHeight: 1.6,
                                color: 'var(--clr-text-2)',
                                fontStyle: 'italic'
                            }}>
                                &quot;{preview}&quot;
                            </div>
                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--clr-text-3)' }}>
                                Shown with sample data: John Doe / 2348012345678
                            </div>
                        </div>
                    )}

                    {/* Send Button */}
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }} disabled={loading}>
                        {loading
                            ? <><span className="spinner" style={{ width: 16, height: 16 }} /> {mode === 'campaign' ? 'Queuing...' : 'Sending...'}</>
                            : <><Send size={16} /> {mode === 'instant' ? 'Send Instant Message' : form.sendMode === 'schedule' ? 'Schedule Campaign' : 'Send Campaign'}</>
                        }
                    </button>
                </div>
            </form>
        </>
    );
}
