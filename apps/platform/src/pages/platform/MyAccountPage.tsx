import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  QrCode,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
} from 'lucide-react';
import type {
  PlatformLoginHistoryView,
  PlatformSessionView,
  PlatformTotpSetupView,
  PlatformUserView,
} from '@hrm/shared-types';
import {
  changePlatformPassword,
  confirmPlatform2fa,
  fetchPlatformLoginHistory,
  fetchPlatformProfile,
  fetchPlatformSessions,
  revokeOtherPlatformSessions,
  revokePlatformSession,
  setupPlatform2fa,
  ApiError,
} from '@/lib/api-client';
import { Modal } from '@/components/ui/Modal';

interface MyAccountPageProps {
  currentUser: PlatformUserView | null;
  onProfileUpdated?: (user: PlatformUserView) => void;
}

export function MyAccountPage({ currentUser, onProfileUpdated }: MyAccountPageProps) {
  const [activeTab, setActiveTab] = useState<'security' | 'sessions' | 'history'>('security');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Sessions state
  const [sessions, setSessions] = useState<PlatformSessionView[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionActionLoading, setSessionActionLoading] = useState(false);

  // Login history state
  const [loginHistory, setLoginHistory] = useState<PlatformLoginHistoryView[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 2FA Reconfiguration modal state
  const [reconfigure2faOpen, setReconfigure2faOpen] = useState(false);
  const [totpSetup, setTotpSetup] = useState<PlatformTotpSetupView | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpSuccess, setTotpSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Load sessions
  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await fetchPlatformSessions();
      setSessions(data);
    } catch {
      // Handled silently
    } finally {
      setSessionsLoading(false);
    }
  };

  // Load login history
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchPlatformLoginHistory();
      setLoginHistory(data);
    } catch {
      // Handled silently
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sessions') {
      loadSessions();
    } else if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password confirmation does not match. Please verify and retype.');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePlatformPassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully. Your active session remains authenticated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CURRENT_PASSWORD') {
        setPasswordError('The current password you entered is incorrect. Please verify and try again.');
      } else if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else {
        setPasswordError('Failed to change password. Please check your connection and retry.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setSessionActionLoading(true);
    try {
      await revokePlatformSession(sessionId);
      await loadSessions();
    } finally {
      setSessionActionLoading(false);
    }
  };

  const handleRevokeOthers = async () => {
    setSessionActionLoading(true);
    try {
      await revokeOtherPlatformSessions();
      await loadSessions();
    } finally {
      setSessionActionLoading(false);
    }
  };

  const handleStart2faSetup = async () => {
    setTotpLoading(true);
    setTotpError(null);
    setTotpSuccess(false);
    setTotpVerifyCode('');
    try {
      const setup = await setupPlatform2fa();
      setTotpSetup(setup);
      setReconfigure2faOpen(true);
    } catch (err) {
      alert('Failed to initiate 2FA setup. Please try again.');
    } finally {
      setTotpLoading(false);
    }
  };

  const handleConfirm2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpSetup) return;

    setTotpLoading(true);
    setTotpError(null);
    try {
      await confirmPlatform2fa(totpSetup.secret, totpVerifyCode.trim());
      setTotpSuccess(true);
      if (onProfileUpdated) {
        const updated = await fetchPlatformProfile();
        onProfileUpdated(updated);
      }
      setTimeout(() => {
        setReconfigure2faOpen(false);
        setTotpSuccess(false);
      }, 1500);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_2FA_CODE') {
        setTotpError(
          'The 6-digit code you entered did not match. Please verify your device clock and re-enter.',
        );
      } else if (err instanceof ApiError) {
        setTotpError(err.message);
      } else {
        setTotpError('Verification failed. Please retry.');
      }
    } finally {
      setTotpLoading(false);
    }
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return 'Standard Web Session';
    if (ua.includes('Chrome')) return 'Google Chrome';
    if (ua.includes('Firefox')) return 'Mozilla Firefox';
    if (ua.includes('Safari')) return 'Apple Safari';
    if (ua.includes('curl') || ua.includes('node')) return 'API CLI Client';
    return ua.slice(0, 32);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Page Title & Profile Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center font-extrabold text-xl shadow-md">
              {currentUser?.firstName?.[0] || 'P'}
              {currentUser?.lastName?.[0] || 'O'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {currentUser?.firstName} {currentUser?.lastName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {currentUser?.roleName}
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5 font-mono">{currentUser?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Mandatory 2FA Active</span>
            </span>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          {[
            { id: 'security', label: 'Password & Security', icon: Lock },
            { id: 'sessions', label: 'Active Sessions', icon: Laptop },
            { id: 'history', label: 'Login History', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                    : 'text-secondary hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: PASSWORD & SECURITY */}
      {activeTab === 'security' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Change Password Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-card space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-500" />
                Change Password
              </h2>
              <p className="text-xs text-secondary mt-1">
                Update your platform staff credentials. Password changes take effect immediately.
              </p>
            </div>

            {passwordSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{passwordSuccess}</div>
              </div>
            )}

            {passwordError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{passwordError}</div>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading || !currentPassword || !newPassword}
                className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40 transition-colors shadow-sm"
              >
                {passwordLoading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          </div>

          {/* 2FA Configuration Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-card space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Two-Factor Authentication (2FA)
              </h2>
              <p className="text-xs text-secondary mt-1">
                Mandatory for all platform staff per <code className="text-[11px]">docs/SECURITY.md</code>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Status: Enforced & Active
              </div>
              <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
                Your account requires an RFC 6238 TOTP code from an authenticator app on every sign in.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Replace or Reconfigure Authenticator:
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                If you lost access to your device or switched to a new authenticator, you can generate a new secret and verify it.
              </p>

              <button
                type="button"
                onClick={handleStart2faSetup}
                disabled={totpLoading}
                className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <QrCode className="h-4 w-4 text-amber-500" />
                {totpLoading ? 'Generating Secret...' : 'Re-enroll Authenticator App'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Laptop className="h-4 w-4 text-amber-500" />
                Active Platform Sessions
              </h2>
              <p className="text-xs text-secondary mt-1">
                Devices currently authenticated with a valid rotating refresh token.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadSessions}
                className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Refresh sessions list"
              >
                <RefreshCw className={`h-4 w-4 ${sessionsLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleRevokeOthers}
                disabled={sessionActionLoading || sessions.length <= 1}
                className="h-9 px-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                Revoke All Other Sessions
              </button>
            </div>
          </div>

          {sessionsLoading ? (
            <div className="py-12 text-center text-xs text-secondary">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-secondary">No sessions recorded.</div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    session.isRevoked
                      ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-60'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <Laptop className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {parseUserAgent(session.userAgent)}
                        </span>
                        {session.isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Current Session
                          </span>
                        )}
                        {session.isRevoked && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-secondary mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="font-mono">{session.ipAddress || '127.0.0.1'}</span>
                        <span>·</span>
                        <span>Started {new Date(session.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {!session.isRevoked && !session.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={sessionActionLoading}
                      className="h-8 px-3 rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold self-start sm:self-auto transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LOGIN HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-card space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Login History
              </h2>
              <p className="text-xs text-secondary mt-1">
                Records from <code className="text-[11px]">platform_login_history</code>.
              </p>
            </div>

            <button
              type="button"
              onClick={loadHistory}
              className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh login history"
            >
              <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {historyLoading ? (
            <div className="py-12 text-center text-xs text-secondary">Loading history...</div>
          ) : loginHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-secondary">No login events found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] uppercase font-bold text-secondary">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Details / Failure Reason</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3">Client</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {loginHistory.map((entry) => {
                    const statusTone =
                      entry.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : entry.status === 'locked'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                          : entry.status === '2fa_challenge'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 whitespace-nowrap text-secondary">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${statusTone}`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-sans text-slate-800 dark:text-slate-200">
                          {entry.failureReason || 'Authenticated successfully'}
                        </td>
                        <td className="px-4 py-3 text-secondary">{entry.ipAddress || '127.0.0.1'}</td>
                        <td className="px-4 py-3 font-sans text-secondary truncate max-w-[200px]">
                          {parseUserAgent(entry.userAgent)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2FA Reconfiguration Modal */}
      {reconfigure2faOpen && totpSetup && (
        <Modal
          open={reconfigure2faOpen}
          onClose={() => setReconfigure2faOpen(false)}
          title="Reconfigure Authenticator App (2FA)"
        >
          <div className="space-y-4">
            <p className="text-xs text-secondary leading-relaxed">
              Scan this QR code with Google Authenticator, 1Password, or Authy, then enter the 6-digit verification code to confirm.
            </p>

            <div className="p-3 bg-white rounded-2xl mx-auto w-fit shadow-sm">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                  totpSetup.qrUri,
                )}`}
                alt="2FA QR Code"
                className="h-40 w-40"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-[10px] text-secondary uppercase font-mono">Manual Secret Key</div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <code className="text-xs font-mono font-bold text-amber-500 tracking-wider">
                  {totpSetup.secret}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(totpSetup.secret);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {totpSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                2FA successfully reconfigured!
              </div>
            )}

            {totpError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {totpError}
              </div>
            )}

            <form onSubmit={handleConfirm2fa} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Enter 6-Digit Code to Confirm:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpVerifyCode}
                  onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center font-mono text-base tracking-[0.25em] focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReconfigure2faOpen(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={totpLoading || totpVerifyCode.length < 6}
                  className="h-10 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-40 transition-colors"
                >
                  {totpLoading ? 'Verifying...' : 'Confirm & Save'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
