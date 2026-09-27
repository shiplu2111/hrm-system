import type { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** When true, skeleton fills its container (use inside sized wrappers). */
  block?: boolean;
}

export function Skeleton({ className = '', block = false, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md bg-[rgb(var(--bg-muted))] ${block ? 'w-full h-full' : ''} ${className}`}
      {...props}
    />
  );
}
