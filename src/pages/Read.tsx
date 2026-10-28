import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import { getMaterial, type Material } from '../lib/api';
import { legacyToBlockNote } from '../lib/blocknote-adapter';
import { markMaterialComplete } from '../lib/api-learner';
import { useAuth } from '../store/auth';
import { AppHeader } from '../components/AppHeader';
import { PreviewBanner } from '../components/PreviewBanner';
import {
  CalloutBlock, AccordionBlock, InlineQuizBlock,
  ImageFileBlock, VideoFileBlock, StyledSectionBlock,
} from '../lib/custom-blocks';
import { IconCheck } from '../lib/icons';

function toSpec(_name: string, x: unknown): never {
  const result = typeof x === 'function' ? (x as () => unknown)() : x;
  return result as never;
}

const schema = BlockNoteSchema.create().extend({
  blockSpecs: {
    callout: toSpec('Callout', CalloutBlock),
    accordion: toSpec('Accordion', AccordionBlock),
    inlineQuiz: toSpec('InlineQuiz', InlineQuizBlock),
    imageFile: toSpec('ImageFile', ImageFileBlock),
    videoFile: toSpec('VideoFile', VideoFileBlock),
    styledSection: toSpec('StyledSection', StyledSectionBlock),
  },
});

export function Read() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId') || undefined;
  const lessonId = searchParams.get('lessonId') || undefined;
  const isPreview = searchParams.get('preview') === '1';

  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [material, setMaterial] = useState<Material | null>(null);
  const [completed, setCompleted] = useState(false);
  const [marking, setMarking] = useState(false);

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
          setError('Этот материал не является лонгридом.');
          setLoading(false);
          return;
        }
        setMaterial(m);
        setCompleted(!!(m as { myStatus?: { completed?: boolean } }).myStatus?.completed);
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const onMark = async () => {
    if (!material || isPreview) return;
    if (!user) { navigate('/login'); return; }
    setMarking(true);
    try {
      await markMaterialComplete(material.id, undefined, { courseId, lessonId });
      setCompleted(true);
      if (courseId) navigate('/course/' + courseId, { replace: true });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setMarking(false);
    }
  };

  const onBack = () => {
    if (isPreview) { navigate('/admin'); return; }
    if (courseId) navigate('/course/' + courseId);
    else navigate('/learner');
  };

  if (loading) {
    return (
      <>
        <AppHeader />
        {isPreview && <PreviewBanner />}
        <main style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)' }}>Загружаем…</main>
      </>
    );
  }
  if (error || !material) {
    return (
      <>
        <AppHeader />
        {isPreview && <PreviewBanner />}
        <main style={{ padding: 40 }}>
          <button className="btn btn-ghost" onClick={onBack}>← Назад</button>
          <div className="auth-error" style={{ marginTop: 20 }}>{error || 'Материал не найден'}</div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      {isPreview && <PreviewBanner />}
      <ReadInner
        material={material}
        completed={completed}
        marking={marking}
        onMark={onMark}
        onBack={onBack}
        courseContext={!!courseId}
        isPreview={isPreview}
      />
    </>
  );
}

function ReadInner({
  material, completed, marking, onMark, onBack, courseContext, isPreview,
}: {
  material: Material;
  completed: boolean;
  marking: boolean;
  onMark: () => void;
  onBack: () => void;
  courseContext: boolean;
  isPreview: boolean;
}) {
  const initialContent = legacyToBlockNote((material as { content?: unknown }).content);

  const editor = useCreateBlockNote({
    initialContent: initialContent as never,
    schema,
  });

  useEffect(() => {
    try {
      (editor as unknown as { isEditable: boolean }).isEditable = false;
    } catch { /* ignore */ }
  }, [editor]);

  const desc = (material as { desc?: string; description?: string }).desc
    || (material as { description?: string }).description
    || '';

  return (
    <div className="editor-shell">
      <header className="editor-topbar" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={onBack}>
          ← {isPreview ? 'В админку' : courseContext ? 'К курсу' : 'В кабинет'}
        </button>
        <div className="editor-topbar-center">
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{material.title}</span>
        </div>
        <div className="editor-topbar-right">
          {isPreview ? (
            <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: 12 }}>
              Прогресс не сохраняется
            </span>
          ) : completed ? (
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconCheck size={14} /> Прочитано
            </span>
          ) : (
            <button className="btn btn-primary" onClick={onMark} disabled={marking}>
              <IconCheck size={16} /> {marking ? '…' : 'Отметить прочитанным'}
            </button>
          )}
        </div>
      </header>

      <div className="editor-bn-body">
        <main className="editor-bn-main preview-mode" style={{ padding: '40px 24px 120px' }}>
          <div className="editor-bn-surface" style={{ maxWidth: 720, border: 'none', boxShadow: 'none', background: 'transparent', padding: 0 }}>
            <h1 style={{ fontSize: 34, marginBottom: 12 }}>{material.title}</h1>
            {desc && <p className="longread-lead" style={{ marginBottom: 28 }}>{desc}</p>}
            <BlockNoteView editor={editor} editable={false} theme="light" />
          </div>
        </main>
      </div>
    </div>
  );
}