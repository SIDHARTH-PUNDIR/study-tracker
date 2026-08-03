import React from 'react';

export default function Landing({ onNavigate }) {
  return (
    <div className="page-wrapper" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ maxWidth: '540px', width: '100%', padding: '2rem 1rem' }}>
        <h1 className="heading-large" style={{ marginBottom: '0.75rem' }}>
          StudyRoom
        </h1>
        <p className="text-muted" style={{ marginBottom: '2.5rem', fontSize: '1.1rem' }}>
          A silent, minimalist shared space for deep focus and real-time accountability.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => onNavigate('login')}
            style={{ minWidth: '130px', padding: '0.75rem 1.5rem' }}
          >
            Log in
          </button>
          <button 
            className="btn" 
            onClick={() => onNavigate('signup')}
            style={{ minWidth: '130px', padding: '0.75rem 1.5rem' }}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}
