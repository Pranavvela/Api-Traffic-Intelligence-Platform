import React from 'react';
import PropTypes from 'prop-types';
import { login, registerUser } from '../services/api';
import { setToken } from '../services/auth';

export default function Login({ onLogin }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isRegister, setIsRegister] = React.useState(false);
  let submitLabel = 'Sign in';
  if (loading) {
    submitLabel = 'Please wait...';
  } else if (isRegister) {
    submitLabel = 'Create account';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = isRegister
        ? await registerUser({ email, password })
        : await login({ email, password });

      const token = response?.token;
      if (!token) {
        throw new Error('No token returned from server.');
      }

      setToken(token);
      onLogin();
    } catch (err) {
      const message = err?.response?.data?.message || err.message || 'Login failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.85),rgba(2,6,23,0.98))]" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-soft backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.3em] text-sky-300/80">
            API Sentinel
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white">
            {isRegister ? 'Create an account' : 'Sign in'}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {isRegister
              ? 'Set up a new analyst account to access the console.'
              : 'Authenticate to access the threat intelligence console.'}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                placeholder="analyst@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 pr-11 text-sm text-white focus:border-sky-400 focus:outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-300 transition hover:text-white"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.68 16.68A9.72 9.72 0 0112 18c-5 0-9-6-9-6a17.52 17.52 0 014.64-4.8" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 5.09A9.12 9.12 0 0112 5c5 0 9 7 9 7a18.4 18.4 0 01-2.07 2.8" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12S6 5.25 12 5.25 21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="text-sm text-rose-300">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-500/90 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitLabel}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-slate-400">
            {isRegister ? 'Already have access?' : 'New here?'}{' '}
            <button
              type="button"
              className="text-sky-300 hover:text-sky-200"
              onClick={() => setIsRegister((prev) => !prev)}
            >
              {isRegister ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Login.propTypes = {
  onLogin: PropTypes.func.isRequired,
};
