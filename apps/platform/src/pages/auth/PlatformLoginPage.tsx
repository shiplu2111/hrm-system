import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Lock,
  LockKeyhole,
  Mail,
  Moon,
  QrCode,
  Shield,
  ShieldAlert,
  Sun,
} from 'lucide-react';
import type { PlatformLogin2faChallenge, PlatformLoginSuccess } from '@hrm/shared-types';
import { platformLogin, platformVerify2fa, ApiError } from '@/lib/api-client';

interface PlatformLoginPageProps {
  onLoginSuccess: (bundle: PlatformLoginSuccess) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

function formatUserFacingError(err: unknown): { title: string; message: string; isLockout?: boolean } {
  if (err instanceof ApiError) {
    if (err.code === 'ACCOUNT_LOCKED') {
      return {
        title: 'Account Temporarily Locked',
        message:
          'Your account has been temporarily locked following 5 failed authentication attempts. Access is paused for 15 minutes to protect platform infrastructure. Please wait before retrying.',
        isLockout: true,
      };
    }
    if (err.code === 'INVALID_2FA_CODE') {
      return {
        title: 'Invalid Verification Code',
        message:
          'The 6-digit TOTP code you entered is incorrect or has expired. Please ensure your device clock is synchronized and enter the latest code from your authenticator app.',
      };
    }
    if (err.code === 'INVALID_CREDENTIALS') {
      return {
        title: 'Authentication Failed',
        message: 'Invalid staff email or password. Please verify your credentials and try again.',
      };
    }
    if (err.code === 'INVALID_MFA_TOKEN') {
      return {
        title: 'Session Expired',
        message: 'Your 2FA challenge window has expired. Please sign in again with your password.',
      };
    }
    return {
      title: 'Sign In Failed',
      message: err.message,
    };
  }
  return {
    title: 'Unexpected Error',
    message: 'Could not connect to the platform auth service. Please check your connection.',
  };
}

export function PlatformLoginPage({
  onLoginSuccess,
  theme,
  onToggleTheme,
}: PlatformLoginPageProps) {
  const [email, setEmail] = useState('platform.owner@cmsnbd.com');
  const [password, setPassword] = useState('password');
  const [totpCode, setTotpCode] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState<PlatformLogin2faChallenge | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ title: string; message: string; isLockout?: boolean } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Handle Step 1 or Direct 1-Step Login
  const handlePrimarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    setLoading(true);

    try {
      const response = await platformLogin(email.trim(), password, totpCode || undefined);

      if ('requires2fa' in response && response.requires2fa) {
        setMfaChallenge(response);
      } else if ('accessToken' in response && response.accessToken) {
        onLoginSuccess(response as PlatformLoginSuccess);
      }
    } catch (err) {
      setErrorInfo(formatUserFacingError(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2 (2FA Verification or Enrolment Confirmation)
  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge?.mfaToken) return;

    setErrorInfo(null);
    setLoading(true);

    try {
      const result = await platformVerify2fa(mfaChallenge.mfaToken, totpCode.trim());
      onLoginSuccess(result);
    } catch (err) {
      setErrorInfo(formatUserFacingError(err));
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (mfaChallenge?.secret) {
      navigator.clipboard.writeText(mfaChallenge.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200">
      {/* 1. Unmissable top coloured visual cue */}
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 shadow-md" />

      {/* Header bar */}
      <div className="p-4 sm:p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-950/50">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-white">
            CMSN-HR Platform
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider">
            ROOT CONSOLE
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Form Header */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 mb-4 shadow-sm">
              {mfaChallenge?.setupRequired ? (
                <QrCode className="h-6 w-6" />
              ) : mfaChallenge ? (
                <KeyRound className="h-6 w-6" />
              ) : (
                <LockKeyhole className="h-6 w-6" />
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {mfaChallenge?.setupRequired
                ? '2FA Device Enrollment'
                : mfaChallenge
                  ? 'Two-Factor Authentication'
                  : 'Super Admin Sign In'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {mfaChallenge?.setupRequired
                ? 'Scan the QR code or enter the secret in your authenticator'
                : mfaChallenge
                  ? 'Enter the 6-digit TOTP code from your authenticator app'
                  : 'Platform staff identity layer · Mandatory 2FA enforced'}
            </p>
          </div>

          {/* Error Banner with Human-Readable Messages */}
          {errorInfo && (
            <div
              className={`mb-5 p-3.5 rounded-2xl border text-xs flex items-start gap-3 animate-fade-in ${
                errorInfo.isLockout
                  ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                  : 'bg-red-950/50 border-red-800/60 text-red-200'
              }`}
            >
              <AlertTriangle
                className={`h-4 w-4 shrink-0 mt-0.5 ${
                  errorInfo.isLockout ? 'text-amber-400' : 'text-red-400'
                }`}
              />
              <div className="space-y-0.5">
                <div className="font-bold text-white">{errorInfo.title}</div>
                <div className="text-[11px] leading-relaxed opacity-90">{errorInfo.message}</div>
              </div>
            </div>
          )}

          {/* Security alert box */}
          {!errorInfo && (
            <div className="mb-5 p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200/90 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Privileged Environment:</strong> Zero tenant access keys. All logins are verified against <code className="font-mono text-amber-300">aud: platform</code>.
              </div>
            </div>
          )}

          {/* 1. PASSWORD SCREEN */}
          {!mfaChallenge && (
            <form onSubmit={handlePrimarySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Platform Staff Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@platform.local"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    TOTP Code (Optional for 1-Step Login)
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">6 digits</span>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm font-mono tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-950/60 disabled:opacity-50 transition-all"
              >
                {loading ? 'Authenticating...' : 'Sign In to Platform'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* 2. 2FA ENROLMENT SCREEN (FIRST-TIME OR RESET) */}
          {mfaChallenge?.setupRequired && (
            <form onSubmit={handleVerify2fa} className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-3">
                <div className="text-xs font-bold text-slate-300">
                  Scan QR code with Google Authenticator or 1Password:
                </div>
                {mfaChallenge.qrUri && (
                  <div className="flex justify-center p-2 bg-white rounded-xl mx-auto w-fit shadow-md">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        mfaChallenge.qrUri,
                      )}`}
                      alt="TOTP 2FA QR Code"
                      className="h-36 w-36"
                    />
                  </div>
                )}
                <div className="pt-2">
                  <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                    Or Enter Manual Secret Key:
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <code className="text-xs font-mono font-bold text-amber-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 tracking-wider">
                      {mfaChallenge.secret}
                    </code>
                    <button
                      type="button"
                      onClick={copySecret}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors flex items-center gap-1"
                      title="Copy Secret"
                    >
                      {copiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Confirm 6-Digit Code from Authenticator:
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
                  <input
                    type="text"
                    autoFocus
                    required
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-950/90 border border-amber-500/50 text-base font-mono tracking-[0.25em] text-center text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || totpCode.length < 6}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-950/60 disabled:opacity-50 transition-all"
              >
                {loading ? 'Enrolling...' : 'Verify & Complete Enrollment'}
                <CheckCircle2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMfaChallenge(null);
                  setTotpCode('');
                }}
                className="w-full text-xs text-slate-400 hover:text-white transition-colors text-center pt-1"
              >
                &larr; Back to password login
              </button>
            </form>
          )}

          {/* 3. 2FA VERIFICATION SCREEN (ACTIVE ENROLLMENT) */}
          {mfaChallenge && !mfaChallenge.setupRequired && (
            <form onSubmit={handleVerify2fa} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  6-Digit Security Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
                  <input
                    type="text"
                    autoFocus
                    required
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-950/90 border border-amber-500/50 text-base font-mono tracking-[0.25em] text-center text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || totpCode.length < 6}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-950/60 disabled:opacity-50 transition-all"
              >
                {loading ? 'Verifying 2FA...' : 'Complete 2FA Sign In'}
                <CheckCircle2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMfaChallenge(null);
                  setTotpCode('');
                }}
                className="w-full text-xs text-slate-400 hover:text-white transition-colors text-center pt-1"
              >
                &larr; Back to password login
              </button>
            </form>
          )}

          {/* Local Dev Helper Info & Role Quick-Select */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
            <div className="font-bold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Seeded Platform Roles:</span>
              <span className="text-[10px] text-amber-400/80 font-normal">Click to auto-fill</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {[
                { label: 'Platform Owner', email: 'platform.owner@cmsnbd.com' },
                { label: 'Billing Admin', email: 'billing.admin@cmsnbd.com' },
                { label: 'Support Agent', email: 'support.agent@cmsnbd.com' },
                { label: 'Compliance Admin', email: 'compliance.admin@cmsnbd.com' },
                { label: 'Read-Only Auditor', email: 'auditor@cmsnbd.com' },
              ].map((r) => (
                <button
                  key={r.email}
                  type="button"
                  onClick={() => {
                    setEmail(r.email);
                    setPassword('password');
                    setTotpCode('');
                    setErrorInfo(null);
                  }}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition-all ${
                    email === r.email
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div>Password for all accounts: <code className="text-amber-400">password</code></div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-[11px] text-slate-500">
        CMSN-HR Platform Staff Infrastructure · Confidential & Proprietary
      </div>
    </div>
  );
}
