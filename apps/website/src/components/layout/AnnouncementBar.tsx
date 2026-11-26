'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CmsSiteSettingsBundleDto } from '@hrm/shared-types';
import { ArrowRight, X } from 'lucide-react';
import { localizePath } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';

export function AnnouncementBar({
  config,
}: {
  config?: CmsSiteSettingsBundleDto['announcementBar'];
}) {
  const { locale } = useWebsiteI18n();
  const [dismissed, setDismissed] = useState(false);
  const [withinWindow, setWithinWindow] = useState(false);

  const text = locale === 'bn' ? config?.text.bn || config?.text.en : config?.text.en;
  const linkLabel =
    locale === 'bn' ? config?.linkLabel.bn || config?.linkLabel.en : config?.linkLabel.en;
  const storageKey = text ? `cmsn_ann_dismissed:${text.slice(0, 48)}` : '';

  useEffect(() => {
    if (!config?.enabled || !text) {
      setWithinWindow(false);
      return;
    }
    const now = Date.now();
    const startOk = !config.startsAt || now >= new Date(config.startsAt).getTime();
    const endOk = !config.endsAt || now <= new Date(config.endsAt).getTime();
    setWithinWindow(startOk && endOk);

    if (config.dismissible && storageKey) {
      try {
        setDismissed(window.localStorage.getItem(storageKey) === '1');
      } catch {
        setDismissed(false);
      }
    }
  }, [config, text, storageKey]);

  if (!config?.enabled || !withinWindow || dismissed || !text) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, '1');
      } catch {
        // ignore storage restrictions
      }
    }
  };

  const isExternal = Boolean(config.linkUrl && /^https?:\/\//i.test(config.linkUrl));

  return (
    <div
      data-testid="site-announcement-bar"
      className="bg-[#0c2239] text-white text-xs py-2 px-4 relative flex items-center justify-center gap-3 border-b border-white/10"
    >
      <p className="font-medium text-center">
        {text}{' '}
        {config.linkUrl && linkLabel ? (
          isExternal ? (
            <a
              href={config.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline font-semibold text-sky-200 hover:text-white ml-1"
            >
              {linkLabel}
              <ArrowRight className="w-3 h-3" />
            </a>
          ) : (
            <Link
              href={localizePath(config.linkUrl, locale)}
              className="inline-flex items-center gap-1 underline font-semibold text-sky-200 hover:text-white ml-1"
            >
              {linkLabel}
              <ArrowRight className="w-3 h-3" />
            </Link>
          )
        ) : null}
      </p>

      {config.dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          className="p-1 rounded hover:bg-white/10 text-white/80 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
