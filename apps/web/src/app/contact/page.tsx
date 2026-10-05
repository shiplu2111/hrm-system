import type { Metadata } from 'next';
import { CalendarClock, LifeBuoy, Mail, MapPin, Phone } from 'lucide-react';
import { ContactForm } from '@/components/forms/ContactForm';
import { Container, PageHero } from '@/components/ui/Section';
import { CONTACT_TOPICS } from '@/lib/forms';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Talk to the CMSN-HR team — sales, demos, support and partnerships.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const topicParam = typeof params.topic === 'string' ? params.topic : '';
  const topic = CONTACT_TOPICS.some((t) => t.value === topicParam) ? topicParam : 'sales';
  const plan = typeof params.plan === 'string' ? params.plan.slice(0, 20) : undefined;

  const channels = [
    {
      icon: Mail,
      title: 'Sales',
      lines: [site.contact.salesEmail],
      href: `mailto:${site.contact.salesEmail}`,
    },
    {
      icon: LifeBuoy,
      title: 'Customer support',
      lines: [site.contact.supportEmail],
      href: `mailto:${site.contact.supportEmail}`,
    },
    {
      icon: Phone,
      title: 'Phone',
      lines: [site.contact.phone],
      href: `tel:${site.contact.phone.replace(/[^+\d]/g, '')}`,
    },
    { icon: CalendarClock, title: 'Office hours', lines: [site.contact.hours] },
    { icon: MapPin, title: 'Office', lines: [...site.contact.address] },
  ];

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={topic === 'demo' ? 'Book your free demo' : "Let's talk"}
        description={
          topic === 'demo'
            ? 'A 30-minute walkthrough tailored to your policies, payroll and team size. Pick a time that suits you and we will confirm by email.'
            : 'Questions about plans, a custom quote, or help with your account — our team usually replies within a few hours.'
        }
      />
      <Container className="grid gap-10 py-16 lg:grid-cols-[1fr_340px] lg:py-20">
        <ContactForm initialTopic={topic} plan={plan} />
        <aside className="space-y-4">
          {channels.map(({ icon: Icon, title, lines, href }) => {
            const body = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{title}</span>
                  {lines.map((line) => (
                    <span key={line} className="block text-sm text-slate-600">
                      {line}
                    </span>
                  ))}
                </span>
              </>
            );
            const className = 'flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card';
            return href ? (
              <a key={title} href={href} className={`${className} transition hover:border-brand-200`}>
                {body}
              </a>
            ) : (
              <div key={title} className={className}>
                {body}
              </div>
            );
          })}
        </aside>
      </Container>
    </>
  );
}
