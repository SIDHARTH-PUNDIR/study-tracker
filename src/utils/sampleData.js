// Sample data generators and seed data for StudySync

const getDaysAgoDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

export const defaultProfiles = {
  p1: {
    id: 'p1',
    name: 'Alex',
    colorTheme: 'amber', // Amber/Orange
    avatar: '🦊',
    dailyGoalMins: 120,
    weeklyGoalMins: 600,
  },
  p2: {
    id: 'p2',
    name: 'Sam',
    colorTheme: 'teal', // Electric Teal/Cyan
    avatar: '🐬',
    dailyGoalMins: 120,
    weeklyGoalMins: 600,
  }
};

export const sampleSessions = [
  // Today's sessions
  { id: 'sec-1', personId: 'p1', date: getDaysAgoDate(0), durationMins: 75, subject: 'Data Structures & Algorithms', note: 'Conquered binary trees and tree traversal algorithms!', timestamp: Date.now() - 3600000 },
  { id: 'sec-2', personId: 'p2', date: getDaysAgoDate(0), durationMins: 90, subject: 'Machine Learning', note: 'Trained random forests on tabular dataset. Great focus!', timestamp: Date.now() - 5000000 },
  
  // 1 day ago (Yesterday)
  { id: 'sec-3', personId: 'p1', date: getDaysAgoDate(1), durationMins: 120, subject: 'System Design', note: 'Studied rate limiting and caching strategies with Redis.', timestamp: Date.now() - 86400000 - 3600000 },
  { id: 'sec-4', personId: 'p2', date: getDaysAgoDate(1), durationMins: 110, subject: 'Spanish Vocabulary', note: 'Memorized 50 new idioms and verb conjugations.', timestamp: Date.now() - 86400000 - 4000000 },

  // 2 days ago
  { id: 'sec-5', personId: 'p1', date: getDaysAgoDate(2), durationMins: 60, subject: 'React & Frontend Architecture', note: 'Custom hooks and performance optimization.', timestamp: Date.now() - 86400000 * 2 },
  { id: 'sec-6', personId: 'p2', date: getDaysAgoDate(2), durationMins: 135, subject: 'Calculus III', note: 'Multiple integrations and differential geometry.', timestamp: Date.now() - 86400000 * 2 - 2000000 },

  // 3 days ago
  { id: 'sec-7', personId: 'p1', date: getDaysAgoDate(3), durationMins: 95, subject: 'Data Structures & Algorithms', note: 'Dynamic programming memoization problems.', timestamp: Date.now() - 86400000 * 3 },
  { id: 'sec-8', personId: 'p2', date: getDaysAgoDate(3), durationMins: 80, subject: 'Machine Learning', note: 'Neural network backpropagation math.', timestamp: Date.now() - 86400000 * 3 - 3000000 },

  // 4 days ago
  { id: 'sec-9', personId: 'p1', date: getDaysAgoDate(4), durationMins: 150, subject: 'System Design', note: 'Database partitioning and sharding case study.', timestamp: Date.now() - 86400000 * 4 },
  { id: 'sec-10', personId: 'p2', date: getDaysAgoDate(4), durationMins: 90, subject: 'Spanish Vocabulary', note: 'Listening comprehension practice with podcasts.', timestamp: Date.now() - 86400000 * 4 - 5000000 },

  // 5 days ago
  { id: 'sec-11', personId: 'p1', date: getDaysAgoDate(5), durationMins: 80, subject: 'React & Frontend Architecture', note: 'State management styling patterns.', timestamp: Date.now() - 86400000 * 5 },
  { id: 'sec-12', personId: 'p2', date: getDaysAgoDate(5), durationMins: 105, subject: 'Calculus III', note: 'Vector field line integrals and Green theorem.', timestamp: Date.now() - 86400000 * 5 - 1000000 },

  // 6 days ago
  { id: 'sec-13', personId: 'p1', date: getDaysAgoDate(6), durationMins: 110, subject: 'Data Structures & Algorithms', note: 'Graph algorithms: Dijkstra and A* shortest paths.', timestamp: Date.now() - 86400000 * 6 },
  { id: 'sec-14', personId: 'p2', date: getDaysAgoDate(6), durationMins: 70, subject: 'Machine Learning', note: 'Regularization techniques L1/L2 loss.', timestamp: Date.now() - 86400000 * 6 - 8000000 },
];
