import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema } from '@blocknote/core';
import type { Block as BNBlock } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import { getMaterial, updateMaterial, type Material } from '../lib/api';
import { legacyToBlockNote } from '../lib/blocknote-adapter';
import {
  CalloutBlock, AccordionBlock, InlineQuizBlock,
  ImageFileBlock, VideoFileBlock, StyledSectionBlock,
} from '../lib/custom-blocks';
import { useToast } from '../lib/utils';
import { AppHeader } from '../components/AppHeader';
import { PreviewBanner } from '../components/PreviewBanner';
import {
  IconArrowLeft, IconCheck, IconFileText, IconEdit, IconLayers,
  IconList, IconBook, IconUpload, IconPlay,
} from '../lib/icons';

function toSpec(name: string, x: unknown): never {
  const result = typeof x === 'function' ? (x as () => unknown)() : x;
  console.log(`[schema] ${name}: type=${typeof x} → ${typeof result}`);
  return result as never;
}

const schema = BlockNoteSchema.create().extend({
  blockSpecs: {
    callout: toSpec('CalloutBlock', CalloutBlock),
    accordion: toSpec('AccordionBlock', AccordionBlock),
    inlineQuiz: toSpec('InlineQuizBlock', InlineQuizBlock),
    imageFile: toSpec('ImageFileBlock', ImageFileBlock),
    videoFile: toSpec('VideoFileBlock', VideoFileBlock),
    styledSection: toSpec('StyledSectionBlock', StyledSectionBlock),
  },
});

interface BNTemplate {
  id: string;
  label: string;
  icon: React.ReactNode;
  block: Record<string, unknown>;
}

const BLOCK_TEMPLATES: BNTemplate[] = [
  { id: 'h1',        label: 'Заголовок 1',   icon: <IconFileText size={16} />, block: { type: 'heading', props: { level: 1 }, content: '' } },
  { id: 'h2',        label: 'Заголовок 2',   icon: <IconFileText size={16} />, block: { type: 'heading', props: { level: 2 }, content: '' } },
  { id: 'h3',        label: 'Заголовок 3',   icon: <IconFileText size={16} />, block: { type: 'heading', props: { level: 3 }, content: '' } },
  { id: 'paragraph', label: 'Параграф',      icon: <IconEdit size={16} />,     block: { type: 'paragraph', content: '' } },
  { id: 'bullet',    label: 'Маркированный', icon: <IconLayers size={16} />,   block: { type: 'bulletListItem', content: '' } },
  { id: 'numbered',  label: 'Нумерованный',  icon: <IconList size={16} />,     block: { type: 'numberedListItem', content: '' } },
  { id: 'check',     label: 'Чек-лист',      icon: <IconCheck size={16} />,    block: { type: 'checkListItem', content: '' } },
  { id: 'callout',   label: 'Врезка',        icon: <IconBook size={16} />,     block: { type: 'callout', props: { variant: 'info' }, content: [] } },
  { id: 'styledSection', label: 'Секция',    icon: <IconBook size={16} />,     block: { type: 'styledSection', props: { bgColor: '#f8fafc', padding: 24, borderRadius: 16, textColor: '#0f172a', overlay: 0, bgImage: '' }, content: '' } },
  { id: 'accordion', label: 'Аккордеон',     icon: <IconLayers size={16} />,   block: { type: 'accordion', props: { title: 'Разверните, чтобы прочитать' }, content: [] } },
  { id: 'quiz',      label: 'Мини-тест',     icon: <IconCheck size={16} />,    block: { type: 'inlineQuiz', props: { question: 'Вопрос', options: JSON.stringify(['Вариант 1', 'Вариант 2']), correctIndex: 0, explanation: '' } } },
  { id: 'imageFile', label: 'Изображение',   icon: <IconUpload size={16} />,   block: { type: 'imageFile', props: { url: '', caption: '' } } },
  { id: 'videoFile', label: 'Видео',         icon: <IconPlay size={16} />,     block: { type: 'videoFile', props: { url: '', caption: '' } } },
];

export function LongreadEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialPreview = searchParams.get('preview') === '1';

  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [material, setMaterial] = useState<Material | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialContent, setInitialContent] = useState<BNBlock[] | undefined>(undefined);
  const [mode, setMode] = useState<'edit' | 'preview'>(initialPreview ? 'preview' : 'edit');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const { material: m } = await getMaterial(id);
        if (cancelled) return;
        if (m.type !== 'longread') {
          setError(`Редактор для типа «${m.type}» пока не готов. Работает только для лонгридов.`);
          setLoading(false);
          return;
        }
        setMaterial(m);
        setTitle(m.title);
        setDesc((m as { desc?: string; description?: string }).desc
          || (m as { description?: string }).description
          || '');
        setStatus(m.status === 'published' ? 'published' : 'draft');
        setInitialContent(legacyToBlockNote(m.content));
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <>
        <AppHeader />
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)' }}>Загружаем лонгрид…</div>
      </>
    );
  }
  if (error || !material) {
    return (
      <>
        <AppHeader />
        <div style={{ padding: 40 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/admin')}>
            <IconArrowLeft size={18} /> Назад
          </button>
          <div className="auth-error" style={{ marginTop: 20 }}>{error || 'Материал не найден'}</div>
        </div>
      </>
    );
  }

  return (
    <EditorInner
      material={material}
      initialContent={initialContent}
      title={title}
      setTitle={(v) => { setTitle(v); setDirty(true); }}
      desc={desc}
      setDesc={(v) => { setDesc(v); setDirty(true); }}
      dirty={dirty}
      setDirty={setDirty}
      saving={saving}
      isPublished={status === 'published'}
      mode={mode}
      setMode={setMode}
      onBack={() => {
        if (dirty && !confirm('Несохранённые изменения будут потеряны. Выйти?')) return;
        navigate(mode === 'preview' ? '/admin' : '/admin');
      }}
      onSave={async (publish, bnBlocks) => {
        if (!title.trim()) { toast('Укажите заголовок', 'error'); return; }
        setSaving(true);
        try {
          await updateMaterial(material.id, {
            title: title.trim(),
            description: desc,
            content: bnBlocks as unknown as Record<string, unknown>[],
            ...(publish ? { status: 'published' } : {}),
          });
          setDirty(false);
          if (publish) setStatus('published');
          toast(publish ? 'Опубликован' : 'Сохранено');
        } catch (e) {
          toast((e as Error).message, 'error');
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}

function EditorInner({
  material, initialContent, title, setTitle, desc, setDesc,
  saving, isPublished, onBack, onSave, setDirty, mode, setMode,
}: {
  material: Material;
  initialContent: BNBlock[] | undefined;
  title: string;
  setTitle: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  dirty: boolean;
  setDirty: (v: boolean) => void;
  saving: boolean;
  isPublished: boolean;
  onBack: () => void;
  onSave: (publish: boolean, blocks: BNBlock[]) => void;
  mode: 'edit' | 'preview';
  setMode: (m: 'edit' | 'preview') => void;
}) {
  const editor = useCreateBlockNote({
    initialContent: initialContent as never,
    schema,
  });

  useEffect(() => {
    try {
      (editor as unknown as { isEditable: boolean }).isEditable = mode === 'edit';
    } catch { /* ignore */ }
  }, [editor, mode]);

  const insertBlock = (tpl: BNTemplate) => {
    if (!editor || mode !== 'edit') return;
    let refBlockId: string | undefined;
    try {
      const cursor = editor.getTextCursorPosition();
      refBlockId = cursor?.block?.id;
    } catch { refBlockId = undefined; }
    if (!refBlockId) {
      const doc = editor.document;
      refBlockId = doc[doc.length - 1]?.id;
    }
    try {
      const inserted = editor.insertBlocks(
        [tpl.block as never],
        refBlockId as never,
        'after'
      );
      if (inserted && inserted[0]) {
        setTimeout(() => { try { editor.focus(); } catch { /* ignore */ } }, 10);
      }
      setDirty(true);
    } catch (e) {
      console.warn('insertBlocks error', e);
    }
  };

  const isPreview = mode === 'preview';

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <button className="btn btn-ghost" onClick={onBack}>
          <IconArrowLeft size={18} /> Назад
        </button>
        <div className="editor-topbar-center">
          <input
            className="editor-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок"
            readOnly={isPreview}
          />
        </div>
        <div className="editor-topbar-right">
          <button
            className={`btn ${isPreview ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setMode(isPreview ? 'edit' : 'preview')}
            type="button"
          >
            {isPreview
              ? <><IconEdit size={16} /> Редактор</>
              : <><IconPlay size={16} /> Предпросмотр</>}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => onSave(false, editor.document as unknown as BNBlock[])}
            disabled={saving || isPreview}
          >
            {saving ? '…' : 'Сохранить'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(true, editor.document as unknown as BNBlock[])}
            disabled={saving || isPreview}
          >
            <IconCheck size={16} /> {isPublished ? 'Опубликован' : 'Опубликовать'}
          </button>
        </div>
      </header>

      <div className="editor-bn-body">
        {!isPreview && (
          <aside className="editor-bn-side">
            <div className="editor-panel-title">Добавить блок</div>
            <div className="editor-block-list">
              {BLOCK_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="editor-block-btn"
                  onClick={() => insertBlock(tpl)}
                  title={tpl.label}
                >
                  {tpl.icon}
                  <span>{tpl.label}</span>
                </button>
              ))}
            </div>

            <div className="editor-panel-title" style={{ marginTop: 24 }}>Описание</div>
            <textarea
              className="textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Коротко о содержании"
              rows={3}
              style={{ fontSize: 13 }}
            />

            <div className="editor-panel-title" style={{ marginTop: 24 }}>Подсказка</div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
              <code>/</code> в пустой строке — меню блоков.<br />
              Ручка <strong>⠿</strong> слева — перемещение.<br />
              <strong>Секция</strong>: фон, картинка, отступы, скругление.<br />
              <strong>Врезка</strong>: цвет точками внизу.<br />
              <strong>Аккордеон</strong>: клик по заголовку в предпросмотре.<br />
              <strong>Мини-тест</strong>: радио слева = правильный ответ.
            </p>

            {material.status !== 'published' && (
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--warning)' }}>
                Черновик. Учащиеся не видят материал.
              </div>
            )}
          </aside>
        )}

        <main className={`editor-bn-main ${isPreview ? 'preview-mode' : ''}`}>
          {isPreview && <PreviewBanner />}
          <div className="editor-bn-surface">
            <BlockNoteView
              editor={editor}
              editable={!isPreview}
              onChange={() => { if (!isPreview) setDirty(true); }}
              theme="light"
            />
          </div>
        </main>
      </div>
    </div>
  );
}