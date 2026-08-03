import React, { useState } from 'react';
import { signUpUser, logInUser } from '../utils/auth';

export function SignUpScreen({ onAuthSuccess, onNavigate }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const user = await signUpUser(name, phone, password);
      onAuthSuccess(user);
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="panel" style={{ width: '100%', maxWidth: '420px' }}>
        <h2 className="heading-sub" style={{ marginBottom: '1.5rem' }}>Create ID</h2>

        {error && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid #EF4444', borderRadius: 'var(--radius)', color: '#EF4444', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp}>
          <div className="field-group">
            <label className="field-label">Full Name</label>
            <input 
              type="text" 
              required 
              className="field-input" 
              placeholder="Alex Smith"
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />
          </div>

          <div className="field-group">
            <label className="field-label">Phone Number</label>
            <input 
              type="tel" 
              required 
              className="field-input" 
              placeholder="+1 555 123 4567"
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
            />
          </div>

          <div className="field-group">
            <label className="field-label">Password</label>
            <input 
              type="password" 
              required 
              className="field-input" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <div className="field-group" style={{ marginBottom: '2rem' }}>
            <label className="field-label">Confirm Password</label>
            <input 
              type="password" 
              required 
              className="field-input" 
              placeholder="••••••••"
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
            <button type="button" className="btn btn-subtle" onClick={() => onNavigate('login')} style={{ textAlign: 'center' }}>
              Already have an ID? Log in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LogInScreen({ onAuthSuccess, onNavigate }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await logInUser(phone, password);
      onAuthSuccess(user);
    } catch (err) {
      setError(err.message || 'Login failed. Verify phone and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="panel" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 className="heading-sub" style={{ marginBottom: '1.5rem' }}>Log In</h2>

        {error && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid #EF4444', borderRadius: 'var(--radius)', color: '#EF4444', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogIn}>
          <div className="field-group">
            <label className="field-label">Phone Number</label>
            <input 
              type="tel" 
              required 
              className="field-input" 
              placeholder="+1 555 123 4567"
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
            />
          </div>

          <div className="field-group" style={{ marginBottom: '2rem' }}>
            <label className="field-label">Password</label>
            <input 
              type="password" 
              required 
              className="field-input" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
            <button type="button" className="btn btn-subtle" onClick={() => onNavigate('signup')} style={{ textAlign: 'center' }}>
              Need an account? Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
