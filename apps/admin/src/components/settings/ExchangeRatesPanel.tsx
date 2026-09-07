import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { ExchangeRateRecord } from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  createExchangeRate,
  listExchangeRates,
} from '@/lib/exchange-rates-api';
import { ApiError } from '@/lib/tenant-api-client';

export function ExchangeRatesPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rates, setRates] = useState<ExchangeRateRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState('AUD');
  const [quoteCurrency, setQuoteCurrency] = useState('USD');
  const [rate, setRate] = useState('1.48');
  const [effectiveFrom, setEffectiveFrom] = useState('2026-07-01');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRates(await listExchangeRates());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load exchange rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createExchangeRate({
        baseCurrency: baseCurrency.toUpperCase(),
        quoteCurrency: quoteCurrency.toUpperCase(),
        rate,
        effectiveFrom,
        effectiveTo: effectiveTo.trim() || null,
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create exchange rate');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-accent-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Exchange rates</CardTitle>
          <p className="text-xs text-secondary mt-1">
            Effective-dated FX rates. Payroll locks the rate active on the period end date (RULES.md §4).
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add rate
        </Button>
      </CardHeader>
      <CardBody className="p-0">
        {error && (
          <div className="mx-4 mb-4 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error}
          </div>
        )}
        <div className="divide-y divide-[rgb(var(--border-base))]">
          {rates.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-primary">
                    1 {row.quoteCurrency} → {row.rate} {row.baseCurrency}
                  </span>
                  {!row.effectiveTo && <Badge tone="success">Current</Badge>}
                </div>
                <p className="text-xs text-secondary mt-1">
                  Effective {row.effectiveFrom}
                  {row.effectiveTo ? ` – ${row.effectiveTo}` : ' onwards'}
                </p>
              </div>
            </div>
          ))}
          {rates.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-secondary">
              No exchange rates configured yet.
            </p>
          )}
        </div>
      </CardBody>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add exchange rate">
        <div className="space-y-3">
          <p className="text-xs text-secondary">
            Rate = base currency units per 1 quote currency unit (e.g. 1 USD = 1.48 AUD).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fx-base">Base currency</Label>
              <Input id="fx-base" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fx-quote">Quote currency</Label>
              <Input id="fx-quote" value={quoteCurrency} onChange={(e) => setQuoteCurrency(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="fx-rate">Rate</Label>
            <Input id="fx-rate" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fx-from">Effective from</Label>
              <Input id="fx-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fx-to">Effective to (optional)</Label>
              <Input id="fx-to" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
            </div>
          </div>
          <Button variant="primary" disabled={saving} onClick={() => void handleCreate()}>
            {saving ? 'Saving…' : 'Save rate'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
