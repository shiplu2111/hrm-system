import PDFDocument from 'pdfkit';

export interface InvoicePdfLine {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  status: string;
  currency: string;
  billingReason: string;
  issueDate: string;
  dueDate: string;
  paidAt?: string | null;
  paymentMethod?: string | null;
  tenantName: string;
  tenantSubdomain: string;
  tenantId: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  lines: InvoicePdfLine[];
  creditNotes?: Array<{ creditNoteNumber: string; amount: number }>;
}

export function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header / Brand
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(22).text('CMSN-HR', 50, 50);
    doc.fillColor('#64748b').font('Helvetica').fontSize(9).text('Cloud Human Resource Management & Payroll Platform', 50, 76);
    doc.text('Global Infrastructure Operations Inc. · billing@cmsnbd.com', 50, 88);

    // Invoice Title & Status Badge
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(20).text('INVOICE', 380, 50, { align: 'right' });
    doc.fillColor('#3b82f6').font('Helvetica-Bold').fontSize(11).text(data.invoiceNumber, 380, 74, { align: 'right' });
    
    const statusColor = data.status.toLowerCase() === 'paid' ? '#10b981' : data.status.toLowerCase() === 'past_due' ? '#ef4444' : '#f59e0b';
    doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(10).text(`STATUS: ${data.status.toUpperCase()}`, 380, 88, { align: 'right' });

    doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // Bill To & Invoice Meta columns
    const startY = 125;
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text('BILLED TO:', 50, startY);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text(data.tenantName, 50, startY + 14);
    doc.fillColor('#475569').font('Helvetica').fontSize(9).text(`Subdomain: ${data.tenantSubdomain}.cmsnbd.com`, 50, startY + 30);
    doc.text(`Tenant ID: ${data.tenantId}`, 50, startY + 44);

    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text('INVOICE DETAILS:', 350, startY);
    doc.fillColor('#475569').font('Helvetica').fontSize(9);
    doc.text(`Issue Date: ${data.issueDate}`, 350, startY + 14);
    doc.text(`Due Date: ${data.dueDate}`, 350, startY + 28);
    doc.text(`Billing Reason: ${data.billingReason.replace('_', ' ')}`, 350, startY + 42);
    if (data.paidAt) {
      doc.fillColor('#10b981').text(`Paid On: ${data.paidAt} (${data.paymentMethod || 'manual'})`, 350, startY + 56);
    }

    // Line items table
    const tableTop = 205;
    doc.rect(50, tableTop, 495, 22).fill('#f8fafc');
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9);
    doc.text('DESCRIPTION', 60, tableTop + 6);
    doc.text('QTY', 340, tableTop + 6, { width: 40, align: 'center' });
    doc.text('UNIT PRICE', 390, tableTop + 6, { width: 65, align: 'right' });
    doc.text('AMOUNT', 465, tableTop + 6, { width: 70, align: 'right' });

    let currentY = tableTop + 28;
    doc.font('Helvetica').fontSize(9).fillColor('#1e293b');

    for (const line of data.lines) {
      doc.text(line.description, 60, currentY, { width: 270 });
      doc.text(String(line.quantity), 340, currentY, { width: 40, align: 'center' });
      doc.text(`${data.currency} ${line.unitAmount.toFixed(2)}`, 390, currentY, { width: 65, align: 'right' });
      doc.text(`${data.currency} ${line.amount.toFixed(2)}`, 465, currentY, { width: 70, align: 'right' });
      currentY += 22;
      doc.moveTo(50, currentY - 4).lineTo(545, currentY - 4).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
    }

    // Credit notes if any
    if (data.creditNotes && data.creditNotes.length > 0) {
      for (const cn of data.creditNotes) {
        doc.fillColor('#ef4444').text(`Credit Note: ${cn.creditNoteNumber}`, 60, currentY, { width: 270 });
        doc.text('1', 340, currentY, { width: 40, align: 'center' });
        doc.text(`-${data.currency} ${cn.amount.toFixed(2)}`, 390, currentY, { width: 65, align: 'right' });
        doc.text(`-${data.currency} ${cn.amount.toFixed(2)}`, 465, currentY, { width: 70, align: 'right' });
        currentY += 22;
      }
    }

    // Summary block on right side
    currentY += 10;
    const summaryX = 350;
    const valueX = 465;

    doc.moveTo(350, currentY).lineTo(545, currentY).strokeColor('#cbd5e1').lineWidth(1).stroke();
    currentY += 10;

    doc.fillColor('#475569').font('Helvetica').fontSize(9).text('Subtotal:', summaryX, currentY);
    doc.text(`${data.currency} ${data.subtotal.toFixed(2)}`, valueX, currentY, { width: 70, align: 'right' });
    currentY += 16;

    doc.text('Tax (0%):', summaryX, currentY);
    doc.text(`${data.currency} ${data.tax.toFixed(2)}`, valueX, currentY, { width: 70, align: 'right' });
    currentY += 16;

    doc.rect(345, currentY - 2, 200, 22).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('Total:', summaryX, currentY + 4);
    doc.text(`${data.currency} ${data.total.toFixed(2)}`, valueX, currentY + 4, { width: 70, align: 'right' });
    currentY += 28;

    doc.fillColor('#475569').font('Helvetica').fontSize(9).text('Amount Paid:', summaryX, currentY);
    doc.text(`${data.currency} ${data.amountPaid.toFixed(2)}`, valueX, currentY, { width: 70, align: 'right' });
    currentY += 16;

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('Amount Due:', summaryX, currentY);
    doc.fillColor(data.amountDue > 0 ? '#ef4444' : '#10b981').text(`${data.currency} ${data.amountDue.toFixed(2)}`, valueX, currentY, { width: 70, align: 'right' });

    // Footer
    doc.moveTo(50, 720).lineTo(545, 720).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(8).text(
      'Payment terms: Net 30. All monetary values are settled in agreed ISO currencies. Questions? Contact support@cmsnbd.com.',
      50,
      730,
      { align: 'center', width: 495 }
    );

    doc.end();
  });
}
