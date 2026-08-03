import React, { useState, useEffect, useRef } from 'react';
import { subscribeToRoomEvents, isCloudEnabled, saveCustomSupabaseConfig } from '../lib/supabase';

const getSafeSessions = (userId) => {
  try {
    const stored = localStorage.getItem(`sessions_${userId}`);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Late-night marathon rule: sessions occurring between midnight and 5:00 AM belong to the previous evening's study date!
const getStudyDateKey = (date = new Date()) => {
  const d = new Date(date);
  if (d.getHours() < 5) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().split('T')[0];
};

const getStudyTimeHistory = (uid) => {
  try {
    const data = localStorage.getItem(`study_time_history_${uid}`);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const updateStudyTime = (uid, dateKey, secondsDelta = 1) => {
  try {
    const history = getStudyTimeHistory(uid);
    history[dateKey] = (history[dateKey] || 0) + secondsDelta;
    localStorage.setItem(`study_time_history_${uid}`, JSON.stringify(history));
    return history;
  } catch {
    return {};
  }
};

const formatDurationLabel = (totalSecs) => {
  if (!totalSecs || totalSecs <= 0) return '0m';
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

const getInitialTimerState = () => {
  try {
    const saved = localStorage.getItem('global_room_timer_state');
    if (saved) {
      const data = JSON.parse(saved);
      let elapsed = typeof data.elapsedSeconds === 'number' ? data.elapsedSeconds : 0;
      // If timer was actively running, calculate real time elapsed since last record
      if (data.timerStatus === 'running' && typeof data.lastTick === 'number') {
        const diffSeconds = Math.floor((Date.now() - data.lastTick) / 1000);
        elapsed += Math.max(0, diffSeconds);
      }
      return {
        status: data.timerStatus || 'stopped',
        elapsed,
        mode: data.timerMode || 'stopwatch',
        target: typeof data.targetDuration === 'number' ? data.targetDuration : 50 * 60
      };
    }
  } catch {
    // default
  }
  return { status: 'stopped', elapsed: 0, mode: 'stopwatch', target: 50 * 60 };
};

const saveTimerStateToStorage = (status, elapsed, mode, target) => {
  try {
    localStorage.setItem('global_room_timer_state', JSON.stringify({
      timerStatus: status,
      elapsedSeconds: elapsed,
      timerMode: mode,
      targetDuration: target,
      lastTick: Date.now()
    }));
  } catch {
    // ignore storage limits
  }
};

export default function StudyRoom({ user, onLogout, darkMode, setDarkMode }) {
  const userId = user?.id || 'guest';
  const userName = user?.name || 'Guest User';

  const initialTimer = getInitialTimerState();
  // Shared Timer State resilient to web refreshes
  const [timerStatus, setTimerStatus] = useState(initialTimer.status); // 'stopped' | 'running' | 'paused'
  const [elapsedSeconds, setElapsedSeconds] = useState(initialTimer.elapsed);
  const [timerMode, setTimerMode] = useState(initialTimer.mode); // 'stopwatch' | 'countdown'
  const [targetDuration, setTargetDuration] = useState(initialTimer.target); // 50 mins default

  // Live real-time ticker for header room clock in 12-hour AM/PM format
  const [realTime, setRealTime] = useState(() => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));

  // Cloud Sync Setup Modal visibility
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [inputUrl, setInputUrl] = useState(() => localStorage.getItem('study_supabase_url') || '');
  const [inputKey, setInputKey] = useState(() => localStorage.getItem('study_supabase_key') || '');

  // Personal user state for today
  const [objectiveText, setObjectiveText] = useState(() => {
    try { return localStorage.getItem(`obj_text_${userId}_GLOBAL`) || ''; } catch { return ''; }
  });
  const [objectiveCompleted, setObjectiveCompleted] = useState(() => {
    try { return localStorage.getItem(`obj_done_${userId}_GLOBAL`) === 'true'; } catch { return false; }
  });
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [workStartTime] = useState(() => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }));
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [studyHistory, setStudyHistory] = useState(() => getStudyTimeHistory(userId));
  const [graphTimeframe, setGraphTimeframe] = useState('week'); // 'week' | 'month'

  // Helper: Derive presence status automatically from break toggle & timer status
  const deriveStatus = (isBreak, tStatus) => {
    if (isBreak) return 'break';
    return tStatus === 'running' ? 'studying' : 'idle';
  };

  // Connected Members list resilient to page refreshes via cache
  const [members, setMembers] = useState(() => {
    const defaultMe = {
      userId,
      name: userName,
      status: deriveStatus(isOnBreak, timerStatus),
      objectiveText,
      objectiveCompleted,
      workStartTime: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
      breakSeconds: 0,
      studyTimeHistory: getStudyTimeHistory(userId),
      lastSeen: Date.now()
    };
    try {
      const cached = JSON.parse(localStorage.getItem('global_room_members_cache') || '{}');
      return { ...cached, [userId]: defaultMe };
    } catch {
      return { [userId]: defaultMe };
    }
  });

  const channelRef = useRef(null);
  const timerRef = useRef(null);
  const breakTimerRef = useRef(null);
  const myProfileRef = useRef({ userId, name: userName });
  const currentTimerRef = useRef({ status: timerStatus, elapsed: elapsedSeconds, mode: timerMode, target: targetDuration });
  const isOnBreakRef = useRef(isOnBreak);

  useEffect(() => {
    isOnBreakRef.current = isOnBreak;
  }, [isOnBreak]);

  // Keep refs synchronized to latest state for instantaneous broadcasts
  useEffect(() => {
    currentTimerRef.current = { status: timerStatus, elapsed: elapsedSeconds, mode: timerMode, target: targetDuration };
    saveTimerStateToStorage(timerStatus, elapsedSeconds, timerMode, targetDuration);
  }, [timerStatus, elapsedSeconds, timerMode, targetDuration]);

  useEffect(() => {
    myProfileRef.current = {
      userId,
      name: userName,
      status: deriveStatus(isOnBreak, timerStatus),
      objectiveText,
      objectiveCompleted,
      workStartTime,
      breakSeconds,
      studyTimeHistory: studyHistory,
      personalTimer: {
        status: timerStatus,
        elapsed: elapsedSeconds,
        mode: timerMode,
        targetDuration
      },
      lastSeen: Date.now()
    };
    // Cache member profiles to maintain visibility after refreshing browser
    setMembers(prev => {
      const updated = { ...prev, [userId]: myProfileRef.current };
      try { localStorage.setItem('global_room_members_cache', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [userId, userName, isOnBreak, timerStatus, elapsedSeconds, timerMode, targetDuration, objectiveText, objectiveCompleted, workStartTime, breakSeconds, studyHistory]);

  // 1. Live real-time clock ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTime(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Broadcast local presence & personal timer state over the live network channel
  const broadcastMyState = (overrides = {}) => {
    const nextState = { ...myProfileRef.current, ...overrides, lastSeen: Date.now() };
    if (channelRef.current) {
      channelRef.current.broadcast('MEMBER_STATE_SYNC', nextState);
    }
    // Record objective completions to calendar history
    if (overrides.objectiveCompleted !== undefined || overrides.objectiveText !== undefined) {
      const today = getStudyDateKey();
      const sess = getSafeSessions(userId);
      const existingIdx = sess.findIndex(s => s && s.date === today);
      if (existingIdx >= 0) {
        sess[existingIdx].objectiveCompleted = nextState.objectiveCompleted;
        sess[existingIdx].objectiveText = nextState.objectiveText;
      } else {
        sess.push({ date: today, objectiveCompleted: nextState.objectiveCompleted, objectiveText: nextState.objectiveText });
      }
      try { localStorage.setItem(`sessions_${userId}`, JSON.stringify(sess)); } catch {}
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

  // 3. Setup Realtime channel & synchronization protocols
  useEffect(() => {
    const curMe = myProfileRef.current;

    // Subscribe to broadcasts from study partners
    const channel = subscribeToRoomEvents('GLOBAL_STUDY_SPACE', (evt) => {
      if (!evt || !evt.event) return;
      const { event, payload } = evt;

      if (event === 'MEMBER_STATE_SYNC' && payload && payload.userId) {
        setMembers(prev => {
          const isKnown = !!prev[payload.userId];
          const updated = { ...prev, [payload.userId]: { ...payload, lastSeen: Date.now() } };
          try { localStorage.setItem('global_room_members_cache', JSON.stringify(updated)); } catch {}
          // If we just discovered a new partner, immediately reply with our own status and personal focus clock!
          if (!isKnown && channelRef.current && payload.userId !== userId) {
            setTimeout(() => {
              if (channelRef.current) {
                channelRef.current.broadcast('MEMBER_STATE_SYNC', myProfileRef.current);
              }
            }, 200);
          }
          return updated;
        });
      } else if (event === 'REQUEST_SYNC' || event === 'NETWORK_CONNECTED' || event === 'presence_sync') {
        // A study buddy joined, requested sync, or cloud network connected! Immediately send our profile and focus clock!
        if (channelRef.current) {
          channelRef.current.broadcast('MEMBER_STATE_SYNC', myProfileRef.current);
        }
      }
    });

    channelRef.current = channel;

    // Multi-stage rapid onboarding handshake (Ensures presence broadcast after Vercel WebSocket SSL connection completes)
    const pingDelays = [400, 1200, 2500, 4500];
    const initTimers = pingDelays.map(delay => 
      setTimeout(() => {
        if (channelRef.current) {
          channelRef.current.broadcast('MEMBER_STATE_SYNC', curMe);
          channelRef.current.broadcast('REQUEST_SYNC', { newcomer: userId });
        }
      }, delay)
    );

    // High-frequency live cloud heartbeat (Every 3 seconds) so peers remain continuously synchronized without interfering with independent clocks
    const heartbeat = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.broadcast('MEMBER_STATE_SYNC', myProfileRef.current);
      }
    }, 3000);

    return () => {
      initTimers.forEach(t => clearTimeout(t));
      clearInterval(heartbeat);
      if (channelRef.current) {
        channelRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Shared Session Timer ticker logic & Study Time History accumlator
  useEffect(() => {
    if (timerStatus === 'running') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          saveTimerStateToStorage('running', next, timerMode, targetDuration);
          
          // If user is actively studying (not on break), accumulate seconds in today's marathon study history!
          if (!isOnBreakRef.current) {
            const dateKey = getStudyDateKey();
            const latestHistory = updateStudyTime(userId, dateKey, 1);
            setStudyHistory({ ...latestHistory });
          }

          // Broadcast live clock inside personal profile every 15 seconds while ticking
          if (next % 15 === 0 && channelRef.current) {
            const currentPT = { status: 'running', elapsed: next, mode: timerMode, targetDuration };
            channelRef.current.broadcast('MEMBER_STATE_SYNC', { ...myProfileRef.current, personalTimer: currentPT });
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerStatus, timerMode, targetDuration, userId]);

  // 5. Break time accumulator logic
  useEffect(() => {
    if (isOnBreak) {
      breakTimerRef.current = setInterval(() => {
        setBreakSeconds(prev => {
          const next = prev + 1;
          if (next % 15 === 0 && channelRef.current) {
            channelRef.current.broadcast('MEMBER_STATE_SYNC', { ...myProfileRef.current, breakSeconds: next });
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(breakTimerRef.current);
    }
    return () => clearInterval(breakTimerRef.current);
  }, [isOnBreak]);

  // Handlers for Personal Timer actions
  const handleTimerControl = (newStatus, customElapsed = elapsedSeconds) => {
    setConfirmReset(false);
    let effectiveTarget = targetDuration;
    if (newStatus === 'running' && timerMode === 'countdown' && effectiveTarget <= 0) {
      effectiveTarget = 25 * 60;
      setTargetDuration(effectiveTarget);
    }
    setTimerStatus(newStatus);
    setElapsedSeconds(customElapsed);
    saveTimerStateToStorage(newStatus, customElapsed, timerMode, effectiveTarget);
    
    if (channelRef.current) {
      const updatedTimer = {
        status: newStatus,
        elapsed: customElapsed,
        mode: timerMode,
        targetDuration: effectiveTarget
      };
      const newStat = deriveStatus(isOnBreak, newStatus);
      channelRef.current.broadcast('MEMBER_STATE_SYNC', { ...myProfileRef.current, personalTimer: updatedTimer, status: newStat });
    }
  };

  const handleUpdateTargetDuration = (newSeconds) => {
    const safeSeconds = Math.max(0, Math.min(24 * 3600, newSeconds));
    setTargetDuration(safeSeconds);
    saveTimerStateToStorage(timerStatus, elapsedSeconds, timerMode, safeSeconds);
    if (channelRef.current) {
      const updatedTimer = {
        status: timerStatus,
        elapsed: elapsedSeconds,
        mode: 'countdown',
        targetDuration: safeSeconds
      };
      channelRef.current.broadcast('MEMBER_STATE_SYNC', { ...myProfileRef.current, personalTimer: updatedTimer });
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
  };

  const handleObjectiveChange = (text, done) => {
    setObjectiveText(text);
    setObjectiveCompleted(done);
    try {
      localStorage.setItem(`obj_text_${userId}_GLOBAL`, text);
      localStorage.setItem(`obj_done_${userId}_GLOBAL`, done.toString());
    } catch { /* ignore */ }
    broadcastMyState({ objectiveText: text, objectiveCompleted: done });
  };

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

  const getMemberDisplayTime = (pt) => {
    if (!pt) return '00:00';
    if (pt.mode === 'countdown') {
      const remain = Math.max(0, (pt.targetDuration || 3000) - pt.elapsed);
      return formatTime(remain);
    }
    return formatTime(pt.elapsed);
  };

  const getEffectiveStudyDate = () => {
    const d = new Date();
    if (d.getHours() < 5) d.setDate(d.getDate() - 1);
    return d;
  };
  const activeStudyDate = getEffectiveStudyDate();
  const currentDay = activeStudyDate.getDate();
  const daysInMonth = new Date(activeStudyDate.getFullYear(), activeStudyDate.getMonth() + 1, 0).getDate();

  const getStatusBadge = (status) => {
    if (status === 'break') return <span style={{ color: 'var(--status-break)', fontWeight: 600 }}>🟡 On break</span>;
    if (status === 'studying') return <span style={{ color: 'var(--status-studying)', fontWeight: 600 }}>🟢 Studying</span>;
    return <span style={{ color: 'var(--status-idle)', fontWeight: 600 }}>⚪ Idle</span>;
  };

  return (
    <div className="page-wrapper" style={{ padding: '2rem 1.5rem', position: 'relative' }}>
      {/* Real-time Cloud Sync Configuration Dialog */}
      {showSyncModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="panel" style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>🌐 Enable Global Cloud Sync</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
              When deployed on Vercel, peers on separate devices use our Zero-Config WebSocket Network or a shared Supabase cloud channel to see each other instantly.<br/><br/>
              To link a dedicated Supabase Postgres DB, enter your URL and Anon Key below (optional):
            </p>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <label className="field-label">Supabase Project URL</label>
              <input 
                type="text" 
                placeholder="https://xyz.supabase.co"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="field-input"
              />
            </div>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <label className="field-label">Supabase Anon Key</label>
              <input 
                type="password" 
                placeholder="ey.... (anon public key)"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="field-input"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={() => setShowSyncModal(false)} className="btn btn-subtle">Close</button>
              <button 
                onClick={() => saveCustomSupabaseConfig(inputUrl, inputKey)}
                className="btn btn-primary"
              >
                Save & Link Cloud
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Room Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            UNIFIED STUDY SPACE
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>GLOBAL ROOM</h1>
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>Live</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Real-time Cloud Link Badge */}
          <button
            onClick={() => setShowSyncModal(true)}
            className="btn btn-subtle"
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', background: isCloudEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)' }}
            title="Click to manage live cloud synchronization across devices"
          >
            {isCloudEnabled ? '🟢 Live Cloud Connected' : '🌐 Universal Zero-Config Sync Active'}
          </button>

          <span className="mono" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            🕒 {realTime}
          </span>

          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="btn btn-subtle"
            style={{ padding: '0.4rem 0.65rem' }}
            title="Toggle Dark/Light theme"
          >
            {darkMode ? '🌙 Dark' : '☀️ Light'}
          </button>

          <button 
            onClick={onLogout}
            className="btn btn-subtle"
            style={{ fontSize: '0.85rem', color: '#EF4444', borderColor: 'var(--border-color)' }}
          >
            Log Out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Top Section: Personal Focus Timer */}
        <section style={{ textAlign: 'center', padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Personal Focus Timer ({timerMode === 'stopwatch' ? 'Count-Up' : `${getTargetLabel()} Target`})
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
                borderColor: confirmReset ? '#EF4444' : 'transparent',
                color: confirmReset ? '#EF4444' : 'var(--text-main)',
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

        {/* Middle Section: Personal Action Pad & Marathon Study Timetable */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '0.5rem' }}>
          {/* Left: Today's Objective & Break Toggle */}
          <div className="panel" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>Your Today's Objective</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Working since {workStartTime} • Total break: {Math.floor(breakSeconds / 60)}m {breakSeconds % 60}s</span>
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
                style={{ width: '22px', height: '22px', accentColor: '#10B981', cursor: 'pointer', borderRadius: '4px' }}
                title="Mark today's objective completed"
              />
              <input 
                type="text"
                placeholder="What is your main target today? (e.g., 7 LeetCode questions)"
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
          </div>

          {/* Right side small box: Night Marathon Study Timetable */}
          <div className="panel" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🌙 Night Marathon Timetable
              </span>
              <span style={{ fontSize: '0.72rem', background: 'var(--accent)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>11:00 PM - 4:30 AM</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {[
                { time: '11:00 - 11:10 PM', title: '🚪 Arrival & Warmup', desc: '10 min setup & goal planning', type: 'setup' },
                { time: '11:10 - 12:00 AM', title: '⚡ Focus Session 1', desc: '50 mins deep focus', type: 'study' },
                { time: '12:00 - 12:15 AM', title: '☕ Coffee Break', desc: '15 mins recharge', type: 'break' },
                { time: '12:15 - 1:30 AM', title: '🧠 Focus Session 2', desc: '1h 15m intense problem solving', type: 'study' },
                { time: '1:30 - 1:45 AM', title: '🌿 15 min Break', desc: '15 mins relax & stretching', type: 'break' },
                { time: '1:45 - 3:15 AM', title: '🔥 Focus Session 3', desc: '1h 30m endurance study', type: 'study' },
                { time: '3:15 - 3:30 AM', title: '🎵 15 min Break', desc: '15 mins breather before final push', type: 'break' },
                { time: '3:30 - 4:30 AM', title: '🚀 Final Push (Session 4)', desc: '1 hour sprint to finish line', type: 'study' },
                { time: '10:00 AM (Subah)', title: '☀️ Morning Check-in', desc: 'Subah 10 bje wake & review', type: 'setup' }
              ].map((slot, idx) => {
                const isBreak = slot.type === 'break';
                return (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.45rem 0.65rem', 
                    background: 'var(--bg-app)', 
                    borderRadius: '6px', 
                    borderLeft: isBreak ? '3px solid #EAB308' : (slot.type === 'study' ? '3px solid #10B981' : '3px solid var(--text-muted)'),
                    fontSize: '0.78rem'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{slot.title}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{slot.desc}</span>
                    </div>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isBreak ? '#EAB308' : (slot.type === 'study' ? '#10B981' : 'var(--text-muted)'), whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                      {slot.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom Section: Connected Members Presence, Study Duration Graphs & Focus Calendars */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Global Room Members ({Object.keys(members).length})
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button 
                onClick={() => {
                  if (channelRef.current) {
                    channelRef.current.broadcast('MEMBER_STATE_SYNC', myProfileRef.current);
                    channelRef.current.broadcast('REQUEST_SYNC', { newcomer: userId });
                  }
                }}
                className="btn btn-subtle"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', cursor: 'pointer' }}
                title="Force broadcast presence and fetch latest status from study partners"
              >
                🔄 Ping Partners
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Realtime multi-network cloud sync active</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
            {Object.values(members).map((m) => {
              const memberId = m?.userId || 'guest';
              const isMe = memberId === userId;
              const userSessions = getSafeSessions(memberId);
              const doneDays = userSessions.filter(s => s && s.objectiveCompleted).map(s => {
                const d = new Date(s.date);
                return !isNaN(d) ? d.getDate() : null;
              }).filter(d => d !== null && d <= currentDay);

              if (m?.objectiveCompleted && !doneDays.includes(currentDay)) {
                doneDays.push(currentDay);
              }

              // Calculate Study Time History and Marathons based on selected timeframe (Week vs Whole Month)
              const numDays = graphTimeframe === 'month' ? 30 : 7;
              const memberHistory = m?.studyTimeHistory || getStudyTimeHistory(memberId);
              const daysList = Array.from({ length: numDays }, (_, i) => {
                const d = new Date();
                if (d.getHours() < 5) d.setDate(d.getDate() - 1);
                d.setDate(d.getDate() - ((numDays - 1) - i));
                const key = d.toISOString().split('T')[0];
                const weekdayStr = d.toLocaleDateString([], { weekday: 'short' });
                const monthDayStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                const label = i === (numDays - 1) ? 'Today' : (graphTimeframe === 'month' ? monthDayStr : weekdayStr);
                const secs = memberHistory[key] || 0;
                return { key, label, fullDate: `${weekdayStr}, ${monthDayStr}`, secs };
              });

              const totalPeriodSecs = daysList.reduce((acc, curr) => acc + curr.secs, 0);
              const todaySecs = daysList[numDays - 1]?.secs || 0;
              const avgSecs = Math.floor(totalPeriodSecs / numDays);
              const maxDaySecs = Math.max(3600 * 4, ...daysList.map(d => d.secs)); // scale relative to at least 4 hours

              return (
                <div key={memberId} className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: isMe ? '3px solid #10B981' : '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>{m?.name || 'Student'} {isMe && '(You)'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      {m?.personalTimer && m.personalTimer.elapsed > 0 && (
                        <span style={{
                          fontSize: '0.82rem',
                          background: m.personalTimer.status === 'running' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-subtle)',
                          color: m.personalTimer.status === 'running' ? '#10B981' : 'var(--text-muted)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '14px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          border: m.personalTimer.status === 'running' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-color)',
                          fontFamily: 'monospace'
                        }} title={`Personal Clock (${m.personalTimer.mode || 'Count-Up'})`}>
                          ⏱️ {getMemberDisplayTime(m.personalTimer)} {m.personalTimer.status === 'paused' ? '(Paused)' : ''}
                        </span>
                      )}
                      <span style={{ fontSize: '0.85rem' }}>
                        {getStatusBadge(m?.status)}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{m?.objectiveCompleted ? '✅' : '🎯'}</span>
                    <span style={{ textDecoration: 'none', color: 'var(--text-main)', fontStyle: m?.objectiveText ? 'normal' : 'italic', fontWeight: 500 }}>
                      {m?.objectiveText || 'No objective set for today'}
                    </span>
                  </div>

                  {/* 📈 Date vs. Time Study Duration & Marathon Graph */}
                  <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        📈 Study Duration & Marathons
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* Week vs Month View Switch */}
                        <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: '6px', padding: '0.15rem', border: '1px solid var(--border-color)' }}>
                          <button 
                            onClick={() => setGraphTimeframe('week')}
                            style={{ 
                              fontSize: '0.68rem', 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '4px', 
                              border: 'none', 
                              cursor: 'pointer',
                              background: graphTimeframe === 'week' ? 'var(--accent)' : 'transparent',
                              color: graphTimeframe === 'week' ? '#FFFFFF' : 'var(--text-muted)',
                              fontWeight: graphTimeframe === 'week' ? 700 : 500
                            }}
                          >
                            7 Days
                          </button>
                          <button 
                            onClick={() => setGraphTimeframe('month')}
                            style={{ 
                              fontSize: '0.68rem', 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '4px', 
                              border: 'none', 
                              cursor: 'pointer',
                              background: graphTimeframe === 'month' ? 'var(--accent)' : 'transparent',
                              color: graphTimeframe === 'month' ? '#FFFFFF' : 'var(--text-muted)',
                              fontWeight: graphTimeframe === 'month' ? 700 : 500
                            }}
                          >
                            Whole Month (30d)
                          </button>
                        </div>

                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10B981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.15rem 0.55rem', borderRadius: '999px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          Today: {formatDurationLabel(todaySecs)}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem', fontStyle: 'italic' }}>
                      🌙 Sessions running across midnight up to 5 AM count in one continuous go!
                    </div>

                    {/* Bar Chart Container */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', gap: graphTimeframe === 'month' ? '0.15rem' : '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      {daysList.map((col, idx) => {
                        const isTodayCol = idx === (numDays - 1);
                        const barHeightPct = Math.max(4, Math.min(100, Math.round((col.secs / maxDaySecs) * 100)));
                        return (
                          <div key={col.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', height: '100%', justifyContent: 'flex-end' }}>
                            {graphTimeframe === 'week' && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: col.secs > 0 ? 'var(--text-main)' : 'var(--text-muted)', textAlign: 'center' }}>
                                {formatDurationLabel(col.secs)}
                              </span>
                            )}
                            <div 
                              style={{
                                width: '100%',
                                maxWidth: graphTimeframe === 'month' ? '12px' : '36px',
                                height: `${barHeightPct}%`,
                                background: col.secs > 0 ? (isTodayCol ? '#10B981' : 'linear-gradient(to top, var(--bg-panel), #10B981)') : 'var(--bg-subtle)',
                                borderRadius: '3px 3px 0 0',
                                border: col.secs > 0 ? '1px solid #059669' : '1px dashed var(--border-color)',
                                transition: 'height 0.3s ease',
                                boxShadow: col.secs > 0 && isTodayCol ? '0 0 8px rgba(16, 185, 129, 0.35)' : 'none',
                                cursor: 'pointer'
                              }}
                              title={`${col.fullDate} (${col.key}): Studied ${formatDurationLabel(col.secs)} in one go`}
                            />
                            {graphTimeframe === 'week' && (
                              <span style={{ fontSize: '0.72rem', color: isTodayCol ? '#10B981' : 'var(--text-muted)', fontWeight: isTodayCol ? 700 : 500 }}>
                                {col.label}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Month view horizontal timeline milestones */}
                    {graphTimeframe === 'month' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        <span>30d ago ({daysList[0]?.label})</span>
                        <span>15d ago ({daysList[14]?.label})</span>
                        <span style={{ color: '#10B981', fontWeight: 700 }}>Today</span>
                      </div>
                    )}

                    {/* Summary Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      <span>🔥 {graphTimeframe === 'month' ? '30-Day Total' : '7-Day Total'}: <strong style={{ color: '#10B981' }}>{formatDurationLabel(totalPeriodSecs)}</strong></span>
                      <span>⚡ Daily Avg: <strong>{formatDurationLabel(avgSecs)}</strong></span>
                    </div>
                  </div>

                  {/* Full Month Focus Calendar for member (Green = Work Done, Grey = No Work Done) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Focus Calendar:</span>
                        {isMe && (
                          <button
                            onClick={() => {
                              if (window.confirm("Clean accidental test records from Days 2 & 4, and accurately set Day 3 to your genuine 1h 10m (70 minutes) session?")) {
                                const yr = activeStudyDate.getFullYear();
                                const mo = String(activeStudyDate.getMonth() + 1).padStart(2, '0');
                                const day3Key = `${yr}-${mo}-03`;
                                const cleanHistory = { [day3Key]: 4200 }; // 1h 10m in seconds
                                localStorage.setItem(`study_time_history_${userId}`, JSON.stringify(cleanHistory));
                                
                                const sess = [{ date: day3Key, objectiveCompleted: true, objectiveText: objectiveText || '7 leetcode question' }];
                                localStorage.setItem(`sessions_${userId}`, JSON.stringify(sess));
                                setStudyHistory({ ...cleanHistory });
                                
                                myProfileRef.current.studyTimeHistory = cleanHistory;
                                if (channelRef.current) {
                                  channelRef.current.broadcast('MEMBER_STATE_SYNC', myProfileRef.current);
                                }
                                alert("✅ Cleaned! Day 2 & 4 reset to zero. Day 3 set to 1h 10m.");
                              }
                            }}
                            className="btn btn-subtle"
                            style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', minHeight: 'auto', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-main)', cursor: 'pointer', borderRadius: '12px' }}
                            title="Reset accidental test entries from calendar and keep only genuine study time"
                          >
                            🧹 Clean Test Dates
                          </button>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🟢 Work Done • ⚪ No Work</span>
                    </div>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(7, 1fr)', 
                      gap: '0.35rem',
                      background: 'var(--bg-app)',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border-color)'
                    }}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                        <div key={`d-${idx}`} style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '0.2rem' }}>
                          {day}
                        </div>
                      ))}

                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => {
                        const isToday = dayNum === currentDay;
                        const now = new Date();
                        const localDayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                        let daySecs = memberHistory[localDayKey] || 0;
                        if (isToday) {
                          const todayGraphSecs = daysList[numDays - 1]?.secs || 0;
                          daySecs = Math.max(daySecs, todayGraphSecs);
                        }

                        const isPastOrToday = dayNum <= currentDay;
                        const isDone = isPastOrToday && (doneDays.includes(dayNum) || (isToday && m?.objectiveCompleted) || daySecs > 0);

                        // Green (#10B981) if study work or objective is done; Grey if no work done
                        const cellBackground = isDone ? '#10B981' : (isPastOrToday ? 'var(--border-color)' : 'transparent');
                        const cellColor = isDone ? '#FFFFFF' : 'var(--text-muted)';
                        const cellOpacity = isPastOrToday || isDone ? 1 : 0.25;

                        return (
                          <div 
                            key={`day-${dayNum}`}
                            style={{
                              aspectRatio: '1/1',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.72rem',
                              borderRadius: '0.25rem',
                              background: cellBackground,
                              color: cellColor,
                              fontWeight: isPastOrToday || isDone ? 700 : 400,
                              border: isToday && !isDone ? '2px solid var(--text-muted)' : 'none',
                              boxShadow: isDone ? '0 1px 3px rgba(16, 185, 129, 0.3)' : 'none',
                              opacity: cellOpacity,
                              padding: '0.1rem',
                              overflow: 'hidden'
                            }}
                            title={`Day ${dayNum}: Studied for ${formatDurationLabel(daySecs)} ${isDone ? '• Work completed 🟢' : (isPastOrToday ? '• No work done ⚪' : '• Upcoming')}`}
                          >
                            <span>{dayNum}</span>
                            {daySecs > 0 && (
                              <span style={{ fontSize: '0.55rem', opacity: 0.95, fontWeight: 700, marginTop: '0.1rem', background: 'rgba(0, 0, 0, 0.18)', padding: '0.05rem 0.2rem', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                                {formatDurationLabel(daySecs)}
                              </span>
                            )}
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
