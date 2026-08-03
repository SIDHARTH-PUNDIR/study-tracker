import React, { useState } from 'react';
import { History, Search, Edit2, Trash2, Calendar, Clock, Check, X } from 'lucide-react';

export default function HistoryFeed({ 
  sessions, 
  profiles, 
  onUpdateSession, 
  onDeleteSession 
}) {
  const [filterPerson, setFilterPerson] = useState('all'); // 'all', 'p1', 'p2'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSession, setEditingSession] = useState(null);

  // Edit Form State
  const [editDate, setEditDate] = useState('');
  const [editDuration, setEditDuration] = useState(0);
  const [editSubject, setEditSubject] = useState('');
  const [editNote, setEditNote] = useState('');

  const p1 = profiles.p1;
  const p2 = profiles.p2;

  const filteredSessions = sessions
    .filter(s => {
      if (filterPerson === 'p1') return s.personId === 'p1';
      if (filterPerson === 'p2') return s.personId === 'p2';
      return true;
    })
    .filter(s => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (s.subject || '').toLowerCase().includes(q) ||
        (s.note || '').toLowerCase().includes(q) ||
        (profiles[s.personId]?.name || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const startEditing = (s) => {
    setEditingSession(s);
    setEditDate(s.date);
    setEditDuration(s.durationMins);
    setEditSubject(s.subject);
    setEditNote(s.note || '');
  };

  const cancelEditing = () => {
    setEditingSession(null);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (editDuration <= 0) {
      alert("Duration must be greater than 0 minutes.");
      return;
    }
    const updated = {
      ...editingSession,
      date: editDate,
      durationMins: Number(editDuration),
      subject: editSubject,
      note: editNote
    };
    onUpdateSession(updated);
    setEditingSession(null);
  };

  const formatHrsMins = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}` : `${m}m`;
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>
            <History size={22} color="#06B6D4" /> Activity Log & History
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Review, edit, or remove past study sessions recorded by both friends.
          </p>
        </div>

        {/* Filter Pill & Search Bar */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: '1', minWidth: '300px', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', minWidth: '180px', flex: '1', maxWidth: '280px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search subject or notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.25rem', paddingRight: '0.75rem', fontSize: '0.85rem' }}
            />
          </div>

          <div className="tabs-container" style={{ width: 'auto' }}>
            <button
              className={`tab-btn ${filterPerson === 'all' ? 'active' : ''}`}
              onClick={() => setFilterPerson('all')}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            >
              All ({sessions.length})
            </button>
            <button
              className={`tab-btn ${filterPerson === 'p1' ? 'active' : ''}`}
              onClick={() => setFilterPerson('p1')}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: 'var(--p1-dark)' }}
            >
              {p1.avatar} {p1.name}
            </button>
            <button
              className={`tab-btn ${filterPerson === 'p2' ? 'active' : ''}`}
              onClick={() => setFilterPerson('p2')}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: 'var(--p2-dark)' }}
            >
              {p2.avatar} {p2.name}
            </button>
          </div>
        </div>
      </div>

      {/* Session Timeline Feed */}
      {filteredSessions.length === 0 ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
          <History size={36} style={{ opacity: 0.5, margin: '0 auto 0.75rem' }} />
          <p style={{ fontWeight: 600, fontSize: '1rem' }}>No study sessions found matching your filter.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Try modifying your search or start a focus timer to log your first record!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '540px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {filteredSessions.map((session) => {
            const profile = profiles[session.personId] || profiles.p1;
            const isP1 = session.personId === 'p1';
            const badgeClass = isP1 ? 'badge badge-p1' : 'badge badge-p2';

            return (
              <div
                key={session.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '1rem',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  transition: 'var(--transition)'
                }}
              >
                <div style={{ display: 'flex', gap: '0.85rem', flex: 1 }}>
                  {/* Avatar box */}
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: isP1 ? 'var(--p1-light)' : 'var(--p2-light)',
                    border: `1px solid ${isP1 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    flexShrink: 0
                  }}>
                    {profile.avatar}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {profile.name}
                      </span>
                      <span className={badgeClass} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                        <Clock size={12} /> {formatHrsMins(session.durationMins)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={12} /> {session.date}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isP1 ? 'var(--p1-dark)' : 'var(--p2-dark)', marginBottom: session.note ? '0.35rem' : '0' }}>
                      {session.subject}
                    </div>

                    {session.note && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', background: 'var(--bg-card)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginTop: '0.4rem' }}>
                        "{session.note}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Edit & Delete Action Buttons */}
                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => startEditing(session)}
                    className="btn-ghost"
                    title="Edit Session"
                    style={{ padding: '0.4rem' }}
                  >
                    <Edit2 size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete this ${formatHrsMins(session.durationMins)} session for ${profile.name}?`)) {
                        onDeleteSession(session.id);
                      }
                    }}
                    className="btn-ghost"
                    title="Delete Session"
                    style={{ padding: '0.4rem', color: 'var(--danger)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingSession && (
        <div className="modal-overlay" onClick={cancelEditing}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={20} color="#06B6D4" /> Edit Study Session
              </h3>
              <button className="btn-ghost" onClick={cancelEditing}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="input-group">
                <label className="input-label">Study Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Duration (Total Minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  className="input-field"
                  value={editDuration}
                  onChange={e => setEditDuration(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Subject / Category</label>
                <input
                  type="text"
                  className="input-field"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Session Notes</label>
                <textarea
                  rows="3"
                  className="textarea-field"
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={cancelEditing}>Cancel</button>
                <button type="submit" className="btn btn-primary-p1" style={{ minWidth: '120px' }}>
                  <Check size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
