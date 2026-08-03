import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LoggingCenter({ 
  activePerson, 
  profiles, 
  onAddSession, 
  todayMins, 
  dailyGoalMins 
}) {
  const [activeTab, setActiveTab] = useState('timer'); // 'timer' or 'manual'
  
  // Timer State
  const [isRunning, setIsRunning] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [targetDurationMins, setTargetDurationMins] = useState(25); // Pomodoro default
  const [timerSubject, setTimerSubject] = useState('Data Structures & Algorithms');
  const [timerNote, setTimerNote] = useState('');
  
  // Manual Entry State
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualHours, setManualHours] = useState('1');
  const [manualMins, setManualMins] = useState('30');
  const [manualSubject, setManualSubject] = useState('System Design & Architecture');
  const [manualNote, setManualNote] = useState('Reviewed core distributed design principles.');
  
  const timerRef = useRef(null);

  const currentProfile = profiles[activePerson];
  const isP1 = activePerson === 'p1';
  const primaryBtnClass = isP1 ? 'btn-primary-p1' : 'btn-primary-p2';

  // Stopwatch interval
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsElapsed(prev => {
          const next = prev + 1;
          // Trigger confetti automatically when target preset goal time is reached exactly
          if (targetDurationMins > 0 && next === targetDurationMins * 60) {
            confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, targetDurationMins]);

  const handleStartPause = () => {
    setIsRunning(!isRunning);
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setSecondsElapsed(0);
  };

  const handleFinishTimer = () => {
    setIsRunning(false);
    const totalMins = Math.max(1, Math.round(secondsElapsed / 60));
    
    const newSession = {
      personId: activePerson,
      date: new Date().toISOString().split('T')[0],
      durationMins: totalMins,
      subject: timerSubject || 'General Study',
      note: timerNote || 'Completed live focus session.'
    };

    onAddSession(newSession, `🎉 Logged ${totalMins} mins for ${currentProfile.name}! Keep the momentum going!`);
    
    // Check if they crossed daily goal with this session!
    if (todayMins < dailyGoalMins && (todayMins + totalMins) >= dailyGoalMins) {
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
    } else {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    }

    setSecondsElapsed(0);
    setTimerNote('');
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const totalMins = (Number(manualHours) * 60) + Number(manualMins);
    if (totalMins <= 0) {
      alert('Please enter a duration greater than 0 minutes.');
      return;
    }

    const newSession = {
      personId: activePerson,
      date: manualDate,
      durationMins: totalMins,
      subject: manualSubject || 'General Study',
      note: manualNote || ''
    };

    onAddSession(newSession, `✨ Saved ${totalMins}m study session for ${currentProfile.name}!`);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    
    // Reset inputs slightly
    setManualNote('');
  };

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const subjects = [
    'Data Structures & Algorithms',
    'System Design & Architecture',
    'Machine Learning & AI',
    'React & Frontend Architecture',
    'Calculus III & Mathematics',
    'Spanish Vocabulary & Grammar',
    'General Focus & Research'
  ];

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Decorative colored top header accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: isP1 ? 'var(--p1-gradient)' : 'var(--p2-gradient)'
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.75rem' }}>{currentProfile.avatar}</span>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Log Session for {currentProfile.name}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Choose a live study timer or log completed hours manually.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="tabs-container" style={{ width: 'auto', minWidth: '260px' }}>
          <button
            className={`tab-btn ${activeTab === 'timer' ? 'active' : ''}`}
            onClick={() => setActiveTab('timer')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}
          >
            <Clock size={16} /> Live Timer
          </button>
          <button
            className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveTab('manual')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}
          >
            <Calendar size={16} /> Manual Entry
          </button>
        </div>
      </div>

      {activeTab === 'timer' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'center', marginTop: '1rem' }}>
          {/* Digital Timer Face & Controls */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: isRunning ? (isP1 ? 'var(--shadow-glow-p1)' : 'var(--shadow-glow-p2)') : 'none',
            transition: 'all 0.3s ease'
          }}>
            <span className={isP1 ? 'badge badge-p1' : 'badge badge-p2'} style={{ marginBottom: '1rem' }}>
              {isRunning ? '🔥 Focus Mode Active' : '⏱️ Ready to Study'}
            </span>
            
            <div style={{
              fontSize: '3.5rem',
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: '-0.02em',
              color: isRunning ? (isP1 ? 'var(--p1-color)' : 'var(--p2-color)') : 'var(--text-primary)',
              margin: '0.5rem 0 1.5rem',
              textAlign: 'center'
            }}>
              {formatTime(secondsElapsed)}
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Pomodoro (25m)', val: 25 },
                { label: 'Deep Focus (50m)', val: 50 },
                { label: 'Marathon (90m)', val: 90 },
                { label: 'Count-Up', val: 0 }
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setTargetDurationMins(preset.val);
                    if (!isRunning && preset.val > 0) {
                      // Just preset indicator
                    }
                  }}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '0.5rem',
                    background: targetDurationMins === preset.val ? (isP1 ? 'var(--p1-light)' : 'var(--p2-light)') : 'var(--bg-secondary)',
                    border: `1px solid ${targetDurationMins === preset.val ? (isP1 ? 'var(--p1-color)' : 'var(--p2-color)') : 'var(--border-color)'}`,
                    color: targetDurationMins === preset.val ? (isP1 ? 'var(--p1-dark)' : 'var(--p2-dark)') : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Control Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleStartPause}
                className={`btn ${isRunning ? 'btn-secondary' : primaryBtnClass}`}
                style={{ flex: 1, maxWidth: '160px' }}
              >
                {isRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> {secondsElapsed > 0 ? 'Resume' : 'Start'}</>}
              </button>

              {secondsElapsed > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleFinishTimer}
                    className="btn btn-secondary"
                    style={{ background: 'var(--success)', color: 'white', borderColor: 'var(--success)', flex: 1, maxWidth: '160px' }}
                  >
                    <CheckCircle2 size={18} /> Finish & Log
                  </button>

                  <button
                    type="button"
                    onClick={handleResetTimer}
                    className="btn btn-ghost"
                    title="Reset Timer"
                  >
                    <Square size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Session Details Form */}
          <div>
            <div className="input-group">
              <label className="input-label">Study Subject / Category</label>
              <select
                className={`select-field ${!isP1 ? 'p2-focus' : ''}`}
                value={timerSubject}
                onChange={(e) => setTimerSubject(e.target.value)}
              >
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Session Notes & Accomplishments (Optional)</label>
              <textarea
                rows="4"
                className={`textarea-field ${!isP1 ? 'p2-focus' : ''}`}
                placeholder="What did you learn today? Any breakthrough moments or problems solved?"
                value={timerNote}
                onChange={(e) => setTimerNote(e.target.value)}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <Sparkles size={14} color={isP1 ? '#F59E0B' : '#06B6D4'} />
              <span>Tip: Completing sessions fuels your streak and moves you ahead on the friendly weekly leaderboard!</span>
            </div>
          </div>
        </div>
      ) : (
        /* Manual Entry Form */
        <form onSubmit={handleManualSubmit} style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <div className="input-group">
              <label className="input-label">Study Date</label>
              <input
                type="date"
                className={`input-field ${!isP1 ? 'p2-focus' : ''}`}
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Hours</label>
              <input
                type="number"
                min="0"
                max="24"
                className={`input-field ${!isP1 ? 'p2-focus' : ''}`}
                value={manualHours}
                onChange={e => setManualHours(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                className={`input-field ${!isP1 ? 'p2-focus' : ''}`}
                value={manualMins}
                onChange={e => setManualMins(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Study Subject / Category</label>
            <select
              className={`select-field ${!isP1 ? 'p2-focus' : ''}`}
              value={manualSubject}
              onChange={e => setManualSubject(e.target.value)}
            >
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Session Notes & Key Accomplishments</label>
            <textarea
              rows="3"
              className={`textarea-field ${!isP1 ? 'p2-focus' : ''}`}
              placeholder="Summary of what you worked on during this past session..."
              value={manualNote}
              onChange={e => setManualNote(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button type="submit" className={`btn ${primaryBtnClass}`} style={{ minWidth: '180px' }}>
              <CheckCircle2 size={18} /> Save Session Record
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
