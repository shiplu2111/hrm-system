import { Calendar, ChevronDown, PenLine, Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { customFieldsCopy } from '@/lib/custom-fields-copy';
import { normalizeOptions, type FieldDraft } from '@/lib/custom-field-schema';

type PreviewField = Pick<FieldDraft, 'label' | 'fieldType' | 'required' | 'options'>;

const controlBox =
  'w-full rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2 text-sm text-muted';

function FieldControl({ field }: { field: PreviewField }) {
  const copy = customFieldsCopy.preview;
  const options = normalizeOptions(field.options);

  switch (field.fieldType) {
    case 'number':
      return <div className={controlBox}>0</div>;
    case 'date':
      return (
        <div className={`${controlBox} flex items-center justify-between`}>
          <span>YYYY-MM-DD</span>
          <Calendar className="h-4 w-4" />
        </div>
      );
    case 'dropdown':
      return (
        <div className={`${controlBox} flex items-center justify-between`}>
          <span>{options[0] ?? copy.choose}</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      );
    case 'radio':
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {(options.length ? options : ['—']).map((option, i) => (
            <span key={option} className="inline-flex items-center gap-1.5 text-sm text-secondary">
              <span
                className={`h-3.5 w-3.5 rounded-full border border-strong ${i === 0 ? 'ring-[3px] ring-inset ring-accent-500' : ''}`}
              />
              {option}
            </span>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <span className="inline-flex items-center gap-2 text-sm text-secondary">
          <span className="h-4 w-4 rounded border border-strong" />
          {copy.yes}
        </span>
      );
    case 'file':
    case 'image':
      return (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-strong px-3 py-3 text-xs text-muted">
          <Upload className="h-4 w-4" /> {copy.upload}
        </div>
      );
    case 'signature':
      return (
        <div className="flex h-16 items-end gap-2 rounded-lg border border-dashed border-strong px-3 pb-2 text-xs text-muted">
          <PenLine className="h-4 w-4" /> {copy.signHere}
        </div>
      );
    default:
      return <div className={controlBox}>&nbsp;</div>;
  }
}

export function FieldPreviewItem({ field }: { field: PreviewField }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-secondary">
        {field.label.trim() || customFieldsCopy.editor.untitled}
        {field.required && <span className="ml-0.5 text-error-600">*</span>}
      </div>
      <FieldControl field={field} />
    </div>
  );
}

interface FormPreviewProps {
  fields: (PreviewField & { isActive?: boolean; key: string })[];
  /** Extra built-in rows shown after the custom fields (e.g. expiry date on documents). */
  extra?: ReactNode;
}

export function FormPreview({ fields, extra }: FormPreviewProps) {
  const copy = customFieldsCopy.preview;
  const visible = fields.filter((f) => f.isActive !== false);

  return (
    <div className="rounded-xl border border-base bg-[rgb(var(--bg-muted))]/40 p-4" aria-label={copy.title}>
      <div className="mb-3">
        <div className="text-sm font-semibold text-primary">{copy.title}</div>
        <div className="text-xs text-muted">{copy.description}</div>
      </div>
      {visible.length === 0 && !extra ? (
        <p className="py-6 text-center text-xs text-muted">{copy.empty}</p>
      ) : (
        <div className="space-y-3.5" aria-hidden="true">
          {visible.map((field) => (
            <FieldPreviewItem key={field.key} field={field} />
          ))}
          {extra}
        </div>
      )}
    </div>
  );
}

export function ExpiryPreviewRow() {
  return (
    <FieldPreviewItem
      field={{ label: customFieldsCopy.preview.expiryDate, fieldType: 'date', required: true, options: [] }}
    />
  );
}
