// Storage and calculation utilities for StudySync
import { defaultProfiles, sampleSessions } from './sampleData';

const STORAGE_KEYS = {
  SESSIONS: 'studysync_sessions',
  PROFILES: 'studysync_profiles',
  ACTIVE_PERSON: 'studysync_active_person',
  THEME: 'studysync_theme_dark'
};

export const getProfiles = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
    return data ? JSON.parse(data) : defaultProfiles;
  } catch (e) {
    console.error('Error reading profiles from localStorage', e);
    return defaultProfiles;
  }
};

export const saveProfiles = (profiles) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  } catch (e) {
    console.error('Error saving profiles', e);
  }
};

export const getSessions = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!data) {
      // Seed with sample sessions on first launch so user sees a vibrant interactive app!
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sampleSessions));
      return sampleSessions;
    }
    return JSON.parse(data);
  } catch (e) {
    console.error('Error reading sessions', e);
    return [];
  }
};

export const saveSessions = (sessions) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Error saving sessions', e);
  }
};

export const addSession = (session) => {
  const current = getSessions();
  const newSession = {
    id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: Date.now(),
    ...session
  };
  const updated = [newSession, ...current];
  saveSessions(updated);
  return updated;
};

export const updateSession = (updatedSession) => {
  const current = getSessions();
  const updated = current.map(s => s.id === updatedSession.id ? updatedSession : s);
  saveSessions(updated);
  return updated;
};

export const deleteSession = (sessionId) => {
  const current = getSessions();
  const updated = current.filter(s => s.id !== sessionId);
  saveSessions(updated);
  return updated;
};

export const getActivePersonId = () => {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_PERSON) || 'p1';
};

export const saveActivePersonId = (id) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_PERSON, id);
};

// Calculate consecutive study streaks (in days)
export const calculateStreak = (sessions, personId) => {
  const personSessions = sessions.filter(s => s.personId === personId);
  if (personSessions.length === 0) return 0;

  // Get unique dates sorted descending (newest first)
  const uniqueDates = [...new Set(personSessions.map(s => s.date))].sort().reverse();
  
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  // Streak only lives if latest session is today or yesterday
  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  let currentDate = new Date(uniqueDates[0]);

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i]);
    const diffDays = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      streak++;
      currentDate = prevDate;
    } else {
      break;
    }
  }

  return streak;
};

// Calculate total time for today, past 7 days, and all-time
export const getPersonStats = (sessions, personId) => {
  const personSessions = sessions.filter(s => s.personId === personId);
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Today's total
  const todayMins = personSessions
    .filter(s => s.date === todayStr)
    .reduce((acc, curr) => acc + Number(curr.durationMins), 0);

  // Past 7 days total (including today)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  
  const weeklyMins = personSessions
    .filter(s => s.date >= sevenDaysAgoStr && s.date <= todayStr)
    .reduce((acc, curr) => acc + Number(curr.durationMins), 0);

  // All time total
  const totalMins = personSessions.reduce((acc, curr) => acc + Number(curr.durationMins), 0);
  
  const streak = calculateStreak(sessions, personId);

  return {
    todayMins,
    weeklyMins,
    totalMins,
    streak,
    sessionsCount: personSessions.length
  };
};

// Generate daily series data for comparison chart (last 7 days)
export const getSevenDaySeries = (sessions) => {
  const days = [];
  const p1Daily = [];
  const p2Daily = [];
  const dateLabels = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    
    days.push(dateStr);
    dateLabels.push(i === 0 ? 'Today' : dayLabel);

    const p1Mins = sessions
      .filter(s => s.personId === 'p1' && s.date === dateStr)
      .reduce((sum, s) => sum + Number(s.durationMins), 0);
      
    const p2Mins = sessions
      .filter(s => s.personId === 'p2' && s.date === dateStr)
      .reduce((sum, s) => sum + Number(s.durationMins), 0);

    p1Daily.push(p1Mins);
    p2Daily.push(p2Mins);
  }

  return { days, dateLabels, p1Daily, p2Daily };
};

// Generate friendly encouragement on who is ahead this week
export const getFriendlyLeaderMessage = (p1Stats, p2Stats, profiles) => {
  const p1Name = profiles.p1.name;
  const p2Name = profiles.p2.name;
  const p1Time = p1Stats.weeklyMins;
  const p2Time = p2Stats.weeklyMins;
  const diff = Math.abs(p1Time - p2Time);

  if (diff <= 20) {
    return {
      text: `🤝 Neck and neck! ${p1Name} and ${p2Name} are within ${diff === 0 ? 'a few' : diff} minutes of each other this week! Pure teamwork!`,
      status: 'tie',
      leaderId: null
    };
  }

  if (p1Time > p2Time) {
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins} mins`;
    return {
      text: `🚀 ${p1Name} is ahead by ${timeStr} this week! ${p2Name} is turning up the focus to catch up! 🔥`,
      status: 'p1-lead',
      leaderId: 'p1'
    };
  } else {
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins} mins`;
    return {
      text: `🌟 ${p2Name} took the lead by ${timeStr} this week! ${p1Name}, ready for another focus session? 💪`,
      status: 'p2-lead',
      leaderId: 'p2'
    };
  }
};

// Export all sessions to CSV
export const exportToCSV = (sessions, profiles) => {
  const headers = ['Session ID', 'Date', 'Friend Name', 'Duration (Minutes)', 'Duration (Hours)', 'Subject', 'Notes'];
  const rows = sessions.map(s => {
    const personName = profiles[s.personId]?.name || 'Unknown';
    const hours = (Number(s.durationMins) / 60).toFixed(2);
    // Escape quotes in note and subject
    const safeSubject = `"${(s.subject || '').replace(/"/g, '""')}"`;
    const safeNote = `"${(s.note || '').replace(/"/g, '""')}"`;
    return [s.id, s.date, personName, s.durationMins, hours, safeSubject, safeNote].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `StudySync_History_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Reset to initial sample data (for easy testing & demos)
export const resetToDemoData = () => {
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sampleSessions));
  localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(defaultProfiles));
  return { sessions: sampleSessions, profiles: defaultProfiles };
};
