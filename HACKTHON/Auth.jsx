import { useState } from 'react';
import { Bus, LockKeyhole, Mail, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { apiRequest, toErrorMessage } from '../api';

export default function Auth({ onLoginSuccess }) {
  const [accountType, setAccountType] = useState('student');
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('admin');
  const [driverId, setDriverId] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const switchAccountType = (type) => {
    setAccountType(type);
    setIsLogin(true);
    setMessage('');
    setIsError(false);
    setPassword('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setIsError(false);
    setSubmitting(true);

    const endpoint = accountType === 'admin'
      ? '/api/auth/admin-login'
      : accountType === 'driver'
        ? '/api/auth/driver-login'
        : isLogin ? '/api/auth/login' : '/api/auth/signup';
    const payload = accountType === 'admin'
      ? { user_id: userId, password }
      : accountType === 'driver'
        ? { driver_id: driverId, password }
        : isLogin ? { email, password } : { full_name: fullName, email, password };

    try {
      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(data.message);
      onLoginSuccess(data.user, data.token);
    } catch (error) {
      setIsError(true);
      setMessage(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand-icon"><Bus size={28} /></div>
        <h1>SmartBus Transit</h1>
        <p className="auth-subtitle">College bus management and student transit</p>

        <div className="auth-type-switch" role="tablist" aria-label="Choose account type">
          <button type="button" role="tab" aria-selected={accountType === 'student'}
            className={accountType === 'student' ? 'selected' : ''}
            onClick={() => switchAccountType('student')}>
            <UserRound size={16} /> Student
          </button>
          <button type="button" role="tab" aria-selected={accountType === 'admin'}
            className={accountType === 'admin' ? 'selected' : ''}
            onClick={() => switchAccountType('admin')}>
            <ShieldCheck size={16} /> Admin
          </button>
          <button type="button" role="tab" aria-selected={accountType === 'driver'}
            className={accountType === 'driver' ? 'selected' : ''}
            onClick={() => switchAccountType('driver')}>
            <UsersRound size={16} /> Driver
          </button>
        </div>

        <h2>{accountType === 'admin' ? 'Administrator login' : accountType === 'driver' ? 'Driver login' : isLogin ? 'Welcome back' : 'Create student account'}</h2>
        <p className="auth-subtitle">
          {accountType === 'admin'
            ? 'Sign in with the administrator credentials.'
            : accountType === 'driver'
              ? 'Sign in with the driver ID and password provided by your administrator.'
              : isLogin ? 'Sign in to view schedules and book a bus seat.' : 'Register with your college email to get started.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {accountType === 'student' && !isLogin && (
            <label className="field">Full name
              <span className="auth-input-wrap"><UserRound size={17} />
                <input required autoComplete="name" value={fullName} placeholder="Your full name"
                  onChange={event => setFullName(event.target.value)} />
              </span>
            </label>
          )}

          {accountType === 'admin' ? (
            <label className="field">Administrator user ID
              <span className="auth-input-wrap"><ShieldCheck size={17} />
                <input required autoComplete="username" value={userId} placeholder="User ID"
                  onChange={event => setUserId(event.target.value)} />
              </span>
            </label>
          ) : accountType === 'driver' ? (
            <label className="field">Driver ID
              <span className="auth-input-wrap"><UsersRound size={17} />
                <input required inputMode="numeric" autoComplete="username" value={driverId} placeholder="Driver ID"
                  onChange={event => setDriverId(event.target.value)} />
              </span>
            </label>
          ) : (
            <label className="field">College email
              <span className="auth-input-wrap"><Mail size={17} />
                <input required type="email" autoComplete="email" value={email} placeholder="student@college.edu"
                  onChange={event => setEmail(event.target.value)} />
              </span>
            </label>
          )}

          <label className="field">Password
            <span className="auth-input-wrap"><LockKeyhole size={17} />
              <input required type="password" autoComplete={isLogin ? 'current-password' : 'new-password'}
                minLength={accountType === 'student' && !isLogin ? 8 : undefined}
                value={password} placeholder="Enter your password"
                onChange={event => setPassword(event.target.value)} />
            </span>
          </label>

          <button className="btn-primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : accountType === 'admin' ? 'Sign in as admin' : accountType === 'driver' ? 'Sign in as driver' : isLogin ? 'Sign in' : 'Create student account'}
          </button>
        </form>

        {message && <p className={`message auth-message ${isError ? 'error' : ''}`} role={isError ? 'alert' : 'status'}>{message}</p>}

        {accountType === 'student' && (
          <p className="auth-switch">
            {isLogin ? 'New to SmartBus?' : 'Already registered?'}{' '}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setMessage(''); setPassword(''); }}>
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        )}
      </section>
    </main>
  );
}
