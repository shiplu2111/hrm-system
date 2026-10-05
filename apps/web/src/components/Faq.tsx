import { ChevronDown } from 'lucide-react';

export interface FaqItem {
  question: string;
  answer: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-card">
      {items.map((item) => (
        <details key={item.question} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-base font-semibold text-slate-900">
            {item.question}
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden />
          </summary>
          <p className="mt-3 leading-relaxed text-slate-600">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export const pricingFaq: FaqItem[] = [
  {
    question: 'How does buying a plan work?',
    answer:
      'Choose a plan and billing cycle, then send us your company details. Our team confirms the order within one business day, sends an invoice, and sets up your workspace as soon as payment is received — usually the same day.',
  },
  {
    question: 'Which payment methods do you accept?',
    answer:
      'Bank transfer, bKash or Nagad for Bangladeshi customers, and card payment through a secure invoice link for international customers. Enterprise customers can also pay by purchase order.',
  },
  {
    question: 'Can I switch plans later?',
    answer:
      'Yes. Upgrades take effect immediately and are prorated for the rest of your billing period. Downgrades apply from your next renewal.',
  },
  {
    question: 'What happens if we grow past our employee limit?',
    answer:
      'Nothing stops working. We will contact you to either upgrade your plan or add an employee pack, whichever costs less.',
  },
  {
    question: 'Do you help us move our existing data?',
    answer:
      'Every plan includes guided onboarding. We import employee records, leave balances and opening payroll figures from Excel or your current HR system.',
  },
  {
    question: 'Is our data safe?',
    answer:
      'Each customer has an isolated workspace, sensitive fields are encrypted, every change is written to an audit log, and backups run daily. Enterprise customers can choose their data retention policy.',
  },
];
