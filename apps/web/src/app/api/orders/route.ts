import { NextResponse } from 'next/server';
import { PAYMENT_METHODS, flattenErrors, orderSchema, type SubmitResult } from '@/lib/forms';
import { formatMoney, getPlan, periodPrice } from '@/lib/plans';
import { clientIp, rateLimit } from '@/lib/server/rate-limit';
import { MailUnavailableError, makeReference, salesInbox, sendMail } from '@/lib/server/mailer';
import { site } from '@/lib/site';

const reply = (body: SubmitResult, status = 200) => NextResponse.json(body, { status });

export async function POST(request: Request) {
  if (!rateLimit(`order:${clientIp(request.headers)}`, 5, 10 * 60_000)) {
    return reply({ ok: false, error: 'Too many requests. Please wait a few minutes and try again.' }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: 'Invalid request.' }, 400);
  }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === 'website')) {
      return reply({ ok: true, reference: makeReference('NX') });
    }
    return reply({ ok: false, error: 'Please fix the highlighted fields.', fieldErrors: flattenErrors(parsed.error) }, 422);
  }

  const order = parsed.data;
  const plan = getPlan(order.plan)!;
  const amount = periodPrice(plan, order.currency, order.cycle)!;
  const amountText = `${formatMoney(amount, order.currency)} per ${order.cycle === 'yearly' ? 'year' : 'month'}`;
  const payment = PAYMENT_METHODS.find((m) => m.value === order.paymentMethod)?.label ?? order.paymentMethod;
  const reference = makeReference('NX');

  const summary = [
    `Reference:      ${reference}`,
    `Plan:           ${plan.name} (${order.cycle})`,
    `Amount:         ${amountText} (excl. VAT)`,
    `Employees:      ${order.employees}`,
    '',
    `Company:        ${order.companyName}`,
    `Contact:        ${order.contactName}`,
    `Email:          ${order.email}`,
    `Phone:          ${order.phone}`,
    `Country:        ${order.country}`,
    `Address:        ${order.address || '—'}`,
    `Payment method: ${payment}`,
    '',
    `Notes:`,
    order.notes || '—',
  ].join('\n');

  try {
    await sendMail({
      to: salesInbox(),
      replyTo: order.email,
      subject: `New order ${reference}: ${plan.name} for ${order.companyName}`,
      text: `A new plan order was submitted on the website.\n\n${summary}`,
    });
    await sendMail({
      to: order.email,
      replyTo: salesInbox(),
      subject: `We received your ${site.name} order (${reference})`,
      text: [
        `Hi ${order.contactName},`,
        '',
        `Thank you for choosing ${site.name}. We have received your order and our team will contact you within one business day with an invoice and next steps for setting up your workspace.`,
        '',
        summary,
        '',
        `Questions? Reply to this email or call ${site.contact.phone}.`,
        '',
        `— The ${site.name} team`,
      ].join('\n'),
    });
  } catch (error) {
    console.error('[orders] failed to send order email', error);
    const message =
      error instanceof MailUnavailableError
        ? `Online ordering is temporarily unavailable. Please email ${site.contact.salesEmail} and we'll set you up.`
        : `We couldn't submit your order right now. Please try again or email ${site.contact.salesEmail}.`;
    return reply({ ok: false, error: message }, 503);
  }

  return reply({ ok: true, reference });
}
