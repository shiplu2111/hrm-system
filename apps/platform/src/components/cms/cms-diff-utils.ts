import type { CmsBlockNode, CmsPageVersionDto } from '@hrm/shared-types';
import type { SystemPageLocaleDraft } from './system-page-editor-utils';

export interface DiffToken {
  type: 'same' | 'removed' | 'added';
  text: string;
}

export interface VersionDiffRow {
  key: string;
  label: string;
  changed: boolean;
  leftText: string;
  rightText: string;
  leftTokens: DiffToken[];
  rightTokens: DiffToken[];
}

export function stripHtmlToDiffText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\/(?:p|h[1-6]|li|tr|blockquote|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, '[Image: $1]')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function serializeBlockForDiff(block: CmsBlockNode): string {
  switch (block.type) {
    case 'heading':
      return [
        `H${block.props.level}: ${block.props.text}`,
        block.props.subtitle ? `Subtitle: ${block.props.subtitle}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    case 'rich_text':
      return stripHtmlToDiffText(block.props.html);
    case 'image':
      return `Media: ${block.props.mediaId || 'none'}\nAlt: ${block.props.alt}${
        block.props.caption ? `\nCaption: ${block.props.caption}` : ''
      }`;
    case 'button':
      return `[${block.props.label}] -> ${block.props.href}`;
    case 'feature_cards':
      return [
        block.props.heading ? `Heading: ${block.props.heading}` : '',
        block.props.subtitle ? `Subtitle: ${block.props.subtitle}` : '',
        ...block.props.cards.map(
          (c, i) => `Card ${i + 1}: ${c.title} — ${c.description}`,
        ),
      ]
        .filter(Boolean)
        .join('\n');
    case 'faq_list':
      return [
        block.props.heading ? `Heading: ${block.props.heading}` : '',
        `Limit: ${block.props.limit ?? 10}`,
        block.props.faqIds?.length ? `FAQs: ${block.props.faqIds.join(', ')}` : 'FAQs: dynamic',
      ]
        .filter(Boolean)
        .join('\n');
    case 'cta_band':
      return [
        block.props.title,
        block.props.description || '',
        `Primary: [${block.props.primaryButton.label}] -> ${block.props.primaryButton.href}`,
        block.props.secondaryButton
          ? `Secondary: [${block.props.secondaryButton.label}] -> ${block.props.secondaryButton.href}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    case 'video_embed':
      return `${block.props.provider}: ${block.props.title} (${block.props.url})`;
    case 'columns':
      return block.props.columns
        .map(
          (col, idx) =>
            `Column ${idx + 1}:\n${col.blocks.map((b) => serializeBlockForDiff(b)).join('\n')}`,
        )
        .join('\n---\n');
    case 'divider':
      return block.props.label ? `--- ${block.props.label} ---` : '--- Divider ---';
    case 'dynamic_block':
      return [
        `Locked Widget: ${block.props.widget}`,
        block.props.heading ? `Heading: ${block.props.heading}` : '',
        block.props.subtitle ? `Subtitle: ${block.props.subtitle}` : '',
      ]
        .filter(Boolean)
        .join('\n');
  }
}

/**
 * Word-level LCS diff returning aligned token streams for Left (removed) and Right (added).
 */
export function computeWordDiff(
  leftText: string,
  rightText: string,
): { leftTokens: DiffToken[]; rightTokens: DiffToken[] } {
  if (leftText === rightText) {
    const token: DiffToken[] = leftText ? [{ type: 'same', text: leftText }] : [];
    return { leftTokens: token, rightTokens: token };
  }

  const tokenize = (input: string) => input.match(/\S+|\s+/g) ?? [];
  const a = tokenize(leftText);
  const b = tokenize(rightText);

  // Guard huge inputs from O(N*M) blowup
  if (a.length * b.length > 90_000) {
    return {
      leftTokens: leftText ? [{ type: 'removed', text: leftText }] : [],
      rightTokens: rightText ? [{ type: 'added', text: rightText }] : [],
    };
  }

  const m = a.length;
  const n = b.length;
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const leftTokens: DiffToken[] = [];
  const rightTokens: DiffToken[] = [];
  let i = 0;
  let j = 0;

  const pushMerged = (arr: DiffToken[], type: DiffToken['type'], text: string) => {
    const last = arr[arr.length - 1];
    if (last && last.type === type) {
      last.text += text;
    } else {
      arr.push({ type, text });
    }
  };

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      pushMerged(leftTokens, 'same', a[i]);
      pushMerged(rightTokens, 'same', b[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushMerged(leftTokens, 'removed', a[i]);
      i++;
    } else {
      pushMerged(rightTokens, 'added', b[j]);
      j++;
    }
  }
  while (i < m) {
    pushMerged(leftTokens, 'removed', a[i++]);
  }
  while (j < n) {
    pushMerged(rightTokens, 'added', b[j++]);
  }

  return { leftTokens, rightTokens };
}

function buildDiffRow(
  key: string,
  label: string,
  leftVal?: string | null,
  rightVal?: string | null,
): VersionDiffRow {
  const leftText = leftVal ?? '';
  const rightText = rightVal ?? '';
  const { leftTokens, rightTokens } = computeWordDiff(leftText, rightText);
  return {
    key,
    label,
    changed: leftText !== rightText,
    leftText,
    rightText,
    leftTokens,
    rightTokens,
  };
}

export function buildVersionSideBySideDiff(
  leftVer: CmsPageVersionDto,
  rightVer: CmsPageVersionDto,
): { rows: VersionDiffRow[]; changedCount: number } {
  const rows: VersionDiffRow[] = [
    buildDiffRow('title', 'Page Title', leftVer.title, rightVer.title),
    buildDiffRow('seoTitle', 'SEO Title', leftVer.seoTitle, rightVer.seoTitle),
    buildDiffRow('seoDescription', 'SEO Description', leftVer.seoDescription, rightVer.seoDescription),
    buildDiffRow('ogImageUrl', 'Social Image', leftVer.ogImageUrl, rightVer.ogImageUrl),
  ];

  const leftBlocks = Array.isArray(leftVer.blocks) ? leftVer.blocks : [];
  const rightBlocks = Array.isArray(rightVer.blocks) ? rightVer.blocks : [];
  const rightById = new Map(rightBlocks.map((b) => [b.id, b]));
  const seenRightIds = new Set<string>();

  for (const lb of leftBlocks) {
    const rb = rightById.get(lb.id);
    if (rb) {
      seenRightIds.add(rb.id);
    }
    rows.push(
      buildDiffRow(
        `block-${lb.id}`,
        `Block: ${lb.type.replace(/_/g, ' ')} (${lb.id})`,
        serializeBlockForDiff(lb),
        rb ? serializeBlockForDiff(rb) : '[Removed in target version]',
      ),
    );
  }

  for (const rb of rightBlocks) {
    if (!seenRightIds.has(rb.id)) {
      rows.push(
        buildDiffRow(
          `block-${rb.id}`,
          `Block: ${rb.type.replace(/_/g, ' ')} (${rb.id})`,
          '[Not present in base version]',
          serializeBlockForDiff(rb),
        ),
      );
    }
  }

  return {
    rows,
    changedCount: rows.filter((r) => r.changed).length,
  };
}

/**
 * Three-way draft merge helper when two editors save concurrent revisions on the same page/locale.
 * - Unmodified local fields adopt server's latest changes.
 * - Modified local fields where server didn't touch stay cleanly with local.
 * - Dual-edited fields are flagged in `conflictedFields` and take local edits so author work isn't lost,
 *   while preserving any new blocks added on the server.
 */
export function mergeDraftWithServerVersion(params: {
  localDraft: SystemPageLocaleDraft;
  baseDraft: SystemPageLocaleDraft | null;
  serverVersion: CmsPageVersionDto;
}): { mergedDraft: SystemPageLocaleDraft; conflictedFields: string[] } {
  const { localDraft, baseDraft, serverVersion } = params;
  const conflictedFields: string[] = [];

  const mergeString = (
    fieldLabel: string,
    localVal: string,
    baseVal: string | undefined,
    serverVal: string | null | undefined,
  ): string => {
    const srv = serverVal ?? '';
    const bas = baseVal ?? '';
    const localChanged = localVal !== bas;
    const serverChanged = srv !== bas;
    if (!localChanged && serverChanged) return srv;
    if (localChanged && serverChanged && localVal !== srv) {
      conflictedFields.push(fieldLabel);
      return localVal;
    }
    return localVal;
  };

  const baseBlocks = baseDraft?.blocks ?? [];
  const baseById = new Map(baseBlocks.map((b) => [b.id, JSON.stringify(b)]));
  const serverBlocks = Array.isArray(serverVersion.blocks) ? serverVersion.blocks : [];
  const serverById = new Map(serverBlocks.map((b) => [b.id, b]));
  const mergedBlocks: CmsBlockNode[] = [];
  const seenServerIds = new Set<string>();

  for (const lb of localDraft.blocks) {
    const sb = serverById.get(lb.id);
    if (sb) seenServerIds.add(sb.id);
    const localJson = JSON.stringify(lb);
    const baseJson = baseById.get(lb.id);
    const serverJson = sb ? JSON.stringify(sb) : undefined;

    if (sb && baseJson && localJson === baseJson && serverJson !== baseJson) {
      mergedBlocks.push(JSON.parse(serverJson!) as CmsBlockNode);
    } else if (sb && baseJson && localJson !== baseJson && serverJson !== baseJson && localJson !== serverJson) {
      conflictedFields.push(`Block ${lb.id}`);
      mergedBlocks.push(lb);
    } else {
      mergedBlocks.push(lb);
    }
  }

  for (const sb of serverBlocks) {
    if (!seenServerIds.has(sb.id) && !baseById.has(sb.id)) {
      mergedBlocks.push(JSON.parse(JSON.stringify(sb)) as CmsBlockNode);
    }
  }

  return {
    mergedDraft: {
      ...localDraft,
      title: mergeString('Page Title', localDraft.title, baseDraft?.title, serverVersion.title),
      seoTitle: mergeString(
        'SEO Title',
        localDraft.seoTitle,
        baseDraft?.seoTitle,
        serverVersion.seoTitle,
      ),
      seoDescription: mergeString(
        'SEO Description',
        localDraft.seoDescription,
        baseDraft?.seoDescription,
        serverVersion.seoDescription,
      ),
      ogImageUrl: mergeString(
        'Social Image',
        localDraft.ogImageUrl,
        baseDraft?.ogImageUrl,
        serverVersion.ogImageUrl,
      ),
      blocks: mergedBlocks,
      sourceVersionNumber: serverVersion.versionNumber,
      changeNote: `Merged with v${serverVersion.versionNumber}`,
    },
    conflictedFields,
  };
}
