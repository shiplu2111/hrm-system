export interface RssFeedItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  category?: string;
  description: string;
}

export interface RssFeedChannelOptions {
  title: string;
  link: string;
  feedUrl: string;
  description: string;
  language?: string;
  items: readonly RssFeedItem[];
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildRssFeedXml(channel: RssFeedChannelOptions): string {
  const itemsXml = channel.items
    .map((item) => {
      const parsedDate = new Date(item.pubDate);
      const rfcDate = Number.isNaN(parsedDate.getTime())
        ? new Date().toUTCString()
        : parsedDate.toUTCString();

      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>`,
        `      <pubDate>${escapeXml(rfcDate)}</pubDate>`,
        item.category ? `      <category>${escapeXml(item.category)}</category>` : null,
        `      <description>${escapeXml(item.description)}</description>`,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${escapeXml(channel.language ?? 'en')}</language>`,
    `    <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml" />`,
    itemsXml,
    '  </channel>',
    '</rss>',
  ]
    .filter(Boolean)
    .join('\n');
}
