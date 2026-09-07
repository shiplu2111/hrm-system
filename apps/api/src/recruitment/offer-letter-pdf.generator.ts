import PDFDocument from 'pdfkit';

export interface OfferLetterPdfData {
  companyName: string;
  companyAddress?: string;
  candidateName: string;
  candidateEmail: string;
  letterDate: string;
  jobTitle: string;
  department?: string;
  employmentType?: string;
  reportingTo?: string;
  startDate: string;
  workLocation?: string;
  annualSalary?: string;
  signingBonus?: string;
  equityNotes?: string;
  probationLabel?: string;
  expiryDate?: string;
  additionalTerms?: string;
  templateLabel: string;
}

export function renderOfferLetterPdf(data: OfferLetterPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('Offer of Employment', { align: 'center' });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor('#555555').text(data.templateLabel, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text(data.companyName, { align: 'center' });
    doc.font('Helvetica');
    if (data.companyAddress) {
      doc.fontSize(9).fillColor('#555555').text(data.companyAddress, { align: 'center' });
      doc.fillColor('#000000');
    }
    doc.moveDown();

    doc.fontSize(10).text(data.letterDate, { align: 'right' });
    doc.moveDown();
    doc.text(data.candidateName);
    doc.text(data.candidateEmail);
    doc.moveDown();

    const firstName = data.candidateName.split(' ')[0] ?? data.candidateName;
    doc.fontSize(11).font('Helvetica-Bold').text(`Dear ${firstName},`);
    doc.font('Helvetica').moveDown(0.5);

    doc.fontSize(10).text(
      `We are pleased to offer you the position of ${data.jobTitle} at ${data.companyName}. ` +
        'We believe your skills and experience will be a strong match for our team.',
      { align: 'justify' },
    );
    doc.moveDown();

    writeSection(doc, 'Position Details', [
      ['Job Title', data.jobTitle],
      ['Department', data.department],
      ['Employment Type', data.employmentType],
      ['Reports To', data.reportingTo],
      ['Start Date', data.startDate],
      ['Work Location', data.workLocation],
    ]);

    writeSection(doc, 'Compensation', [
      ['Annual Salary', data.annualSalary],
      ['Signing Bonus', data.signingBonus],
      ['Equity / Options', data.equityNotes],
      ['Probation Period', data.probationLabel],
    ]);

    if (data.additionalTerms?.trim()) {
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold').text('Additional Terms');
      doc.font('Helvetica').fontSize(10).text(data.additionalTerms, { align: 'justify' });
    }

    doc.moveDown();
    if (data.expiryDate) {
      doc.text(
        `This offer is valid until ${data.expiryDate}. Please indicate your acceptance by signing below.`,
        { align: 'justify' },
      );
    } else {
      doc.text(
        'Please indicate your acceptance by signing below and returning this letter.',
        { align: 'justify' },
      );
    }

    doc.moveDown();
    doc.text('We look forward to welcoming you to the team.');
    doc.moveDown(1.5);
    doc.text('Sincerely,');
    doc.moveDown(2);
    doc.text('______________________________');
    doc.text('Authorized Signatory');
    doc.text(data.companyName);

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#555555');
    doc.text('Candidate Acceptance', { underline: true });
    doc.fillColor('#000000').moveDown(0.5);
    doc.text('Signature: _____________________________    Date: ______________');

    doc.end();
  });
}

function writeSection(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  rows: Array<[string, string | undefined]>,
): void {
  const visible = rows.filter(([, value]) => value && value.trim().length > 0);
  if (visible.length === 0) return;

  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica-Bold').text(title);
  doc.font('Helvetica').fontSize(10);
  for (const [label, value] of visible) {
    doc.text(`• ${label}: ${value}`);
  }
}
