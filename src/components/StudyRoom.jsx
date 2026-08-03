import React, { useState, useEffect, useRef } from 'react';
import { subscribeToRoomEvents } from '../lib/supabase';
import { isCloudEnabled, supabase } from '../lib/supabase';

const getSafeSessions = (userId) => {
  try {
    const stored = localStorage.getItem(`sessions_${userId}`);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function StudyRoom({ roomCode, user, onLeaveRoom, darkMode, setDarkMode }) {
  const userId = user?.id || 'guest';
  const userName = user?.name || 'Guest User';

  // Shared Timer State
  const [timerStatus, setTimerStatus] = useState('stopped'); // 'stopped' | 'running' | 'paused'
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerMode, setTimerMode] = useState('stopwatch'); // 'stopwatch' | 'countdown'
  const [targetDuration, setTargetDuration] = useState(50 * 60); // 50 mins default target

  // Live real-time ticker for room clock
  const [realTime, setRealTime] = useState(() => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));

  // Personal user state for today
  const [objectiveText, setObjectiveText] = useState(() => {
    try { return localStorage.getItem(`obj_text_${userId}_${roomCode}`) || ''; } catch { return ''; }
  });
  const [objectiveCompleted, setObjectiveCompleted] = useState(() => {
    try { return localStorage.getItem(`obj_done_${userId}_${roomCode}`) === 'true'; } catch { return false; }
  });
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [workStartTime] = useState(() => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }));
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  // Helper: Derive presence status automatically from break toggle & timer status
  const deriveStatus = (isBreak, tStatus) => {
    if (isBreak) return 'break';
    return tStatus === 'running' ? 'studying' : 'idle';
  };

  // Connected Members list (Initialized safely with current user so rendering never crashes)
  const [members, setMembers] = useState(() => ({
    [userId]: {
      userId,
      name: userName,
      status: 'idle',
      objectiveText: '',
      objectiveCompleted: false,
      workStartTime: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
      breakSeconds: 0
    }
  }));

  const channelRef = useRef(null);
  const timerRef = useRef(null);
  const breakTimerRef = useRef(null);
  const myProfileRef = useRef({ userId, name: userName });

  // 1. Live real-time clock ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTime(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Broadcast local profile presence state whenever it changes
  const broadcastMyState = (overrides = {}) => {
    const nextStatus = overrides.status !== undefined 
      ? overrides.status 
      : deriveStatus(isOnBreak, timerStatus);

    const myState = {
      userId,
      name: userName,
      status: nextStatus,
      objectiveText: overrides.objectiveText !== undefined ? overrides.objectiveText : objectiveText,
      objectiveCompleted: overrides.objectiveCompleted !== undefined ? overrides.objectiveCompleted : objectiveCompleted,
      workStartTime: overrides.workStartTime !== undefined ? overrides.workStartTime : workStartTime,
      breakSeconds: overrides.breakSeconds !== undefined ? overrides.breakSeconds : breakSeconds,
      updatedAt: Date.now()
    };

    setMembers(prev => ({ ...prev, [userId]: myState }));

    if (channelRef.current) {
      channelRef.current.broadcast('MEMBER_STATE_SYNC', myState);
    }

    // Persist objective completion to local session records for daily calendar highlights
    if (myState.objectiveCompleted !== objectiveCompleted) {
      const today = new Date().toISOString().split('T')[0];
      const sess = getSafeSessions(userId);
      const existingIdx = sess.findIndex(s => s && s.date === today);
      if (existingIdx >= 0) {
        sess[existingIdx].objectiveCompleted = myState.objectiveCompleted;
        sess[existingIdx].objectiveText = myState.objectiveText;
      } else {
        sess.push({ date: today, objectiveCompleted: myState.objectiveCompleted, objectiveText: myState.objectiveText });
      }
      try {
        localStorage.setItem(`sessions_${userId}`, JSON.stringify(sess));
      } catch {
        // ignore storage write errors
      }
    }
  };

  // Automatically update and broadcast our derived status when timer Status or Break shifts!
  useEffect(() => {
    const computed = deriveStatus(isOnBreak, timerStatus);
    const myCurrent = members[userId];
    if (!myCurrent || myCurrent.status !== computed) {
      broadcastMyState({ status: computed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStatus, isOnBreak]);

  // 3. Setup Realtime channels on mount
  useEffect(() => {
    const { userId: curId, name: curName } = myProfileRef.current;
    // Initial self state in member list
    const initialMe = {
      userId: curId,
      name: curName,
      status: deriveStatus(isOnBreak, timerStatus),
      objectiveText,
      objectiveCompleted,
      workStartTime,
      breakSeconds
    };
    setMembers(prev => ({ ...prev, [curId]: initialMe }));

    // Subscribe to broadcasts
    const channel = subscribeToRoomEvents(roomCode, (evt) => {
      if (!evt || !evt.event) return;
      const { event, payload } = evt;

      if (event === 'TIMER_UPDATE' && payload) {
        setTimerStatus(payload.status || 'stopped');
        if (typeof payload.elapsed === 'number') setElapsedSeconds(payload.elapsed);
        if (payload.mode) setTimerMode(payload.mode);
        if (typeof payload.targetDuration === 'number') setTargetDuration(payload.targetDuration);
      } else if (event === 'MEMBER_STATE_SYNC' && payload && payload.userId) {
        setMembers(prev => ({ ...prev, [payload.userId]: payload }));
      } else if (event === 'REQUEST_SYNC') {
        if (channelRef.current) {
          channelRef.current.broadcast('MEMBER_STATE_SYNC', initialMe);
        }
      }
    });

    channelRef.current = channel;

    // Announce entry and request current timer/member state from existing peers
    const timerId = setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.broadcast('MEMBER_STATE_SYNC', initialMe);
        channelRef.current.broadcast('REQUEST_SYNC', { newcomer: curId });
      }
    }, 400);

    return () => {
      clearTimeout(timerId);
      if (channelRef.current) {
        channelRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // 4. Shared Session Timer logic
  useEffect(() => {
    if (timerStatus === 'running') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          if (timerMode === 'countdown' && next >= targetDuration) {
            clearInterval(timerRef.current);
            setTimerStatus('stopped');
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('StudyRoom Target Reached', { body: 'Great job! Your focus countdown has ended.' });
            }
            return 0;
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerStatus, timerMode, targetDuration]);

  // 5. Break time accumulator logic
  useEffect(() => {
    if (isOnBreak) {
      breakTimerRef.current = setInterval(() => {
        setBreakSeconds(prev => {
          const next = prev + 1;
          if (next % 15 === 0) {
            if (channelRef.current) {
              channelRef.current.broadcast('MEMBER_STATE_SYNC', {
                ...members[myProfileRef.current.userId],
                breakSeconds: next
              });
            }
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(breakTimerRef.current);
    }
    return () => clearInterval(breakTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnBreak]);

  // Handlers for Shared Timer actions
  const handleTimerControl = (newStatus, customElapsed = elapsedSeconds) => {
    setConfirmReset(false);
    let effectiveTarget = targetDuration;
    if (newStatus === 'running' && timerMode === 'countdown' && effectiveTarget <= 0) {
      effectiveTarget = 25 * 60;
      setTargetDuration(effectiveTarget);
    }
    setTimerStatus(newStatus);
    setElapsedSeconds(customElapsed);
    
    if (channelRef.current) {
      channelRef.current.broadcast('TIMER_UPDATE', {
        status: newStatus,
        elapsed: customElapsed,
        mode: timerMode,
        targetDuration: effectiveTarget
      });
    }

    if (isCloudEnabled && supabase) {
      supabase.from('room_state').upsert({
        room_id: roomCode,
        timer_status: newStatus,
        timer_seconds: customElapsed
      }).catch(() => {});
    }
  };

  const handleUpdateTargetDuration = (newSeconds) => {
    const safeSeconds = Math.max(0, Math.min(24 * 3600, newSeconds));
    setTargetDuration(safeSeconds);
    if (channelRef.current) {
      channelRef.current.broadcast('TIMER_UPDATE', {
        status: timerStatus,
        elapsed: elapsedSeconds,
        mode: 'countdown',
        targetDuration: safeSeconds
      });
    }
  };

  const getTargetLabel = () => {
    const h = Math.floor(targetDuration / 3600);
    const m = Math.floor((targetDuration % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const handleResetClick = () => {
    if (timerStatus === 'running') return;
    if (!confirmReset && elapsedSeconds > 0) {
      setConfirmReset(true);
    } else {
      handleTimerControl('stopped', 0);
      setConfirmReset(false);
    }
  };

  const handleToggleBreak = () => {
    const newBreak = !isOnBreak;
    setIsOnBreak(newBreak);
    const newStatus = deriveStatus(newBreak, timerStatus);
    broadcastMyState({ status: newStatus });

    if (!newBreak && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const handleObjectiveChange = (text, done) => {
    setObjectiveText(text);
    setObjectiveCompleted(done);
    try {
      localStorage.setItem(`obj_text_${userId}_${roomCode}`, text);
      localStorage.setItem(`obj_done_${userId}_${roomCode}`, done.toString());
    } catch {
      // ignore
    }
    broadcastMyState({ objectiveText: text, objectiveCompleted: done });
  };

  // Helper formatting
  const formatTime = (totalSeconds) => {
    const safeSecs = typeof totalSeconds === 'number' && !isNaN(totalSeconds) ? Math.max(0, totalSeconds) : 0;
    const hrs = Math.floor(safeSecs / 3600);
    const mins = Math.floor((safeSecs % 3600) / 60);
    const secs = safeSecs % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getDisplayTime = () => {
    if (timerMode === 'countdown') {
      const remain = Math.max(0, targetDuration - elapsedSeconds);
      return formatTime(remain);
    }
    return formatTime(elapsedSeconds);
  };

  const currentDay = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const getStatusBadge = (status) => {
    if (status === 'break') return <span style={{ color: 'var(--status-break)', fontWeight: 600 }}>🟡 On break</span>;
    if (status === 'studying') return <span style={{ color: 'var(--status-studying)', fontWeight: 600 }}>🟢 Studying</span>;
    return <span style={{ color: 'var(--status-idle)', fontWeight: 600 }}>⚪ Idle</span>;
  };

  return (
    <div className="page-wrapper" style={{ padding: '2rem 1.5rem' }}>
      {/* Zen Room Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Shared Room
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em' }}>{roomCode}</h1>
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
              Live
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div className="font-mono" style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
            🕒 {realTime}
          </div>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="btn btn-subtle"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', minHeight: 'auto' }}
            title="Toggle Serene Dark Mode"
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button 
            onClick={onLeaveRoom}
            className="btn btn-subtle"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', minHeight: 'auto' }}
          >
            Leave room
          </button>
        </div>
      </header>

      {/* Main Focus Dashboard (Center aligned for immersion) */}
      <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Top Section: Shared Session Timer */}
        <section style={{ textAlign: 'center', padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Shared Room Timer ({timerMode === 'stopwatch' ? 'Count-Up' : `${getTargetLabel()} Target`})
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="font-mono" style={{ fontSize: '4.5rem', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: timerStatus === 'running' ? 'var(--text-main)' : 'var(--text-muted)' }}>
              {getDisplayTime()}
            </div>
            {timerStatus === 'running' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="live-dot" title="Session ticking in real-time" />
                <span style={{ fontSize: '0.65rem', color: 'var(--status-studying)', marginTop: '0.35rem', fontWeight: 600 }}>LIVE</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {timerStatus === 'stopped' || timerStatus === 'paused' ? (
              <button 
                onClick={() => handleTimerControl('running')} 
                className="btn btn-primary"
                style={{ minWidth: '130px' }}
              >
                {elapsedSeconds > 0 ? 'Resume Focus' : 'Start Focus'}
              </button>
            ) : (
              <button 
                onClick={() => handleTimerControl('paused')} 
                className="btn btn-subtle"
                style={{ minWidth: '130px', border: '1px solid var(--border-color)' }}
              >
                Pause Timer
              </button>
            )}

            <button 
              onClick={handleResetClick}
              disabled={timerStatus === 'running'}
              className="btn btn-subtle"
              style={{ 
                minWidth: '130px', 
                opacity: timerStatus === 'running' ? 0.4 : 1, 
                cursor: timerStatus === 'running' ? 'not-allowed' : 'pointer',
                borderColor: confirmReset ? '#D97706' : 'transparent',
                color: confirmReset ? 'var(--calendar-done)' : 'var(--text-main)',
                fontWeight: confirmReset ? 600 : 500
              }}
              title={timerStatus === 'running' ? 'Pause timer first to reset shared clock' : 'Reset timer for everyone in room'}
            >
              {timerStatus === 'running' ? 'Reset (Disabled)' : (confirmReset ? '⚠️ Confirm Reset?' : 'Reset Clock')}
            </button>

            <span style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: 'auto 0' }} />

            <button 
              onClick={() => {
                const mode = timerMode === 'stopwatch' ? 'countdown' : 'stopwatch';
                setTimerMode(mode);
                handleTimerControl('stopped', 0);
              }} 
              className="btn btn-subtle"
              style={{ fontSize: '0.85rem' }}
            >
              Mode: {timerMode === 'stopwatch' ? 'Count-Up' : `${getTargetLabel()} Countdown`}
            </button>
          </div>

          {timerMode === 'countdown' && (
            <div style={{ 
              marginTop: '1.75rem', 
              padding: '1.25rem', 
              background: 'var(--bg-subtle)', 
              borderRadius: 'var(--radius)', 
              border: '1px solid var(--border-color)',
              maxWidth: '620px',
              margin: '1.75rem auto 0.5rem auto',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <span>🎯 Customize Countdown Duration</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({getTargetLabel()})</span>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                {[
                  { label: '15m', secs: 15 * 60 },
                  { label: '25m (Pomodoro)', secs: 25 * 60 },
                  { label: '45m', secs: 45 * 60 },
                  { label: '50m', secs: 50 * 60 },
                  { label: '1h', secs: 60 * 60 },
                  { label: '1h 30m', secs: 90 * 60 },
                  { label: '2h', secs: 120 * 60 }
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => handleUpdateTargetDuration(preset.secs)}
                    className="btn btn-subtle"
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      minHeight: 'auto',
                      background: targetDuration === preset.secs ? 'var(--accent)' : 'var(--bg-panel)',
                      color: targetDuration === preset.secs ? '#FFFFFF' : 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      fontWeight: targetDuration === preset.secs ? 600 : 400
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Hours & Minutes Controls */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>Or custom target:</span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Hours:</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={Math.floor(targetDuration / 3600)}
                    onChange={(e) => {
                      const hrs = parseInt(e.target.value || '0', 10);
                      const mins = Math.floor((targetDuration % 3600) / 60);
                      handleUpdateTargetDuration((hrs * 3600) + (mins * 60));
                    }}
                    className="field-input"
                    style={{ width: '70px', padding: '0.4rem', textAlign: 'center', fontSize: '0.9rem', height: '36px', background: 'var(--bg-app)' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Minutes:</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={Math.floor((targetDuration % 3600) / 60)}
                    onChange={(e) => {
                      const mins = parseInt(e.target.value || '0', 10);
                      const hrs = Math.floor(targetDuration / 3600);
                      handleUpdateTargetDuration((hrs * 3600) + (mins * 60));
                    }}
                    className="field-input"
                    style={{ width: '70px', padding: '0.4rem', textAlign: 'center', fontSize: '0.9rem', height: '36px', background: 'var(--bg-app)' }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Middle Section: Personal Action Pad (Objective & Break Toggle) */}
        <section className="panel" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>Your Today's Objective</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Working since {workStartTime} • Total break today: {Math.floor(breakSeconds / 60)}m {breakSeconds % 60}s</span>
            </div>

            <button 
              onClick={handleToggleBreak}
              className="btn btn-subtle"
              style={{ 
                background: isOnBreak ? 'var(--status-break)' : 'var(--bg-panel)',
                color: isOnBreak ? '#0C0A09' : 'var(--text-main)',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem'
              }}
            >
              {isOnBreak ? '☕ Resume Focus' : 'Take a short break'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input 
              type="checkbox"
              checked={objectiveCompleted}
              onChange={(e) => handleObjectiveChange(objectiveText, e.target.checked)}
              style={{ width: '22px', height: '22px', accentColor: 'var(--calendar-done)', cursor: 'pointer', borderRadius: '4px' }}
              title="Mark today's objective completed"
            />
            <input 
              type="text"
              placeholder="What is your main target for this session? (e.g., Read chapter 4, finish problem set)"
              value={objectiveText}
              onChange={(e) => handleObjectiveChange(e.target.value, objectiveCompleted)}
              className="field-input"
              style={{ 
                textDecoration: 'none',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                background: 'var(--bg-app)',
                flex: 1
              }}
            />
          </div>
        </section>

        {/* Bottom Section: Connected Members Presence & Compact Calendar */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Room Members ({Object.keys(members).length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Live updates enabled</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {Object.values(members).map((m) => {
              const memberId = m?.userId || 'guest';
              const isMe = memberId === userId;
              const userSessions = getSafeSessions(memberId);
              const doneDays = userSessions.filter(s => s && s.objectiveCompleted).map(s => {
                const d = new Date(s.date);
                return !isNaN(d) ? d.getDate() : null;
              }).filter(d => d !== null);

              if (m?.objectiveCompleted && !doneDays.includes(currentDay)) {
                doneDays.push(currentDay);
              }

              return (
                <div key={memberId} className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: isMe ? '3px solid var(--calendar-done)' : '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>{m?.name || 'Student'} {isMe && '(You)'}</span>
                    </div>
                    <span style={{ fontSize: '0.85rem' }}>
                      {getStatusBadge(m?.status)}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{m?.objectiveCompleted ? '✅' : '🎯'}</span>
                    <span style={{ textDecoration: 'none', color: 'var(--text-main)', fontStyle: m?.objectiveText ? 'normal' : 'italic', fontWeight: 500 }}>
                      {m?.objectiveText || 'No objective set for today'}
                    </span>
                  </div>

                  {/* Full Month Focus Calendar for member */}
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Focus Calendar:</span>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(7, 1fr)', 
                      gap: '0.35rem',
                      background: 'var(--bg-app)',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      marginTop: '0.5rem',
                      border: '1px solid var(--border-color)'
                    }}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                        <div key={`d-${idx}`} style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '0.2rem' }}>
                          {day}
                        </div>
                      ))}

                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => {
                        const isDone = doneDays.includes(dayNum) || (dayNum === currentDay && m?.objectiveCompleted);
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
                              fontSize: '0.72rem',
                              borderRadius: '0.25rem',
                              background: isDone ? 'var(--calendar-done)' : (isPastOrToday ? 'var(--status-studying)' : 'transparent'),
                              color: isDone ? 'var(--calendar-done-text)' : (isPastOrToday ? '#0C0A09' : 'var(--text-muted)'),
                              fontWeight: isPastOrToday || isDone ? 700 : 400,
                              border: isToday && !isDone ? '2px solid #0C0A09' : 'none',
                              boxShadow: isPastOrToday || isDone ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                              opacity: isPastOrToday ? 1 : 0.4
                            }}
                            title={`Day ${dayNum}: ${isDone ? 'Objective completed 🏆' : (isPastOrToday ? 'Study active 🟢' : 'Upcoming')}`}
                          >
                            {dayNum}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
