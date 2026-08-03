import React, { useState, useEffect } from 'react';
import { getCurrentUser, logoutUser } from './utils/auth';
import Landing from './components/Landing';
import { SignUpScreen, LogInScreen } from './components/AuthScreens';
import StudyRoom from './components/StudyRoom';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || 'An unexpected runtime rendering error occurred.' };
  }
  componentDidCatch(error, errorInfo) {
    console.error('StudyRoom Rendering Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="page-wrapper" style={{ padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <div className="panel" style={{ maxWidth: '480px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>⚠️ View Disarray Detected</h2>
            <p className="text-muted" style={{ fontSize: '0.95rem' }}>
              We encountered a slight issue while trying to open this study space: <br/>
              <code style={{ fontSize: '0.85rem', color: '#EF4444' }}>{this.state.errorMsg}</code>
            </p>
            <button 
              onClick={() => {
                window.location.hash = '/global';
                window.location.reload();
              }}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Reload Global Study Space
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState(() => getCurrentUser());
  // Directly route authenticated users into the Global Study Room
  const [view, setView] = useState(() => (user ? 'room' : 'landing'));
  
  // Theme management
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('study_room_dark') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('study_room_dark', darkMode.toString());
  }, [darkMode]);

  // Handle URL Hash deep-link routing
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (!user && (hash.startsWith('#/global') || hash === '#global')) {
        setView('login');
      } else if (user && view !== 'room') {
        setView('room');
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [user, view]);

  const handleAuthSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    setView('room');
    window.location.hash = '/global';
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setView('landing');
    window.location.hash = '';
  };

  // Render routing view engine wrapped in ErrorBoundary to prevent any blank screen
  return (
    <ErrorBoundary>
      <main>
        {!user && view === 'landing' && (
          <Landing onNavigate={(nextView) => setView(nextView)} />
        )}

        {!user && view === 'signup' && (
          <SignUpScreen onAuthSuccess={handleAuthSuccess} onNavigate={(nextView) => setView(nextView)} />
        )}

        {!user && view === 'login' && (
          <LogInScreen onAuthSuccess={handleAuthSuccess} onNavigate={(nextView) => setView(nextView)} />
        )}

        {user && view === 'room' && (
          <StudyRoom 
            roomCode="GLOBAL" 
            user={user} 
            onLogout={handleLogout}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />
        )}
      </main>
    </ErrorBoundary>
  );
}
