import React from 'react';
import { Award, Download, Flame, Trophy, CheckCircle2, Sparkles, HeartHandshake, Zap } from 'lucide-react';
import { exportToCSV } from '../utils/storage';

export default function WeeklyWrapUp({ sessions, profiles, p1Stats, p2Stats }) {
  const p1 = profiles.p1;
  const p2 = profiles.p2;

  const totalCombinedMins = p1Stats.totalMins + p2Stats.totalMins;
  const combinedHours = (totalCombinedMins / 60).toFixed(1);

  // Calculate top subjects
  const subjectMap = {};
  sessions.forEach(s => {
    const sub = s.subject || 'General Focus';
    subjectMap[sub] = (subjectMap[sub] || 0) + Number(s.durationMins);
  });
  const topSubject = Object.entries(subjectMap).sort((a, b) => b[1] - a[1])[0] ? Object.entries(subjectMap).sort((a, b) => b[1] - a[1])[0][0] : 'Various Topics';

  const handleExport = () => {
    exportToCSV(sessions, profiles);
  };

  const trophies = [
    {
      id: 'synergy',
      icon: <HeartHandshake size={24} color="#F59E0B" />,
      title: "Team Synergy",
      desc: `Over ${Math.floor(totalCombinedMins / 60)} combined study hours logged as partners!`,
      earned: totalCombinedMins >= 300,
      badge: "Partner Milestone"
    },
    {
      id: 'streak',
      icon: <Flame size={24} color="#EF4444" />,
      title: "Streak Masters",
      desc: `Maintained a consecutive study streak of 3 or more days!`,
      earned: p1Stats.streak >= 3 || p2Stats.streak >= 3,
      badge: "Consistency Award"
    },
    {
      id: 'marathon',
      icon: <Zap size={24} color="#06B6D4" />,
      title: "Deep Focus Marathon",
      desc: "Completed at least one focus session lasting 90 minutes or longer.",
      earned: sessions.some(s => s.durationMins >= 90),
      badge: "Endurance Trophy"
    }
  ];

  return (
    <div className="card" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-highlight)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>
            <Trophy size={22} color="#F59E0B" /> Weekly Recap & Trophy Room
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Celebrate your shared milestones, consistency records, and export data for external archiving.
          </p>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={handleExport}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', border: '1px solid var(--border-highlight)' }}
        >
          <Download size={16} color="#10B981" />
          <span>Export History (CSV)</span>
        </button>
      </div>

      {/* Highlights Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>COMBINED EFFORT</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{combinedHours} Hours</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}>
            <Sparkles size={13} /> Great teamwork this month!
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>TOP FOCUS SUBJECT</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {topSubject}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.25rem' }}>
            Most practiced topic this week
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>ACTIVE SESSIONS</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{sessions.length} Logs</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.25rem' }}>
            {p1.name} ({sessions.filter(s=>s.personId==='p1').length}) vs {p2.name} ({sessions.filter(s=>s.personId==='p2').length})
          </div>
        </div>
      </div>

      {/* Trophies Section */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Award size={16} /> Motivational Achievements
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {trophies.map(t => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '1rem',
              background: t.earned ? 'var(--bg-secondary)' : 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${t.earned ? 'var(--border-highlight)' : 'var(--border-color)'}`,
              opacity: t.earned ? 1 : 0.6,
              boxShadow: t.earned ? 'var(--shadow-sm)' : 'none',
              transition: 'var(--transition)'
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: t.earned ? 'var(--bg-hover)' : 'var(--bg-active)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {t.icon}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t.title}
                </span>
                {t.earned && (
                  <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                    <CheckCircle2 size={10} /> Earned
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {t.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
