import { NextResponse } from 'next/server';
import { CONTACT_TOPICS, contactSchema, flattenErrors, type SubmitResult } from '@/lib/forms';
import { clientIp, rateLimit } from '@/lib/server/rate-limit';
import { MailUnavailableError, makeReference, salesInbox, sendMail } from '@/lib/server/mailer';
import { site } from '@/lib/site';

const reply = (body: SubmitResult, status = 200) => NextResponse.json(body, { status });

export async function POST(request: Request) {
  if (!rateLimit(`contact:${clientIp(request.headers)}`, 5, 10 * 60_000)) {
    return reply({ ok: false, error: 'Too many messages. Please wait a few minutes and try again.' }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: 'Invalid request.' }, 400);
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === 'website')) {
      return reply({ ok: true, reference: makeReference('MSG') });
    }
    return reply({ ok: false, error: 'Please fix the highlighted fields.', fieldErrors: flattenErrors(parsed.error) }, 422);
  }

  const msg = parsed.data;
  const topic = CONTACT_TOPICS.find((t) => t.value === msg.topic)?.label ?? msg.topic;
  const reference = makeReference('MSG');
  const to = msg.topic === 'support' ? site.contact.supportEmail : salesInbox();

  try {
    await sendMail({
      to,
      replyTo: msg.email,
      subject: `[${topic}] ${msg.name}${msg.company ? ` — ${msg.company}` : ''} (${reference})`,
      text: [
        `Topic:        ${topic}`,
        `Name:         ${msg.name}`,
        `Email:        ${msg.email}`,
        `Phone:        ${msg.phone || '—'}`,
        `Company:      ${msg.company || '—'}`,
        `Company size: ${msg.companySize || '—'}`,
        `Plan:         ${msg.plan || '—'}`,
        '',
        msg.message,
      ].join('\n'),
    });
  } catch (error) {
    console.error('[contact] failed to send message', error);
    const message =
      error instanceof MailUnavailableError
        ? `Our contact form is temporarily unavailable. Please email ${site.contact.salesEmail}.`
        : `We couldn't send your message right now. Please try again or email ${site.contact.salesEmail}.`;
    return reply({ ok: false, error: message }, 503);
  }

  return reply({ ok: true, reference });
}
