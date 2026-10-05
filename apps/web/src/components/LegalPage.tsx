import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Section';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <Container className="max-w-3xl py-16 sm:py-20">
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-slate-500">Last updated {updated}</p>
      <div className="mt-10 space-y-8 leading-relaxed text-slate-600 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </Container>
  );
}
