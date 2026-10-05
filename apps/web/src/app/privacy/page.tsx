import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="5 October 2026">
      <section>
        <h2>Who we are</h2>
        <p>
          {site.name} provides cloud HR, attendance and payroll software. This policy explains how we handle information
          collected through this website and, where relevant, through the {site.name} platform.
        </p>
      </section>
      <section>
        <h2>Information we collect on this website</h2>
        <ul>
          <li>Details you submit in our contact and order forms, such as your name, work email, phone and company.</li>
          <li>Basic technical data like your IP address and browser, used to protect the forms from abuse.</li>
          <li>Your pricing currency preference, stored in your own browser.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To reply to your enquiry, prepare quotes and invoices, and set up your workspace.</li>
          <li>To send service messages about an order you placed.</li>
          <li>We do not sell your information or share it with advertisers.</li>
        </ul>
      </section>
      <section>
        <h2>Customer data in the platform</h2>
        <p>
          Employee data that customers store in {site.name} belongs to the customer. We process it only to provide the
          service, keep each customer&apos;s workspace isolated, encrypt sensitive fields and record changes in an audit
          log. Data processing terms are set out in your subscription agreement.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can ask us to access, correct or delete information you sent through this website by emailing{' '}
          <a href={`mailto:${site.contact.supportEmail}`} className="font-medium text-brand-700 underline">
            {site.contact.supportEmail}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
