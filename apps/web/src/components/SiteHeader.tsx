'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ButtonLink, buttonClass } from '@/components/ui/Button';
import { Container } from '@/components/ui/Section';
import { mainNav, site } from '@/lib/site';

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/90 backdrop-blur transition ${
        scrolled || open ? 'border-slate-200 shadow-sm' : 'border-transparent'
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive(item.href) ? 'text-brand-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a href={site.appUrl} className={buttonClass('ghost', 'sm')}>
            Sign in
          </a>
          <ButtonLink href="/contact?topic=demo" variant="secondary" size="sm">
            Book a demo
          </ButtonLink>
          <ButtonLink href="/pricing" size="sm">
            Get started
          </ButtonLink>
        </div>

        <button
          type="button"
          className="-mr-2 rounded-md p-2 text-slate-700 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </Container>

      {open && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2.5 text-base font-medium ${
                  isActive(item.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={site.appUrl} className={buttonClass('secondary', 'md')}>
                Sign in
              </a>
              <ButtonLink href="/pricing">Get started</ButtonLink>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
