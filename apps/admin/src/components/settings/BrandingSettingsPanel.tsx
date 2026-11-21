import { useState, useEffect } from 'react';
import {
  Palette,
  Image as ImageIcon,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Globe,
  Save,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Form';
import {
  getTenantBranding,
  updateTenantBranding,
} from '@/lib/branding-domains-api';
import type { TenantBrandingView } from '@hrm/shared-types';

export function BrandingSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState<TenantBrandingView | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const [secondaryColor, setSecondaryColor] = useState('#1E40AF');
  const [appTitle, setAppTitle] = useState('');
  const [emailSenderName, setEmailSenderName] = useState('');
  const [emailSenderAddress, setEmailSenderAddress] = useState('');

  useEffect(() => {
    loadBranding();
  }, []);

  async function loadBranding() {
    setLoading(true);
    try {
      const data = await getTenantBranding();
      setBranding(data);
      setLogoUrl(data.logoUrl || '');
      setFaviconUrl(data.faviconUrl || '');
      setPrimaryColor(data.primaryColor || '#2563EB');
      setSecondaryColor(data.secondaryColor || '#1E40AF');
      setAppTitle(data.appTitle || '');
      setEmailSenderName(data.emailSenderName || '');
      setEmailSenderAddress(data.emailSenderAddress || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load tenant branding');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      const updated = await updateTenantBranding({
        logoUrl: logoUrl.trim() || null,
        faviconUrl: faviconUrl.trim() || null,
        primaryColor: primaryColor.trim() || '#2563EB',
        secondaryColor: secondaryColor.trim() || '#1E40AF',
        appTitle: appTitle.trim() || undefined,
        emailSenderName: emailSenderName.trim() || undefined,
        emailSenderAddress: emailSenderAddress.trim() || undefined,
      });
      setBranding(updated);
      setSuccess('Branding, theme colors, and email sender settings updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update branding');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardBody className="py-12 flex items-center justify-center text-muted gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading branding configuration...</span>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-accent-500" />
              <CardTitle>Organization Branding & Theme (MODULES.md §01)</CardTitle>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-accent-100 dark:bg-accent-950 text-accent-700 dark:text-accent-300 font-semibold border border-accent-200 dark:border-accent-800">
              White-Labeling
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Customize your organization's logo, primary brand color, and outbound email sender identity across the portal.
          </p>
        </CardHeader>

        <CardBody>
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-success-50 dark:bg-success-950/40 border border-success-200 dark:border-success-800 flex items-center gap-2 text-sm text-success-800 dark:text-success-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger-50 dark:bg-danger-950/40 border border-danger-200 dark:border-danger-800 flex items-center gap-2 text-sm text-danger-800 dark:text-danger-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. Visual Assets: Logo & Favicon */}
            <div className="space-y-4">
              <div className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" /> Visual Identity & Assets
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="logoUrl">Organization Logo URL</Label>
                  <Input
                    id="logoUrl"
                    type="url"
                    placeholder="https://cdn.example.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Direct image link (PNG, SVG, or WebP). Displayed on navigation bar and login screens.
                  </p>
                </div>

                <div>
                  <Label htmlFor="faviconUrl">Favicon URL</Label>
                  <Input
                    id="faviconUrl"
                    type="url"
                    placeholder="https://cdn.example.com/favicon.ico"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Browser tab icon (32x32px .ico or .png).
                  </p>
                </div>
              </div>

              {/* Live Visual Preview */}
              {(logoUrl || faviconUrl) && (
                <div className="surface border border-base rounded-xl p-4 flex items-center gap-6 bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-xs font-semibold text-muted">Preview:</span>
                  {logoUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-secondary">Logo:</span>
                      <div className="h-10 px-3 py-1 bg-white dark:bg-slate-800 rounded-lg border border-base flex items-center justify-center">
                        <img
                          src={logoUrl}
                          alt="Logo Preview"
                          className="max-h-8 max-w-[120px] object-contain"
                          onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                        />
                      </div>
                    </div>
                  )}
                  {faviconUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-secondary">Favicon:</span>
                      <img
                        src={faviconUrl}
                        alt="Favicon"
                        className="h-6 w-6 object-contain rounded"
                        onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Brand Colors */}
            <div className="space-y-4 pt-4 border-t border-base">
              <div className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="h-4 w-4" /> Brand Theme Colors
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="primaryColorPicker"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-12 rounded cursor-pointer border border-base bg-transparent p-0.5"
                    />
                    <Input
                      id="primaryColor"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#2563EB"
                      className="font-mono text-sm uppercase"
                    />
                  </div>
                  <p className="text-[11px] text-muted mt-1">
                    Used for primary action buttons, active navigation states, and hero accents.
                  </p>
                </div>

                <div>
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="secondaryColorPicker"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-10 w-12 rounded cursor-pointer border border-base bg-transparent p-0.5"
                    />
                    <Input
                      id="secondaryColor"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#1E40AF"
                      className="font-mono text-sm uppercase"
                    />
                  </div>
                  <p className="text-[11px] text-muted mt-1">
                    Used for hovered states, secondary highlights, and badge accents.
                  </p>
                </div>
              </div>

              {/* Palette preview pill */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Preview Badge:</span>
                <span
                  style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
                  className="px-3 py-1 rounded-full text-xs font-semibold shadow-sm"
                >
                  Primary Action
                </span>
                <span
                  style={{ backgroundColor: secondaryColor, color: '#FFFFFF' }}
                  className="px-3 py-1 rounded-full text-xs font-semibold shadow-sm"
                >
                  Secondary Hover
                </span>
              </div>
            </div>

            {/* 3. Outbound Email Sender Identity */}
            <div className="space-y-4 pt-4 border-t border-base">
              <div className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> Email Sender Identity (White-Labeled)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emailSenderName">Email Sender Name</Label>
                  <Input
                    id="emailSenderName"
                    placeholder="e.g. Acme People Ops"
                    value={emailSenderName}
                    onChange={(e) => setEmailSenderName(e.target.value)}
                  />
                  <p className="text-[11px] text-muted mt-1">
                    The display name appearing in recipients' inboxes for payslips, offers, and notifications.
                  </p>
                </div>

                <div>
                  <Label htmlFor="emailSenderAddress">Email Sender Address</Label>
                  <Input
                    id="emailSenderAddress"
                    type="email"
                    placeholder="hr@acmepayroll.com"
                    value={emailSenderAddress}
                    onChange={(e) => setEmailSenderAddress(e.target.value)}
                  />
                  <p className="text-[11px] text-muted mt-1">
                    The "From" email address. Configure custom domain SPF/DKIM records to prevent spam filtering.
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="appTitle">Portal Display Title</Label>
                <Input
                  id="appTitle"
                  placeholder="e.g. Acme Corporation HR Portal"
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end">
              <Button type="submit" disabled={saving} className="flex items-center gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Branding...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Branding Configuration</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
