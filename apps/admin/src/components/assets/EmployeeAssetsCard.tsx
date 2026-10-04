import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Loader2, Package, Plus, RotateCcw } from 'lucide-react';
import { ASSET_CATEGORY_LABELS, type CompanyAssetRecord } from '@hrm/shared-types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AssignAssetModal } from '@/components/assets/AssignAssetModal';
import { ReturnAssetModal } from '@/components/assets/ReturnAssetModal';
import { pathForPage } from '@/config/routes';
import { listCompanyAssets } from '@/lib/assets-api';
import { formatAssetDate, formatAssetValue } from '@/lib/assets-display';
import { ApiError } from '@/lib/tenant-api-client';

interface EmployeeAssetsCardProps {
  companyId: string;
  employee: { id: string; fullName: string };
  canEdit: boolean;
  /** Bump to reload after assets change elsewhere on the page. */
  refreshKey?: number;
  onChanged: (message: string, checklistUpdates: string[]) => void | Promise<void>;
}

/** Assets currently held by an employee, live from the asset register, with assign/return actions. */
export function EmployeeAssetsCard({ companyId, employee, canEdit, refreshKey = 0, onChanged }: EmployeeAssetsCardProps) {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<CompanyAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [returning, setReturning] = useState<CompanyAssetRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssets(await listCompanyAssets(companyId, { employeeId: employee.id }));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [companyId, employee.id]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const totalValue = assets.reduce((sum, asset) => sum + Number(asset.purchaseValue ?? 0), 0);
  const currency = assets[0]?.currency;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Package className="h-4 w-4 text-muted" /> Assets held
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {assets.length > 0 && currency ? (
            <Badge tone="neutral">
              {assets.length} · {formatAssetValue(totalValue.toFixed(2), currency)}
            </Badge>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`${pathForPage('assets')}?employee=${employee.id}`)}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Asset register
          </Button>
          {canEdit ? (
            <Button variant="secondary" size="sm" onClick={() => setAssignOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Assign asset
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {loading ? (
          <div className="flex items-center px-5 py-4 text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="px-5 py-4 text-sm text-error-600">{error}</div>
        ) : assets.length === 0 ? (
          <div className="px-5 py-4 text-sm text-secondary">{employee.fullName} holds no company assets.</div>
        ) : (
          <ul className="divide-y divide-[rgb(var(--border-base))]">
            {assets.map((asset) => (
              <li key={asset.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-primary">{asset.name}</span>
                    <Badge tone="neutral">{ASSET_CATEGORY_LABELS[asset.category]}</Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                    <span className="font-mono">{asset.assetTag}</span>
                    {asset.serialNumber ? <span>S/N {asset.serialNumber}</span> : null}
                    <span>Since {formatAssetDate(asset.assignedAt)}</span>
                    {asset.conditionOnAssign ? <span>Handed over: {asset.conditionOnAssign}</span> : null}
                  </div>
                </div>
                {canEdit ? (
                  <Button variant="secondary" size="sm" onClick={() => setReturning(asset)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Return
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <AssignAssetModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        companyId={companyId}
        employee={employee}
        onAssigned={async (assignment) => {
          await load();
          await onChanged(`${assignment.assetName} assigned to ${assignment.employeeName}.`, assignment.checklistUpdates ?? []);
        }}
      />
      <ReturnAssetModal
        open={returning !== null}
        onClose={() => setReturning(null)}
        asset={
          returning
            ? {
                id: returning.id,
                name: returning.name,
                assetTag: returning.assetTag,
                holderName: returning.assignedEmployeeName,
                assignedAt: returning.assignedAt,
                conditionOnAssign: returning.conditionOnAssign,
              }
            : null
        }
        onReturned={async (assignment) => {
          await load();
          await onChanged(`${assignment.assetName} returned.`, assignment.checklistUpdates ?? []);
        }}
      />
    </Card>
  );
}
