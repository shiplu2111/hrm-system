import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Globe2,
  Info,
  Lock,
  Mail,
  Palette,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type {
  PlatformTenantSummary,
  TenantBrandingView,
  TenantCustomDomainStatus,
  TenantDnsRecord,
} from '@hrm/shared-types';
import { usePlatformTenant } from '@/context/PlatformTenantContext';
import { fetchPlatformTenants } from '@/lib/api-client';
import {
  disableTenantCustomDomain,
  getTenantBranding,
  reEnableTenantCustomDomain,
  updateTenantBranding,
  verifyTenantCustomDomain,
} from '@/lib/branding-api';
import { FeatureGate } from '@/components/FeatureGate';

const PRESET_PALETTES = [
  { name: 'Default Indigo', primary: '#4F46E5', secondary: '#06B6D4', accent: '#F59E0B', bg: '#0F172A' },
  { name: 'Corporate Emerald', primary: '#059669', secondary: '#0D9488', accent: '#3B82F6', bg: '#064E3B' },
  { name: 'Royal Violet', primary: '#7C3AED', secondary: '#EC4899', accent: '#10B981', bg: '#1E1B4B' },
  { name: 'Ocean Blue', primary: '#2563EB', secondary: '#0284C7', accent: '#F97316', bg: '#0C4A6E' },
  { name: 'Crimson Slate', primary: '#DC2626', secondary: '#475569', accent: '#EAB308', bg: '#18181B' },
];

export function BrandingDomainsPage() {
  const { selectedTenant, setSelectedTenant } = usePlatformTenant();
  const [tenants, setTenants] = useState<PlatformTenantSummary[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>('');
  const [loadingTenants, setLoadingTenants] = useState<boolean>(true);

  const [branding, setBranding] = useState<TenantBrandingView | null>(null);
  const [loadingBranding, setLoadingBranding] = useState<boolean>(false);
  const [savingBranding, setSavingBranding] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);

  // Form states for branding
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4F46E5');
  const [secondaryColor, setSecondaryColor] = useState('#06B6D4');
  const [accentColor, setAccentColor] = useState('#F59E0B');
  const [backgroundColor, setBackgroundColor] = useState('#0F172A');
  const [appTitle, setAppTitle] = useState('');
  const [emailSenderName, setEmailSenderName] = useState('');
  const [emailSenderAddress, setEmailSenderAddress] = useState('');
  const [customDomainInput, setCustomDomainInput] = useState('');

  // Modals & Feedback
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disableReason, setDisableReason] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tenantSearch, setTenantSearch] = useState('');

  // Load tenants on mount
  useEffect(() => {
    fetchPlatformTenants()
      .then((res: any) => {
        const list: PlatformTenantSummary[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.data)
          ? res.data
          : [];
        setTenants(list);
        if (selectedTenant && list.some((t) => t.id === selectedTenant.id)) {
          setActiveTenantId(selectedTenant.id);
        } else if (list.length > 0) {
          setActiveTenantId(list[0].id);
        }
      })
      .catch((err) => {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to load tenants' });
      })
      .finally(() => setLoadingTenants(false));
  }, [selectedTenant]);

  // Load branding whenever active tenant changes
  useEffect(() => {
    if (!activeTenantId) return;
    setLoadingBranding(true);
    setStatusMessage(null);

    getTenantBranding(activeTenantId)
      .then((data) => {
        setBranding(data);
        setLogoUrl(data.logoUrl || '');
        setFaviconUrl(data.faviconUrl || '');
        setPrimaryColor(data.primaryColor || '#4F46E5');
        setSecondaryColor(data.secondaryColor || '#06B6D4');
        setAccentColor(data.accentColor || '#F59E0B');
        setBackgroundColor(data.backgroundColor || '#0F172A');
        setAppTitle(data.appTitle || `${data.tenantName} Workforce Portal`);
        setEmailSenderName(data.emailSenderName || `${data.tenantName} People Ops`);
        setEmailSenderAddress(data.emailSenderAddress || `hr@${data.subdomain}.cmsnbd.com`);
        setCustomDomainInput(data.customDomain || '');
      })
      .catch((err) => {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to load branding' });
      })
      .finally(() => setLoadingBranding(false));
  }, [activeTenantId]);

  const currentTenant = useMemo(() => {
    return Array.isArray(tenants) ? tenants.find((t) => t.id === activeTenantId) : undefined;
  }, [tenants, activeTenantId]);

  const filteredTenants = useMemo(() => {
    if (!Array.isArray(tenants)) return [];
    if (!tenantSearch.trim()) return tenants;
    const q = tenantSearch.toLowerCase();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.subdomain.toLowerCase().includes(q) ||
        t.plan.toLowerCase().includes(q),
    );
  }, [tenants, tenantSearch]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveBranding = async () => {
    if (!activeTenantId) return;
    setSavingBranding(true);
    setStatusMessage(null);
    try {
      const updated = await updateTenantBranding(activeTenantId, {
        logoUrl: logoUrl.trim() || null,
        faviconUrl: faviconUrl.trim() || null,
        primaryColor,
        secondaryColor,
        accentColor,
        backgroundColor,
        appTitle: appTitle.trim() || undefined,
        emailSenderName: emailSenderName.trim() || undefined,
        emailSenderAddress: emailSenderAddress.trim() || undefined,
        customDomain: customDomainInput.trim() || null,
      });
      setBranding(updated);
      setStatusMessage({ type: 'success', text: 'Tenant branding & domain configuration updated successfully.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update branding' });
    } finally {
      setSavingBranding(false);
    }
  };

  const handleVerifyDns = async () => {
    if (!activeTenantId) return;
    setVerifying(true);
    setStatusMessage(null);
    try {
      const result = await verifyTenantCustomDomain(activeTenantId);
      // Reload branding state to sync UI
      const updated = await getTenantBranding(activeTenantId);
      setBranding(updated);
      if (result.verified) {
        setStatusMessage({
          type: 'success',
          text: `DNS Verification Succeeded: ${result.message}`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `DNS Verification Failed: ${result.message}`,
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Verification check failed' });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisableDomain = async () => {
    if (!activeTenantId || !disableReason.trim()) return;
    setDisabling(true);
    try {
      const updated = await disableTenantCustomDomain(activeTenantId, {
        reason: disableReason.trim(),
      });
      setBranding(updated);
      setDisableModalOpen(false);
      setDisableReason('');
      setStatusMessage({
        type: 'success',
        text: `Custom domain disabled. Traffic routing has reverted to ${updated.subdomain}.cmsnbd.com`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to disable custom domain' });
    } finally {
      setDisabling(false);
    }
  };

  const handleReEnableDomain = async () => {
    if (!activeTenantId) return;
    setLoadingBranding(true);
    setStatusMessage(null);
    try {
      const updated = await reEnableTenantCustomDomain(activeTenantId);
      setBranding(updated);
      setStatusMessage({
        type: 'success',
        text: 'Custom domain re-enabled and queued for DNS verification.',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to re-enable custom domain' });
    } finally {
      setLoadingBranding(false);
    }
  };

  const applyPalette = (p: typeof PRESET_PALETTES[0]) => {
    setPrimaryColor(p.primary);
    setSecondaryColor(p.secondary);
    setAccentColor(p.accent);
    setBackgroundColor(p.bg);
  };

  const renderStatusBadge = (status?: TenantCustomDomainStatus) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Verified & Active
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Clock3 className="h-3.5 w-3.5 animate-pulse" />
            Pending DNS Verification
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <AlertTriangle className="h-3.5 w-3.5" />
            Verification Failed
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
            <Ban className="h-3.5 w-3.5" />
            Disabled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
            Unconfigured
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100 pb-16">
      {/* Page Title & Tenant Context Selector */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">
            <Palette className="h-4 w-4" />
            WHITE-LABELING & INFRASTRUCTURE
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Branding & Custom Domains</h1>
          <p className="text-sm text-slate-500 mt-1">
            Platform control of tenant logos, color schemes, DNS records, and automated SSL certificate verification.
          </p>
        </div>

        {/* Searchable Tenant Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[280px]">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Tenant Workspace
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                value={activeTenantId}
                onChange={(e) => {
                  setActiveTenantId(e.target.value);
                  const found = tenants.find((t) => t.id === e.target.value);
                  if (found) setSelectedTenant(found);
                }}
                disabled={loadingTenants}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.plan} · {t.subdomain}.cmsnbd.com)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Status Alert Toast */}
      {statusMessage && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm transition animate-fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{statusMessage.text}</div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadingBranding ? (
        <div className="flex flex-col items-center justify-center min-h-[360px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-500">Loading tenant branding & DNS configuration...</p>
        </div>
      ) : branding ? (
        <div className="space-y-6">
          {/* Tenant Meta Overview Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tenant Workspace</span>
              <div className="text-base font-extrabold text-slate-900 dark:text-white mt-1 truncate">
                {branding.tenantName}
              </div>
              <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                {branding.subdomain}.cmsnbd.com
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Subscription Tier</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base font-extrabold capitalize text-slate-900 dark:text-white">
                  {branding.planCode}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {branding.planCode === 'enterprise' ? 'Unlimited Features' : 'Tier Capped'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Custom Domain Status</span>
              <div className="mt-1">{renderStatusBadge(branding.domainStatus)}</div>
              {branding.lastCheckedAt && (
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  Checked {new Date(branding.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SSL Certificate</span>
              <div className="flex items-center gap-2 mt-1">
                <Shield className={`h-4 w-4 ${branding.sslStatus === 'active' ? 'text-emerald-500' : 'text-slate-400'}`} />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize">
                  {branding.sslStatus === 'active' ? "Active (Let's Encrypt TLS)" : branding.sslStatus}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Automated HTTP-01 Renewals</div>
            </div>
          </div>

          {/* Section: Custom Domain Configuration (Gated by FeatureGate) */}
          <FeatureGate
            feature="custom_domains"
            entitlement={branding.featureEntitlement}
            title={`Custom Domains Gated for ${branding.tenantName}`}
            description={`Custom Domains & White-label SSL routing is an Enterprise tier capability. ${branding.tenantName} is currently on the ${branding.planCode.toUpperCase()} tier.`}
            onUpgradePlan={() => {
              window.location.hash = '#/billing';
            }}
            onGrantOverride={() => {
              window.location.hash = '#/feature-flags';
            }}
          >
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                    <Globe2 className="h-4 w-4" />
                    REVERSE PROXY & HOSTNAME ROUTING
                  </div>
                  <h3 className="text-lg font-bold">Custom Domain & Automated SSL</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Map tenant's corporate vanity domain (e.g. <code className="text-indigo-600 dark:text-indigo-400">hr.yourcompany.com</code>) to the SaaS multi-tenant ingress.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {branding.domainStatus === 'disabled' ? (
                    <button
                      type="button"
                      onClick={handleReEnableDomain}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="h-4 w-4" />
                      Re-enable Domain
                    </button>
                  ) : branding.customDomain ? (
                    <>
                      <button
                        type="button"
                        onClick={handleVerifyDns}
                        disabled={verifying}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
                        {verifying ? 'Re-checking DNS...' : 'Verify DNS Now'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDisableReason('');
                          setDisableModalOpen(true);
                        }}
                        className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Disable Domain
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Disabled Alert Callout if Disabled */}
              {branding.domainStatus === 'disabled' && (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-600 dark:text-rose-400">
                    <Ban className="h-4 w-4" />
                    Custom Domain Currently Disabled
                  </div>
                  <p>
                    Routing for <strong className="font-mono">{branding.customDomain}</strong> was suspended
                    {branding.disabledAt ? ` on ${new Date(branding.disabledAt).toLocaleDateString()}` : ''}.
                  </p>
                  {branding.disabledReason && (
                    <p className="italic text-slate-500 dark:text-slate-400">
                      Reason: "{branding.disabledReason}"
                    </p>
                  )}
                </div>
              )}

              {/* Domain Input Field */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Custom Domain FQDN
                  </label>
                  <div className="relative">
                    <Globe2 className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value)}
                      placeholder="e.g. hr.globex.io"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveBranding}
                  disabled={savingBranding || customDomainInput.trim() === (branding.customDomain || '')}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Save className="h-4 w-4" />
                  {savingBranding ? 'Saving...' : 'Update Hostname'}
                </button>
              </div>

              {/* DNS Records Table */}
              {branding.customDomain && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Required DNS Configuration Records
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Add the following DNS records to your domain DNS provider (Cloudflare, Route53, GoDaddy) to route traffic and verify domain ownership.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase font-mono tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Record Name (Host)</th>
                          <th className="py-2.5 px-3">Expected Target / Value</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Purpose</th>
                          <th className="py-2.5 px-3 text-right">Copy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {branding.dnsRecords.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-500">
                              No DNS records generated yet. Save custom domain to generate.
                            </td>
                          </tr>
                        ) : (
                          branding.dnsRecords.map((record, index) => {
                            const isConfigured = record.status === 'configured';
                            return (
                              <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                <td className="py-3 px-3">
                                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    {record.type}
                                  </span>
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                                  {record.name}
                                </td>
                                <td className="py-3 px-3 text-indigo-600 dark:text-indigo-400 break-all max-w-xs">
                                  {record.expectedValue}
                                </td>
                                <td className="py-3 px-3">
                                  {isConfigured ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Active
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                      <Clock3 className="h-3.5 w-3.5" />
                                      Pending
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-sans text-slate-500 text-[11px]">
                                  {record.purpose}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(record.expectedValue, `rec-${index}`)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
                                    title="Copy Value"
                                  >
                                    {copiedKey === `rec-${index}` ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {branding.failureReason && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{branding.failureReason}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </FeatureGate>

          {/* Section: Branding (Logo, Colors, Email Sender) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Section (7 cols) */}
            <div className="lg:col-span-7 space-y-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold">Portal Theme & Assets</h3>
                  <p className="text-xs text-slate-500">Configure visual branding and corporate identity for staff logins.</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-400">Presets:</span>
                  {PRESET_PALETTES.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => applyPalette(p)}
                      title={p.name}
                      className="h-5 w-5 rounded-full border border-white/40 shadow-sm hover:scale-110 transition"
                      style={{ backgroundColor: p.primary }}
                    />
                  ))}
                </div>
              </div>

              {/* Logo & Favicon */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Tenant Logo URL
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Favicon URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="https://example.com/favicon.ico"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Color Scheme Inputs */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Brand Color Palette
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <span className="text-[11px] font-bold text-slate-500">Primary Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-8 w-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-full text-xs font-mono font-bold uppercase bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <span className="text-[11px] font-bold text-slate-500">Secondary</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="h-8 w-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-full text-xs font-mono font-bold uppercase bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <span className="text-[11px] font-bold text-slate-500">Accent Highlight</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="h-8 w-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-full text-xs font-mono font-bold uppercase bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <span className="text-[11px] font-bold text-slate-500">Header / Surface</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="h-8 w-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="w-full text-xs font-mono font-bold uppercase bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Email Sender */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Portal App Title
                  </label>
                  <input
                    type="text"
                    value={appTitle}
                    onChange={(e) => setAppTitle(e.target.value)}
                    placeholder="e.g. Globex People Portal"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Email Sender Name
                  </label>
                  <input
                    type="text"
                    value={emailSenderName}
                    onChange={(e) => setEmailSenderName(e.target.value)}
                    placeholder="e.g. Globex HR Team"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Outbound Email Address
                  </label>
                  <input
                    type="email"
                    value={emailSenderAddress}
                    onChange={(e) => setEmailSenderAddress(e.target.value)}
                    placeholder="e.g. hr@globex.io"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveBranding}
                  disabled={savingBranding}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingBranding ? 'Saving Changes...' : 'Save Branding Assets'}
                </button>
              </div>
            </div>

            {/* Live Interactive Preview Mockup (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    LIVE PORTAL UI SIMULATOR
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">WYSIWYG</span>
                </div>

                {/* Simulated Portal Top Navigation */}
                <div
                  className="rounded-xl p-3 border border-slate-700 text-white shadow-md transition-all duration-300"
                  style={{ backgroundColor }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Tenant Logo"
                          className="h-6 w-auto max-w-[90px] object-contain rounded"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          className="h-6 w-6 rounded-lg flex items-center justify-center text-white font-black text-xs shadow"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {branding.tenantName.charAt(0)}
                        </div>
                      )}
                      <span className="text-xs font-extrabold tracking-tight truncate max-w-[140px]">
                        {appTitle || branding.tenantName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shadow-sm"
                        style={{ backgroundColor: accentColor, color: '#0F172A' }}
                      >
                        Live ESS
                      </span>
                      <div className="h-5 w-5 rounded-full bg-white/20 border border-white/30" />
                    </div>
                  </div>

                  {/* Simulated Sub-menu */}
                  <div className="flex items-center gap-3 text-[11px] font-medium text-white/80 border-t border-white/10 pt-2">
                    <span className="text-white font-bold border-b-2 border-white pb-0.5">Directory</span>
                    <span className="hover:text-white">Attendance</span>
                    <span className="hover:text-white">Payslips</span>
                    <span className="hover:text-white">Requests</span>
                  </div>
                </div>

                {/* Simulated Action Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Primary Action Controls
                    </div>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: secondaryColor }}
                      title="Secondary Accent Dot"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Buttons and highlight components adapt automatically to your brand's primary color code.
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-3.5 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm transition hover:opacity-90"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Clock In Now
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition"
                      style={{ borderColor: primaryColor, color: primaryColor }}
                    >
                      View Schedule
                    </button>
                  </div>
                </div>

                {/* Simulated Outbound Email Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Mail className="h-4 w-4 text-indigo-500" />
                    Email Notification Sender
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] space-y-0.5">
                    <div className="text-slate-400">
                      From: <strong className="text-slate-900 dark:text-white">{emailSenderName}</strong> &lt;{emailSenderAddress}&gt;
                    </div>
                    <div className="text-slate-400">
                      Subject: <span className="font-semibold text-slate-800 dark:text-slate-200">Your November 2026 Payslip is Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Disable Modal */}
      {disableModalOpen && branding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
                <Ban className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Disable Custom Domain</h3>
                <p className="text-xs text-slate-500">Suspends vanity routing for {branding.customDomain}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Traffic requesting <code className="text-rose-600 dark:text-rose-400 font-mono font-bold">{branding.customDomain}</code> will be rejected or redirected to standard subdomain <code className="font-mono">{branding.subdomain}.cmsnbd.com</code>.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Justification Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                rows={3}
                placeholder="Reason is required for platform audit logs (e.g. Domain expired / customer DNS decommissioning)..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDisableModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisableDomain}
                disabled={!disableReason.trim() || disabling}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {disabling ? 'Disabling...' : 'Confirm & Disable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
