import { useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { customFieldsCopy } from '@/lib/custom-fields-copy';

interface OptionsEditorProps {
  id?: string;
  options: string[];
  onChange: (options: string[]) => void;
  invalid?: boolean;
  disabled?: boolean;
}

export function OptionsEditor({ id, options, onChange, invalid = false, disabled = false }: OptionsEditorProps) {
  const copy = customFieldsCopy.editor;
  const [pending, setPending] = useState('');

  const addPending = () => {
    const additions = pending
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o && !options.includes(o));
    if (additions.length) onChange([...options, ...new Set(additions)]);
    setPending('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addPending();
    } else if (e.key === 'Backspace' && !pending && options.length) {
      onChange(options.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      {options.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <li
              key={option}
              className="inline-flex items-center gap-1 rounded-md border border-base bg-[rgb(var(--bg-muted))] pl-2 pr-1 py-0.5 text-xs text-primary"
            >
              {option}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(options.filter((o) => o !== option))}
                className="rounded p-0.5 text-muted hover:text-error-600 hover:bg-[rgb(var(--bg-hover))] disabled:opacity-50"
                aria-label={copy.removeOption(option)}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={pending}
          disabled={disabled}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addPending}
          placeholder={copy.optionsPlaceholder}
          aria-invalid={invalid || undefined}
          className={invalid ? 'border-error-500 focus:ring-error-500/30' : ''}
        />
        <Button type="button" variant="secondary" size="sm" onClick={addPending} disabled={disabled || !pending.trim()}>
          <Plus className="h-3.5 w-3.5" /> {copy.optionsAdd}
        </Button>
      </div>
    </div>
  );
}
