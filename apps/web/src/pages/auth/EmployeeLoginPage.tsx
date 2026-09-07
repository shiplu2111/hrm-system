import { useState } from 'react';
import { Loader2, Moon, Sun, UserRound } from 'lucide-react';
import { useAppTranslation } from '@hrm/i18n';
import { useTheme, ApiError, Button, Input, Label } from '@hrm/portal-ui';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

export function EmployeeLoginPage({
  onLogin,
}: {
  onLogin: (
    email: string,
    password: string,
    tenantSubdomain?: string,
  ) => Promise<void>;
}) {
  const { t } = useAppTranslation();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('employee@cmsnbd.com');
  const [password, setPassword] = useState('password');
  const [tenant, setTenant] = useState('demo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onLogin(email.trim(), password, tenant.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.signInFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-100 via-blue-50/40 to-indigo-100/60 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-5 right-5 p-2 rounded-lg text-secondary hover:text-primary hover:bg-white/60 dark:hover:bg-slate-800/60"
      >
        {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      <div className="absolute top-5 left-5">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white mb-4 bg-gradient-to-tr from-blue-600 to-cyan-500">
            <UserRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-primary">{t('auth.portalTitle')}</h1>
          <p className="text-sm mt-1 text-muted">{t('auth.portalSubtitle')}</p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-3xl border p-6 space-y-4 shadow-xl bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700"
        >
          <div>
            <Label>{t('auth.tenantSubdomain')}</Label>
            <Input
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              placeholder="demo"
              autoComplete="organization"
            />
          </div>

          <div>
            <Label>{t('auth.email')}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <Label>{t('auth.password')}</Label>
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
                {t('auth.signingIn')}
              </>
            ) : (
              t('auth.signIn')
            )}
          </Button>

          <p className="text-[11px] text-center text-muted">
            {t('auth.demoPassword', { password: 'password' })}
          </p>
        </form>
      </div>
    </div>
  );
}
