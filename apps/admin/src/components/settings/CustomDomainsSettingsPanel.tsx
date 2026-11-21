import { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  Trash2,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label } from '@/components/ui/Form';
import {
  listCustomDomains,
  createCustomDomain,
  verifyCustomDomain,
  deleteCustomDomain,
} from '@/lib/branding-domains-api';
import type { CustomDomainView, TenantDnsRecord } from '@hrm/shared-types';

export function CustomDomainsSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<CustomDomainView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add Domain Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Action states
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadDomains();
  }, []);

  async function loadDomains() {
    setLoading(true);
    try {
      const data = await listCustomDomains();
      setDomains(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load custom domains');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const created = await createCustomDomain(newDomain.trim());
      setDomains([created, ...domains]);
      setAddModalOpen(false);
      setNewDomain('');
      setSuccess(`Custom domain '${created.domain}' added. Please configure the DNS records below.`);
    } catch (err: any) {
      setError(err.message || 'Failed to add custom domain');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(id: string) {
    setVerifyingId(id);
    setError(null);
    setSuccess(null);

    try {
      const res = await verifyCustomDomain(id);
      if (res.verified) {
        setSuccess(`Domain '${res.customDomain}' verified and TLS certificate provisioned successfully!`);
      } else {
        setError(res.message || 'DNS verification failed. Please check that records have propagated.');
      }
      await loadDomains();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to remove this custom domain? Users will no longer be able to log in from this domain.')) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteCustomDomain(id);
      setDomains(domains.filter((d) => d.id !== id));
      setSuccess('Custom domain removed successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete custom domain');
    } finally {
      setDeletingId(null);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function getStatusBadge(status: string, sslStatus: string) {
    if (status === 'active' && sslStatus === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <Lock className="h-3 w-3" /> Active & Secured
        </span>
      );
    }
    if (status === 'provisioning_tls' || sslStatus === 'provisioning') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
          <Loader2 className="h-3 w-3 animate-spin" /> Provisioning TLS...
        </span>
      );
    }
    if (status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
          <CheckCircle2 className="h-3 w-3" /> DNS Verified
        </span>
      );
    }
    if (status === 'dns_failed' || status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800">
          <AlertTriangle className="h-3 w-3" /> DNS Check Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
        <RefreshCw className="h-3 w-3" /> Pending DNS Setup
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-accent-500" />
              <CardTitle>Custom Domains & Automated TLS (MODULES.md §01)</CardTitle>
            </div>
            <Button
              onClick={() => setAddModalOpen(true)}
              size="sm"
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Custom Domain
            </Button>
          </div>
          <p className="text-xs text-secondary mt-1">
            Connect your company's own custom domain (e.g. <code>hr.acmepayroll.com</code>). The platform verifies DNS records and automatically provisions Let's Encrypt TLS certificates.
          </p>
        </CardHeader>

        <CardBody className="space-y-4">
          {success && (
            <div className="p-3 rounded-lg bg-success-50 dark:bg-success-950/40 border border-success-200 dark:border-success-800 flex items-center gap-2 text-sm text-success-800 dark:text-success-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-950/40 border border-danger-200 dark:border-danger-800 flex items-center gap-2 text-sm text-danger-800 dark:text-danger-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 flex items-center justify-center text-muted gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading custom domains...</span>
            </div>
          ) : domains.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-base rounded-2xl p-6">
              <Globe className="h-10 w-10 text-muted mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-primary">No custom domain configured</h3>
              <p className="text-xs text-secondary max-w-md mx-auto mt-1 mb-4">
                You are currently using the default subdomain. Add a custom domain to enable full white-labeled branding and direct login access.
              </p>
              <Button onClick={() => setAddModalOpen(true)} size="sm">
                Add Custom Domain
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {domains.map((dom) => (
                <div
                  key={dom.id}
                  className="surface border border-base rounded-2xl p-5 space-y-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-accent-50 dark:bg-accent-950 flex items-center justify-center text-accent-600 dark:text-accent-400 font-bold">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-primary font-mono">{dom.domain}</h4>
                          {getStatusBadge(dom.status, dom.sslStatus)}
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          Registered: {new Date(dom.createdAt).toLocaleDateString()}
                          {dom.sslExpiresAt && (
                            <span className="ml-2 font-medium text-secondary">
                              • TLS Valid Until: {new Date(dom.sslExpiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerify(dom.id)}
                        disabled={verifyingId === dom.id}
                        className="flex items-center gap-1.5"
                      >
                        {verifyingId === dom.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Checking DNS...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Verify & Issue TLS</span>
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(dom.id)}
                        disabled={deletingId === dom.id}
                        className="text-danger-600 hover:text-danger-700 hover:bg-danger-50 dark:hover:bg-danger-950/40 p-2"
                        title="Remove custom domain"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {dom.errorMessage && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                      <strong>DNS Verification Notice:</strong> {dom.errorMessage}
                    </div>
                  )}

                  {/* Required DNS Records Table */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-muted uppercase tracking-wider">
                      Required DNS Records to Configure with your Domain Registrar
                    </div>

                    <div className="border border-base rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[rgb(var(--bg-muted))] text-muted border-b border-base font-semibold">
                            <th className="py-2.5 px-3 w-20">Type</th>
                            <th className="py-2.5 px-3">Host / Name</th>
                            <th className="py-2.5 px-3">Value / Target</th>
                            <th className="py-2.5 px-3 w-28">Status</th>
                            <th className="py-2.5 px-3 w-16 text-right">Copy</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-base">
                          {(dom.dnsRecords || []).map((rec, idx) => (
                            <tr key={idx} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-accent-600 dark:text-accent-400">
                                {rec.type}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-primary font-medium select-all">
                                {rec.name}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-secondary max-w-xs truncate select-all">
                                {rec.expectedValue}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    rec.status === 'configured'
                                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                      : rec.status === 'error'
                                      ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                  }`}
                                >
                                  {rec.status === 'configured'
                                    ? 'Valid'
                                    : rec.status === 'error'
                                    ? 'Mismatch'
                                    : 'Pending'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(rec.expectedValue, `${dom.id}-${idx}`)}
                                  className="text-secondary hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))]"
                                  title="Copy value"
                                >
                                  {copiedKey === `${dom.id}-${idx}` ? (
                                    <Check className="h-3.5 w-3.5 text-success-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Add Custom Domain Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Custom Domain"
      >
        <form onSubmit={handleAddDomain} className="space-y-4">
          <div>
            <Label htmlFor="customDomainInput">Custom Domain Name</Label>
            <Input
              id="customDomainInput"
              placeholder="e.g. hr.acmepayroll.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              required
              className="font-mono"
            />
            <p className="text-[11px] text-muted mt-1">
              Enter the fully qualified domain name (FQDN). Do not include <code>http://</code> or <code>https://</code>.
            </p>
          </div>

          <div className="surface border border-base rounded-xl p-3 text-xs text-secondary space-y-1.5 bg-slate-50 dark:bg-slate-900/40">
            <div className="font-semibold text-primary flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-accent-500" /> Automatic TLS Certificate
            </div>
            <p>
              Once you add this domain, DNS records will be generated. After you add them to your DNS provider (e.g. Cloudflare, Route53, GoDaddy), our automated verification job provisions an SSL/TLS certificate within seconds.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex items-center gap-1.5">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Adding Domain...</span>
                </>
              ) : (
                <span>Add Domain & Generate DNS</span>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
