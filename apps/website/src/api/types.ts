/**
 * Typed definitions for platform public endpoints.
 * Shared across server-rendered marketing pages and forms.
 */
import type {
  AvailableTenantLanguage,
  IncidentSeverity,
  IncidentStatus,
  PublicCaptchaChallengeResponse,
  PublicComponentState,
  PublicCountryStatutorySupport,
  PublicCountryView,
  PublicCurrenciesMeta,
  PublicCurrencyCountryRef,
  PublicCurrencyView,
  PublicDailyUptimeDay,
  PublicDpaMetadataResponse,
  PublicForgotCompanyPayload,
  PublicForgotCompanyResponse,
  PublicIncidentUpdate,
  PublicKbArticleDetail,
  PublicKbArticleSummary,
  PublicKbCategory,
  PublicKbCategoryDetail,
  PublicKbFeedbackResponse,
  PublicLeadSubmissionPayload,
  PublicLeadSubmissionResponse,
  PublicLoginDiscoverPayload,
  PublicLoginDiscoverResponse,
  PublicNewsletterSubscribePayload,
  PublicNewsletterSubscribeResponse,
  PublicPlanFeatureView,
  PublicPlanLimitView,
  PublicPlanPriceView,
  PublicPlanPricingModel,
  PublicPlanView,
  PublicPlatformStatusResponse,
  PublicPortalTarget,
  PublicSignupAcceptedResponse,
  PublicSignupAuthMethod,
  PublicSignupPayload,
  PublicSignupVerificationResponse,
  PublicStatusComponent,
  PublicStatusComponentId,
  PublicStatusIncident,
  PublicSubdomainAvailabilityResponse,
  PublicSubprocessorCategory,
  PublicSubprocessorCategoryNote,
  PublicSubprocessorItem,
  PublicSubprocessorsResponse,
  PublicTrialConfigResponse,
} from '@hrm/shared-types';

export type {
  AvailableTenantLanguage,
  IncidentSeverity,
  IncidentStatus,
  PublicCaptchaChallengeResponse,
  PublicComponentState,
  PublicCountryStatutorySupport,
  PublicCountryView,
  PublicCurrenciesMeta,
  PublicCurrencyCountryRef,
  PublicCurrencyView,
  PublicDailyUptimeDay,
  PublicDpaMetadataResponse,
  PublicIncidentUpdate,
  PublicPlatformStatusResponse,
  PublicStatusComponent,
  PublicStatusComponentId,
  PublicStatusIncident,
  PublicSubprocessorCategory,
  PublicSubprocessorCategoryNote,
  PublicSubprocessorItem,
  PublicSubprocessorsResponse,
  PublicForgotCompanyPayload,
  PublicForgotCompanyResponse,
  PublicKbArticleDetail,
  PublicKbArticleSummary,
  PublicKbCategory,
  PublicKbCategoryDetail,
  PublicKbFeedbackResponse,
  PublicLeadSubmissionPayload,
  PublicLeadSubmissionResponse,
  PublicLoginDiscoverPayload,
  PublicLoginDiscoverResponse,
  PublicNewsletterSubscribePayload,
  PublicNewsletterSubscribeResponse,
  PublicPlanFeatureView,
  PublicPlanLimitView,
  PublicPlanPriceView,
  PublicPlanPricingModel,
  PublicPlanView,
  PublicPortalTarget,
  PublicSignupAcceptedResponse,
  PublicSignupAuthMethod,
  PublicSignupPayload,
  PublicSignupVerificationResponse,
  PublicSubdomainAvailabilityResponse,
  PublicTrialConfigResponse,
};

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, any>;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: any;
  requestId?: string;
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetail;
}

export interface PublicHealthData {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  apiLatencyMs: number;
  errorRatePercentage: number;
  database: string;
  redis: string;
  mobileSyncSuccessRate: number;
}

export interface PublicSystemStatus {
  isMaintenanceActive: boolean;
  scheduledWindow?: {
    start: string;
    end: string;
    reason: string;
  } | null;
  affectedServices: string[];
  bannerMessage: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
}

export interface PublicTenantBranding {
  subdomain: string;
  displayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  customDomain: string | null;
}

export type PublicPlanFeature = PublicPlanFeatureView;

export type PublicPlanPrice = PublicPlanPriceView;

export type PublicPlan = PublicPlanView;

export type PublicCountry = PublicCountryView;

export interface PublicArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  categoryId: string;
  categoryName?: string;
  publishedAt: string;
  readTimeMinutes?: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  articleCount?: number;
}

export type PublicLeadPayload = PublicLeadSubmissionPayload;
