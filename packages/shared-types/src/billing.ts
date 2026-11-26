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
  | 'advanced_workflow'
  | 'custom_domains'
  | 'white_label';

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

export type PublicPlanPricingModel =
  | 'free'
  | 'base_plus_employee'
  | 'per_employee'
  | 'flat'
  | 'custom';

export interface PublicPlanFeatureView {
  key: string;
  label: string;
  included: boolean;
}

export interface PublicPlanLimitView {
  key: string;
  label: string;
  value: number | null;
}

export interface PublicPlanPriceView {
  currency: string;
  billingCycle: 'monthly' | 'annual';
  amount: number;
  perSeatAmount: number | null;
  effectiveFrom: string;
}

export interface PublicPlanView {
  id: string;
  code: string;
  name: string;
  description: string;
  rank: number;
  pricingModel: PublicPlanPricingModel;
  includedSeats: number;
  isPopular: boolean;
  features: PublicPlanFeatureView[];
  limits: PublicPlanLimitView[];
  prices: PublicPlanPriceView[];
}

export interface PublicCurrencyCountryRef {
  isoCode: string;
  name: string;
  slug: string;
}

export interface PublicCurrencyView {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
  isDefault: boolean;
  countries: PublicCurrencyCountryRef[];
}

export interface PublicCurrenciesMeta {
  detectedCountry: string | null;
  defaultCurrency: string;
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
  | 'refunded'
  | 'partially_refunded';

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

export interface CreditNoteView {
  id: string;
  tenantId: string;
  invoiceId: string;
  creditNoteNumber: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  issuedBy: string;
  issuedAt: string;
  createdAt: string;
}

export interface PlatformInvoiceListItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
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
  pdfKey: string | null;
  paidReason: string | null;
  paymentMethod: string | null;
  createdAt: string;
}

export interface PlatformInvoiceDetailView extends PlatformInvoiceListItem {
  lines: InvoiceLineView[];
  payments: PaymentRecordView[];
  creditNotes: CreditNoteView[];
  pdfUrl: string | null;
}

export interface MarkInvoicePaidRequest {
  reason: string;
  paymentMethod?: string;
  reference?: string;
}

export interface IssueCreditNoteRequest {
  amount: number;
  reason: string;
}

export interface ResendInvoiceEmailRequest {
  recipientEmail?: string;
}

export interface QueryInvoicesFilter {
  tenantId?: string;
  search?: string;
  status?: InvoiceStatus;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}

export interface PaymentRefundView {
  id: string;
  paymentId: string;
  tenantId: string;
  amount: number;
  currency: string;
  reason: string;
  refundedBy: string;
  status: string;
  providerRefundId?: string | null;
  createdAt: string;
}

export interface PlatformPaymentListItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  subscriptionId?: string | null;
  provider: string;
  providerPaymentId?: string | null;
  idempotencyKey?: string | null;
  amount: number;
  amountRefunded: number;
  currency: string;
  status: PaymentStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  paymentMethod?: string | null;
  refundReason?: string | null;
  refundedAt?: string | null;
  retryCount: number;
  lastRetryAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  refundsCount: number;
}

export interface PlatformPaymentDetailView extends PlatformPaymentListItem {
  refunds: PaymentRefundView[];
  invoice?: {
    id: string;
    invoiceNumber: string;
    total: number;
    amountPaid: number;
    amountDue: number;
    status: InvoiceStatus;
    billingReason: string;
  } | null;
}

export interface RefundPaymentRequest {
  amount?: number;
  reason: string;
  refundType: 'full' | 'partial';
}

export interface RetryPaymentRequest {
  simulateFailure?: boolean;
  failureReason?: string;
}

export interface QueryPaymentsFilter {
  tenantId?: string;
  search?: string;
  status?: PaymentStatus;
  provider?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface DunningTenantView {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  subscriptionId: string;
  planId: string;
  planName: string;
  planTier: string;
  billingCycle: string;
  subscriptionStatus: string;
  dunningStep: number;
  dunningStage: 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' | 'suspended';
  dunningStageLabel: string;
  dunningDescription: string;
  lastDunningAt?: string | null;
  nextRetryAt?: string | null;
  daysOverdue: number;
  gracePeriodEndsAt?: string | null;
  isSuspended: boolean;
  suspensionMode?: string | null;
  totalOutstandingAmount: number;
  currency: string;
  unpaidInvoicesCount: number;
  latestFailedPayment?: {
    id: string;
    amount: number;
    currency: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    failedAt: string;
  } | null;
}

export interface MonthlyRevenueMovement {
  month: string;
  monthLabel: string;
  startingMrr: number;
  newRevenue: number;
  expansionRevenue: number;
  contractionRevenue: number;
  churnedRevenue: number;
  netNewRevenue: number;
  endingMrr: number;
  activeSubscriptionsCount: number;
  newSubscriptionsCount: number;
  churnedSubscriptionsCount: number;
}

export interface RevenueByPlanItem {
  planId: string;
  planName: string;
  planCode: string;
  planTier: string;
  activeSubscriptionsCount: number;
  totalMrr: number;
  percentage: number;
}

export interface RevenueByCountryItem {
  countryCode: string;
  countryName: string;
  activeSubscriptionsCount: number;
  totalMrr: number;
  percentage: number;
}

export interface PlatformRevenueReportView {
  asOf: string;
  currency: string;
  currentMrr: number;
  currentArr: number;
  netNewMrrThisMonth: number;
  growthRatePercent: number;
  customerChurnRate: number;
  revenueChurnRate: number;
  totalActiveSubscriptions: number;
  monthlyMovements: MonthlyRevenueMovement[];
  revenueByPlan: RevenueByPlanItem[];
  revenueByCountry: RevenueByCountryItem[];
}

export interface PlatformFeatureFlagView {
  id: string;
  key: string;
  description: string | null;
  defaultState: boolean;
  rolloutPercentage: number;
  metadata?: Record<string, any> | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  overrideCount?: number;
}

export interface FlagTenantOverrideDetailView {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  featureKey: string;
  enabled: boolean;
  reason?: string | null;
  expiresAt?: string | null;
  isExpired: boolean;
  createdAt: string;
  createdBy?: string | null;
  planCode?: string;
  planName?: string;
  planDefault: boolean;
  effectiveEnabled: boolean;
  effectiveSource: FeatureEvaluationSource;
  explanation: string;
}

export interface PlatformFeatureFlagDetailView extends PlatformFeatureFlagView {
  overrideCount: number;
  overrides: FlagTenantOverrideDetailView[];
}

export interface CreatePlatformFeatureFlagRequest {
  key: string;
  description?: string;
  defaultState?: boolean;
  rolloutPercentage?: number;
  metadata?: Record<string, any>;
}

export interface UpdatePlatformFeatureFlagRequest {
  description?: string;
  defaultState?: boolean;
  rolloutPercentage?: number;
  metadata?: Record<string, any>;
}

export interface TenantFeatureOverrideView {
  id: string;
  tenantId: string;
  key: string;
  value: boolean;
  reason?: string | null;
  expiresAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
}

export interface SetTenantFeatureOverrideRequest {
  key: string;
  value: boolean;
  reason?: string;
  expiresAt?: string | null;
}

export type FeatureEvaluationSource =
  | 'tenant_override'
  | 'flag_rollout'
  | 'flag_default'
  | 'setting_override'
  | 'plan_default';

export interface FeatureEvaluationResult {
  key: string;
  enabled: boolean;
  source: FeatureEvaluationSource;
  reason?: string | null;
  bucket?: number;
  rolloutPercentage?: number;
  planCode?: string;
}







