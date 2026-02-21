import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Send, MessageSquare, Type } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

export default function ComposePage() {
    const navigate = useNavigate();
    const [groups, setGroups] = useState([]);
    const [form, setForm] = useState({
        title: '',
        message_body: '',
        channel: 'sms',
        group_ids: [],
        sendMode: 'now',
        scheduled_at: '',
    });
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState('');

    useEffect(() => {
        api.get('/groups').then(r => setGroups(r.data));
    }, []);

    useEffect(() => {
        setPreview(
            form.message_body
                .replace(/\{\{first_name\}\}/gi, 'John')
                .replace(/\{\{last_name\}\}/gi, 'Doe')
                .replace(/\{\{phone\}\}/gi, '2348012345678')
        );
    }, [form.message_body]);

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
        if (!form.title.trim()) return toast.error('Campaign title is required');
        if (!form.message_body.trim()) return toast.error('Message body is required');
        if (!form.group_ids.length) return toast.error('Select at least one group');

        setLoading(true);
        try {
            const payload = {
                title: form.title,
                message_body: form.message_body,
                channel: form.channel,
                group_ids: form.group_ids,
                scheduled_at: form.sendMode === 'schedule' && form.scheduled_at ? form.scheduled_at : undefined,
            };
            const { data } = await api.post('/messages/send', payload);
            toast.success(`Campaign queued! ${data.queued} messages scheduled.`);
            navigate('/app/analytics');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send campaign');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <div className="page-title">Compose Campaign</div>
                    <div className="page-subtitle">Write your message and choose your audience</div>
                </div>
            </div>

            <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
                {/* Left: Main form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Campaign title */}
                    <div className="card">
                        <div style={{ marginBottom: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Type size={16} style={{ color: 'var(--clr-accent)' }} />
                            Campaign Details
                        </div>
                        <div className="form-group">
                            <label className="form-label">Campaign Title *</label>
                            <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Black Friday Sale Announcement" required />
                        </div>
                    </div>

                    {/* Channel toggle */}
                    <div className="card">
                        <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 14 }}>Channel</div>
                        <div className="toggle-group">
                            <button type="button" className={`toggle-btn ${form.channel === 'sms' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, channel: 'sms' }))}>
                                📱 SMS
                            </button>
                            <button type="button" className={`toggle-btn ${form.channel === 'whatsapp' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, channel: 'whatsapp' }))}>
                                💬 WhatsApp
                            </button>
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
                    </div>

                    {/* Schedule toggle */}
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
                </div>

                {/* Right: Audience + Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Audience */}
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
                                "{preview}"
                            </div>
                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--clr-text-3)' }}>
                                Shown with sample data: John Doe / 2348012345678
                            </div>
                        </div>
                    )}

                    {/* Send Button */}
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }} disabled={loading}>
                        {loading
                            ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Queuing messages…</>
                            : <><Send size={16} /> {form.sendMode === 'schedule' ? 'Schedule Campaign' : 'Send Campaign'}</>
                        }
                    </button>
                </div>
            </form>
        </>
    );
}
