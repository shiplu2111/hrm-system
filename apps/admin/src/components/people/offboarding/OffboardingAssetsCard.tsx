import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, Package, Undo2 } from 'lucide-react';
import {
  ASSET_CATEGORY_LABELS,
  type EmployeeOffboardingRecord,
  type OffboardingAssetRecord,
} from '@hrm/shared-types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ReturnAssetModal } from '@/components/assets/ReturnAssetModal';
import { pathForPage } from '@/config/routes';
import { formatCurrencyAmount } from '@/lib/offboarding-display';
import { formatShortDate } from '@/lib/onboarding-display';

interface OffboardingAssetsCardProps {
  offboarding: EmployeeOffboardingRecord;
  canEdit: boolean;
  /** Called after a return; the tracker reloads the offboarding to pick up completed steps. */
  onChanged: () => Promise<void> | void;
  onNotice: (message: string) => void;
}

export function OffboardingAssetsCard({
  offboarding,
  canEdit,
  onChanged,
  onNotice,
}: OffboardingAssetsCardProps) {
  const navigate = useNavigate();
  const assets = offboarding.assets ?? [];
  const outstanding = assets.filter((asset) => asset.status === 'active');
  const returned = assets.filter((asset) => asset.status === 'returned');
  const active = offboarding.status !== 'cancelled';
  const outstandingValue = outstanding.reduce((sum, a) => sum + Number(a.purchaseValue ?? 0), 0);
  const currency = outstanding.find((a) => a.purchaseValue)?.currency ?? 'AUD';

  const [returning, setReturning] = useState<OffboardingAssetRecord | null>(null);

  const renderRow = (asset: OffboardingAssetRecord) => (
    <li key={asset.assignmentId} className="flex flex-col sm:flex-row sm:items-center gap-2 px-5 py-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {asset.status === 'returned' ? (
          <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0 mt-0.5" />
        ) : (
          <Package className="h-5 w-5 text-warning-600 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-primary">{asset.assetName}</span>
            <Badge tone="neutral">{ASSET_CATEGORY_LABELS[asset.category]}</Badge>
            {asset.status === 'returned' ? (
              <Badge tone="success">Returned</Badge>
            ) : (
              <Badge tone="warning">With employee</Badge>
            )}
            {asset.status === 'active' && !asset.coveredByChecklist ? (
              <Badge tone="info">Not on checklist</Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted">
            <span>Tag {asset.assetTag}</span>
            {asset.serialNumber ? <span>S/N {asset.serialNumber}</span> : null}
            <span>Assigned {formatShortDate(asset.assignedAt)}</span>
            {asset.purchaseValue ? (
              <span>Value {formatCurrencyAmount(asset.purchaseValue, asset.currency)}</span>
            ) : null}
            {asset.returnedAt ? <span>Returned {formatShortDate(asset.returnedAt)}</span> : null}
            {asset.conditionOnReturn ? <span>Condition: {asset.conditionOnReturn}</span> : null}
          </div>
        </div>
      </div>
      {asset.status === 'active' && active && canEdit ? (
        <Button size="sm" variant="secondary" onClick={() => setReturning(asset)}>
          <Undo2 className="h-3.5 w-3.5" /> Mark returned
        </Button>
      ) : null}
    </li>
  );

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Package className="h-4 w-4 text-muted" /> Asset return
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {assets.length > 0 ? (
            <Badge tone={outstanding.length === 0 ? 'success' : 'warning'} dot>
              {outstanding.length === 0
                ? 'All returned'
                : `${outstanding.length} outstanding${
                    outstandingValue > 0 ? ` · ${formatCurrencyAmount(outstandingValue, currency)}` : ''
                  }`}
            </Badge>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`${pathForPage('assets')}?employee=${offboarding.employeeId}`)}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Asset register
          </Button>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {assets.length === 0 ? (
          <p className="px-5 py-4 text-sm text-secondary">
            No company assets are assigned to {offboarding.employeeName}.
          </p>
        ) : (
          <>
            {outstanding.some((a) => !a.coveredByChecklist) ? (
              <div className="flex items-start gap-2 mx-5 mt-4 rounded-lg bg-sky-50 dark:bg-sky-950/30 px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Some assets are not covered by an asset-return step on this checklist. Collect them
                anyway — they stay assigned in the asset register until returned.
              </div>
            ) : null}
            <ul className="divide-y divide-[rgb(var(--border-base))]">
              {outstanding.map(renderRow)}
              {returned.map(renderRow)}
            </ul>
          </>
        )}
        <p className="px-5 py-3 text-xs text-muted border-t border-base">
          Live from the asset register. Asset-return steps complete automatically once every asset of
          their category is back — whether it is returned here or in the register.
        </p>
      </CardBody>

      <ReturnAssetModal
        open={returning !== null}
        onClose={() => setReturning(null)}
        asset={
          returning
            ? {
                id: returning.assetId,
                name: returning.assetName,
                assetTag: returning.assetTag,
                holderName: offboarding.employeeName,
                assignedAt: returning.assignedAt,
                conditionOnAssign: returning.conditionOnAssign,
              }
            : null
        }
        onReturned={async (assignment) => {
          await onChanged();
          onNotice([`${assignment.assetName} returned.`, ...(assignment.checklistUpdates ?? [])].join(' · '));
        }}
      />
    </Card>
  );
}
