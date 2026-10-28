import type { Block as BNBlock } from '@blocknote/core';

interface LegacyBlock {
  id?: string;
  type: string;
  style?: Record<string, unknown>;
  text?: string;
  url?: string;
  caption?: string;
  author?: string;
  items?: string[];
  ordered?: boolean;
  href?: string;
  btnStyle?: string;
  align?: string;
  html?: string;
}

function uid(): string {
  return 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function isBlockNoteContent(content: unknown): content is BNBlock[] {
  if (!Array.isArray(content) || content.length === 0) return false;
  const first = content[0] as Record<string, unknown>;
  return typeof first === 'object' && first !== null && 'props' in first && 'type' in first;
}

export function legacyToBlockNote(blocks: unknown): BNBlock[] {
  if (!Array.isArray(blocks)) return [];
  if (isBlockNoteContent(blocks)) return blocks;

  const result: BNBlock[] = [];
  for (const raw of blocks as LegacyBlock[]) {
    if (!raw || typeof raw !== 'object') continue;
    const id = raw.id || uid();

    switch (raw.type) {
      case 'heading':
        result.push({
          id,
          type: 'heading',
          props: { level: 2 },
          content: raw.text ? [{ type: 'text', text: raw.text, styles: {} }] : [],
          children: []
        });
        break;
      case 'paragraph':
        result.push({
          id,
          type: 'paragraph',
          props: {},
          content: raw.text ? [{ type: 'text', text: raw.text, styles: {} }] : [],
          children: []
        });
        break;
      case 'image':
        result.push({
          id,
          type: 'image',
          props: { url: raw.url || '', caption: raw.caption || '', previewWidth: 512 },
          children: []
        });
        break;
      case 'video':
        result.push({
          id, type: 'paragraph', props: {},
          content: [{ type: 'text', text: `Видео: ${raw.url || ''}${raw.caption ? ` — ${raw.caption}` : ''}`, styles: {} }],
          children: []
        });
        break;
      case 'quote':
        result.push({
          id, type: 'paragraph', props: {},
          content: [{ type: 'text', text: `«${raw.text || ''}»${raw.author ? ` — ${raw.author}` : ''}`, styles: { italic: true } }],
          children: []
        });
        break;
      case 'list': {
        const items = raw.items || [];
        for (const item of items) {
          result.push({
            id: uid(),
            type: raw.ordered ? 'numberedListItem' : 'bulletListItem',
            props: {},
            content: item ? [{ type: 'text', text: item, styles: {} }] : [],
            children: []
          });
        }
        break;
      }
      case 'button':
        result.push({
          id, type: 'paragraph', props: {},
          content: [{ type: 'text', text: `Кнопка: ${raw.text || ''} → ${raw.href || '#'}`, styles: { bold: true } }],
          children: []
        });
        break;
      case 'html':
        result.push({
          id, type: 'paragraph', props: {},
          content: [{ type: 'text', text: raw.html || '', styles: { code: true } }],
          children: []
        });
        break;
      case 'divider':
        result.push({
          id, type: 'paragraph', props: {},
          content: [{ type: 'text', text: '---', styles: {} }],
          children: []
        });
        break;
      default:
        result.push({
          id, type: 'paragraph', props: {},
          content: raw.text ? [{ type: 'text', text: raw.text, styles: {} }] : [],
          children: []
        });
    }
  }

  return result.length ? result : [{ id: uid(), type: 'paragraph', props: {}, content: [], children: [] }];
}

export function blockNoteToLegacy(blocks: BNBlock[]): LegacyBlock[] {
  return blocks.map((b) => {
    const type = b.type;
    const props = (b.props || {}) as Record<string, unknown>;
    const content = Array.isArray(b.content) ? b.content : [];
    const plainText = content
      .map((c) => (c && typeof c === 'object' && 'text' in c ? ((c as { text?: string }).text || '') : ''))
      .join('');

    if (type === 'heading') return { id: b.id, type: 'heading', text: plainText, style: {} };
    if (type === 'image') return { id: b.id, type: 'image', url: (props.url as string) || '', caption: (props.caption as string) || '', style: {} };
    if (type === 'bulletListItem' || type === 'numberedListItem') {
      return { id: b.id, type: 'list', items: [plainText], ordered: type === 'numberedListItem', style: {} };
    }
    return { id: b.id, type: 'paragraph', text: plainText, style: {} };
  });
}