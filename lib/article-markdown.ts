import { marked } from 'marked';
import { cleanArticle } from './article';

export function markdownToArticle(source: string) {
  const html = marked.parse(source, { async: false, breaks: true, gfm: true });
  return cleanArticle(html.replace(/<(\/?)h1>/g, '<$1h2>'));
}

/** Round-trip the editor's supported blocks when opening the Markdown tab. */
export function articleToMarkdown(html: string) {
  const root = document.createElement('div');
  root.innerHTML = cleanArticle(html);
  const escape = (value: string) => value.replace(/([\\`*_{}\[\]<>#!|])/g, '\\$1');
  const destination = (value: string) => `<${value.replace(/[\s<>\\]/g, char => encodeURIComponent(char))}>`;
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE)
      return escape(node.textContent || '');
    if (!(node instanceof HTMLElement)) return '';
    const content = Array.from(node.childNodes).map(walk).join('');
    switch (node.tagName) {
      case 'H2': return `\n\n## ${content}\n\n`;
      case 'H3': return `\n\n### ${content}\n\n`;
      case 'P': case 'DIV': return `\n\n${content}\n\n`;
      case 'BR': return '\n';
      case 'STRONG': case 'B': return `**${content}**`;
      case 'EM': case 'I': return `*${content}*`;
      case 'A': return `[${content}](${destination(node.getAttribute('href') || '')})`;
      case 'IMG': return `\n\n![${escape(node.getAttribute('alt') || '')}](${destination(node.getAttribute('src') || '')})\n\n`;
      case 'LI': return `${node.parentElement?.tagName === 'OL' ? `${Array.from(node.parentElement.children).indexOf(node) + 1}.` : '-'} ${content.trim()}\n`;
      case 'UL': case 'OL': return `\n\n${content}\n`;
      case 'BLOCKQUOTE': return `\n\n${content.trim().split('\n').map(line => `> ${line}`).join('\n')}\n\n`;
      case 'HR': return '\n\n---\n\n';
      // Keep tables as supported HTML so changing tabs does not discard cells.
      case 'TABLE': return `\n\n${node.outerHTML}\n\n`;
      default: return content;
    }
  }
  return Array.from(root.childNodes).map(walk).join('').replace(/\n{3,}/g, '\n\n').trim();
}
