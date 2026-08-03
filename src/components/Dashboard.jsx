import React, { useState } from 'react';
import { supabase, isCloudEnabled, saveCustomSupabaseConfig } from '../lib/supabase';

export default function Dashboard({ user, onLogout, onJoinRoom }) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  
  // Supabase Custom Config state
  const [customUrl, setCustomUrl] = useState(localStorage.getItem('study_supabase_url') || '');
  const [customKey, setCustomKey] = useState(localStorage.getItem('study_supabase_key') || '');

  const activeRoomCode = localStorage.getItem('last_active_room_code');

  // Compute actual local streak count and completed calendar days
  const getStreakData = () => {
    let sessions = [];
    try {
      const stored = localStorage.getItem(`sessions_${user.id}`);
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) sessions = parsed;
    } catch {
      sessions = [];
    }
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return { streak: 0, completedDays: [] };
    }
    const doneSessions = sessions.filter(s => s && s.objectiveCompleted);
    const completedDays = doneSessions.map(s => {
      const d = new Date(s.date);
      return !isNaN(d) ? d.getDate() : null;
    }).filter(d => d !== null);

    return { 
      streak: doneSessions.length, 
      completedDays 
    };
  };

  const { streak, completedDays } = getStreakData();

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');
    
    // Generate simple shareable 6-character code
    const words = ['ZEN', 'FOCUS', 'STUDY', 'CALM', 'QUIET', 'MIND'];
    const word = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(10 + Math.random() * 89);
    const code = `${word}-${num}`;

    try {
      if (isCloudEnabled && supabase) {
        const { error: dbErr } = await supabase
          .from('rooms')
          .insert([{ room_code: code, created_by: user.id }]);
        
        if (dbErr && dbErr.code !== '23505') {
          console.error('Error saving room to Postgres:', dbErr);
        }
      }
      localStorage.setItem('last_active_room_code', code);
      onJoinRoom(code);
    } catch {
      setError('Unable to create study room.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    if (isCloudEnabled && supabase) {
      await supabase.from('rooms').select('room_code').eq('room_code', cleanCode).maybeSingle();
      // Even if room not found in DB yet, allow joining directly to make ad-hoc sync seamless!
    }

    localStorage.setItem('last_active_room_code', cleanCode);
    onJoinRoom(cleanCode);
  };

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const currentDay = new Date().getDate();

  return (
    <div className="page-wrapper">
      {/* Top Quiet Nav */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>StudyRoom</h1>
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>Logged in as {user.name}</span>
        </div>

        <button onClick={onLogout} className="btn btn-subtle" style={{ fontSize: '0.85rem' }}>
          Log out
        </button>
      </header>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-subtle)', border: '1px solid #EF4444', borderRadius: 'var(--radius)', color: '#EF4444', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Main Options Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        
        {/* Left Column: Room Action Panel */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 className="heading-sub" style={{ marginBottom: '1.5rem' }}>Join or Create a Room</h2>

            {activeRoomCode && (
              <div style={{ marginBottom: '1.75rem', padding: '1rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>ACTIVE STUDY SESSION</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{activeRoomCode}</span>
                  <button onClick={() => onJoinRoom(activeRoomCode)} className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
                    Rejoin Room →
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleJoinSubmit} style={{ marginBottom: '1.5rem' }}>
              <div className="field-group" style={{ marginBottom: '0.75rem' }}>
                <label className="field-label">Enter Room Code</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="e.g. ZEN-44"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    className="field-input mono"
                    style={{ textTransform: 'uppercase' }}
                  />
                  <button type="submit" className="btn" style={{ whiteSpace: 'nowrap' }}>
                    Join
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', textAlign: 'center' }}>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>Want to start a new collaborative session?</p>
            <button 
              onClick={handleCreateRoom} 
              disabled={loading}
              className="btn btn-primary" 
              style={{ width: '100%', padding: '0.75rem' }}
            >
              Create a New Room
            </button>
          </div>
        </div>

        {/* Right Column: Streak & Calendar Preview */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem' }}>
            <h3 className="heading-sub">Your Focus Calendar</h3>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--calendar-done)', background: 'rgba(245, 158, 11, 0.15)', padding: '0.2rem 0.65rem', borderRadius: '999px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              🏆 {streak}-day streak
            </span>
          </div>

          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Days where your focus objective was marked complete are highlighted below in golden yellow.
          </p>

          {/* Compact Month View Calendar */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: '0.35rem',
            background: 'var(--bg-subtle)',
            padding: '0.85rem',
            borderRadius: 'var(--radius)',
            marginTop: 'auto'
          }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
              <div key={`d-${idx}`} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '0.2rem' }}>
                {day}
              </div>
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => {
              const isDone = completedDays.includes(dayNum);
              const isPastOrToday = dayNum <= currentDay;
              const isToday = dayNum === currentDay;

              return (
                <div 
                  key={`day-${dayNum}`}
                  style={{
                    aspectRatio: '1/1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    borderRadius: '0.25rem',
                    background: isDone ? 'var(--calendar-done)' : (isPastOrToday ? 'var(--status-studying)' : 'transparent'),
                    color: isDone ? 'var(--calendar-done-text)' : (isPastOrToday ? '#0C0A09' : 'var(--text-muted)'),
                    fontWeight: isPastOrToday || isDone ? 700 : 400,
                    border: isToday && !isDone ? '2px solid #0C0A09' : 'none',
                    boxShadow: isPastOrToday || isDone ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                    opacity: dayNum > currentDay ? 0.35 : 1
                  }}
                  title={isDone ? `Day ${dayNum}: Objective completed 🏆` : (isPastOrToday ? `Day ${dayNum}: No objective completed yet` : `Day ${dayNum}`)}
                >
                  {dayNum}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Cloud Sync Configuration Footer */}
      <footer style={{ marginTop: 'auto', textAlign: 'center', padding: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
        <span className="text-muted">
          Sync status: <strong style={{ color: isCloudEnabled ? 'var(--accent)' : 'var(--text-main)' }}>{isCloudEnabled ? 'Supabase Online Sync' : 'Local Multi-Tab Sync'}</strong>
        </span>
        <button onClick={() => setShowConfig(!showConfig)} className="btn btn-subtle" style={{ marginLeft: '0.5rem', textDecoration: 'underline' }}>
          {showConfig ? 'Hide Cloud Setup' : 'Configure Supabase'}
        </button>

        {showConfig && (
          <div style={{ maxWidth: '460px', margin: '1rem auto 0', textAlign: 'left', background: 'var(--bg-panel)', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Link to your Free Supabase Database</div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
              Paste your project URL and Anon Key to enable cross-device live study synchronization across the internet.
            </p>

            <div className="field-group" style={{ marginBottom: '0.75rem' }}>
              <label className="field-label">Project URL</label>
              <input type="text" placeholder="https://xyz.supabase.co" value={customUrl} onChange={e => setCustomUrl(e.target.value)} className="field-input" style={{ fontSize: '0.85rem' }} />
            </div>

            <div className="field-group" style={{ marginBottom: '1rem' }}>
              <label className="field-label">Anon Key</label>
              <input type="password" placeholder="eyJh..." value={customKey} onChange={e => setCustomKey(e.target.value)} className="field-input" style={{ fontSize: '0.85rem' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => saveCustomSupabaseConfig('', '')} className="btn" style={{ fontSize: '0.8rem' }}>Reset / Local Mode</button>
              <button onClick={() => saveCustomSupabaseConfig(customUrl, customKey)} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>Save & Reload</button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
