const AVATAR_COLORS = [
  'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
  'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
  'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
];

export function CandidateAvatar({
  name,
  size = 'sm',
}: {
  name: string;
  size?: 'sm' | 'lg';
}) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + hash * 31;
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const dims = size === 'lg' ? 'h-16 w-16 text-xl' : 'h-8 w-8 text-xs';
  return (
    <div
      className={`${dims} rounded-full ${color} flex items-center justify-center font-semibold shrink-0`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
