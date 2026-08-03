import React, { useState } from 'react';
import { BookOpen, Moon, Sun, Settings, Sparkles, RefreshCw, Check } from 'lucide-react';
import { saveProfiles, resetToDemoData } from '../utils/storage';
import confetti from 'canvas-confetti';

export default function Navbar({ 
  profiles, 
  setProfiles, 
  activePerson, 
  setActivePerson, 
  darkMode, 
  setDarkMode,
  onResetData 
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [editProfiles, setEditProfiles] = useState(profiles);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    saveProfiles(editProfiles);
    setProfiles(editProfiles);
    setSaveSuccess(true);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.2 } });
    setTimeout(() => {
      setSaveSuccess(false);
      setShowSettings(false);
    }, 800);
  };

  const handleResetDemo = () => {
    if (window.confirm("Reload demo sample data? This will replace current study records with interactive seed sessions.")) {
      const reset = resetToDemoData();
      setProfiles(reset.profiles);
      setEditProfiles(reset.profiles);
      onResetData(reset.sessions);
      setShowSettings(false);
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 } });
    }
  };

  const p1 = profiles.p1;
  const p2 = profiles.p2;

  const avatars = ['🦊', '🐬', '🦁', '🦄', '🐲', '🚀', '⭐', '🦖', '🦉', '🎓'];

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 1.5rem',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(16px)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      {/* Brand Logo & Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #F59E0B 0%, #06B6D4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
        }}>
          <BookOpen size={24} strokeWidth={2.5} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #F59E0B, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            StudySync
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Friendly Accountability Tracker
          </p>
        </div>
      </div>

      {/* Profile Selector Toggle Pill */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-primary)',
        padding: '0.35rem',
        borderRadius: '999px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0.75rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Sparkles size={14} color="#F59E0B" /> Logging for:
        </span>
        
        <button
          onClick={() => setActivePerson('p1')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 1rem',
            borderRadius: '999px',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: activePerson === 'p1' ? 'var(--p1-gradient)' : 'transparent',
            color: activePerson === 'p1' ? 'white' : 'var(--text-secondary)',
            boxShadow: activePerson === 'p1' ? '0 2px 8px rgba(245, 158, 11, 0.35)' : 'none'
          }}
        >
          <span>{p1.avatar}</span>
          <span>{p1.name}</span>
        </button>

        <button
          onClick={() => setActivePerson('p2')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 1rem',
            borderRadius: '999px',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: activePerson === 'p2' ? 'var(--p2-gradient)' : 'transparent',
            color: activePerson === 'p2' ? 'white' : 'var(--text-secondary)',
            boxShadow: activePerson === 'p2' ? '0 2px 8px rgba(6, 182, 212, 0.35)' : 'none'
          }}
        >
          <span>{p2.avatar}</span>
          <span>{p2.name}</span>
        </button>
      </div>

      {/* Action Icons (Theme Toggle & Settings Modal) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="btn-ghost"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}
        >
          {darkMode ? <Sun size={20} color="#F59E0B" /> : <Moon size={20} />}
        </button>

        <button
          onClick={() => {
            setEditProfiles(profiles);
            setShowSettings(true);
          }}
          className="btn-secondary"
          style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Settings size={16} />
          <span>Profiles & Goals</span>
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={22} color="#F59E0B" /> Customize Friends & Goals
              </h2>
              <button className="btn-ghost" onClick={() => setShowSettings(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveSettings}>
              {/* Friend 1 Settings */}
              <div style={{ padding: '1rem', background: 'var(--p1-light)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', border: '1px solid rgba(245,158,11,0.2)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--p1-dark)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>{editProfiles.p1.avatar}</span> Friend 1 (Amber Theme)
                </h3>
                
                <div className="input-group">
                  <label className="input-label">Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editProfiles.p1.name}
                    onChange={e => setEditProfiles({ ...editProfiles, p1: { ...editProfiles.p1, name: e.target.value } })}
                    required
                  />
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem' }}>Choose Avatar</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {avatars.map(emoji => (
                      <button
                        type="button"
                        key={`p1-${emoji}`}
                        onClick={() => setEditProfiles({ ...editProfiles, p1: { ...editProfiles.p1, avatar: emoji } })}
                        style={{
                          padding: '0.4rem',
                          fontSize: '1.2rem',
                          background: editProfiles.p1.avatar === emoji ? 'var(--bg-secondary)' : 'transparent',
                          border: `1px solid ${editProfiles.p1.avatar === emoji ? '#F59E0B' : 'transparent'}`,
                          borderRadius: '0.5rem',
                          cursor: 'pointer'
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Daily Study Goal (minutes)</label>
                  <input
                    type="number"
                    min="15"
                    max="1440"
                    step="15"
                    className="input-field"
                    value={editProfiles.p1.dailyGoalMins}
                    onChange={e => setEditProfiles({ ...editProfiles, p1: { ...editProfiles.p1, dailyGoalMins: Number(e.target.value) } })}
                    required
                  />
                </div>
              </div>

              {/* Friend 2 Settings */}
              <div style={{ padding: '1rem', background: 'var(--p2-light)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid rgba(6,182,212,0.2)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--p2-dark)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>{editProfiles.p2.avatar}</span> Friend 2 (Teal Theme)
                </h3>
                
                <div className="input-group">
                  <label className="input-label">Name</label>
                  <input
                    type="text"
                    className="input-field p2-focus"
                    value={editProfiles.p2.name}
                    onChange={e => setEditProfiles({ ...editProfiles, p2: { ...editProfiles.p2, name: e.target.value } })}
                    required
                  />
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem' }}>Choose Avatar</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {avatars.map(emoji => (
                      <button
                        type="button"
                        key={`p2-${emoji}`}
                        onClick={() => setEditProfiles({ ...editProfiles, p2: { ...editProfiles.p2, avatar: emoji } })}
                        style={{
                          padding: '0.4rem',
                          fontSize: '1.2rem',
                          background: editProfiles.p2.avatar === emoji ? 'var(--bg-secondary)' : 'transparent',
                          border: `1px solid ${editProfiles.p2.avatar === emoji ? '#06B6D4' : 'transparent'}`,
                          borderRadius: '0.5rem',
                          cursor: 'pointer'
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Daily Study Goal (minutes)</label>
                  <input
                    type="number"
                    min="15"
                    max="1440"
                    step="15"
                    className="input-field p2-focus"
                    value={editProfiles.p2.dailyGoalMins}
                    onChange={e => setEditProfiles({ ...editProfiles, p2: { ...editProfiles.p2, dailyGoalMins: Number(e.target.value) } })}
                    required
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  <RefreshCw size={15} /> Load Demo Sample Data
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary-p1" style={{ minWidth: '120px' }}>
                    {saveSuccess ? <><Check size={18} /> Saved!</> : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
