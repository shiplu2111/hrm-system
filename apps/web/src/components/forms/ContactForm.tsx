'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, FormAlert, Honeypot } from '@/components/forms/Field';
import {
  COMPANY_SIZES,
  CONTACT_TOPICS,
  contactSchema,
  flattenErrors,
  type ContactInput,
  type FieldErrors,
} from '@/lib/forms';
import { postForm } from '@/lib/submit';

type FormState = Required<Omit<ContactInput, 'companySize'>> & { companySize: string };

export function ContactForm({ initialTopic, plan }: { initialTopic: string; plan?: string }) {
  const [form, setForm] = useState<FormState>({
    topic: initialTopic,
    name: '',
    email: '',
    phone: '',
    company: '',
    companySize: '',
    plan: plan ?? '',
    message: '',
    website: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentRef, setSentRef] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const inputProps = (key: keyof FormState) => ({
    id: key,
    name: key,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors = flattenErrors(parsed.error);
      setErrors(fieldErrors);
      const first = Object.keys(fieldErrors)[0];
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setSubmitting(true);
    const result = await postForm('/api/contact', form);
    setSubmitting(false);
    if (result.ok) {
      setSentRef(result.reference);
      return;
    }
    setFormError(result.error);
    if (result.fieldErrors) setErrors(result.fieldErrors);
  };

  if (sentRef) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-card">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden />
        <h2 className="mt-4 text-2xl font-bold">Message sent</h2>
        <p className="mt-2 max-w-md text-slate-600">
          Thanks, {form.name.split(' ')[0]}. Our team will reply to {form.email} within one business day.
        </p>
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-2 font-mono text-sm text-slate-600">Reference: {sentRef}</p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => {
            setSentRef(null);
            setForm((prev) => ({ ...prev, message: '' }));
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8"
    >
      <fieldset>
        <legend className="field-label">What can we help with?</legend>
        <div className="flex flex-wrap gap-2">
          {CONTACT_TOPICS.map((topic) => (
            <label
              key={topic.value}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                form.topic === topic.value
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 text-slate-700 hover:border-slate-400'
              }`}
            >
              <input
                type="radio"
                name="topic"
                value={topic.value}
                checked={form.topic === topic.value}
                onChange={() => set('topic', topic.value)}
                className="sr-only"
              />
              {topic.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Full name" error={errors.name}>
          <input
            {...inputProps('name')}
            className="field-input"
            autoComplete="name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <input
            {...inputProps('email')}
            type="email"
            className="field-input"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
        <Field id="phone" label="Phone" optional error={errors.phone}>
          <input
            {...inputProps('phone')}
            type="tel"
            className="field-input"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </Field>
        <Field id="company" label="Company" optional error={errors.company}>
          <input
            {...inputProps('company')}
            className="field-input"
            autoComplete="organization"
            value={form.company}
            onChange={(e) => set('company', e.target.value)}
          />
        </Field>
        <Field id="companySize" label="Number of employees" optional error={errors.companySize} className="sm:col-span-2">
          <select
            {...inputProps('companySize')}
            className="field-input"
            value={form.companySize}
            onChange={(e) => set('companySize', e.target.value)}
          >
            <option value="">Select…</option>
            {COMPANY_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Field>
        <Field id="message" label="Message" error={errors.message} className="sm:col-span-2">
          <textarea
            {...inputProps('message')}
            rows={5}
            className="field-input"
            placeholder={
              form.topic === 'demo'
                ? 'Tell us your preferred date and time, and which modules you want to see.'
                : 'How can we help?'
            }
            value={form.message}
            onChange={(e) => set('message', e.target.value)}
          />
        </Field>
      </div>

      <Honeypot value={form.website} onChange={(v) => set('website', v)} />

      {formError && (
        <div className="mt-5">
          <FormAlert>{formError}</FormAlert>
        </div>
      )}

      <Button type="submit" size="lg" className="mt-6 w-full sm:w-auto" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        {submitting ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  );
}
