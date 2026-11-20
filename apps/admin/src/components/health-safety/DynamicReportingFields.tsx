import { Layers } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import type {
  HealthSafetyRuleLayerSummary,
  SafetyReportingFieldDefinition,
  WorkplaceIncidentSeverity,
  WorkplaceIncidentStatus,
} from '@hrm/shared-types';

export const INCIDENT_SEVERITY_TONES: Record<
  WorkplaceIncidentSeverity,
  'neutral' | 'warning' | 'error'
> = {
  low: 'neutral',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

export const INCIDENT_STATUS_TONES: Record<
  WorkplaceIncidentStatus,
  'info' | 'warning' | 'success' | 'neutral'
> = {
  reported: 'info',
  under_investigation: 'warning',
  resolved: 'success',
  closed: 'neutral',
};

const LAYER_LABELS: Record<HealthSafetyRuleLayerSummary['layer'], string> = {
  global: 'Global Default',
  country: 'Country Rule',
  state: 'State / Province',
  company: 'Company Policy',
  employee_contract: 'Employee Contract',
};

export function RuleProvenanceBadges({
  layers,
  asOf,
}: {
  layers?: HealthSafetyRuleLayerSummary[];
  asOf?: string | null;
}) {
  const activeLayers = (layers ?? []).filter((item) => item.applied);
  if (activeLayers.length === 0 && !asOf) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="inline-flex items-center gap-1 font-medium text-muted">
        <Layers className="h-3.5 w-3.5" /> Rule chain:
      </span>
      {activeLayers.map((layer) => (
        <Badge key={layer.layer} tone={layer.layer === 'country' ? 'accent' : 'neutral'}>
          {LAYER_LABELS[layer.layer]}
        </Badge>
      ))}
      {asOf && (
        <span className="text-muted">
          · Effective {new Date(asOf).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

interface DynamicReportingFieldsProps {
  fields: SafetyReportingFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (nextValues: Record<string, unknown>) => void;
  regulatorRequired: boolean;
  readOnly?: boolean;
  idPrefix?: string;
}

export function DynamicReportingFields({
  fields,
  values,
  onChange,
  regulatorRequired,
  readOnly = false,
  idPrefix = 'hs-field',
}: DynamicReportingFieldsProps) {
  if (fields.length === 0) {
    return (
      <p className="text-xs text-muted">
        No jurisdiction-specific reporting fields are configured in the active health &amp; safety rules.
      </p>
    );
  }

  const setField = (key: string, value: unknown) => {
    onChange({
      ...values,
      [key]: value,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const inputId = `${idPrefix}-${field.key}`;
        const rawValue = values[field.key];
        const isRequiredNow =
          Boolean(field.required) ||
          (regulatorRequired && Boolean(field.requiredWhenRegulatorNotifiable));
        const spanFull = field.type === 'textarea' || field.type === 'boolean';

        return (
          <div key={field.key} className={spanFull ? 'sm:col-span-2' : ''}>
            {field.type === 'boolean' ? (
              <div className="flex items-start justify-between gap-4 rounded-xl border border-base bg-[rgb(var(--bg-muted))]/60 p-3.5">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Label htmlFor={inputId} className="mb-0 text-sm font-medium text-primary">
                      {field.label}
                      {isRequiredNow && <span className="ml-0.5 text-error-600">*</span>}
                    </Label>
                    {field.requiredWhenRegulatorNotifiable && !field.required && (
                      <Badge tone={regulatorRequired ? 'warning' : 'neutral'}>
                        Notifiable rule
                      </Badge>
                    )}
                  </div>
                  {field.helpText && (
                    <p className="text-xs text-muted">{field.helpText}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <Toggle
                    checked={rawValue === true}
                    disabled={readOnly}
                    label={field.label}
                    onChange={(next) => setField(field.key, next)}
                  />
                  <span className="w-8 text-xs font-medium text-secondary">
                    {rawValue === true ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Label htmlFor={inputId} className="mb-0">
                    {field.label}
                    {isRequiredNow && <span className="ml-0.5 text-error-600">*</span>}
                  </Label>
                  {field.requiredWhenRegulatorNotifiable && !field.required && (
                    <Badge tone={regulatorRequired ? 'warning' : 'neutral'}>
                      Regulator required
                    </Badge>
                  )}
                </div>

                {field.type === 'select' ? (
                  <Select
                    id={inputId}
                    disabled={readOnly}
                    value={typeof rawValue === 'string' ? rawValue : ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                  >
                    <option value="">Select…</option>
                    {(field.options ?? []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                ) : field.type === 'textarea' ? (
                  <Textarea
                    id={inputId}
                    rows={3}
                    disabled={readOnly}
                    placeholder={field.placeholder}
                    value={typeof rawValue === 'string' ? rawValue : ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                ) : field.type === 'number' ? (
                  <Input
                    id={inputId}
                    type="number"
                    disabled={readOnly}
                    placeholder={field.placeholder}
                    value={
                      typeof rawValue === 'number' || typeof rawValue === 'string'
                        ? String(rawValue)
                        : ''
                    }
                    onChange={(e) =>
                      setField(
                        field.key,
                        e.target.value === '' ? undefined : Number(e.target.value),
                      )
                    }
                  />
                ) : field.type === 'date' ? (
                  <Input
                    id={inputId}
                    type="date"
                    disabled={readOnly}
                    value={typeof rawValue === 'string' ? rawValue : ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                ) : (
                  <Input
                    id={inputId}
                    type="text"
                    disabled={readOnly}
                    placeholder={field.placeholder}
                    value={typeof rawValue === 'string' ? rawValue : ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                )}

                {field.helpText && (
                  <p className="mt-1 text-[11px] text-muted">{field.helpText}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

