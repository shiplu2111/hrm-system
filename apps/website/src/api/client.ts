import { env } from '../env';
import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  AvailableTenantLanguage,
  PublicCaptchaChallengeResponse,
  PublicCountry,
  PublicCurrenciesMeta,
  PublicCurrencyView,
  PublicForgotCompanyPayload,
  PublicForgotCompanyResponse,
  PublicHealthData,
  PublicKbArticleDetail,
  PublicKbArticleSummary,
  PublicKbCategory,
  PublicKbCategoryDetail,
  PublicKbFeedbackResponse,
  PublicLeadPayload,
  PublicLeadSubmissionResponse,
  PublicLoginDiscoverPayload,
  PublicLoginDiscoverResponse,
  PublicNewsletterSubscribePayload,
  PublicNewsletterSubscribeResponse,
  PublicPlanView,
  PublicDpaMetadataResponse,
  PublicPlatformStatusResponse,
  PublicSubprocessorsResponse,
  PublicSignupAcceptedResponse,
  PublicSignupPayload,
  PublicSignupVerificationResponse,
  PublicSubdomainAvailabilityResponse,
  PublicSystemStatus,
  PublicTenantBranding,
  PublicTrialConfigResponse,
} from './types';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: any,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface RequestOptions {
  revalidate?: number | false;
  tags?: string[];
  cache?: RequestCache;
  timeoutMs?: number;
}

/**
 * Standard typed API client for public platform endpoints.
 * Tailored for Next.js Server Components with caching and ISR.
 */
class PublicApiClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  private async requestEnvelope<T, M = Record<string, unknown>>(
    path: string,
    init?: RequestInit,
    options?: RequestOptions,
  ): Promise<{ data: T; meta?: M }> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const timeout = options?.timeoutMs ?? 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const nextOptions: Record<string, any> = {};
    if (typeof options?.revalidate !== 'undefined') {
      nextOptions.revalidate = options.revalidate;
    } else {
      nextOptions.revalidate = env.NEXT_PUBLIC_CACHE_REVALIDATE_SECONDS;
    }
    if (options?.tags) {
      nextOptions.tags = options.tags;
    }

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init?.headers || {}),
        },
        cache: options?.cache ?? (options?.revalidate === false ? 'no-store' : undefined),
        next: Object.keys(nextOptions).length > 0 ? nextOptions : undefined,
      });

      clearTimeout(timeoutId);

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const errorBody = json as ApiErrorEnvelope | null;
        throw new ApiClientError(
          errorBody?.error?.code || 'HTTP_ERROR',
          errorBody?.error?.message || `Request failed with status ${response.status}`,
          response.status,
          errorBody?.error?.details,
          errorBody?.error?.requestId,
        );
      }

      const envelope = json as ApiEnvelope<T>;
      return {
        data: envelope.data !== undefined ? envelope.data : (json as unknown as T),
        meta: envelope.meta as M | undefined,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err instanceof ApiClientError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiClientError('TIMEOUT', `Request timed out after ${timeout}ms`, 408);
      }
      throw new ApiClientError('NETWORK_ERROR', err.message || 'Network request failed', 0);
    }
  }

  private async request<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
    const result = await this.requestEnvelope<T>(path, init, options);
    return result.data;
  }

  public readonly health = {
    get: async (options?: RequestOptions): Promise<PublicHealthData> => {
      return this.request<PublicHealthData>('/health', { method: 'GET' }, options);
    },
  };

  public readonly system = {
    getStatus: async (options?: RequestOptions): Promise<PublicSystemStatus> => {
      return this.request<PublicSystemStatus>('/system/status', { method: 'GET' }, options);
    },
    getPublicPlatformStatus: async (
      options?: RequestOptions,
    ): Promise<PublicPlatformStatusResponse | null> => {
      try {
        return await this.request<PublicPlatformStatusResponse>(
          '/api/v1/public/status',
          { method: 'GET' },
          { cache: 'no-store', revalidate: false, ...options },
        );
      } catch {
        return null;
      }
    },
  };

  public readonly branding = {
    resolve: async (
      params?: { subdomain?: string; domain?: string },
      options?: RequestOptions,
    ): Promise<PublicTenantBranding> => {
      const query = new URLSearchParams();
      if (params?.subdomain) query.set('subdomain', params.subdomain);
      if (params?.domain) query.set('domain', params.domain);
      const queryString = query.toString() ? `?${query.toString()}` : '';
      return this.request<PublicTenantBranding>(
        `/api/v1/settings/branding/public${queryString}`,
        { method: 'GET' },
        options,
      );
    },
  };

  public readonly plans = {
    list: async (options?: RequestOptions): Promise<PublicPlanView[]> => {
      try {
        return await this.request<PublicPlanView[]>(
          '/api/v1/public/plans',
          { method: 'GET' },
          { revalidate: 10, tags: ['public-plans'], ...options },
        );
      } catch {
        // Return empty catalog when backend is unreachable; never invent static prices
        return [];
      }
    },
  };

  public readonly currencies = {
    list: async (
      params?: { country?: string },
      options?: RequestOptions,
    ): Promise<{ currencies: PublicCurrencyView[]; meta: PublicCurrenciesMeta }> => {
      const query = new URLSearchParams();
      if (params?.country) query.set('country', params.country);
      const qs = query.toString() ? `?${query.toString()}` : '';

      try {
        const res = await this.requestEnvelope<PublicCurrencyView[], PublicCurrenciesMeta>(
          `/api/v1/public/currencies${qs}`,
          { method: 'GET' },
          { revalidate: 30, tags: ['public-currencies'], ...options },
        );
        return {
          currencies: res.data,
          meta: res.meta ?? {
            detectedCountry: params?.country ?? null,
            defaultCurrency:
              res.data.find((c) => c.isDefault)?.code ?? res.data[0]?.code ?? 'USD',
          },
        };
      } catch {
        return {
          currencies: [],
          meta: { detectedCountry: null, defaultCurrency: 'USD' },
        };
      }
    },
  };

  public readonly countries = {
    list: async (options?: RequestOptions): Promise<PublicCountry[]> => {
      try {
        return await this.request<PublicCountry[]>(
          '/api/v1/public/countries',
          { method: 'GET' },
          { revalidate: 10, tags: ['public-countries'], ...options },
        );
      } catch {
        // Return empty array on network unavailability during offline builds; never invent static countries
        return [];
      }
    },
    getBySlug: async (slug: string, options?: RequestOptions): Promise<PublicCountry | null> => {
      const normalized = slug.trim().toLowerCase();
      const activeCountries = await this.countries.list(options);
      return (
        activeCountries.find(
          (c) => c.slug === normalized || c.isoCode.toLowerCase() === normalized,
        ) ?? null
      );
    },
  };

  public readonly knowledgeBase = {
    listCategories: async (options?: RequestOptions): Promise<PublicKbCategory[]> => {
      try {
        return await this.request<PublicKbCategory[]>(
          '/api/v1/public/kb/categories',
          { method: 'GET' },
          { revalidate: 10, tags: ['public-kb'], ...options },
        );
      } catch {
        return [];
      }
    },
    getCategory: async (
      slug: string,
      options?: RequestOptions,
    ): Promise<PublicKbCategoryDetail | null> => {
      try {
        return await this.request<PublicKbCategoryDetail>(
          `/api/v1/public/kb/categories/${encodeURIComponent(slug)}`,
          { method: 'GET' },
          { revalidate: 10, tags: ['public-kb'], ...options },
        );
      } catch {
        return null;
      }
    },
    listArticles: async (
      params?: { categorySlug?: string; search?: string },
      options?: RequestOptions,
    ): Promise<PublicKbArticleSummary[]> => {
      const query = new URLSearchParams();
      if (params?.categorySlug) query.set('categorySlug', params.categorySlug);
      if (params?.search) query.set('search', params.search);
      const qs = query.toString() ? `?${query.toString()}` : '';
      const hasSearch = Boolean(params?.search?.trim());
      try {
        return await this.request<PublicKbArticleSummary[]>(
          `/api/v1/public/kb/articles${qs}`,
          { method: 'GET' },
          hasSearch
            ? { revalidate: false, cache: 'no-store', ...options }
            : { revalidate: 10, tags: ['public-kb'], ...options },
        );
      } catch {
        return [];
      }
    },
    getArticle: async (
      slug: string,
      options?: RequestOptions,
    ): Promise<PublicKbArticleDetail | null> => {
      try {
        return await this.request<PublicKbArticleDetail>(
          `/api/v1/public/kb/articles/${encodeURIComponent(slug)}`,
          { method: 'GET' },
          { revalidate: 10, tags: ['public-kb'], ...options },
        );
      } catch {
        return null;
      }
    },
    trackView: async (slug: string): Promise<void> => {
      try {
        await this.request(
          `/api/v1/public/kb/articles/${encodeURIComponent(slug)}/view`,
          { method: 'POST' },
          { revalidate: false, cache: 'no-store' },
        );
      } catch {
        // Non-blocking telemetry beacon
      }
    },
    submitFeedback: async (
      slug: string,
      helpful: boolean,
    ): Promise<PublicKbFeedbackResponse> => {
      return this.request<PublicKbFeedbackResponse>(
        `/api/v1/public/kb/articles/${encodeURIComponent(slug)}/feedback`,
        { method: 'POST', body: JSON.stringify({ helpful }) },
        { revalidate: false, cache: 'no-store' },
      );
    },
  };

  public readonly signup = {
    getTrialConfig: async (options?: RequestOptions): Promise<PublicTrialConfigResponse | null> => {
      try {
        return await this.request<PublicTrialConfigResponse>(
          '/api/v1/public/signup/config',
          { method: 'GET' },
          { revalidate: 30, tags: ['public-signup-config'], ...options },
        );
      } catch {
        return null;
      }
    },
    getCaptcha: async (): Promise<PublicCaptchaChallengeResponse> => {
      return this.request<PublicCaptchaChallengeResponse>(
        '/api/v1/public/signup/captcha',
        { method: 'GET' },
        { revalidate: false, cache: 'no-store' },
      );
    },
    checkSubdomain: async (subdomain: string): Promise<PublicSubdomainAvailabilityResponse> => {
      const qs = new URLSearchParams({ subdomain: subdomain.trim().toLowerCase() }).toString();
      return this.request<PublicSubdomainAvailabilityResponse>(
        `/api/v1/public/signup/check-subdomain?${qs}`,
        { method: 'GET' },
        { revalidate: false, cache: 'no-store' },
      );
    },
    submit: async (payload: PublicSignupPayload): Promise<PublicSignupAcceptedResponse> => {
      return this.request<PublicSignupAcceptedResponse>(
        '/api/v1/public/signup',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        { revalidate: false, cache: 'no-store' },
      );
    },
    verify: async (
      token: string,
      verifyOptions?: { async?: boolean },
    ): Promise<PublicSignupVerificationResponse> => {
      return this.request<PublicSignupVerificationResponse>(
        '/api/v1/public/signup/verify',
        {
          method: 'POST',
          body: JSON.stringify({ token, async: Boolean(verifyOptions?.async) }),
        },
        { revalidate: false, cache: 'no-store' },
      );
    },
    getStatus: async (token: string): Promise<PublicSignupVerificationResponse> => {
      const qs = new URLSearchParams({ token }).toString();
      return this.request<PublicSignupVerificationResponse>(
        `/api/v1/public/signup/status?${qs}`,
        { method: 'GET' },
        { revalidate: false, cache: 'no-store' },
      );
    },
  };

  public readonly leads = {
    getCaptcha: async (): Promise<PublicCaptchaChallengeResponse> => {
      return this.request<PublicCaptchaChallengeResponse>(
        '/api/v1/public/leads/captcha',
        { method: 'GET' },
        { revalidate: false, cache: 'no-store' },
      );
    },
    submitLead: async (payload: PublicLeadPayload): Promise<PublicLeadSubmissionResponse> => {
      return this.request<PublicLeadSubmissionResponse>(
        '/api/v1/public/leads',
        { method: 'POST', body: JSON.stringify(payload) },
        { revalidate: false, cache: 'no-store' },
      );
    },
    submitDemoRequest: async (payload: PublicLeadPayload): Promise<PublicLeadSubmissionResponse> => {
      return this.request<PublicLeadSubmissionResponse>(
        '/api/v1/public/leads/demo',
        { method: 'POST', body: JSON.stringify(payload) },
        { revalidate: false, cache: 'no-store' },
      );
    },
    submitContactMessage: async (
      payload: PublicLeadPayload,
    ): Promise<PublicLeadSubmissionResponse> => {
      return this.request<PublicLeadSubmissionResponse>(
        '/api/v1/public/leads/contact',
        { method: 'POST', body: JSON.stringify(payload) },
        { revalidate: false, cache: 'no-store' },
      );
    },
  };

  public readonly login = {
    discover: async (
      payload: PublicLoginDiscoverPayload,
    ): Promise<PublicLoginDiscoverResponse> => {
      return this.request<PublicLoginDiscoverResponse>(
        '/api/v1/public/login/discover',
        { method: 'POST', body: JSON.stringify(payload) },
        { revalidate: false, cache: 'no-store' },
      );
    },
    forgotCompany: async (
      payload: PublicForgotCompanyPayload,
    ): Promise<PublicForgotCompanyResponse> => {
      return this.request<PublicForgotCompanyResponse>(
        '/api/v1/public/login/forgot-company',
        { method: 'POST', body: JSON.stringify(payload) },
        { revalidate: false, cache: 'no-store' },
      );
    },
  };

  public readonly newsletter = {
    subscribe: async (
      payload: PublicNewsletterSubscribePayload,
    ): Promise<PublicNewsletterSubscribeResponse> => {
      return this.request<PublicNewsletterSubscribeResponse>(
        '/api/v1/public/newsletter/subscribe',
        { method: 'POST', body: JSON.stringify(payload) },
        { revalidate: false, cache: 'no-store' },
      );
    },
  };

  public readonly languages = {
    list: async (options?: RequestOptions): Promise<AvailableTenantLanguage[]> => {
      const fallback: AvailableTenantLanguage[] = [
        { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', isDefault: true },
        { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', direction: 'ltr', isDefault: false },
      ];
      try {
        const res = await this.requestEnvelope<AvailableTenantLanguage[]>(
          '/api/v1/public/languages',
          { method: 'GET' },
          { revalidate: 60, ...options },
        );
        return Array.isArray(res.data) && res.data.length > 0 ? res.data : fallback;
      } catch {
        return fallback;
      }
    },
  };

  public readonly legal = {
    getDpa: async (options?: RequestOptions): Promise<PublicDpaMetadataResponse | null> => {
      try {
        return await this.request<PublicDpaMetadataResponse>(
          '/api/v1/public/legal/dpa',
          { method: 'GET' },
          { cache: 'no-store', revalidate: false, ...options },
        );
      } catch {
        return null;
      }
    },
    getSubprocessors: async (
      options?: RequestOptions,
    ): Promise<PublicSubprocessorsResponse | null> => {
      try {
        return await this.request<PublicSubprocessorsResponse>(
          '/api/v1/public/legal/subprocessors',
          { method: 'GET' },
          { cache: 'no-store', revalidate: false, ...options },
        );
      } catch {
        return null;
      }
    },
  };
}

export const apiClient = new PublicApiClient();
