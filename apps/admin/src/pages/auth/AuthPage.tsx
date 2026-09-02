import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Eye, EyeOff, Mail, Lock, Shield, Key, ArrowLeft, CheckCircle2,
  AlertTriangle, Clock, LogOut, RefreshCw, Fingerprint, Smartphone,
  Building2, Ban, Send, Check,
  Loader2, Chrome, Sun, Moon, UserRound, ArrowRight,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Toggle';
import { useTheme } from '@/context/ThemeContext';

/* ─────────────────────────────────────────────
   Types & Constants
───────────────────────────────────────────── */
type AuthView =
  | 'login'
  | 'login-mobile'
  | 'two-factor'
  | 'forgot-password'
  | 'reset-password'
  | 'pin-setup'
  | 'pin-login'
  | 'lock-screen'
  | 'account-disabled'
  | 'account-locked'
  | 'choose-workspace'
  | 'platform-login';

interface AuthPageProps {
  initialView?: AuthView;
  onSuccess?: (destination?: 'employee' | 'admin' | 'platform') => void;
}

interface TenantBrand {
  id: string;
  name: string;
  subdomain: string;
  initials: string;
  logoClass: string;
  accentLabel: string;
}

const TENANT_BRANDS: TenantBrand[] = [
  { id: 'acme', name: 'Acme Corporation', subdomain: 'acme', initials: 'AC', logoClass: 'from-blue-600 to-cyan-500', accentLabel: 'Ocean blue' },
  { id: 'techflow', name: 'TechFlow Labs', subdomain: 'techflow', initials: 'TF', logoClass: 'from-emerald-600 to-teal-400', accentLabel: 'Emerald' },
  { id: 'globex', name: 'Globex Industries', subdomain: 'globex', initials: 'GI', logoClass: 'from-amber-600 to-orange-500', accentLabel: 'Amber' },
];
const PLATFORM = 'Nexus HR';
const DEMO_EMAIL = 'sarah.chen@acme.com';

/* ─────────────────────────────────────────────
   Shared Layout Shell (centered elevated card)
───────────────────────────────────────────── */
function AuthShell({
  children,
  className = '',
  tenant = TENANT_BRANDS[0],
  platformAdmin = false,
}: {
  children: React.ReactNode;
  className?: string;
  tenant?: TenantBrand;
  platformAdmin?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4 py-8 ${
      platformAdmin
        ? 'bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900'
        : 'bg-gradient-to-br from-slate-100 via-blue-50/40 to-indigo-100/60 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30'
    }`}>
      {/* Subtle brand grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.3) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Ambient glow blobs */}
      <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none ${platformAdmin ? 'bg-indigo-500/15' : 'bg-accent-400/10 dark:bg-accent-600/5'}`} />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-400/10 dark:bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Theme toggle — top right */}
      <button
        onClick={toggleTheme}
        className={`absolute top-5 right-5 p-2 rounded-lg transition-colors z-20 ${platformAdmin ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-secondary hover:text-primary hover:bg-white/60 dark:hover:bg-slate-800/60'}`}
      >
        {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-md auth-card-enter ${className}`}
        style={{ animation: 'authEnter 0.35s cubic-bezier(0.22,0.61,0.36,1) both' }}
      >
        {/* Product Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className={`h-11 w-11 rounded-2xl bg-gradient-to-tr text-white flex items-center justify-center shadow-lg text-sm font-extrabold ${platformAdmin ? 'from-indigo-600 to-violet-500 shadow-indigo-500/30' : `${tenant.logoClass} shadow-slate-500/20`}`}>
              {platformAdmin ? <Shield className="h-6 w-6" /> : tenant.initials}
            </div>
            <div className="text-left">
              <div className={`text-lg font-extrabold leading-none ${platformAdmin ? 'text-white' : 'text-primary'}`}>
                {platformAdmin ? PLATFORM : tenant.name}
              </div>
              <div className={`text-[11px] ${platformAdmin ? 'text-indigo-200' : 'text-muted'}`}>
                {platformAdmin ? 'Platform Administration' : 'Employee & Admin Access'}
              </div>
            </div>
          </div>
        </div>

        {/* Card body */}
        <div className={`backdrop-blur-xl rounded-3xl border shadow-2xl overflow-hidden ${
          platformAdmin
            ? 'bg-slate-950/90 border-indigo-400/20 shadow-black/50'
            : 'bg-white/80 dark:bg-slate-900/80 border-white/60 dark:border-slate-700/60 shadow-slate-900/10 dark:shadow-black/40'
        }`}>
          {children}
        </div>

        {/* Powered by footer */}
        <p className={`text-center text-[11px] mt-6 ${platformAdmin ? 'text-slate-400' : 'text-muted'}`}>
          {platformAdmin ? 'Protected platform-level access by ' : 'Powered by '}
          <span className="font-semibold text-accent-600 dark:text-accent-400">{PLATFORM}</span>{' '}
          · Enterprise Edition
        </p>
      </div>

      <style>{`
        @keyframes authEnter {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
        .shake { animation: shake 0.45s ease both; }
        @keyframes pinWiggle {
          0%,100% { transform: translateX(0) scale(1); }
          20%      { transform: translateX(-5px) scale(1.02); }
          40%      { transform: translateX(5px) scale(1.02); }
          60%      { transform: translateX(-3px); }
          80%      { transform: translateX(3px); }
        }
        .pin-error { animation: pinWiggle 0.4s ease both; }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Field with password toggle
───────────────────────────────────────────── */
function PasswordField({
  value,
  onChange,
  placeholder = 'Enter password',
  id = 'password',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 pl-4 pr-11 rounded-xl border border-[rgb(var(--border-base))] bg-white/60 dark:bg-slate-800/60 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-colors"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function AuthInput({
  icon: Icon,
  ...props
}: { icon?: React.ComponentType<{ className?: string }> } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && (
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
      )}
      <input
        {...props}
        className={`w-full h-11 ${Icon ? 'pl-10' : 'pl-4'} pr-4 rounded-xl border border-[rgb(var(--border-base))] bg-white/60 dark:bg-slate-800/60 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-colors ${props.className ?? ''}`}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Password Strength Meter
───────────────────────────────────────────── */
interface StrengthResult {
  score: 0 | 1 | 2 | 3;
  label: string;
  color: string;
  checks: { label: string; pass: boolean }[];
}
function checkStrength(pwd: string): StrengthResult {
  const checks = [
    { label: 'At least 8 characters', pass: pwd.length >= 8 },
    { label: 'Uppercase letter (A–Z)', pass: /[A-Z]/.test(pwd) },
    { label: 'Lowercase letter (a–z)', pass: /[a-z]/.test(pwd) },
    { label: 'Number (0–9)', pass: /\d/.test(pwd) },
    { label: 'Special character (!@#$…)', pass: /[^A-Za-z0-9]/.test(pwd) },
  ];
  const passed = checks.filter((c) => c.pass).length;
  const score = passed <= 1 ? 0 : passed <= 3 ? 1 : passed === 4 ? 2 : 3;
  const labels = ['Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['bg-rose-500', 'bg-warning-500', 'bg-success-500', 'bg-emerald-500'];
  return { score, label: labels[score], color: colors[score], checks };
}

/* ─────────────────────────────────────────────
   Countdown hook
───────────────────────────────────────────── */
function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return;
    if (seconds <= 0) { setRunning(false); return; }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, running]);
  const reset = (s = initial) => { setSeconds(s); setRunning(true); };
  const fmt = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return { seconds, fmt, done: seconds <= 0, reset };
}

/* ─────────────────────────────────────────────
   1. LOGIN PAGE
───────────────────────────────────────────── */
function LoginView({
  onNavigate,
  tenant,
  onTenantChange,
}: {
  onNavigate: (v: AuthView) => void;
  tenant: TenantBrand;
  onTenantChange: (tenant: TenantBrand) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    // Demo: wrong password triggers error
    if (password !== 'correct') {
      setError('Invalid email or password. Please check your credentials and try again.');
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    } else {
      onNavigate('two-factor');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Tenant brand preview</span>
          <span className="text-[10px] text-muted">Detected from subdomain</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TENANT_BRANDS.map((brand) => (
            <button
              key={brand.id}
              type="button"
              onClick={() => onTenantChange(brand)}
              className={`rounded-xl border p-2 text-left transition-all ${
                tenant.id === brand.id
                  ? 'border-accent-500 ring-2 ring-accent-500/15 bg-accent-50/70 dark:bg-accent-950/30'
                  : 'border-[rgb(var(--border-base))] hover:border-[rgb(var(--border-strong))]'
              }`}
            >
              <div className={`h-7 w-7 rounded-lg bg-gradient-to-tr ${brand.logoClass} text-white flex items-center justify-center text-[9px] font-extrabold mb-1.5`}>
                {brand.initials}
              </div>
              <div className="text-[10px] font-bold text-primary truncate">{brand.name.split(' ')[0]}</div>
              <div className="text-[9px] text-muted">{brand.accentLabel}</div>
            </button>
          ))}
        </div>
      </div>

      {/* "Signing in to" tenant badge */}
      <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-xl bg-accent-50 dark:bg-accent-950/40 border border-accent-200 dark:border-accent-900">
        <div className="h-6 w-6 rounded-md bg-accent-600 flex items-center justify-center">
          <Building2 className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="text-xs text-secondary">
          Signing in to <span className="font-bold text-primary">{tenant.name}</span>
          <span className="text-muted ml-1 font-mono">({tenant.subdomain}.nexushr.com)</span>
        </div>
      </div>

      <h1 className="text-2xl font-extrabold text-primary mb-1">Welcome back</h1>
      <p className="text-sm text-secondary mb-6">Sign in to your workspace</p>

      {/* Error Banner */}
      {error && (
        <div className={`flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm mb-5 ${shaking ? 'shake' : ''}`}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-secondary mb-1.5">
            Work Email or Username
          </label>
          <AuthInput
            icon={Mail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            autoComplete="email"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-secondary">Password</label>
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="text-xs text-accent-600 dark:text-accent-400 font-medium hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <PasswordField value={password} onChange={setPassword} />
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-[rgb(var(--border-strong))] text-accent-600 accent-accent-600"
          />
          <label htmlFor="remember" className="text-sm text-secondary cursor-pointer">
            Keep me signed in for 30 days
          </label>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-accent-600 hover:bg-accent-700 active:bg-accent-800 text-white font-semibold text-sm transition-all shadow-lg shadow-accent-600/25 flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Authenticating...
            </>
          ) : (
            'Sign In to Workspace'
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-[rgb(var(--border-base))]" />
        <span className="text-xs text-muted font-medium">or</span>
        <div className="h-px flex-1 bg-[rgb(var(--border-base))]" />
      </div>

      {/* SSO Button */}
      <button
        type="button"
        className="w-full h-11 rounded-xl border border-[rgb(var(--border-base))] bg-white/60 dark:bg-slate-800/60 hover:bg-[rgb(var(--bg-hover))] text-primary font-semibold text-sm transition-all flex items-center justify-center gap-2.5"
        onClick={() => alert('Redirecting to SSO provider (Okta / Azure AD)...')}
      >
        <div className="h-5 w-5 rounded bg-slate-800 dark:bg-white flex items-center justify-center">
          <Chrome className="h-3.5 w-3.5 text-white dark:text-slate-800" />
        </div>
        Continue with SSO
      </button>

      {/* Demo links */}
      <div className="flex items-center justify-center gap-4 mt-6 text-xs text-muted">
        <button onClick={() => onNavigate('account-locked')} className="hover:text-primary transition-colors">
          Account Locked?
        </button>
        <span>·</span>
        <button onClick={() => onNavigate('login-mobile')} className="hover:text-primary transition-colors">
          Mobile Login →
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   1b. MOBILE LOGIN VARIANT
───────────────────────────────────────────── */
function LoginMobileView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const [method, setMethod] = useState<'password' | 'pin' | 'biometric'>('password');
  const [password, setPassword] = useState('');

  return (
    <div className="p-8">
      <button
        onClick={() => onNavigate('login')}
        className="flex items-center gap-1 text-xs text-muted hover:text-primary mb-5 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to standard login
      </button>

      <div className="flex items-center gap-3 mb-6">
        <Avatar name="Sarah Chen" size="md" />
        <div>
          <div className="font-bold text-primary">Sarah Chen</div>
          <div className="text-xs text-muted">sarah.chen@acme.com · VP Engineering</div>
        </div>
      </div>

      <h2 className="text-xl font-extrabold text-primary mb-1">Mobile Quick Login</h2>
      <p className="text-xs text-secondary mb-5">Choose your preferred sign-in method</p>

      {/* Method Toggle Chips */}
      <div className="flex gap-2 mb-6">
        {(['password', 'pin', 'biometric'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${method === m
              ? 'bg-accent-600 text-white border-accent-600 shadow-md shadow-accent-600/20'
              : 'border-[rgb(var(--border-base))] text-secondary hover:border-accent-400 bg-white/40 dark:bg-slate-800/40'
              }`}
          >
            {m === 'biometric' ? 'Biometric' : m === 'pin' ? 'PIN' : 'Password'}
          </button>
        ))}
      </div>

      {method === 'password' && (
        <div className="space-y-4">
          <PasswordField value={password} onChange={setPassword} placeholder="Enter work password" />
          <button
            className="w-full h-11 rounded-xl bg-accent-600 hover:bg-accent-700 text-white font-semibold text-sm shadow-lg shadow-accent-600/25"
            onClick={() => onNavigate('two-factor')}
          >
            Sign In
          </button>
        </div>
      )}

      {method === 'pin' && (
        <div className="text-center space-y-4">
          <p className="text-sm text-secondary">Use your 6-digit PIN to unlock the app quickly.</p>
          <button
            className="w-full h-11 rounded-xl bg-accent-600 hover:bg-accent-700 text-white font-semibold text-sm shadow-lg shadow-accent-600/25"
            onClick={() => onNavigate('pin-login')}
          >
            Open PIN Entry
          </button>
        </div>
      )}

      {method === 'biometric' && (
        <div className="text-center space-y-5">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-accent-600 to-indigo-500 flex items-center justify-center mx-auto shadow-xl shadow-accent-600/30">
            <Fingerprint className="h-10 w-10 text-white" />
          </div>
          <div>
            <p className="font-semibold text-primary">Touch sensor or Face ID</p>
            <p className="text-xs text-secondary mt-1">Place your finger on the sensor or look at the camera</p>
          </div>
          <button
            className="w-full h-11 rounded-xl bg-accent-600 hover:bg-accent-700 text-white font-semibold text-sm shadow-lg shadow-accent-600/25 flex items-center justify-center gap-2"
            onClick={() => alert('Biometric authentication triggered!')}
          >
            <Fingerprint className="h-4 w-4" /> Authenticate Now
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   2. TWO-FACTOR AUTH (OTP + Method Switcher)
───────────────────────────────────────────── */
function TwoFactorView({
  onNavigate,
}: {
  onNavigate: (v: AuthView) => void;
}) {
  const OTP_LENGTH = 6;
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [method, setMethod] = useState<'app' | 'sms' | 'email'>('app');
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const countdown = useCountdown(30);

  const handleKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleChange = (idx: number, val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 1);
    const next = [...otp];
    next[idx] = digits;
    setOtp(next);
    if (digits && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
    // Auto-submit when filled
    if (next.every((d) => d)) {
      setTimeout(() => {
        if (next.join('') === '123456') {
          onNavigate('choose-workspace');
        }
        else { setError('Incorrect code. Please try again.'); setOtp(Array(OTP_LENGTH).fill('')); inputRefs.current[0]?.focus(); }
      }, 200);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    const next = [...otp];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  };

  return (
    <div className="p-8">
      <button
        onClick={() => onNavigate('login')}
        className="flex items-center gap-1 text-xs text-muted hover:text-primary mb-5 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="h-12 w-12 rounded-2xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center mb-4">
        <Shield className="h-6 w-6 text-accent-600 dark:text-accent-400" />
      </div>

      <h2 className="text-2xl font-extrabold text-primary mb-1">Verify your identity</h2>
      <p className="text-sm text-secondary mb-6">
        {method === 'app' && 'Enter the 6-digit code from your authenticator app.'}
        {method === 'sms' && `We sent a code to your registered phone ending in ••••92.`}
        {method === 'email' && `A verification code was sent to ${DEMO_EMAIL}.`}
      </p>

      {/* Method Selector Chips */}
      <div className="flex gap-1.5 mb-6">
        {(['app', 'sms', 'email'] as const).map((m) => {
          const labels = { app: 'Authenticator App', sms: 'SMS', email: 'Email' };
          return (
            <button
              key={m}
              onClick={() => { setMethod(m); setOtp(Array(OTP_LENGTH).fill('')); setError(''); }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${method === m
                ? 'bg-accent-600 text-white border-accent-600'
                : 'border-[rgb(var(--border-base))] text-secondary hover:border-accent-400 bg-white/40 dark:bg-slate-800/40'
                }`}
            >
              {labels[m]}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs mb-4 shake">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* OTP Input Boxes */}
      <div className="flex gap-2 mb-5" onPaste={handlePaste}>
        {otp.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => { inputRefs.current[idx] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKey(idx, e)}
            className={`flex-1 h-14 rounded-xl border-2 text-center text-xl font-bold text-primary bg-white/60 dark:bg-slate-800/60 focus:outline-none transition-all ${digit
              ? 'border-accent-500 bg-accent-50/50 dark:bg-accent-950/30'
              : 'border-[rgb(var(--border-base))] focus:border-accent-500'
              }`}
          />
        ))}
      </div>

      {/* Countdown + Resend */}
      <div className="flex items-center justify-between text-xs mb-6">
        <span className="text-muted">
          {countdown.done ? 'Code expired.' : <>Resend available in <span className="font-mono font-bold text-primary">{countdown.fmt}</span></>}
        </span>
        <button
          disabled={!countdown.done}
          onClick={() => countdown.reset(30)}
          className="font-semibold text-accent-600 dark:text-accent-400 disabled:opacity-30 disabled:pointer-events-none hover:underline"
        >
          Resend Code
        </button>
      </div>

      {/* Demo hint */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-muted text-center mb-4">
        Demo: type <span className="font-mono font-bold text-primary">123456</span> to proceed
      </div>

      {/* Backup code link */}
      <div className="text-center">
        <button className="text-xs text-muted hover:text-accent-600 transition-colors">
          Use a backup recovery code instead →
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   3. FORGOT PASSWORD
───────────────────────────────────────────── */
function ForgotPasswordView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const countdown = useCountdown(60);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="p-8">
      <button
        onClick={() => onNavigate('login')}
        className="flex items-center gap-1 text-xs text-muted hover:text-primary mb-5 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </button>

      {!sent ? (
        <>
          <div className="h-12 w-12 rounded-2xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center mb-4">
            <Key className="h-6 w-6 text-accent-600 dark:text-accent-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-primary mb-1">Forgot your password?</h2>
          <p className="text-sm text-secondary mb-6">
            Enter your work email and we'll send a secure password reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">Work Email Address</label>
              <AuthInput
                icon={Mail}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-accent-600 hover:bg-accent-700 text-white font-semibold text-sm shadow-lg shadow-accent-600/25 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? 'Sending reset link...' : 'Send Reset Link'}
            </button>
          </form>
        </>
      ) : (
        /* ── SUCCESS STATE (same card, no layout shift) ── */
        <div className="text-center py-4">
          <div className="h-16 w-16 rounded-3xl bg-success-50 dark:bg-success-950/40 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <Mail className="h-8 w-8 text-success-600 dark:text-success-400" />
          </div>
          <h2 className="text-xl font-extrabold text-primary mb-2">Check your inbox</h2>
          <p className="text-sm text-secondary mb-1">
            We've sent a password reset link to
          </p>
          <p className="text-sm font-bold text-primary mb-6">{email || DEMO_EMAIL}</p>
          <p className="text-xs text-muted mb-5">
            The link expires in 15 minutes. Check spam if you don't see it.
          </p>
          <div className="flex items-center justify-center gap-3 text-xs">
            <span className="text-muted">
              {countdown.done ? 'Ready to resend.' : <>Resend in <span className="font-mono font-bold">{countdown.fmt}</span></>}
            </span>
            <button
              disabled={!countdown.done}
              onClick={() => countdown.reset(60)}
              className="font-semibold text-accent-600 dark:text-accent-400 disabled:opacity-30 disabled:pointer-events-none hover:underline"
            >
              Resend Email
            </button>
          </div>
          <button
            onClick={() => onNavigate('reset-password')}
            className="mt-6 text-xs text-muted hover:text-primary transition-colors block w-full"
          >
            I have a reset code → Set new password
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   4. RESET PASSWORD
───────────────────────────────────────────── */
function ResetPasswordView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const strength = checkStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setMismatch(true); return; }
    setMismatch(false);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setDone(true);
    setTimeout(() => onNavigate('login'), 3000);
  };

  return (
    <div className="p-8">
      {!done ? (
        <>
          <div className="h-12 w-12 rounded-2xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-accent-600 dark:text-accent-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-primary mb-1">Set new password</h2>
          <p className="text-sm text-secondary mb-6">Choose a strong password to secure your account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">New Password</label>
              <PasswordField id="new-password" value={password} onChange={setPassword} placeholder="Create a strong password" />

              {/* Strength bar */}
              {password && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[rgb(var(--bg-muted))] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${strength.color}`}
                        style={{ width: `${((strength.score + 1) / 4) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${strength.score >= 2 ? 'text-success-600' : strength.score === 1 ? 'text-warning-600' : 'text-rose-600'}`}>
                      {strength.label}
                    </span>
                  </div>
                  {/* Requirement checklist */}
                  <div className="grid grid-cols-1 gap-1">
                    {strength.checks.map((c) => (
                      <div key={c.label} className="flex items-center gap-2 text-xs">
                        <div className={`h-4 w-4 rounded-full flex items-center justify-center transition-all ${c.pass ? 'bg-success-500' : 'bg-[rgb(var(--bg-muted))]'}`}>
                          {c.pass && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <span className={c.pass ? 'text-success-700 dark:text-success-400' : 'text-muted'}>
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">Confirm New Password</label>
              <PasswordField id="confirm-password" value={confirm} onChange={setConfirm} placeholder="Re-enter your password" />
              {mismatch && <p className="text-xs text-rose-600 mt-1.5 font-medium">Passwords do not match.</p>}
            </div>

            <button
              type="submit"
              disabled={loading || strength.score < 1}
              className="w-full h-11 rounded-xl bg-accent-600 hover:bg-accent-700 text-white font-semibold text-sm shadow-lg shadow-accent-600/25 flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? 'Resetting password...' : 'Reset Password'}
            </button>
          </form>
        </>
      ) : (
        <div className="text-center py-6">
          <div className="h-16 w-16 rounded-3xl bg-success-50 dark:bg-success-950/40 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="h-9 w-9 text-success-600 dark:text-success-400" />
          </div>
          <h2 className="text-xl font-extrabold text-primary mb-2">Password updated!</h2>
          <p className="text-sm text-secondary">
            Your password has been changed successfully.<br />
            <span className="text-muted">Redirecting you to sign in...</span>
          </p>
          <div className="mt-5">
            <Loader2 className="h-5 w-5 animate-spin text-accent-500 mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   5. PIN SETUP & PIN LOGIN (mobile-first)
───────────────────────────────────────────── */
const PIN_LEN = 6;

function PinKeypad({
  onDigit,
  onDelete,
  disabled = false,
}: {
  onDigit: (d: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mx-auto">
      {keys.map((k, i) => (
        k === '' ? <div key={i} /> :
          <button
            key={i}
            disabled={disabled}
            onClick={() => k === '⌫' ? onDelete() : onDigit(k)}
            className={`h-16 rounded-2xl text-xl font-bold transition-all active:scale-95 disabled:opacity-30 ${k === '⌫'
              ? 'bg-[rgb(var(--bg-muted))] text-secondary hover:bg-[rgb(var(--bg-hover))]'
              : 'bg-white dark:bg-slate-800 border border-[rgb(var(--border-base))] text-primary hover:bg-accent-50 dark:hover:bg-accent-950/40 hover:border-accent-300 shadow-sm'
              }`}
          >
            {k}
          </button>
      ))}
    </div>
  );
}

function PinDots({ value, total = PIN_LEN, error = false }: { value: string; total?: number; error?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${error ? 'pin-error' : ''}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${i < value.length
            ? error ? 'bg-rose-500 border-rose-500' : 'bg-accent-600 border-accent-600'
            : 'border-[rgb(var(--border-strong))]'
            }`}
        />
      ))}
    </div>
  );
}

function PinSetupView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const active = step === 'enter' ? pin : confirmPin;
  const setActive = step === 'enter' ? setPin : setConfirmPin;

  const handleDigit = (d: string) => {
    if (active.length >= PIN_LEN) return;
    const next = active + d;
    setActive(next);
    setError('');
    if (next.length === PIN_LEN) {
      if (step === 'enter') {
        setTimeout(() => setStep('confirm'), 300);
      } else {
        if (next === pin) { setDone(true); setTimeout(() => onNavigate('pin-login'), 1500); }
        else { setError('PINs do not match. Try again.'); setConfirmPin(''); }
      }
    }
  };

  return (
    <div className="p-8 text-center space-y-6">
      <div>
        <div className="h-12 w-12 rounded-2xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center mx-auto mb-4">
          <Key className="h-6 w-6 text-accent-600 dark:text-accent-400" />
        </div>
        <h2 className="text-xl font-extrabold text-primary">
          {done ? 'PIN Created!' : step === 'enter' ? 'Create your PIN' : 'Confirm your PIN'}
        </h2>
        <p className="text-xs text-secondary mt-1">
          {done ? 'Your secure PIN has been set.' : step === 'enter' ? 'Choose a 6-digit PIN for quick app access' : 'Re-enter the same PIN to confirm'}
        </p>
      </div>

      {done ? (
        <div className="py-4">
          <CheckCircle2 className="h-12 w-12 text-success-500 mx-auto" />
        </div>
      ) : (
        <>
          <PinDots value={active} error={!!error} />
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
          <PinKeypad onDigit={handleDigit} onDelete={() => { setActive(active.slice(0, -1)); setError(''); }} />
        </>
      )}
    </div>
  );
}

function PinLoginView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const MAX_ATTEMPTS = 3;
  const CORRECT = '123456';

  const handleDigit = (d: string) => {
    if (pin.length >= PIN_LEN) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === PIN_LEN) {
      setTimeout(() => {
        if (next === CORRECT) {
          onNavigate('login');
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          setShakeKey((k) => k + 1);
          setPin('');
          if (newAttempts >= MAX_ATTEMPTS) {
            onNavigate('account-locked');
          } else {
            setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining before temporary lock.`);
          }
        }
      }, 150);
    }
  };

  return (
    <div className="p-8 text-center space-y-5">
      <div className="flex flex-col items-center gap-2">
        <Avatar name="Sarah Chen" size="lg" />
        <div>
          <p className="font-bold text-primary">Sarah Chen</p>
          <p className="text-xs text-muted">VP Engineering · Acme Corporation</p>
        </div>
      </div>

      <h2 className="text-lg font-extrabold text-primary">Enter your PIN</h2>
      <p className="text-xs text-muted">Demo: type <span className="font-mono font-bold text-primary">123456</span></p>

      <div key={shakeKey}>
        <PinDots value={pin} error={!!error} />
      </div>

      {error && (
        <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {attempts > 0 && attempts < MAX_ATTEMPTS && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning-50 dark:bg-warning-950/40 border border-warning-200 dark:border-warning-900 text-warning-700 dark:text-warning-300 text-xs font-semibold">
          <AlertTriangle className="h-3 w-3" />
          {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining before lock
        </div>
      )}

      <PinKeypad onDigit={handleDigit} onDelete={() => { setPin(pin.slice(0, -1)); setError(''); }} />

      <div className="flex items-center justify-center gap-4 text-xs text-muted pt-2">
        <button onClick={() => onNavigate('login')} className="hover:text-primary transition-colors">
          Forgot PIN? Use password instead
        </button>
        <span>·</span>
        <button
          onClick={() => onNavigate('login-mobile')}
          className="hover:text-primary transition-colors flex items-center gap-1"
        >
          <Fingerprint className="h-3.5 w-3.5" /> Biometric
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   6. LOCK SCREEN
───────────────────────────────────────────── */
function LockScreenView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const unlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd === 'unlock') { onNavigate('login'); }
    else {
      setError('Incorrect password. Try again.');
      setShaking(true); setPwd('');
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div className="p-8">
      {/* Blurred background feel indicator */}
      <div className="absolute inset-0 -z-10 rounded-3xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200/60 via-slate-100/40 to-blue-100/50 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-indigo-950/50 backdrop-blur-sm" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoODB2ODBIMHoiLz48cGF0aCBkPSJNNDAgNDBtLTM4IDBhMzggMzggMCAxIDAgNzYgMGEzOCAzOCAwIDAgMC03NiAwIiBzdHJva2U9InJnYmEoMTAwLDExNiwxMzksMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvZz48L3N2Zz4=')] opacity-20" />
      </div>

      <div className="text-center space-y-5">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted mb-2">
          <Lock className="h-3.5 w-3.5" />
          <span>Session locked due to inactivity</span>
        </div>

        <Avatar name="Sarah Chen" size="lg" className="mx-auto" />
        <div>
          <p className="font-bold text-lg text-primary">Sarah Chen</p>
          <p className="text-xs text-muted">VP Engineering · Acme Corporation</p>
        </div>

        {error && (
          <div className={`flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs ${shaking ? 'shake' : ''}`}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={unlock} className="space-y-3 text-left">
          <label className="block text-xs font-semibold text-secondary">
            Enter password to unlock
          </label>
          <PasswordField value={pwd} onChange={setPwd} placeholder="Your account password" />
          <p className="text-[10px] text-muted">Demo: type <span className="font-mono font-bold">unlock</span></p>
          <button
            type="submit"
            className="w-full h-11 rounded-xl bg-accent-600 hover:bg-accent-700 text-white font-semibold text-sm shadow-lg shadow-accent-600/25 flex items-center justify-center gap-2"
          >
            <Lock className="h-4 w-4" /> Unlock Session
          </button>
        </form>

        <div className="flex items-center justify-center gap-4 text-xs text-muted pt-2">
          <button onClick={() => onNavigate('pin-login')} className="hover:text-primary transition-colors flex items-center gap-1">
            <Key className="h-3.5 w-3.5" /> Use PIN
          </button>
          <span>·</span>
          <button onClick={() => onNavigate('login')} className="hover:text-rose-600 transition-colors flex items-center gap-1">
            <LogOut className="h-3.5 w-3.5" /> Not you? Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   7. ACCOUNT DISABLED
───────────────────────────────────────────── */
function AccountDisabledView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  return (
    <div className="p-8 text-center space-y-5">
      <div className="h-16 w-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mx-auto shadow-inner">
        <Ban className="h-8 w-8 text-rose-600 dark:text-rose-400" />
      </div>

      <div>
        <h2 className="text-xl font-extrabold text-primary">Account disabled</h2>
        <p className="text-sm text-secondary mt-2 leading-relaxed">
          Your account has been disabled by an administrator.<br />
          This is usually a permanent administrative action.
        </p>
      </div>

      {/* Contact Admin Card */}
      <div className="text-left bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-[rgb(var(--border-base))] p-4 space-y-3">
        <p className="text-xs font-bold text-secondary uppercase tracking-wider">Contact your HR Administrator</p>
        <div className="flex items-center gap-2.5 text-sm">
          <div className="h-8 w-8 rounded-lg bg-accent-100 dark:bg-accent-900/50 flex items-center justify-center">
            <Mail className="h-4 w-4 text-accent-600 dark:text-accent-400" />
          </div>
          <span className="text-primary font-medium">hr.admin@acme.com</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm">
          <div className="h-8 w-8 rounded-lg bg-success-100 dark:bg-success-900/50 flex items-center justify-center">
            <Smartphone className="h-4 w-4 text-success-600 dark:text-success-400" />
          </div>
          <span className="text-primary font-medium">+1 (415) 555-0100 ext. 202</span>
        </div>
      </div>

      <button
        className="w-full h-11 rounded-xl bg-accent-600 hover:bg-accent-700 text-white font-semibold text-sm shadow-lg shadow-accent-600/25"
        onClick={() => alert('Opening support ticket form...')}
      >
        Contact Support
      </button>

      <button
        onClick={() => onNavigate('login')}
        className="w-full h-10 rounded-xl border border-[rgb(var(--border-base))] bg-white/60 dark:bg-slate-800/60 hover:bg-[rgb(var(--bg-hover))] text-secondary text-sm font-medium flex items-center justify-center gap-2"
      >
        <LogOut className="h-4 w-4" /> Sign in with a different account
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   8. ACCOUNT LOCKED (temporary, too many attempts)
───────────────────────────────────────────── */
function AccountLockedView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const countdown = useCountdown(14 * 60 + 32); // 14:32

  return (
    <div className="p-8 text-center space-y-5">
      <div className="h-16 w-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mx-auto shadow-inner">
        <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>

      <div>
        <h2 className="text-xl font-extrabold text-primary">Account temporarily locked</h2>
        <p className="text-sm text-secondary mt-2 leading-relaxed">
          Too many failed sign-in attempts. Your account has been locked as a security measure.
          This will automatically unlock — no admin action needed.
        </p>
      </div>

      {/* Visual distinction from "disabled" — this is temporary */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
          Auto-unlock countdown
        </p>
        {countdown.done ? (
          <p className="text-2xl font-mono font-extrabold text-success-600 dark:text-success-400">
            Unlocked! Try again.
          </p>
        ) : (
          <p className="text-3xl font-mono font-extrabold text-amber-700 dark:text-amber-300">
            {countdown.fmt}
          </p>
        )}
        <p className="text-xs text-amber-600 dark:text-amber-500">
          {countdown.done ? 'You may try signing in again.' : 'Wait until the timer expires, or check your email for an instant unlock link.'}
        </p>
      </div>

      {/* Email unlock alternative */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[rgb(var(--border-base))] text-left">
        <Mail className="h-4 w-4 text-accent-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-primary">Instant unlock email sent</p>
          <p className="text-[11px] text-muted mt-0.5">
            We emailed an unlock link to <strong className="text-secondary">s••••@acme.com</strong>. Click it to skip the wait.
          </p>
        </div>
      </div>

      {countdown.done ? (
        <button
          onClick={() => onNavigate('login')}
          className="w-full h-11 rounded-xl bg-accent-600 hover:bg-accent-700 text-white font-semibold text-sm shadow-lg shadow-accent-600/25"
        >
          Try signing in again
        </button>
      ) : (
        <button
          onClick={() => alert('Sending unlock link to your email...')}
          className="w-full h-11 rounded-xl border border-[rgb(var(--border-base))] bg-white/60 dark:bg-slate-800/60 hover:bg-[rgb(var(--bg-hover))] text-primary font-semibold text-sm flex items-center justify-center gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Resend unlock email
        </button>
      )}

      <button
        onClick={() => onNavigate('login')}
        className="text-xs text-muted hover:text-rose-600 transition-colors flex items-center justify-center gap-1.5"
      >
        <LogOut className="h-3.5 w-3.5" /> Sign in with a different account
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROLE ROUTING — MULTI-ROLE WORKSPACE CHOOSER
───────────────────────────────────────────── */
function ChooseWorkspaceView({
  tenant,
  onSuccess,
}: {
  tenant: TenantBrand;
  onSuccess?: (destination?: 'employee' | 'admin' | 'platform') => void;
}) {
  const workspaces = [
    {
      role: 'employee' as const,
      title: 'Continue as Employee',
      description: 'View attendance, leave, payslips and personal requests.',
      icon: UserRound,
    },
    {
      role: 'admin' as const,
      title: 'Continue as Company Admin',
      description: 'Manage people, payroll, policies and company operations.',
      icon: Building2,
    },
  ];

  return (
    <div className="p-8">
      <div className="text-center mb-6">
        <div className={`h-14 w-14 rounded-2xl bg-gradient-to-tr ${tenant.logoClass} text-white flex items-center justify-center mx-auto mb-4 text-sm font-extrabold shadow-lg`}>
          {tenant.initials}
        </div>
        <h2 className="text-2xl font-extrabold text-primary">Choose Workspace</h2>
        <p className="text-sm text-secondary mt-1">You have more than one role at {tenant.name}.</p>
      </div>

      <div className="space-y-3">
        {workspaces.map(({ role, title, description, icon: Icon }) => (
          <button
            key={role}
            onClick={() => onSuccess?.(role)}
            className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-[rgb(var(--border-base))] bg-white/60 dark:bg-slate-800/60 text-left hover:border-accent-400 hover:shadow-card transition-all"
          >
            <div className="h-11 w-11 rounded-xl bg-accent-50 dark:bg-accent-950/50 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary">{title}</p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent-600 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>

      <div className="mt-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-[rgb(var(--border-base))] text-[11px] text-muted leading-relaxed">
        <strong className="text-secondary">Routing note:</strong> Single-role users skip this screen and are sent directly to their assigned dashboard.
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PLATFORM / SUPER ADMIN LOGIN
───────────────────────────────────────────── */
function PlatformLoginView({
  onNavigate,
  onSuccess,
}: {
  onNavigate: (v: AuthView) => void;
  onSuccess?: (destination?: 'employee' | 'admin' | 'platform') => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setLoading(false);
    onSuccess?.('platform');
  };

  return (
    <div className="p-8 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between mb-6">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/20 text-indigo-200 text-[10px] font-bold tracking-wider">
          <Shield className="h-3 w-3" /> PLATFORM ADMIN
        </span>
        <button onClick={() => onNavigate('login')} className="text-[11px] text-slate-400 hover:text-white">
          Tenant login
        </button>
      </div>
      <h2 className="text-2xl font-extrabold text-white">Secure console access</h2>
      <p className="text-sm text-slate-400 mt-1 mb-6">Restricted to authorized Nexus HR platform operators.</p>

      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-orange-500/10 border border-orange-400/20 text-orange-200 text-xs mb-5">
        <Shield className="h-4 w-4 shrink-0 mt-0.5" />
        All platform-level sign-ins and actions are security logged.
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Platform Admin Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@nexushr.com"
            className="w-full h-11 px-4 rounded-xl border border-slate-700 bg-slate-900 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
          <PasswordField value={password} onChange={setPassword} placeholder="Enter secure password" />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-950 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Verifying access…' : 'Enter Platform Console'}
        </button>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN EXPORTED PAGE — View Switcher
───────────────────────────────────────────── */
export function AuthPage({ initialView = 'login', onSuccess }: AuthPageProps) {
  const [view, setView] = useState<AuthView>(initialView);
  const [tenant, setTenant] = useState<TenantBrand>(TENANT_BRANDS[0]);

  const navigate = useCallback((v: AuthView) => setView(v), []);

  // Map each view to its content component
  const renderView = () => {
    switch (view) {
      case 'login':           return <LoginView onNavigate={navigate} tenant={tenant} onTenantChange={setTenant} />;
      case 'login-mobile':    return <LoginMobileView onNavigate={navigate} />;
      case 'two-factor':      return <TwoFactorView onNavigate={navigate} />;
      case 'forgot-password': return <ForgotPasswordView onNavigate={navigate} />;
      case 'reset-password':  return <ResetPasswordView onNavigate={navigate} />;
      case 'pin-setup':       return <PinSetupView onNavigate={navigate} />;
      case 'pin-login':       return <PinLoginView onNavigate={navigate} />;
      case 'lock-screen':     return <LockScreenView onNavigate={navigate} />;
      case 'account-disabled': return <AccountDisabledView onNavigate={navigate} />;
      case 'account-locked':  return <AccountLockedView onNavigate={navigate} />;
      case 'choose-workspace': return <ChooseWorkspaceView tenant={tenant} onSuccess={onSuccess} />;
      case 'platform-login':  return <PlatformLoginView onNavigate={navigate} onSuccess={onSuccess} />;
    }
  };

  return (
    <AuthShell tenant={tenant} platformAdmin={view === 'platform-login'}>
      {renderView()}

      {/* ─── Demo Navigation Panel ─── */}
      <div className="mt-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-white/60 dark:border-slate-700/60 shadow-sm p-4 text-xs">
        <p className="text-center font-bold text-muted uppercase tracking-wider mb-3">
          🎮 Demo: Switch Auth View
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {([
            ['login', 'Login'],
            ['login-mobile', 'Mobile Login'],
            ['two-factor', '2FA'],
            ['forgot-password', 'Forgot Pwd'],
            ['reset-password', 'Reset Pwd'],
            ['pin-setup', 'PIN Setup'],
            ['pin-login', 'PIN Login'],
            ['lock-screen', 'Lock Screen'],
            ['account-disabled', 'Disabled'],
            ['account-locked', 'Locked'],
            ['choose-workspace', 'Choose Workspace'],
            ['platform-login', 'Platform Login'],
          ] as [AuthView, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${view === v
                ? 'bg-accent-600 text-white shadow-sm'
                : 'bg-[rgb(var(--bg-muted))] text-secondary hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
          {onSuccess && (
            <button
              onClick={() => onSuccess('admin')}
              className="px-2.5 py-1 rounded-lg font-semibold bg-[rgb(var(--bg-muted))] text-secondary hover:text-primary transition-all"
            >
              Back to dashboard
            </button>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
