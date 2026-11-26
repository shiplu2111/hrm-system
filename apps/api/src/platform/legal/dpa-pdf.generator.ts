import PDFDocument from 'pdfkit';

export interface DpaPdfInput {
  version: string;
  effectiveDate: string;
  draftNotice: string;
}

/**
 * Generates a structured Data Processing Agreement (DPA) PDF document
 * persisted and served via the FileStorage driver (`StorageService`).
 */
export function renderDpaPdf(data: DpaPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(18).text('Data Processing Agreement (DPA)', {
      align: 'left',
    });
    doc.moveDown(0.35);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#555555')
      .text(`CMSN-HR Multi-Tenant SaaS Platform | Version ${data.version} | Effective ${data.effectiveDate}`);
    doc.fillColor('#000000');
    doc.moveDown(0.5);

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#92400e')
      .text(`Notice: ${data.draftNotice} — Subject to counsel approval per operating jurisdiction.`);
    doc.fillColor('#000000');
    doc.moveDown();

    writeSection(doc, '1. Definitions & Roles', [
      'Customer acts as Data Controller for personal data uploaded or collected within its isolated tenant workspace.',
      'CMSN-HR acts as Data Processor and processes personal data solely under documented Customer instructions, applicable employment contracts, and platform Terms of Service.',
    ]);

    writeSection(doc, '2. Subject Matter & Categories of Personal Data', [
      'Categories of Data Subjects: Customer employees, contractors, applicants, managers, and organization administrators.',
      'Categories of Personal Data: Identity details, work contact info, attendance timestamps, geolocation verification events, leave records, compensation structures, and statutory tax/bank identifiers.',
    ]);

    writeSection(doc, '3. Multi-Tenant Security & Confidentiality (Annex II)', [
      'Logical Tenant Isolation: Every business record is scoped by tenant_id extracted exclusively from authenticated server sessions.',
      'Encryption: TLS in transit, bcrypt password hashing, and AES field-level encryption for sensitive identifiers, tokens, and third-party credentials.',
      'Immutability & Auditability: Payroll calculations are deterministic; finalized runs are locked and payroll mutations write to audit_logs.',
      'Data Subject Erasure & Export: Supports verified deletion and export workflows for customer and lead data.',
    ]);

    writeSection(doc, '4. Subprocessors & Change Notice (Annex III)', [
      'CMSN-HR maintains an up-to-date list of third-party subprocessors actively configured in the platform at /subprocessors.',
      'Only active providers configured for hosting/storage, email, SMS, push notifications, payments, or error monitoring are authorized to process Customer Data.',
      'Customers may subscribe on the Subprocessors page to receive advance email notifications when subprocessors are added or replaced.',
    ]);

    doc.end();
  });
}

function writeSection(
  doc: InstanceType<typeof PDFDocument>,
  heading: string,
  paragraphs: string[],
): void {
  doc.font('Helvetica-Bold').fontSize(12).text(heading);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);
  for (const p of paragraphs) {
    doc.text(p, { lineGap: 2 });
    doc.moveDown(0.35);
  }
  doc.moveDown(0.3);
}
