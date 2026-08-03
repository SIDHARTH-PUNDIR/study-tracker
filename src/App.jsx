import React, { useState, useEffect } from 'react';
import { getCurrentUser, logoutUser } from './utils/auth';
import Landing from './components/Landing';
import { SignUpScreen, LogInScreen } from './components/AuthScreens';
import Dashboard from './components/Dashboard';
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
                localStorage.removeItem('last_active_room_code');
                window.location.hash = '/dashboard';
                window.location.reload();
              }}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Return to Safe Dashboard
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
  const [view, setView] = useState(() => (user ? 'dashboard' : 'landing'));
  const [activeRoomCode, setActiveRoomCode] = useState('');
  
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

  // Handle URL Hash deep-link routing (e.g. #/room/ZEN-44)
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/room/') || hash.startsWith('#room/')) {
        const code = hash.split('/').pop();
        if (code) {
          setActiveRoomCode(code.toUpperCase());
          if (user) {
            setView('room');
          } else {
            // Remember room to jump in right after auth completes
            localStorage.setItem('pending_room_join', code.toUpperCase());
            setView('login');
          }
        }
      } else if (hash.startsWith('#/dashboard') || hash === '#dashboard' || hash === '') {
        if (user && view === 'room' && !activeRoomCode) {
          setView('dashboard');
        }
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [user, view, activeRoomCode]);

  const handleAuthSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    const pendingRoom = localStorage.getItem('pending_room_join') || localStorage.getItem('last_active_room_code');
    if (pendingRoom && window.location.hash.includes(pendingRoom)) {
      localStorage.removeItem('pending_room_join');
      setActiveRoomCode(pendingRoom);
      setView('room');
      window.location.hash = `/room/${pendingRoom}`;
    } else {
      setView('dashboard');
      window.location.hash = '/dashboard';
    }
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setActiveRoomCode('');
    setView('landing');
    window.location.hash = '';
  };

  const handleJoinRoom = (code) => {
    setActiveRoomCode(code);
    setView('room');
    window.location.hash = `/room/${code}`;
  };

  const handleLeaveRoom = () => {
    setActiveRoomCode('');
    setView('dashboard');
    window.location.hash = '/dashboard';
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

        {user && view === 'dashboard' && (
          <Dashboard user={user} onLogout={handleLogout} onJoinRoom={handleJoinRoom} />
        )}

        {user && view === 'room' && activeRoomCode && (
          <StudyRoom 
            roomCode={activeRoomCode} 
            user={user} 
            onLeaveRoom={handleLeaveRoom}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />
        )}
      </main>
    </ErrorBoundary>
  );
}
