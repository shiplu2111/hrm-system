import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { YEARLY_MONTHS_CHARGED } from '@/lib/plans';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="5 October 2026">
      <section>
        <h2>Orders and subscriptions</h2>
        <p>
          Submitting an order on this website is a request to subscribe. Your subscription starts when we confirm the
          order and receive payment of the first invoice. Plans are priced per company and exclude applicable VAT and
          taxes.
        </p>
      </section>
      <section>
        <h2>Billing</h2>
        <ul>
          <li>Monthly plans are invoiced in advance each month.</li>
          <li>
            Yearly plans are invoiced in advance for twelve months at the price of {YEARLY_MONTHS_CHARGED} months.
          </li>
          <li>Upgrades are prorated immediately; downgrades take effect at the next renewal.</li>
          <li>If your headcount exceeds your plan&apos;s limit, we will agree an upgrade or employee add-on with you.</li>
        </ul>
      </section>
      <section>
        <h2>Cancellation</h2>
        <p>
          You may cancel at any time; access continues until the end of the paid period. You can export your data at
          any point before your subscription ends.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>
          You are responsible for the accounts you create and for keeping sign-in details secure. You must not use{' '}
          {site.name} to store unlawful content or to attempt to access other customers&apos; data.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms? Email{' '}
          <a href={`mailto:${site.contact.salesEmail}`} className="font-medium text-brand-700 underline">
            {site.contact.salesEmail}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
