import type { CSSProperties } from 'react';

export type BlockType =
  | 'heading' | 'paragraph' | 'image' | 'video'
  | 'quote' | 'list' | 'button' | 'html' | 'divider';

export interface BlockStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  bgColor?: string;
  padding?: number;
}

export interface Block {
  id: string;
  type: BlockType;
  style?: BlockStyle;
  text?: string;
  url?: string;
  caption?: string;
  author?: string;
  items?: string[];
  ordered?: boolean;
  href?: string;
  btnStyle?: 'primary' | 'outline';
  align?: 'left' | 'center' | 'right';
  html?: string;
}

export interface LongreadStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bgColor?: string;
  contentWidth?: 'normal' | 'wide' | 'full';
}

export const FONTS: Array<{ id: string; name: string; stack: string }> = [
  { id: 'inherit',     name: 'По умолчанию', stack: 'inherit' },
  { id: 'system',      name: 'Системный',    stack: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' },
  { id: 'arial',       name: 'Arial',        stack: 'Arial,sans-serif' },
  { id: 'georgia',     name: 'Georgia',      stack: 'Georgia,serif' },
  { id: 'times',       name: 'Times',        stack: '"Times New Roman",serif' },
  { id: 'verdana',     name: 'Verdana',      stack: 'Verdana,sans-serif' },
  { id: 'inter',       name: 'Inter',        stack: '"Inter",sans-serif' },
  { id: 'roboto',      name: 'Roboto',       stack: '"Roboto",sans-serif' },
  { id: 'montserrat',  name: 'Montserrat',   stack: '"Montserrat",sans-serif' },
  { id: 'playfair',    name: 'Playfair',     stack: '"Playfair Display",serif' },
  { id: 'lora',        name: 'Lora',         stack: '"Lora",serif' },
  { id: 'opensans',    name: 'Open Sans',    stack: '"Open Sans",sans-serif' },
  { id: 'ptserif',     name: 'PT Serif',     stack: '"PT Serif",serif' },
  { id: 'ptmono',      name: 'PT Mono',      stack: '"PT Mono",monospace' },
  { id: 'merriweather',name: 'Merriweather', stack: '"Merriweather",serif' }
];

export const FONT_SIZES: number[] = [12, 14, 16, 17, 18, 20, 22, 24, 28, 32, 36, 42, 48, 56, 64];

export const FONT_WEIGHTS: Array<{ id: string; name: string }> = [
  { id: '400', name: 'Обычный' },
  { id: '600', name: 'Полужирный' },
  { id: '700', name: 'Жирный' },
  { id: '800', name: 'Очень жирный' }
];

export function uid(): string {
  return 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function newBlock(type: BlockType): Block {
  const id = uid();
  switch (type) {
    case 'heading':   return { id, type, text: '', style: {} };
    case 'paragraph': return { id, type, text: '', style: {} };
    case 'image':     return { id, type, url: '', caption: '', style: {} };
    case 'video':     return { id, type, url: '', caption: '', style: {} };
    case 'quote':     return { id, type, text: '', author: '', style: {} };
    case 'list':      return { id, type, items: [''], ordered: false, style: {} };
    case 'button':    return { id, type, text: 'Подробнее', href: '', btnStyle: 'primary', align: 'left', style: {} };
    case 'html':      return { id, type, html: '', style: {} };
    case 'divider':   return { id, type, style: {} };
  }
}

export function fontStack(id?: string): string {
  if (!id || id === 'inherit') return 'inherit';
  const f = FONTS.find((x) => x.id === id);
  return f ? f.stack : 'inherit';
}

/* Стили текста внутри блока — на input/textarea/h2/p */
export function blockTextStyle(block: Block, global: LongreadStyle): CSSProperties {
  const s = block.style || {};
  const ff = s.fontFamily || global.fontFamily;
  const fs = s.fontSize || global.fontSize;
  const out: CSSProperties = {};
  if (ff) out.fontFamily = fontStack(ff);
  if (fs) out.fontSize = `${fs}px`;
  if (s.fontWeight) out.fontWeight = s.fontWeight as CSSProperties['fontWeight'];
  if (s.fontStyle) out.fontStyle = s.fontStyle as CSSProperties['fontStyle'];
  if (s.textAlign) out.textAlign = s.textAlign;
  if (s.color) out.color = s.color;
  else if (global.color) out.color = global.color;
  return out;
}

/* Стили контейнера блока — фон, padding */
export function blockContainerStyle(block: Block): CSSProperties {
  const s = block.style || {};
  const out: CSSProperties = {};
  if (s.bgColor) out.background = s.bgColor;
  if (s.padding !== undefined && s.padding !== null && String(s.padding) !== '') {
    out.padding = s.padding;
  }
  if (s.textAlign) out.textAlign = s.textAlign;
  return out;
}

/* Стиль всего лонгрида — на .longread-preview */
export function longreadContainerStyle(style: LongreadStyle): CSSProperties {
  const out: CSSProperties = {};
  if (style.fontFamily) out.fontFamily = fontStack(style.fontFamily);
  if (style.fontSize) out.fontSize = `${style.fontSize}px`;
  if (style.color) out.color = style.color;
  if (style.bgColor) {
    out.background = style.bgColor;
    out.padding = 60;
    out.borderRadius = 16;
  }
  const mw = style.contentWidth === 'wide' ? 960 : style.contentWidth === 'full' ? 1200 : 720;
  out.maxWidth = mw;
  return out;
}

/* Определение видео по URL */
export function parseVideoUrl(url?: string): {
  kind: 'youtube' | 'rutube' | 'vk' | 'file' | 'unknown' | 'empty';
  embed?: string;
  src?: string;
} {
  if (!url) return { kind: 'empty' };
  const u = url.trim();
  let m: RegExpMatchArray | null;
  m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return { kind: 'youtube', embed: `https://www.youtube.com/embed/${m[1]}` };
  m = u.match(/rutube\.ru\/(?:video|play\/embed)\/([\w-]{6,})/);
  if (m) return { kind: 'rutube', embed: `https://rutube.ru/play/embed/${m[1]}/` };
  m = u.match(/vk\.com\/video(-?\d+)_(\d+)/);
  if (m) return { kind: 'vk', embed: `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}&hd=2` };
  if (/\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(u)) return { kind: 'file', src: u };
  return { kind: 'unknown' };
}