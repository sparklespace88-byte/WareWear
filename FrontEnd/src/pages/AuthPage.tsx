import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';

type AuthMode = 'login' | 'register' | 'forgot';

export const AuthPage: React.FC = () => {
  const { currentPath, navigate, login, register, showToast } = useStore();
  const redirectTo = new URLSearchParams(currentPath.split('?')[1] ?? '').get('redirect') || '/account';

  const [mode, setMode] = useState<AuthMode>('login');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  // Forgot password state
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codePreview, setCodePreview] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedUser = await login(loginEmail, loginPassword, rememberMe);
      showToast(`Welcome back, ${loggedUser.fullName}.`, 'success');
      navigate(loggedUser.role === 'admin' && redirectTo === '/account' ? '/admin' : redirectTo);
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regPassword !== regConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await register({
        fullName: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        confirmPassword: regConfirm,
      });
      showToast(`Account created for ${created.fullName}.`, 'success');
      navigate(redirectTo);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string; verificationCodePreview?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: resetEmail, phoneLast4 }),
        }
      );
      if (res.verificationCodePreview) {
        setCodePreview(res.verificationCodePreview);
      }
      setResetStep('confirm');
      showToast(res.message, 'info');
    } catch (err: any) {
      setError(err.message || 'Could not verify account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword }),
      });
      showToast(res.message, 'success');
      setMode('login');
      setLoginEmail(resetEmail);
      setResetStep('request');
      setCodePreview('');
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white border border-black/10 p-7 sm:p-9">
        <div className="text-center mb-7">
          <p className="font-display text-lg font-bold tracking-[0.18em] text-[#111111]">
            WAREWEAR
          </p>
          <h1 className="font-display text-2xl font-bold text-[#111111] mt-2">
            {mode === 'login'
              ? 'Sign In'
              : mode === 'register'
              ? 'Create Account'
              : 'Reset Password'}
          </h1>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 border border-black/15 p-1 mb-6 bg-[#F7F7F7]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`py-2 text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'login' ? 'bg-[#111111] text-white' : 'text-[#555555]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`py-2 text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'register' ? 'bg-[#111111] text-white' : 'text-[#555555]'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#333333] mb-1">Email Address</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#333333] mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full border border-black/20 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:border-[#111111]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-[#555555] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-[#111111]"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError('');
                }}
                className="text-[#111111] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[#111111] text-white text-sm font-semibold hover:bg-[#333333] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#333333] mb-1">Full Name</label>
              <input
                type="text"
                required
                minLength={2}
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#333333] mb-1">Email Address</label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#333333] mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+1 212 555 0140"
                className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#333333] mb-1">
                Password (min. 8 characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#333333] mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[#111111] text-white text-sm font-semibold hover:bg-[#333333] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <div className="space-y-4">
            {resetStep === 'request' ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <p className="text-xs text-[#555555]">
                  Verify your registered email and the last 4 digits of your phone number to receive a reset code.
                </p>
                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1">
                    Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1">
                    Last 4 Digits of Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    pattern="[0-9]{4}"
                    value={phoneLast4}
                    onChange={(e) => setPhoneLast4(e.target.value)}
                    placeholder="0140"
                    className="w-full border border-black/20 px-3.5 py-2.5 text-sm font-mono-tabular focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#111111] text-white text-sm font-semibold cursor-pointer"
                >
                  {submitting ? 'Verifying...' : 'Send Reset Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                {codePreview && (
                  <div className="p-3 bg-[#F7F7F7] border border-black/15 text-xs text-[#111111]">
                    Verification Code: <span className="font-mono-tabular font-bold">{codePreview}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1">
                    6-Character Reset Code
                  </label>
                  <input
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full border border-black/20 px-3.5 py-2.5 text-sm font-mono-tabular uppercase focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1">
                    New Password (min. 8 characters)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#111111] text-white text-sm font-semibold cursor-pointer"
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
