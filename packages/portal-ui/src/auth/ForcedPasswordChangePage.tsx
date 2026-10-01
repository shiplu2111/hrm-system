import { useState, type ReactNode } from 'react';
import { Check, KeyRound, Loader2, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ApiError } from '../lib/portal-auth';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Form';

export type PasswordRuleKey =
  | 'length'
  | 'lowercase'
  | 'uppercase'
  | 'number'
  | 'special'
  | 'differs'
  | 'matches';

export interface ForcedPasswordChangeCopy {
  title: string;
  subtitle: (email: string) => string;
  currentPassword: string;
  currentPasswordHint: string;
  newPassword: string;
  confirmPassword: string;
  rules: Record<PasswordRuleKey, string>;
  submit: string;
  submitting: string;
  signOut: string;
  showPasswords: string;
  errorMessage: (error: unknown) => string;
}

const DEFAULT_COPY: ForcedPasswordChangeCopy = {
  title: 'Set your own password',
  subtitle: (email) =>
    `${email} was signed in with a temporary password from your administrator. Choose a new one to continue.`,
  currentPassword: 'Temporary password',
  currentPasswordHint: 'The password your administrator gave you',
  newPassword: 'New password',
  confirmPassword: 'Confirm new password',
  rules: {
    length: 'At least 8 characters',
    lowercase: 'A lowercase letter',
    uppercase: 'An uppercase letter',
    number: 'A number',
    special: 'A special character (e.g. ! @ # ?)',
    differs: 'Different from the temporary password',
    matches: 'Both new passwords match',
  },
  submit: 'Save password and continue',
  submitting: 'Saving…',
  signOut: 'Sign out',
  showPasswords: 'Show passwords',
  errorMessage: (error) => {
    if (error instanceof ApiError) {
      if (error.code === 'INVALID_CREDENTIALS') return 'The temporary password is incorrect.';
      return error.message;
    }
    return 'Could not change the password. Try again.';
  },
};

export function evaluatePasswordRules(
  current: string,
  next: string,
  confirm: string,
): Record<PasswordRuleKey, boolean> {
  return {
    length: next.length >= 8 && next.length <= 128,
    lowercase: /[a-z]/.test(next),
    uppercase: /[A-Z]/.test(next),
    number: /[0-9]/.test(next),
    special: /[^A-Za-z0-9]/.test(next),
    differs: next.length > 0 && next !== current,
    matches: next.length > 0 && next === confirm,
  };
}

const RULE_ORDER: PasswordRuleKey[] = [
  'length',
  'lowercase',
  'uppercase',
  'number',
  'special',
  'differs',
  'matches',
];

export function ForcedPasswordChangePage({
  email,
  onSubmit,
  onSignOut,
  copy = DEFAULT_COPY,
  headerStart,
}: {
  email: string;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  onSignOut: () => void;
  copy?: ForcedPasswordChangeCopy;
  headerStart?: ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = evaluatePasswordRules(current, next, confirm);
  const allPass = RULE_ORDER.every((key) => rules[key]);
  const canSubmit = current.length > 0 && allPass && !saving;
  const inputType = reveal ? 'text' : 'password';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    if (current.length < 8) {
      setError(copy.errorMessage(new ApiError('Incorrect password', 401, 'INVALID_CREDENTIALS')));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(current, next);
    } catch (err) {
      setError(copy.errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-100 via-blue-50/40 to-indigo-100/60 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="absolute top-5 right-5 p-2 rounded-lg text-secondary hover:text-primary hover:bg-white/60 dark:hover:bg-slate-800/60"
      >
        {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
      {headerStart ? <div className="absolute top-5 left-5">{headerStart}</div> : null}

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white mb-4 bg-gradient-to-tr from-blue-600 to-cyan-500">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
          <p className="text-sm mt-1 text-muted">{copy.subtitle(email)}</p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-3xl border p-6 space-y-4 shadow-xl bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700"
        >
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />

          <div>
            <Label htmlFor="fpc-current">{copy.currentPassword}</Label>
            <Input
              id="fpc-current"
              type={inputType}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              aria-describedby="fpc-current-hint"
              required
            />
            <p id="fpc-current-hint" className="text-xs text-muted mt-1">
              {copy.currentPasswordHint}
            </p>
          </div>

          <div>
            <Label htmlFor="fpc-new">{copy.newPassword}</Label>
            <Input
              id="fpc-new"
              type={inputType}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              aria-describedby="fpc-rules"
              maxLength={128}
              required
            />
          </div>

          <div>
            <Label htmlFor="fpc-confirm">{copy.confirmPassword}</Label>
            <Input
              id="fpc-confirm"
              type={inputType}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              maxLength={128}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={reveal}
              onChange={(e) => setReveal(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            {copy.showPasswords}
          </label>

          <ul id="fpc-rules" className="space-y-1.5">
            {RULE_ORDER.map((key) => {
              const ok = rules[key];
              return (
                <li
                  key={key}
                  className={`flex items-center gap-1.5 text-xs ${
                    ok ? 'text-success-700 dark:text-success-400' : 'text-muted'
                  }`}
                >
                  {ok ? (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : (
                    <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  {copy.rules[key]}
                </li>
              );
            })}
          </ul>

          {error ? (
            <p role="alert" className="text-sm text-error-600 dark:text-error-400">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.submitting}
              </>
            ) : (
              copy.submit
            )}
          </Button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full text-sm text-secondary hover:text-primary"
          >
            {copy.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}
