import React from 'react';
import { Award, Sparkles, Target, CheckCircle2 } from 'lucide-react';
import { getFriendlyLeaderMessage } from '../utils/storage';

export default function ComparisonDashboard({ 
  p1Stats, 
  p2Stats, 
  profiles, 
  activePerson, 
  setActivePerson 
}) {
  const p1 = profiles.p1;
  const p2 = profiles.p2;

  const leaderMessage = getFriendlyLeaderMessage(p1Stats, p2Stats, profiles);

  const formatHrsMins = (totalMins) => {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs === 0) return `${mins}m`;
    return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
  };

  const calculateProgress = (current, goal) => {
    if (!goal || goal <= 0) return 0;
    return Math.min(100, Math.round((current / goal) * 100));
  };

  const p1Progress = calculateProgress(p1Stats.todayMins, p1.dailyGoalMins);
  const p2Progress = calculateProgress(p2Stats.todayMins, p2.dailyGoalMins);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Friendly Who's Ahead Banner */}
      <div className="card leader-banner" style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        textAlign: 'center',
        border: '1px solid var(--border-highlight)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <Award size={24} color="#F59E0B" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {leaderMessage.text}
        </span>
        <Sparkles size={22} color="#06B6D4" style={{ flexShrink: 0 }} />
      </div>

      {/* Side-by-Side Friend Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Friend 1 Card (Alex - Amber) */}
        <div 
          className="card" 
          onClick={() => setActivePerson('p1')}
          style={{ 
            position: 'relative', 
            overflow: 'hidden', 
            cursor: 'pointer',
            border: activePerson === 'p1' ? '2px solid var(--p1-color)' : '1px solid var(--border-color)',
            boxShadow: activePerson === 'p1' ? 'var(--shadow-glow-p1)' : 'var(--shadow-md)'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: 'var(--p1-gradient)' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                fontSize: '2.25rem', 
                width: '56px', 
                height: '56px', 
                borderRadius: '16px', 
                background: 'var(--p1-light)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                {p1.avatar}
              </div>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {p1.name}
                  {activePerson === 'p1' && <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'var(--p1-gradient)', color: 'white', borderRadius: '999px' }}>ACTIVE</span>}
                </h3>
                <span className="badge badge-p1" style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                  🔥 {p1Stats.streak} Day Streak
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>THIS WEEK</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--p1-dark)' }}>
                {formatHrsMins(p1Stats.weeklyMins)}
              </div>
            </div>
          </div>

          {/* Daily Goal Progress */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Target size={15} color="#F59E0B" /> Today's Progress ({formatHrsMins(p1Stats.todayMins)})
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: p1Progress >= 100 ? 'var(--success)' : 'var(--text-primary)' }}>
                {p1Progress}% of {formatHrsMins(p1.dailyGoalMins)}
              </span>
            </div>
            
            <div className="progress-bar-bg">
              <div className="progress-bar-fill fill-p1" style={{ width: `${p1Progress}%` }} />
            </div>

            {p1Progress >= 100 && (
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={14} /> Daily study goal crushed! Amazing focus! 🏆
              </div>
            )}
          </div>

          {/* Summary Metric Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--bg-hover)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ALL-TIME STUDY</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatHrsMins(p1Stats.totalMins)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL SESSIONS</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p1Stats.sessionsCount} Sessions</div>
            </div>
          </div>
        </div>

        {/* Friend 2 Card (Sam - Teal) */}
        <div 
          className="card" 
          onClick={() => setActivePerson('p2')}
          style={{ 
            position: 'relative', 
            overflow: 'hidden', 
            cursor: 'pointer',
            border: activePerson === 'p2' ? '2px solid var(--p2-color)' : '1px solid var(--border-color)',
            boxShadow: activePerson === 'p2' ? 'var(--shadow-glow-p2)' : 'var(--shadow-md)'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: 'var(--p2-gradient)' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                fontSize: '2.25rem', 
                width: '56px', 
                height: '56px', 
                borderRadius: '16px', 
                background: 'var(--p2-light)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '1px solid rgba(6, 182, 212, 0.3)'
              }}>
                {p2.avatar}
              </div>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {p2.name}
                  {activePerson === 'p2' && <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'var(--p2-gradient)', color: 'white', borderRadius: '999px' }}>ACTIVE</span>}
                </h3>
                <span className="badge badge-p2" style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                  🔥 {p2Stats.streak} Day Streak
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>THIS WEEK</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--p2-dark)' }}>
                {formatHrsMins(p2Stats.weeklyMins)}
              </div>
            </div>
          </div>

          {/* Daily Goal Progress */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Target size={15} color="#06B6D4" /> Today's Progress ({formatHrsMins(p2Stats.todayMins)})
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: p2Progress >= 100 ? 'var(--success)' : 'var(--text-primary)' }}>
                {p2Progress}% of {formatHrsMins(p2.dailyGoalMins)}
              </span>
            </div>
            
            <div className="progress-bar-bg">
              <div className="progress-bar-fill fill-p2" style={{ width: `${p2Progress}%` }} />
            </div>

            {p2Progress >= 100 && (
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={14} /> Daily study goal crushed! Amazing focus! 🏆
              </div>
            )}
          </div>

          {/* Summary Metric Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--bg-hover)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ALL-TIME STUDY</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatHrsMins(p2Stats.totalMins)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL SESSIONS</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p2Stats.sessionsCount} Sessions</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
