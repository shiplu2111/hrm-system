/** Subscription & billing (BILLING_SUBSCRIPTION.md) */

export type SubscriptionPlanTier =
  | 'free'
  | 'starter'
  | 'business'
  | 'enterprise';

export type EnterpriseFeature =
  | 'api_access'
  | 'sso'
  | 'custom_payroll_rules'
  | 'advanced_workflow';

/** Plan tier features from BILLING_SUBSCRIPTION.md §1, cumulative from Free to Enterprise. */
export type PlanFeatureKey =
  | 'core_hr'
  | 'attendance'
  | 'leave'
  | 'basic_payroll'
  | 'roster'
  | 'timesheets'
  | 'advanced_reports'
  | EnterpriseFeature;

export type PlanLimitKey =
  | 'employees'
  | 'storage_gb'
  | 'api_calls'
  | 'companies'
  | (string & {});

/** `approaching` starts at `TenantSubscriptionView.approachingRatio` of the limit. */
export type PlanUsageLevel = 'ok' | 'approaching' | 'reached' | 'exceeded';

export type TenantSubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'pending_deletion'
  | 'deleted';

export interface PlanDefinition {
  planId: SubscriptionPlanTier;
  features: PlanFeatureKey[];
  /** `null` means unlimited. */
  limits: Partial<Record<PlanLimitKey, number | null>>;
}

export interface PlanUsageMetric {
  key: PlanLimitKey;
  used: number;
  limit: number | null;
  level: PlanUsageLevel;
}

export interface TenantSubscriptionView {
  planId: SubscriptionPlanTier;
  status: TenantSubscriptionStatus;
  features: PlanFeatureKey[];
  usage: PlanUsageMetric[];
  /** Every tier in ascending order, for plan comparison. */
  plans: PlanDefinition[];
  /** The next tier up, or `null` on the top tier. */
  nextPlanId: SubscriptionPlanTier | null;
  approachingRatio: number;
  pendingPlanId?: string | null;
  pendingPlanCode?: string | null;
  pendingPlanName?: string | null;
  pendingEffectiveDate?: string | null;
}

export interface TenantPlanInfo {
  planId: SubscriptionPlanTier;
  features: EnterpriseFeature[];
  apiAccessEnabled: boolean;
}

export interface PlatformPlanPriceView {
  id: string;
  planId: string;
  currency: string;
  billingCycle: 'monthly' | 'annual';
  amount: number;
  perSeatAmount: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface PlatformPlanFeatureView {
  id: string;
  planId: string;
  featureKey: string;
  enabled: boolean;
}

export interface PlatformPlanLimitView {
  id: string;
  planId: string;
  limitKey: string;
  value: number | null;
}

export interface PlatformPlanDetailView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  rank: number;
  isActive: boolean;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
  prices: PlatformPlanPriceView[];
  features: PlatformPlanFeatureView[];
  limits: PlatformPlanLimitView[];
}

export type SubscriptionState =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancelled';

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'past_due'
  | 'void'
  | 'uncollectible';

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded';

export interface SubscriptionRecordView {
  id: string;
  tenantId: string;
  planId: string;
  planCode?: string;
  planName?: string;
  pendingPlanId?: string | null;
  pendingPlanCode?: string | null;
  pendingPlanName?: string | null;
  status: SubscriptionState;
  billingCycle: 'monthly' | 'annual';
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  pausedAt: string | null;
  customerId: string | null;
  paymentMethodId: string | null;
  dunningStep: number;
  lastDunningAt: string | null;
  nextBillingAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanChangePreviewRequest {
  targetPlanCode: string;
}

export interface PlanChangePreview {
  changeType: 'upgrade' | 'downgrade' | 'same';
  currentPlanCode: string;
  currentPlanName: string;
  targetPlanCode: string;
  targetPlanName: string;
  isUpgrade: boolean;
  isDowngrade: boolean;
  immediate: boolean;
  proratedAmount: number;
  currency: string;
  billingCycle: string;
  daysRemaining: number;
  totalDaysInPeriod: number;
  currentRecurringAmount: number;
  newRecurringAmount: number;
  allowed: boolean;
  blockReasons: string[];
  effectiveDate: string;
  message?: string;
}

export interface ExecutePlanChangeRequest {
  targetPlanCode: string;
}

export interface PlanChangeResult {
  success: boolean;
  changeType: 'upgrade' | 'downgrade';
  planId: string;
  planCode: string;
  effectiveImmediately: boolean;
  effectiveDate: string;
  invoiceId?: string;
  proratedCharged?: number;
  currency?: string;
  message: string;
}

export interface InvoiceLineView {
  id: string;
  tenantId: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  createdAt: string;
}

export interface InvoiceView {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  invoiceNumber: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: InvoiceStatus;
  billingReason: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  lines: InvoiceLineView[];
}

export interface PaymentRecordView {
  id: string;
  tenantId: string;
  invoiceId: string | null;
  subscriptionId: string | null;
  provider: string;
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  errorCode: string | null;
  errorMessage: string | null;
  paidAt: string | null;
  createdAt: string;
}

export type SubscriptionActionType =
  | 'plan_change'
  | 'trial_extension'
  | 'discount_applied'
  | 'credit_applied'
  | 'pause'
  | 'resume'
  | 'cancel';

export interface SubscriptionChangeRecord {
  id: string;
  subscriptionId: string;
  tenantId: string;
  action: SubscriptionActionType;
  fromPlanId?: string | null;
  fromPlanName?: string | null;
  toPlanId?: string | null;
  toPlanName?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  amount?: number | null;
  currency?: string | null;
  reason?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface PlatformSubscriptionListItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  planId: string;
  planCode: string;
  planName: string;
  status: SubscriptionState;
  billingCycle: 'monthly' | 'annual';
  currency: string;
  baseAmount: number;
  perSeatAmount: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingAt: string;
  trialEndsAt: string | null;
  discountPercent: number | null;
  creditBalance: number;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  pausedAt: string | null;
  pendingPlan?: { id: string; code: string; name: string } | null;
  employeeCount: number;
  maxEmployees: number | null;
  createdAt: string;
}

export interface PlatformSubscriptionDetailView extends PlatformSubscriptionListItem {
  discountReason: string | null;
  pauseReason: string | null;
  cancelReason: string | null;
  changes: SubscriptionChangeRecord[];
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    total: number;
    amountPaid: number;
    amountDue: number;
    status: InvoiceStatus;
    dueDate: string;
    paidAt: string | null;
  }>;
  limits: PlatformPlanLimitView[];
  features: PlatformPlanFeatureView[];
}

export interface PlatformChangePlanRequest {
  targetPlanId: string;
  effectiveImmediately?: boolean;
  reason?: string;
}

export interface PlatformExtendTrialRequest {
  days?: number;
  newTrialEndsAt?: string;
  reason: string;
}

export interface PlatformApplyDiscountRequest {
  discountPercent?: number;
  creditAmount?: number;
  reason: string;
}

export interface PlatformPauseSubscriptionRequest {
  reason: string;
}

export interface PlatformCancelSubscriptionRequest {
  cancelImmediately: boolean;
  reason: string;
}



