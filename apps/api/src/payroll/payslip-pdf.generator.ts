import PDFDocument from 'pdfkit';

export interface PayslipPdfLine {
  label: string;
  amount: string;
}

export interface PayslipPdfData {
  companyName: string;
  employeeName: string;
  employeeNumber: string;
  department?: string;
  designation?: string;
  periodLabel: string;
  paymentDate: string;
  earnings: PayslipPdfLine[];
  deductions: PayslipPdfLine[];
  grossPay: string;
  totalDeductions: string;
  netPay: string;
}

export function renderPayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Payslip', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555555').text(data.companyName, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown();

    doc.fontSize(11).text(`Employee: ${data.employeeName} (${data.employeeNumber})`);
    if (data.department) doc.text(`Department: ${data.department}`);
    if (data.designation) doc.text(`Designation: ${data.designation}`);
    doc.text(`Pay period: ${data.periodLabel}`);
    doc.text(`Payment date: ${data.paymentDate}`);
    doc.moveDown();

    writeSection(doc, 'Earnings', data.earnings);
    doc.moveDown(0.5);
    writeSection(doc, 'Deductions', data.deductions);
    doc.moveDown();

    doc.fontSize(12).text(`Gross Pay: ${data.grossPay}`, { align: 'right' });
    doc.text(`Total Deductions: ${data.totalDeductions}`, { align: 'right' });
    doc.font('Helvetica-Bold').text(`Net Pay: ${data.netPay}`, { align: 'right' });
    doc.font('Helvetica');

    doc.end();
  });
}

function writeSection(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  lines: PayslipPdfLine[],
): void {
  doc.fontSize(12).font('Helvetica-Bold').text(title);
  doc.font('Helvetica').fontSize(10);
  if (lines.length === 0) {
    doc.text('—');
    return;
  }
  for (const line of lines) {
    doc.text(`${line.label}`, 50, doc.y, { continued: true, width: 350 });
    doc.text(line.amount, { align: 'right' });
  }
}
