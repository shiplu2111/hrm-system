import { useState } from 'react';
import { Building2, Loader2, Shield, Sun, Moon, UserRound } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ApiError, type PortalKind } from '../lib/portal-auth';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Form';

const PORTAL_META: Record<
  PortalKind,
  {
    title: string;
    subtitle: string;
    icon: typeof Shield;
    dark?: boolean;
    tenantRequired: boolean;
    defaultEmail: string;
    defaultTenant: string;
  }
> = {
  admin: {
    title: 'Company Portal',
    subtitle: 'HR operations and employee self-service',
    icon: Building2,
    tenantRequired: true,
    defaultEmail: 'admin@cmsnbd.com',
    defaultTenant: 'demo',
  },
  employee: {
    title: 'Employee Portal',
    subtitle: 'Self-service dashboard for employees',
    icon: UserRound,
    tenantRequired: true,
    defaultEmail: 'employee@cmsnbd.com',
    defaultTenant: 'demo',
  },
  platform: {
    title: 'Super Admin',
    subtitle: 'Platform control plane',
    icon: Shield,
    dark: true,
    tenantRequired: false,
    defaultEmail: 'super@cmsnbd.com',
    defaultTenant: '',
  },
};

export function PortalLoginPage({
  portal,
  onLogin,
}: {
  portal: PortalKind;
  onLogin: (
    email: string,
    password: string,
    tenantSubdomain?: string,
  ) => Promise<void>;
}) {
  const meta = PORTAL_META[portal];
  const Icon = meta.icon;
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenant, setTenant] = useState(meta.defaultTenant);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onLogin(
        email.trim(),
        password,
        meta.tenantRequired ? tenant.trim() : undefined,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 py-10 ${
        meta.dark
          ? 'bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900'
          : 'bg-gradient-to-br from-slate-100 via-blue-50/40 to-indigo-100/60 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30'
      }`}
    >
      <button
        type="button"
        onClick={toggleTheme}
        className={`absolute top-5 right-5 p-2 rounded-lg ${
          meta.dark
            ? 'text-slate-400 hover:text-white hover:bg-white/10'
            : 'text-secondary hover:text-primary hover:bg-white/60 dark:hover:bg-slate-800/60'
        }`}
      >
        {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white mb-4 ${
              meta.dark
                ? 'bg-gradient-to-tr from-indigo-600 to-violet-500'
                : 'bg-gradient-to-tr from-blue-600 to-cyan-500'
            }`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <h1
            className={`text-2xl font-bold ${
              meta.dark ? 'text-white' : 'text-primary'
            }`}
          >
            {meta.title}
          </h1>
          <p className={`text-sm mt-1 ${meta.dark ? 'text-indigo-200' : 'text-muted'}`}>
            {meta.subtitle}
          </p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className={`rounded-3xl border p-6 space-y-4 shadow-xl ${
            meta.dark
              ? 'bg-slate-950/90 border-indigo-400/20'
              : 'bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700'
          }`}
        >
          {meta.tenantRequired && (
            <div>
              <Label>Tenant subdomain</Label>
              <Input
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                placeholder="demo"
                autoComplete="organization"
              />
            </div>
          )}

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>

          {/* Quick Demo Fill Buttons */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${meta.dark ? 'text-slate-400' : 'text-secondary'}`}>
                Quick Fill Credentials:
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail(meta.defaultEmail);
                  setPassword('password');
                  if (meta.tenantRequired && !tenant) {
                    setTenant(meta.defaultTenant);
                  }
                  setError(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  meta.dark
                    ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary hover:bg-slate-100 dark:hover:bg-slate-700/80'
                }`}
              >
                ⚡ {portal === 'platform' ? 'Super Admin' : 'Admin'}
              </button>

              {portal === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setEmail('employee@cmsnbd.com');
                    setPassword('password');
                    if (meta.tenantRequired && !tenant) {
                      setTenant('demo');
                    }
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    meta.dark
                      ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary hover:bg-slate-100 dark:hover:bg-slate-700/80'
                  }`}
                >
                  ⚡ Employee
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
