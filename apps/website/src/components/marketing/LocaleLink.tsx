'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { localizePath } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';

export type LocaleLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
};

export function LocaleLink({ href, children, ...props }: LocaleLinkProps) {
  const { locale } = useWebsiteI18n();
  return (
    <Link href={localizePath(href, locale)} {...props}>
      {children}
    </Link>
  );
}
