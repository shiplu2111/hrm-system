// apps/platform/src/components/support/GlobalKbMarkdown.tsx
import React, { Fragment, type ReactNode } from 'react';

/**
 * Renders safe Markdown subset: headings (H1-H3), paragraphs, lists,
 * blockquotes, code blocks, bold, italic, inline code, and links.
 * Built with pure React elements without raw innerHTML.
 */
export function GlobalKbMarkdown({
  source,
  className = '',
}: {
  source: string;
  className?: string;
}) {
  return (
    <div className={`space-y-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200 ${className}`}>
      {renderBlocks(source)}
    </div>
  );
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

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !RULE.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUMBERED.test(lines[i]) &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].trimStart().startsWith('>')
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', lines: para });
  }

  return blocks;
}

function renderInlines(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-bold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const closingBracket = token.indexOf('](');
      const label = token.slice(1, closingBracket);
      const url = token.slice(closingBracket + 2, -1);
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
        >
          {label}
        </a>,
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <Fragment>{parts}</Fragment>;
}

function renderBlocks(source: string): ReactNode {
  const blocks = parseBlocks(source);

  return blocks.map((block, idx) => {
    switch (block.kind) {
      case 'heading': {
        if (block.level === 1) {
          return (
            <h1 key={idx} className="text-xl font-extrabold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 mt-4 first:mt-0">
              {renderInlines(block.text)}
            </h1>
          );
        }
        if (block.level === 2) {
          return (
            <h2 key={idx} className="text-lg font-bold text-slate-900 dark:text-white mt-4 first:mt-0">
              {renderInlines(block.text)}
            </h2>
          );
        }
        return (
          <h3 key={idx} className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-3 first:mt-0">
            {renderInlines(block.text)}
          </h3>
        );
      }
      case 'paragraph':
        return (
          <p key={idx} className="leading-relaxed text-slate-700 dark:text-slate-300 text-sm">
            {renderInlines(block.lines.join(' '))}
          </p>
        );
      case 'list': {
        const Tag = block.ordered ? 'ol' : 'ul';
        return (
          <Tag
            key={idx}
            className={`space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300 ${
              block.ordered ? 'list-decimal' : 'list-disc'
            }`}
          >
            {block.items.map((item, itemIdx) => (
              <li key={itemIdx}>{renderInlines(item)}</li>
            ))}
          </Tag>
        );
      }
      case 'quote':
        return (
          <blockquote
            key={idx}
            className="border-l-4 border-indigo-500 pl-4 py-1 italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-r-lg"
          >
            {renderInlines(block.lines.join(' '))}
          </blockquote>
        );
      case 'code':
        return (
          <pre
            key={idx}
            className="overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100 border border-slate-800 shadow-inner"
          >
            <code>{block.text}</code>
          </pre>
        );
      case 'rule':
        return <hr key={idx} className="border-slate-200 dark:border-slate-800 my-4" />;
      default:
        return null;
    }
  });
}
