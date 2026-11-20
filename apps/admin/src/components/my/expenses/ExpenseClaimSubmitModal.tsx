import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  GitBranch,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  ExpenseCategoryRecord,
  ExpenseClaimRecord,
  WorkflowApprovalRoute,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  createExpenseClaim,
  formatReceiptSize,
  getExpenseApprovalRoute,
  submitExpenseClaim,
  uploadExpenseReceipt,
} from '@/lib/expenses-api';
import { describeLimits, monthlyClaimedForCategory } from '@/lib/expense-display';
import { formatMoney, todayIso } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

const ALLOWED_RECEIPT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);
const ALLOWED_RECEIPT_EXTENSIONS = /\.(pdf|png|jpe?g)$/i;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

interface ExpenseClaimSubmitModalProps {
  open: boolean;
  companyId: string;
  employeeId: string;
  currency?: string;
  categories: ExpenseCategoryRecord[];
  existingClaims: ExpenseClaimRecord[];
  initialCategoryId?: string | null;
  onClose: () => void;
  onSaved: (claim: ExpenseClaimRecord, warning?: string) => void | Promise<void>;
}

export function ExpenseClaimSubmitModal({
  open,
  companyId,
  employeeId,
  currency = 'AUD',
  categories,
  existingClaims,
  initialCategoryId = null,
  onClose,
  onSaved,
}: ExpenseClaimSubmitModalProps) {
  const { t } = useAppTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [route, setRoute] = useState<WorkflowApprovalRoute | null>(null);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategoryId(initialCategoryId ?? categories[0]?.id ?? '');
    setAmount('');
    setExpenseDate(todayIso());
    setDescription('');
    setReceipt(null);
    setError(null);
    setSaving(null);
  }, [open, initialCategoryId, categories]);

  const parsedAmount = useMemo(() => {
    const val = Number(amount);
    return Number.isFinite(val) && val > 0 ? val : 0;
  }, [amount]);

  useEffect(() => {
    if (!open || !companyId) return;
    let active = true;
    const handle = window.setTimeout(() => {
      getExpenseApprovalRoute(companyId, parsedAmount)
        .then((r) => {
          if (active) setRoute(r);
        })
        .catch(() => {
          if (active) setRoute(null);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [open, companyId, parsedAmount]);

  const category = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );

  const monthPrefix = (expenseDate || todayIso()).slice(0, 7);
  const monthSpent = useMemo(
    () =>
      category
        ? monthlyClaimedForCategory(existingClaims, category.id, monthPrefix)
        : 0,
    [category, existingClaims, monthPrefix],
  );

  const exceedsPerClaim =
    category?.maxAmountPerClaim != null &&
    parsedAmount > category.maxAmountPerClaim;
  const exceedsMonthly =
    category?.maxAmountPerMonth != null &&
    monthSpent + parsedAmount > category.maxAmountPerMonth;

  const validate = (submit: boolean): string | null => {
    if (!categoryId || !category) return t('myExpenses.validation.category');
    if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return t('myExpenses.validation.amount');
    }
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      return t('myExpenses.validation.decimals');
    }
    if (exceedsPerClaim) {
      return t('myExpenses.exceedsPerClaim', {
        category: category.name,
        limit: `${formatMoney(category.maxAmountPerClaim)} ${currency}`,
      });
    }
    if (exceedsMonthly) {
      return t('myExpenses.exceedsMonthly', {
        month: monthPrefix,
        spent: `${formatMoney(monthSpent)} ${currency}`,
        amount: `${formatMoney(parsedAmount)} ${currency}`,
        limit: `${formatMoney(category.maxAmountPerMonth)} ${currency}`,
      });
    }
    if (!expenseDate) return t('myExpenses.validation.date');
    if (expenseDate > todayIso()) return t('myExpenses.validation.futureDate');
    if (submit && category.receiptRequired && !receipt) {
      return t('myExpenses.missingRequiredReceipt', { category: category.name });
    }
    return null;
  };

  const handlePickFile = (picked: File | null) => {
    if (!picked) return;
    if (
      !ALLOWED_RECEIPT_TYPES.has(picked.type) &&
      !ALLOWED_RECEIPT_EXTENSIONS.test(picked.name)
    ) {
      setError(t('myExpenses.validation.fileType'));
      return;
    }
    if (picked.size > MAX_RECEIPT_BYTES) {
      setError(t('myExpenses.validation.fileSize'));
      return;
    }
    setError(null);
    setReceipt(picked);
  };

  const handleSave = async (submit: boolean) => {
    const issue = validate(submit);
    if (issue) {
      setError(issue);
      return;
    }
    setSaving(submit ? 'submit' : 'draft');
    setError(null);
    let draft: ExpenseClaimRecord | null = null;
    try {
      draft = await createExpenseClaim(companyId, {
        employeeId,
        categoryId,
        amount: parsedAmount,
        currency,
        expenseDate,
        description: description.trim() || undefined,
      });
      if (receipt) {
        await uploadExpenseReceipt(draft.id, receipt);
      }
      const saved = submit ? await submitExpenseClaim(draft.id) : draft;
      await onSaved(saved);
    } catch (err) {
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('common.error');
      if (draft) {
        await onSaved(
          draft,
          t('myExpenses.draftWarning', {
            ref: draft.referenceNumber,
            reason: msg,
          }),
        );
      } else {
        setError(msg);
      }
    } finally {
      setSaving(null);
    }
  };

  const remainingMonthly =
    category?.maxAmountPerMonth != null
      ? Math.max(0, category.maxAmountPerMonth - monthSpent)
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('myExpenses.modalTitle')}
      description={t('myExpenses.modalDescription')}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving !== null}
          >
            {t('myExpenses.cancel')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleSave(false)}
            disabled={saving !== null || categories.length === 0}
          >
            {saving === 'draft' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {t('myExpenses.saveDraft')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave(true)}
            disabled={saving !== null || categories.length === 0}
          >
            {saving === 'submit' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {t('myExpenses.submitClaim')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="my-exp-category">
            {t('myExpenses.category')} *
          </Label>
          <Select
            id="my-exp-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t('myExpenses.selectCategory')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
          {category ? (
            <div className="mt-2 rounded-lg border border-base bg-[rgb(var(--bg-subtle))] px-3 py-2 text-xs space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-primary">
                  {describeLimits(category)}
                </span>
                <Badge tone={category.receiptRequired ? 'warning' : 'neutral'}>
                  {category.receiptRequired
                    ? t('myExpenses.receiptRequired')
                    : t('myExpenses.receiptOptional')}
                </Badge>
              </div>
              {remainingMonthly != null ? (
                <div className="text-secondary flex items-center justify-between gap-2">
                  <span>
                    {t('myExpenses.monthUsage', {
                      spent: `${formatMoney(monthSpent)} ${currency}`,
                      limit: `${formatMoney(category.maxAmountPerMonth)} ${currency}`,
                    })}
                  </span>
                  <span className="font-medium text-primary">
                    {t('myExpenses.remainingMonth', {
                      remaining: `${formatMoney(remainingMonthly)} ${currency}`,
                    })}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="my-exp-amount">
              {t('myExpenses.amount', { currency })} *
            </Label>
            <Input
              id="my-exp-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            {exceedsPerClaim && category ? (
              <p className="mt-1 text-xs text-error-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t('myExpenses.exceedsPerClaim', {
                  category: category.name,
                  limit: `${formatMoney(category.maxAmountPerClaim)} ${currency}`,
                })}
              </p>
            ) : exceedsMonthly && category ? (
              <p className="mt-1 text-xs text-error-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t('myExpenses.exceedsMonthly', {
                  month: monthPrefix,
                  spent: `${formatMoney(monthSpent)} ${currency}`,
                  amount: `${formatMoney(parsedAmount)} ${currency}`,
                  limit: `${formatMoney(category.maxAmountPerMonth)} ${currency}`,
                })}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="my-exp-date">
              {t('myExpenses.expenseDate')} *
            </Label>
            <Input
              id="my-exp-date"
              type="date"
              max={todayIso()}
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="my-exp-desc">{t('myExpenses.description')}</Label>
          <Textarea
            id="my-exp-desc"
            rows={2}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('myExpenses.descriptionPlaceholder')}
          />
        </div>

        <div>
          <Label>
            {t('myExpenses.receipt')}
            {category?.receiptRequired ? ' *' : ''}
          </Label>
          {receipt ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-base px-3 py-2.5 bg-[rgb(var(--bg-subtle))]">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-accent-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary truncate">
                    {receipt.name}
                  </div>
                  <div className="text-xs text-muted">
                    {formatReceiptSize(receipt.size)}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReceipt(null)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('myExpenses.removeReceipt')}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-base p-4 text-center hover:border-accent-500/60 transition-colors"
            >
              <Upload className="h-5 w-5 text-accent-500 mx-auto" />
              <div className="mt-1 text-sm font-medium text-primary">
                {t('myExpenses.chooseReceipt')}
              </div>
              <div className="text-xs text-muted">
                {t('myExpenses.receiptHint')}
              </div>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = '';
              handlePickFile(file);
            }}
          />
        </div>

        <div className="rounded-lg border border-base bg-[rgb(var(--bg-subtle))] p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary uppercase tracking-wider">
            <GitBranch className="h-3.5 w-3.5" />
            {t('myExpenses.approvalRouteTitle')}
          </div>
          {route?.steps?.length ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {route.steps.map((step, idx) => (
                <div key={step.order} className="inline-flex items-center gap-1.5">
                  <Badge tone="neutral">
                    {t('myExpenses.stepLabel', { order: step.order })}:{' '}
                    {step.roleName}
                  </Badge>
                  {idx < route.steps.length - 1 ? (
                    <span className="text-xs text-muted">→</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{t('myExpenses.approvalRouteEmpty')}</span>
              <Paperclip className="h-3.5 w-3.5 hidden" />
            </div>
          )}
        </div>

        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-2 text-sm text-error-700 dark:text-error-300">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

