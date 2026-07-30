/**
 * Minimal Atlassian Document Format (ADF) → plain text converter.
 *
 * Jira Cloud REST API v3 returns descriptions and comments as ADF (a JSON
 * document tree), not plain text — Atlassian does not publish an official
 * converter, so this walks the documented node/mark types we actually need
 * for AI context: paragraphs, headings, lists, code blocks, blockquotes,
 * links, and basic text marks. Unrecognized node types are skipped rather
 * than thrown on, since ADF has many node kinds (tables, panels, emoji,
 * mentions, media) that don't meaningfully translate to plain text context.
 */

type AdfMark = { type: string; attrs?: Record<string, unknown> };
type AdfNode = {
  type: string;
  text?: string;
  marks?: AdfMark[];
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
};

function applyMarks(text: string, marks: AdfMark[] | undefined): string {
  if (!marks?.length) return text;
  let result = text;
  for (const mark of marks) {
    if (mark.type === 'link' && typeof mark.attrs?.href === 'string') {
      result = `${result} (${mark.attrs.href})`;
    }
    if (mark.type === 'code') result = `\`${result}\``;
  }
  return result;
}

function renderInline(nodes: AdfNode[] | undefined): string {
  if (!nodes?.length) return '';
  return nodes
    .map((node) => {
      if (node.type === 'text') return applyMarks(node.text ?? '', node.marks);
      if (node.type === 'hardBreak') return '\n';
      if (node.type === 'mention') return `@${(node.attrs?.text as string) ?? 'mention'}`;
      if (node.type === 'emoji') return (node.attrs?.text as string) ?? '';
      if (node.content) return renderInline(node.content);
      return '';
    })
    .join('');
}

function renderBlock(node: AdfNode, listDepth = 0): string {
  switch (node.type) {
    case 'paragraph':
      return renderInline(node.content);
    case 'heading':
      return renderInline(node.content);
    case 'codeBlock':
      return (node.content ?? []).map((c) => c.text ?? '').join('\n');
    case 'blockquote':
      return (node.content ?? []).map((child) => `> ${renderBlock(child, listDepth)}`).join('\n');
    case 'rule':
      return '---';
    case 'bulletList':
    case 'orderedList':
      return (node.content ?? [])
        .map((item, index) => {
          const marker = node.type === 'orderedList' ? `${index + 1}.` : '-';
          const inner = (item.content ?? []).map((c) => renderBlock(c, listDepth + 1)).join(' ');
          return `${'  '.repeat(listDepth)}${marker} ${inner}`;
        })
        .join('\n');
    case 'listItem':
      return (node.content ?? []).map((c) => renderBlock(c, listDepth)).join(' ');
    case 'panel':
    case 'expand':
      return (node.content ?? []).map((c) => renderBlock(c, listDepth)).join('\n');
    case 'table':
      return (node.content ?? [])
        .map((row) => (row.content ?? []).map((cell) => renderInline(cell.content ?? []).trim()).join(' | '))
        .join('\n');
    default:
      return node.content ? node.content.map((c) => renderBlock(c, listDepth)).join('\n') : '';
  }
}

export function adfToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const root = doc as AdfNode;
  if (root.type !== 'doc' || !Array.isArray(root.content)) return '';
  return root.content
    .map((node) => renderBlock(node))
    .filter((line) => line.trim().length > 0)
    .join('\n\n')
    .trim();
}
