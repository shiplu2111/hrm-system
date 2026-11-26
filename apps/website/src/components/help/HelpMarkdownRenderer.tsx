import React, { Fragment, type ReactNode } from 'react';
import { AlertTriangle, Info, Lightbulb, ShieldAlert } from 'lucide-react';
import { OptimizedImage } from '../marketing/OptimizedImage';

type CalloutKind = 'note' | 'tip' | 'important' | 'warning' | 'caution';

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'steps'; items: string[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'callout'; tone: CalloutKind; title?: string; lines: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'image'; alt: string; src: string; caption?: string }
  | { kind: 'code'; text: string }
  | { kind: 'rule' };

const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const BULLET_RE = /^\s*[-*+]\s+(.*)$/;
const STEP_RE = /^\s*\d+[.)]\s+(.*)$/;
const RULE_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const IMAGE_LINE_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/;
const ALERT_PREFIX_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i;
const BOLD_CALLOUT_RE = /^\*\*(Note|Tip|Important|Warning|Caution):?\*\*\s*(.*)$/i;

export function isSafeMediaUrl(rawUrl: string): boolean {
  const url = rawUrl.trim();
  if (!url) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSafeLinkUrl(rawUrl: string): boolean {
  const url = rawUrl.trim();
  if (!url) return false;
  if (url.startsWith('#')) return true;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  if (url.toLowerCase().startsWith('mailto:')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ kind: 'code', text: codeLines.join('\n') });
      continue;
    }

    const imageMatch = IMAGE_LINE_RE.exec(line.trim());
    if (imageMatch && isSafeMediaUrl(imageMatch[2])) {
      blocks.push({
        kind: 'image',
        alt: imageMatch[1].trim() || 'Help article illustration',
        src: imageMatch[2].trim(),
        caption: imageMatch[3]?.trim() || undefined,
      });
      i += 1;
      continue;
    }

    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      blocks.push({
        kind: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3 | 4,
        text: headingMatch[2].trim(),
      });
      i += 1;
      continue;
    }

    if (RULE_RE.test(line)) {
      blocks.push({ kind: 'rule' });
      i += 1;
      continue;
    }

    if (STEP_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && STEP_RE.test(lines[i])) {
        items.push(STEP_RE.exec(lines[i])![1].trim());
        i += 1;
      }
      blocks.push({ kind: 'steps', items });
      continue;
    }

    if (BULLET_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        items.push(BULLET_RE.exec(lines[i])![1].trim());
        i += 1;
      }
      blocks.push({ kind: 'bullets', items });
      continue;
    }

    if (line.trimStart().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        quoteLines.push(lines[i].trimStart().replace(/^>\s?/, ''));
        i += 1;
      }
      const firstLine = quoteLines[0] ?? '';
      const alertMatch = ALERT_PREFIX_RE.exec(firstLine);
      if (alertMatch) {
        const tone = alertMatch[1].toLowerCase() as CalloutKind;
        const remainderFirst = alertMatch[2]?.trim();
        const bodyLines = [
          ...(remainderFirst ? [remainderFirst] : []),
          ...quoteLines.slice(1),
        ].filter(Boolean);
        blocks.push({
          kind: 'callout',
          tone,
          title: alertMatch[1].toUpperCase(),
          lines: bodyLines,
        });
        continue;
      }

      const boldCallout = BOLD_CALLOUT_RE.exec(firstLine);
      if (boldCallout) {
        const tone = boldCallout[1].toLowerCase() as CalloutKind;
        const remainderFirst = boldCallout[2]?.trim();
        const bodyLines = [
          ...(remainderFirst ? [remainderFirst] : []),
          ...quoteLines.slice(1),
        ].filter(Boolean);
        blocks.push({
          kind: 'callout',
          tone,
          title: boldCallout[1],
          lines: bodyLines,
        });
        continue;
      }

      blocks.push({ kind: 'quote', lines: quoteLines });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING_RE.test(lines[i]) &&
      !RULE_RE.test(lines[i]) &&
      !BULLET_RE.test(lines[i]) &&
      !STEP_RE.test(lines[i]) &&
      !IMAGE_LINE_RE.test(lines[i].trim()) &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].trimStart().startsWith('>')
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', lines: paraLines });
  }

  return blocks;
}

function renderInlines(text: string): ReactNode {
  const tokenRe = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const nodes: ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={keyIdx++}
          className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-primary))] font-mono text-[0.875em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={keyIdx++} className="font-semibold text-[rgb(var(--text-primary))]">
          {renderInlines(token.slice(2, -2))}
        </strong>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={keyIdx++} className="italic">
          {renderInlines(token.slice(1, -1))}
        </em>,
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch && isSafeLinkUrl(linkMatch[2])) {
        const href = linkMatch[2].trim();
        const isExternal = href.startsWith('http://') || href.startsWith('https://');
        nodes.push(
          <a
            key={keyIdx++}
            href={href}
            {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="font-semibold text-primary-600 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    lastIdx = match.index + token.length;
  }

  if (lastIdx < text.length) {
    nodes.push(text.slice(lastIdx));
  }

  return nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}

const CALLOUT_STYLES: Record<
  CalloutKind,
  { container: string; iconColor: string; label: string; Icon: typeof Info }
> = {
  note: {
    container: 'border-primary-200 bg-primary-50/70',
    iconColor: 'text-primary-600',
    label: 'Note',
    Icon: Info,
  },
  tip: {
    container: 'border-success-200 bg-success-50/70',
    iconColor: 'text-success-700',
    label: 'Tip',
    Icon: Lightbulb,
  },
  important: {
    container: 'border-primary-300 bg-primary-50',
    iconColor: 'text-primary-700',
    label: 'Important',
    Icon: Info,
  },
  warning: {
    container: 'border-warning-200 bg-warning-50/80',
    iconColor: 'text-warning-700',
    label: 'Warning',
    Icon: AlertTriangle,
  },
  caution: {
    container: 'border-error-200 bg-error-50/80',
    iconColor: 'text-error-700',
    label: 'Caution',
    Icon: ShieldAlert,
  },
};

export function HelpMarkdownRenderer({
  source,
  stepLabelPrefix = 'Step',
}: {
  source: string;
  stepLabelPrefix?: string;
}) {
  const blocks = parseBlocks(source);

  return (
    <div className="space-y-5 text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
      {blocks.map((block, idx) => {
        switch (block.kind) {
          case 'heading': {
            if (block.level <= 2) {
              return (
                <h2
                  key={idx}
                  className="text-xl sm:text-2xl font-bold text-[rgb(var(--text-primary))] pt-4 first:pt-0 tracking-tight"
                >
                  {renderInlines(block.text)}
                </h2>
              );
            }
            return (
              <h3
                key={idx}
                className="text-base sm:text-lg font-bold text-[rgb(var(--text-primary))] pt-2"
              >
                {renderInlines(block.text)}
              </h3>
            );
          }

          case 'paragraph':
            return (
              <p key={idx} className="leading-relaxed">
                {renderInlines(block.lines.join(' '))}
              </p>
            );

          case 'steps':
            return (
              <ol
                key={idx}
                data-testid="help-article-steps"
                className="space-y-3 my-4"
              >
                {block.items.map((item, sIdx) => (
                  <li
                    key={sIdx}
                    className="flex items-start gap-3.5 rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-4 shadow-2xs"
                  >
                    <span
                      aria-hidden="true"
                      className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                    >
                      {sIdx + 1}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <span className="sr-only">
                        {stepLabelPrefix} {sIdx + 1}:{' '}
                      </span>
                      <div className="text-sm sm:text-base text-[rgb(var(--text-primary))]">
                        {renderInlines(item)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            );

          case 'bullets':
            return (
              <ul key={idx} className="list-disc pl-6 space-y-1.5">
                {block.items.map((item, bIdx) => (
                  <li key={bIdx}>{renderInlines(item)}</li>
                ))}
              </ul>
            );

          case 'callout': {
            const style = CALLOUT_STYLES[block.tone];
            const Icon = style.Icon;
            return (
              <aside
                key={idx}
                data-testid={`help-callout-${block.tone}`}
                className={`rounded-xl border p-4 sm:p-5 flex items-start gap-3 ${style.container}`}
              >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconColor}`} aria-hidden="true" />
                <div className="space-y-1 min-w-0 text-sm text-[rgb(var(--text-primary))]">
                  <p className="font-bold">{block.title || style.label}</p>
                  <p className="text-[rgb(var(--text-secondary))] leading-relaxed">
                    {renderInlines(block.lines.join(' '))}
                  </p>
                </div>
              </aside>
            );
          }

          case 'quote':
            return (
              <blockquote
                key={idx}
                className="border-l-4 border-primary-300 pl-4 py-1 italic text-[rgb(var(--text-secondary))]"
              >
                {renderInlines(block.lines.join(' '))}
              </blockquote>
            );

          case 'image':
            return (
              <figure
                key={idx}
                data-testid="help-article-figure"
                className="my-5 overflow-hidden rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
              >
                <OptimizedImage
                  src={block.src}
                  alt={block.alt || 'Help Center diagram'}
                  width={1200}
                  height={675}
                  className="w-full h-auto block object-contain bg-slate-50"
                />
                {(block.caption || block.alt) && (
                  <figcaption className="px-4 py-2.5 text-xs text-[rgb(var(--text-muted))] border-t border-[rgb(var(--border-base))]">
                    {block.caption || block.alt}
                  </figcaption>
                )}
              </figure>
            );

          case 'code':
            return (
              <pre
                key={idx}
                className="rounded-xl border border-[rgb(var(--border-base))] bg-slate-900 text-slate-100 p-4 text-xs sm:text-sm font-mono overflow-x-auto"
              >
                <code>{block.text}</code>
              </pre>
            );

          case 'rule':
            return <hr key={idx} className="border-[rgb(var(--border-base))] my-6" />;
        }
      })}
    </div>
  );
}
