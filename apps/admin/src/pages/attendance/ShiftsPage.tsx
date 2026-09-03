import { useCallback, useEffect, useState } from 'react';
import { Plus, Clock, Coffee, Loader2, Trash2 } from 'lucide-react';
import type { ShiftRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { useCompany } from '@/context/CompanyContext';
import { createShift, deleteShift, listShifts } from '@/lib/roster-api';
import { ApiError } from '@/lib/tenant-api-client';

const shiftColors = [
  'bg-accent-500',
  'bg-success-500',
  'bg-warning-500',
  'bg-violet-500',
];

export function ShiftsPage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState('60');
  const [graceMinutes, setGraceMinutes] = useState('10');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setShifts(await listShifts(companyId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!companyId || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createShift(companyId, {
        name: name.trim(),
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes) || 0,
        graceMinutes: Number(graceMinutes) || 0,
      });
      setModalOpen(false);
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create shift');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(shiftId: string) {
    if (!companyId) return;
    setError(null);
    try {
      await deleteShift(companyId, shiftId);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete shift');
    }
  }

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        No company found for this tenant.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Shift Management</h1>
          <p className="text-sm text-secondary mt-0.5">
            {shifts.length} shift pattern{shifts.length === 1 ? '' : 's'} configured
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Shift
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {shifts.map((shift, index) => (
            <Card key={shift.id} className="hover:shadow-card-hover transition-shadow group">
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-10 w-10 rounded-lg ${shiftColors[index % shiftColors.length]} flex items-center justify-center`}
                    >
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-primary">{shift.name}</div>
                      <div className="text-xs text-muted">
                        {shift.startTime} – {shift.endTime}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(shift.id)}
                    className="text-muted hover:text-error-600 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2 pt-3 border-t border-base text-xs">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5 text-muted">
                      <Coffee className="h-3.5 w-3.5" /> Break
                    </span>
                    <span className="text-secondary">{shift.breakMinutes} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Grace</span>
                    <span className="text-secondary">{shift.graceMinutes} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Type</span>
                    <span className="text-secondary capitalize">{shift.shiftType}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Shift"
        description="Create a new shift pattern"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? 'Creating…' : 'Create Shift'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Shift Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning Shift" />
          </div>
          <div>
            <Label>Start Time</Label>
            <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="09:00" />
          </div>
          <div>
            <Label>End Time</Label>
            <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="17:00" />
          </div>
          <div>
            <Label>Break (minutes)</Label>
            <Input value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
          </div>
          <div>
            <Label>Grace (minutes)</Label>
            <Input value={graceMinutes} onChange={(e) => setGraceMinutes(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
