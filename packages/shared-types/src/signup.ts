import type { PublicPlanFeatureView, PublicPlanLimitView } from './billing';

/** Public Self-Service Signup & Provisioning Contracts (Stage E.0 / E.1 / E.2) */

export type PublicSignupAuthMethod = 'password' | 'magic_link';

export interface PublicSignupPayload {
  companyName: string;
  country: string;
  workEmail: string;
  ownerName: string;
  authMethod?: PublicSignupAuthMethod;
  password?: string;
  desiredSubdomain: string;
  acceptedTerms: boolean;
  termsVersion: string;
  captchaToken: string;
  marketingConsent?: boolean;
  attributionConsent?: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
}

export interface PublicSignupAcceptedResponse {
  accepted: true;
  status: 'verification_sent';
  expiresInHours: number;
  message: string;
}

export interface PublicSubdomainAvailabilityResponse {
  subdomain: string;
  available: boolean;
  reason: 'reserved' | 'taken' | 'invalid_format' | null;
  message: string;
}

export interface PublicCaptchaChallengeResponse {
  challengeId: string;
  prompt: string;
  expiresAt: string;
  provider?: 'turnstile' | 'local_fallback';
  fallbackActive?: boolean;
  siteKey?: string;
}

export interface PublicSignupVerificationResponse {
  status: 'provisioned' | 'provisioning' | 'failed';
  tenantId?: string;
  subdomain?: string;
  loginUrl?: string;
  trialDays?: number;
  trialEndsAt?: string | null;
  authMethod?: PublicSignupAuthMethod;
  message: string;
}

export interface PublicTrialConfigResponse {
  trialDays: number;
  requirePaymentCard: boolean;
  termsVersion: string;
  planCode: string;
  planName: string;
  planDescription: string;
  features: PublicPlanFeatureView[];
  limits: PublicPlanLimitView[];
}
