import Link from 'next/link';
import { site } from '@/lib/site';

export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg bg-brand-600 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[62%] w-[62%] text-white" fill="none" aria-hidden>
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 12L2 7m10 5l10-5m-10 5v10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${site.name} home`}>
      <LogoMark />
      <span className={`text-lg font-bold tracking-tight ${inverted ? 'text-white' : 'text-slate-900'}`}>
        {site.name}
      </span>
    </Link>
  );
}
