import {
  OFFER_LETTER_TEMPLATES,
  renderOfferTemplateText,
  type OfferLetterTemplate,
} from '@hrm/shared-types';

export interface OfferLetterPreviewData {
  template: OfferLetterTemplate;
  companyName: string;
  candidateName: string;
  candidateEmail: string | null;
  jobTitle: string;
  departmentName?: string;
  employmentTypeName?: string;
  workLocationName?: string;
  reportingTo: string | null;
  startDate: string;
  annualSalary: number | null;
  signingBonus: number | null;
  currency: string;
  equityNotes: string | null;
  probationMonths: number | null;
  expiryDate: string | null;
  additionalTerms: string | null;
}

function money(amount: number | null, currency: string): string | undefined {
  if (amount == null) return undefined;
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function Section({ title, rows }: { title: string; rows: Array<[string, string | null | undefined]> }) {
  const visible = rows.filter(([, v]) => v && v.trim());
  if (visible.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="font-semibold text-[13px]">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {visible.map(([label, value]) => (
          <li key={label}>
            • {label}: {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** HTML mirror of the server-rendered PDF so template changes are visible before generating. */
export function OfferLetterPreview({ data }: { data: OfferLetterPreviewData }) {
  const template = OFFER_LETTER_TEMPLATES[data.template];
  const vars = {
    companyName: data.companyName,
    candidateName: data.candidateName,
    jobTitle: data.jobTitle || 'the role',
    startDate: data.startDate,
    workLocation: data.workLocationName,
    employmentType: data.employmentTypeName,
    reportingTo: data.reportingTo,
  };
  const firstName = data.candidateName.split(' ')[0] || data.candidateName;
  const probation =
    template.showProbation && data.probationMonths
      ? `${data.probationMonths} month${data.probationMonths === 1 ? '' : 's'}`
      : undefined;

  return (
    <div className="rounded-lg border border-base bg-white text-slate-900 shadow-sm px-6 py-7 text-[12px] leading-relaxed font-serif">
      <p className="text-center text-base font-semibold">Offer of Employment</p>
      <p className="text-center text-[11px] text-slate-500">{template.label}</p>
      <p className="text-center font-semibold mt-3">{data.companyName}</p>

      <p className="text-right mt-4">
        {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <p className="mt-3">{data.candidateName}</p>
      {data.candidateEmail ? <p>{data.candidateEmail}</p> : null}

      <p className="mt-4 font-semibold">Dear {firstName},</p>
      <p className="mt-2 text-justify">{renderOfferTemplateText(template.intro, vars)}</p>

      <Section
        title="Position Details"
        rows={[
          ['Job Title', data.jobTitle],
          ['Department', data.departmentName],
          ['Employment Type', data.employmentTypeName],
          ['Reports To', data.reportingTo],
          ['Start Date', data.startDate],
          ['Work Location', data.workLocationName],
        ]}
      />
      <Section
        title="Compensation"
        rows={[
          [template.salaryLabel, money(data.annualSalary, data.currency)],
          ['Signing Bonus', money(data.signingBonus, data.currency)],
          ['Equity / Options', template.showEquity ? data.equityNotes : undefined],
          ['Probation Period', probation],
        ]}
      />

      {template.clauses.map((clause) => (
        <div key={clause.title} className="mt-4">
          <p className="font-semibold text-[13px]">{clause.title}</p>
          <p className="text-justify">{renderOfferTemplateText(clause.body, vars)}</p>
        </div>
      ))}

      {data.additionalTerms?.trim() ? (
        <div className="mt-4">
          <p className="font-semibold text-[13px]">Additional Terms</p>
          <p className="text-justify whitespace-pre-wrap">{data.additionalTerms}</p>
        </div>
      ) : null}

      <p className="mt-4 text-justify">
        {data.expiryDate
          ? `This offer is valid until ${data.expiryDate}. Please indicate your acceptance by signing below.`
          : 'Please indicate your acceptance by signing below and returning this letter.'}
      </p>
      <p className="mt-3">We look forward to welcoming you to the team.</p>
      <p className="mt-4">Sincerely,</p>
      <p className="mt-6">______________________________</p>
      <p>Authorized Signatory</p>
      <p>{data.companyName}</p>
    </div>
  );
}
