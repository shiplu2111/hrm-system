import { redirect } from 'next/navigation';
import { localizePath, resolveWebsiteLocale } from '../../../i18n';

export default async function UpdatesRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  redirect(localizePath('/changelog', locale));
}
