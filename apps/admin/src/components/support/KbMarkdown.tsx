import { Fragment, type ReactNode } from 'react';

/**
 * Renders the Markdown subset used by knowledge base articles: headings, paragraphs,
 * bullet and numbered lists, quotes, code blocks, rules, bold, italic, inline code and links.
 * Output is built from React elements only, so article text can never inject HTML.
 */
export function KbMarkdown({ source, className = '' }: { source: string; className?: string }) {
  return <div className={`space-y-3 text-sm leading-relaxed text-primary ${className}`}>{renderBlocks(source)}</div>;
}

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'code'; text: string }
  | { kind: 'rule' };

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

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
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
      });
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' });
      i += 1;
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = !BULLET.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(pattern.exec(lines[i])![1]);
        i += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    if (line.trimStart().startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        quote.push(lines[i].trimStart().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ kind: 'quote', lines: quote });
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUMBERED.test(lines[i]) &&
      !RULE.test(lines[i]) &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].trimStart().startsWith('>')
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', lines: paragraph });
  }

  return blocks;
}

function renderBlocks(source: string): ReactNode[] {
  return parseBlocks(source).map((block, index) => {
    switch (block.kind) {
      case 'heading': {
        const classes = {
          1: 'text-lg font-semibold',
          2: 'text-base font-semibold',
          3: 'text-sm font-semibold',
        }[block.level];
        const Tag = (`h${block.level + 1}` as 'h2' | 'h3' | 'h4');
        return (
          <Tag key={index} className={`${classes} text-primary pt-1`}>
            {renderInline(block.text)}
          </Tag>
        );
      }
      case 'paragraph':
        return <p key={index}>{withLineBreaks(block.lines)}</p>;
      case 'list': {
        const Tag = block.ordered ? 'ol' : 'ul';
        return (
          <Tag
            key={index}
            className={`space-y-1 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-muted`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ))}
          </Tag>
        );
      }
      case 'quote':
        return (
          <blockquote
            key={index}
            className="border-l-2 border-accent-300 pl-3 text-secondary dark:border-accent-700"
          >
            {withLineBreaks(block.lines)}
          </blockquote>
        );
      case 'code':
        return (
          <pre
            key={index}
            className="overflow-x-auto rounded-lg bg-slate-950 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-100"
          >
            <code>{block.text}</code>
          </pre>
        );
      case 'rule':
        return <hr key={index} className="border-base" />;
    }
  });
}

function withLineBreaks(lines: string[]): ReactNode[] {
  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 ? <br /> : null}
      {renderInline(line)}
    </Fragment>
  ));
}

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const token = match[0];

    if (match[1]) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-[rgb(var(--bg-muted))] px-1 py-0.5 font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      nodes.push(
        <strong key={key++} className="font-semibold">
          {renderInline(token.slice(2, -2))}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(<em key={key++}>{renderInline(token.slice(1, -1))}</em>);
    } else if (match[4]) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token) ?? [];
      const safe = safeHref(href ?? '');
      nodes.push(
        safe ? (
          <a
            key={key++}
            href={safe}
            target={safe.startsWith('/') ? undefined : '_blank'}
            rel="noopener noreferrer"
            className="font-medium text-accent-600 underline underline-offset-2 hover:text-accent-700 dark:text-accent-400"
          >
            {label}
          </a>
        ) : (
          token
        ),
      );
    }
    last = start + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function safeHref(href: string): string | null {
  if (/^(https?:|mailto:)/i.test(href)) return href;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  return null;
}