import guideMarkdown from '../../../guild.md?raw';
import guideMarkdownEn from '../../../guild.en.md?raw';
import { useMemo } from 'react';
import { useLanguage } from '../i18n';

const GITHUB_REPO_URL = 'https://github.com/NeoWeb3Nova/signature-airdrop';

const headingAnchor = (text: string) => text
  .toLowerCase()
  .replace(/[`*]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '');

export function DevelopmentGuide() {
  const { language, t } = useLanguage();
  const markdown = language === 'zh' ? guideMarkdown : guideMarkdownEn;
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown]);

  return (
    <section className="guide-page" aria-labelledby="guide-title">
      <div className="guide-hero">
        <span className="guide-kicker">{t('guideKicker')}</span>
        <h1 id="guide-title">{t('guideTitle')}</h1>
        <p>{t('guideDescription')}</p>
        <a className="guide-github-link" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
          {t('githubProjectLink')}
        </a>
      </div>
      <article className="guide-document">
        {blocks.map((block, index) => renderBlock(block, index))}
      </article>
    </section>
  );
}

type MarkdownBlock =
  | { type: 'heading'; depth: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.replace(/^```/, '').trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', language, code: codeLines.join('\n') });
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', depth: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') });
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(lines[index]);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (orderedMatch || unorderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        const itemMatch = ordered ? itemLine.match(/^\d+\.\s+(.+)$/) : itemLine.match(/^[-*]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1]);
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      const next = lines[index].trim();
      if (
        next.startsWith('```') ||
        next.startsWith('#') ||
        next.startsWith('>') ||
        next.startsWith('|') ||
        /^\d+\.\s+/.test(next) ||
        /^[-*]\s+/.test(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
  }

  return blocks;
}

function isTableStart(lines: string[], index: number) {
  return lines[index]?.trim().startsWith('|') && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1]?.trim() ?? '');
}

function splitTableRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderBlock(block: MarkdownBlock, index: number) {
  switch (block.type) {
    case 'heading': {
      const anchor = headingAnchor(block.text) || `section-${index}`;
      if (block.depth === 1) return <h2 key={index} id={anchor}>{renderInline(block.text)}</h2>;
      if (block.depth === 2) return <h3 key={index} id={anchor}>{renderInline(block.text)}</h3>;
      if (block.depth === 3) return <h4 key={index} id={anchor}>{renderInline(block.text)}</h4>;
      return <h5 key={index} id={anchor}>{renderInline(block.text)}</h5>;
    }
    case 'paragraph':
      return <p key={index}>{renderInline(block.text)}</p>;
    case 'quote':
      return <blockquote key={index}>{renderInline(block.text)}</blockquote>;
    case 'code':
      return (
        <pre key={index} className="guide-code">
          {block.language && <span className="guide-code-language">{block.language}</span>}
          <code>{block.code}</code>
        </pre>
      );
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag key={index}>
          {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ListTag>
      );
    }
    case 'table':
      return (
        <div className="guide-table-wrap" key={index}>
          <table>
            <thead>
              <tr>{block.headers.map((header, headerIndex) => <th key={headerIndex}>{renderInline(header)}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInline(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function renderInline(text: string) {
  const segments = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    if (segment.startsWith('`') && segment.endsWith('`')) {
      return <code key={index}>{segment.slice(1, -1)}</code>;
    }

    if (segment.startsWith('**') && segment.endsWith('**')) {
      return <strong key={index}>{segment.slice(2, -2)}</strong>;
    }

    return <span key={index}>{segment}</span>;
  });
}
