import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Container } from '@/components/ui/Section';
import { site } from '@/lib/site';

const columns = [
  {
    title: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/features#self-service', label: 'Mobile app' },
      { href: '/contact?topic=demo', label: 'Book a demo' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About us' },
      { href: '/contact', label: 'Contact' },
      { href: '/contact?topic=partnership', label: 'Partners' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of service' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-brand-950 text-brand-100">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo inverted />
            <p className="mt-4 text-sm leading-relaxed text-brand-200">{site.description}</p>
            <ul className="mt-6 space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-brand-300" aria-hidden />
                <a href={`mailto:${site.contact.salesEmail}`} className="hover:text-white">
                  {site.contact.salesEmail}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-brand-300" aria-hidden />
                <a href={`tel:${site.contact.phone.replace(/[^+\d]/g, '')}`} className="hover:text-white">
                  {site.contact.phone}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 text-brand-300" aria-hidden />
                <span>{site.contact.address.join(', ')}</span>
              </li>
            </ul>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-white">{column.title}</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-brand-200 transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-brand-800 pt-8 text-xs text-brand-300 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <a href={site.appUrl} className="hover:text-white">
            Customer sign in →
          </a>
        </div>
      </Container>
    </footer>
  );
}
