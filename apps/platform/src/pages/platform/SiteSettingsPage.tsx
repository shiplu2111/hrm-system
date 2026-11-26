import { useCallback, useEffect, useState } from 'react';
import type { CmsLocale, CmsSiteSettingsBundleDto } from '@hrm/shared-types';
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Cookie,
  Globe2,
  Image as ImageIcon,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  Share2,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermission';
import {
  getCmsSiteSettingsBundle,
  updateCmsSiteSettingsBundle,
} from '@/lib/platform-cms-api';
import { MediaLibraryPickerModal } from '@/components/cms/MediaLibraryPickerModal';

function toLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SiteSettingsPage() {
  const { can, roleName } = usePermissions();
  const canViewCms = can('cms', 'view');
  const canManageCms = can('cms', 'manage');

  const [bundle, setBundle] = useState<CmsSiteSettingsBundleDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!canViewCms) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getCmsSiteSettingsBundle();
      setBundle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CMS site settings.');
    } finally {
      setLoading(false);
    }
  }, [canViewCms]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundle || !canManageCms) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateCmsSiteSettingsBundle(bundle);
      setBundle(updated);
      setNotice('Saved website Site Settings and published updates to /public/content/settings.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save site settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!canViewCms) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center p-8 rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm max-w-xl mx-auto my-8">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold mb-2">Site Settings Restricted</h1>
        <p className="text-sm text-[rgb(var(--text-secondary))]">
          Your role ({roleName || 'Operator'}) lacks <code>cms:view</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary-600 dark:text-primary-300 uppercase tracking-wider mb-1">
            <Wrench className="h-3.5 w-3.5" />
            Website CMS · Global Configuration
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
            Site Settings
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
            Configure contact details, sales &amp; support emails, social links, scheduled announcement bar, footer &amp; cookie wording, default OG image, and default language.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSettings()}
          disabled={loading}
          className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!canManageCms && (
        <div className="px-4 py-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Read-only preview: Content Publisher or Platform Admin permission (<code>cms:manage</code>) is required to save Site Settings.</span>
        </div>
      )}

      {notice && (
        <div className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {loading || !bundle ? (
        <div className="h-56 rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] flex items-center justify-center text-xs text-[rgb(var(--text-muted))] gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading site settings...
        </div>
      ) : (
        <form onSubmit={handleSaveAll} className="space-y-6 text-xs">
          {/* 1. Company Contact Details & Emails */}
          <section className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary-600" />
              Company Contact Details &amp; Public Emails
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-medium mb-1">Company Name (EN)</label>
                <input
                  type="text"
                  value={bundle.contact.companyName.en}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      contact: {
                        ...bundle.contact,
                        companyName: { ...bundle.contact.companyName, en: e.target.value },
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Company Name (বাংলা)</label>
                <input
                  type="text"
                  lang="bn"
                  value={bundle.contact.companyName.bn}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      contact: {
                        ...bundle.contact,
                        companyName: { ...bundle.contact.companyName, bn: e.target.value },
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Office Address (EN)</label>
                <input
                  type="text"
                  value={bundle.contact.address.en}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      contact: {
                        ...bundle.contact,
                        address: { ...bundle.contact.address, en: e.target.value },
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Office Address (বাংলা)</label>
                <input
                  type="text"
                  lang="bn"
                  value={bundle.contact.address.bn}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      contact: {
                        ...bundle.contact,
                        address: { ...bundle.contact.address, bn: e.target.value },
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  value={bundle.contact.phone}
                  onChange={(e) =>
                    setBundle({ ...bundle, contact: { ...bundle.contact, phone: e.target.value } })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Sales Email (shown on site)</label>
                <input
                  type="email"
                  value={bundle.contact.salesEmail}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      contact: { ...bundle.contact, salesEmail: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Support Email (shown on site)</label>
                <input
                  type="email"
                  value={bundle.contact.supportEmail}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      contact: { ...bundle.contact, supportEmail: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
            </div>
          </section>

          {/* 2. Social Links */}
          <section className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary-600" />
              Social Media Links
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {(['linkedin', 'x', 'facebook', 'youtube', 'github'] as const).map((net) => (
                <div key={net}>
                  <label className="block font-medium mb-1 capitalize">{net} URL</label>
                  <input
                    type="text"
                    value={bundle.socialLinks[net] ?? ''}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        socialLinks: { ...bundle.socialLinks, [net]: e.target.value },
                      })
                    }
                    placeholder={`https://${net}.com/...`}
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] font-mono text-[11px]"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 3. Top Announcement Bar */}
          <section className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <BellRing className="h-4 w-4 text-primary-600" />
                Top Announcement Bar
              </h2>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bundle.announcementBar.enabled}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        announcementBar: { ...bundle.announcementBar, enabled: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded"
                  />
                  Enable Announcement Bar
                </label>
                <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bundle.announcementBar.dismissible}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        announcementBar: {
                          ...bundle.announcementBar,
                          dismissible: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded"
                  />
                  Dismissible by visitors
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-medium mb-1">Announcement Text (EN)</label>
                <input
                  type="text"
                  value={bundle.announcementBar.text.en}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      announcementBar: {
                        ...bundle.announcementBar,
                        text: { ...bundle.announcementBar.text, en: e.target.value },
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Announcement Text (বাংলা)</label>
                <input
                  type="text"
                  lang="bn"
                  value={bundle.announcementBar.text.bn}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      announcementBar: {
                        ...bundle.announcementBar,
                        text: { ...bundle.announcementBar.text, bn: e.target.value },
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Link Label (EN)</label>
                <input
                  type="text"
                  value={bundle.announcementBar.linkLabel.en}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      announcementBar: {
                        ...bundle.announcementBar,
                        linkLabel: { ...bundle.announcementBar.linkLabel, en: e.target.value },
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Link Label (বাংলা)</label>
                <input
                  type="text"
                  lang="bn"
                  value={bundle.announcementBar.linkLabel.bn}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      announcementBar: {
                        ...bundle.announcementBar,
                        linkLabel: { ...bundle.announcementBar.linkLabel, bn: e.target.value },
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-medium mb-1">Link URL</label>
                <input
                  type="text"
                  value={bundle.announcementBar.linkUrl}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      announcementBar: { ...bundle.announcementBar, linkUrl: e.target.value },
                    })
                  }
                  placeholder="/changelog or https://..."
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Start Time (optional)</label>
                <input
                  type="datetime-local"
                  value={toLocalDateTimeInput(bundle.announcementBar.startsAt)}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      announcementBar: {
                        ...bundle.announcementBar,
                        startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">End Time (optional)</label>
                <input
                  type="datetime-local"
                  value={toLocalDateTimeInput(bundle.announcementBar.endsAt)}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      announcementBar: {
                        ...bundle.announcementBar,
                        endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
            </div>
          </section>

          {/* 4. Footer Copy & Cookie Banner Wording */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-5 shadow-sm space-y-3.5">
              <h2 className="text-sm font-semibold">Footer Text (Per Locale)</h2>
              <div>
                <label className="block font-medium mb-1">Footer Brand Tagline (EN)</label>
                <textarea
                  rows={2}
                  value={bundle.footer.tagline.en}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      footer: {
                        ...bundle.footer,
                        tagline: { ...bundle.footer.tagline, en: e.target.value },
                      },
                    })
                  }
                  className="w-full p-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Footer Brand Tagline (বাংলা)</label>
                <textarea
                  rows={2}
                  lang="bn"
                  value={bundle.footer.tagline.bn}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      footer: {
                        ...bundle.footer,
                        tagline: { ...bundle.footer.tagline, bn: e.target.value },
                      },
                    })
                  }
                  className="w-full p-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Copyright Suffix (EN)</label>
                  <input
                    type="text"
                    value={bundle.footer.copyrightText.en}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        footer: {
                          ...bundle.footer,
                          copyrightText: { ...bundle.footer.copyrightText, en: e.target.value },
                        },
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Copyright Suffix (বাংলা)</label>
                  <input
                    type="text"
                    lang="bn"
                    value={bundle.footer.copyrightText.bn}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        footer: {
                          ...bundle.footer,
                          copyrightText: { ...bundle.footer.copyrightText, bn: e.target.value },
                        },
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                  />
                </div>
              </div>
            </section>

            {/* Cookie Banner Wording Only */}
            <section className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Cookie className="h-4 w-4 text-primary-600" />
                  Cookie Banner Wording
                </h2>
                <span className="px-2 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-[10px] font-medium">
                  Wording only · Consent logic locked in code
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Banner Title (EN)</label>
                  <input
                    type="text"
                    value={bundle.cookieBanner.title.en}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        cookieBanner: {
                          ...bundle.cookieBanner,
                          title: { ...bundle.cookieBanner.title, en: e.target.value },
                        },
                      })
                    }
                    className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Banner Title (বাংলা)</label>
                  <input
                    type="text"
                    lang="bn"
                    value={bundle.cookieBanner.title.bn}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        cookieBanner: {
                          ...bundle.cookieBanner,
                          title: { ...bundle.cookieBanner.title, bn: e.target.value },
                        },
                      })
                    }
                    className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Banner Message (EN)</label>
                  <textarea
                    rows={2}
                    value={bundle.cookieBanner.body.en}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        cookieBanner: {
                          ...bundle.cookieBanner,
                          body: { ...bundle.cookieBanner.body, en: e.target.value },
                        },
                      })
                    }
                    className="w-full p-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Banner Message (বাংলা)</label>
                  <textarea
                    rows={2}
                    lang="bn"
                    value={bundle.cookieBanner.body.bn}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        cookieBanner: {
                          ...bundle.cookieBanner,
                          body: { ...bundle.cookieBanner.body, bn: e.target.value },
                        },
                      })
                    }
                    className="w-full p-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium mb-1">Accept Label (EN)</label>
                  <input
                    type="text"
                    value={bundle.cookieBanner.acceptAllLabel.en}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        cookieBanner: {
                          ...bundle.cookieBanner,
                          acceptAllLabel: {
                            ...bundle.cookieBanner.acceptAllLabel,
                            en: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full h-8 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">Decline Label (EN)</label>
                  <input
                    type="text"
                    value={bundle.cookieBanner.declineAllLabel.en}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        cookieBanner: {
                          ...bundle.cookieBanner,
                          declineAllLabel: {
                            ...bundle.cookieBanner.declineAllLabel,
                            en: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full h-8 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">Policy Link (EN)</label>
                  <input
                    type="text"
                    value={bundle.cookieBanner.policyLinkText.en}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        cookieBanner: {
                          ...bundle.cookieBanner,
                          policyLinkText: {
                            ...bundle.cookieBanner.policyLinkText,
                            en: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full h-8 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* 5. Default SEO Image & Default Language */}
          <section className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-primary-600" />
              Default SEO Social Image &amp; Default Language
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-1">Default SEO Social Image (OG Image)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bundle.seo.defaultOgImageUrl}
                    onChange={(e) =>
                      setBundle({
                        ...bundle,
                        seo: { ...bundle.seo, defaultOgImageUrl: e.target.value },
                      })
                    }
                    placeholder="/api/v1/public/content/media/.../file"
                    className="flex-1 h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => setMediaOpen(true)}
                    className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] font-medium inline-flex items-center gap-1.5 shrink-0"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Media Library
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Default Public Website Language</label>
                <select
                  value={bundle.locale.defaultLanguage}
                  onChange={(e) =>
                    setBundle({
                      ...bundle,
                      locale: {
                        ...bundle.locale,
                        defaultLanguage: e.target.value as CmsLocale,
                      },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
                >
                  <option value="en">English (en)</option>
                  <option value="bn">Bengali (বাংলা · bn)</option>
                </select>
              </div>
            </div>
          </section>

          {canManageCms && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Site Settings
              </button>
            </div>
          )}
        </form>
      )}

      <MediaLibraryPickerModal
        isOpen={mediaOpen}
        locale="en"
        defaultFolder="seo"
        onClose={() => setMediaOpen(false)}
        onSelect={(selection) => {
          setBundle((prev) =>
            prev
              ? { ...prev, seo: { ...prev.seo, defaultOgImageUrl: selection.src } }
              : prev,
          );
          setMediaOpen(false);
        }}
      />
    </div>
  );
}
