import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getMaterial, type Material } from '../lib/api';
import { useAuth } from '../store/auth';
import { setupScormAPI, type ScormInitialState } from '../lib/scorm-api';
import { loadScormState, trackScorm, finishScorm } from '../lib/api-scorm';
import { AppHeader } from '../components/AppHeader';
import { PreviewBanner } from '../components/PreviewBanner';
import { IconArrowLeft, IconCheck } from '../lib/icons';

interface ScormMeta { root: string; entry: string; }
interface MaterialWithScorm extends Material { scorm?: ScormMeta; }

export function ScormView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId') || undefined;
  const lessonId = searchParams.get('lessonId') || undefined;
  const isPreview = searchParams.get('preview') === '1';

  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [material, setMaterial] = useState<MaterialWithScorm | null>(null);
  const [initialState, setInitialState] = useState<ScormInitialState | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const { material: m } = await getMaterial(id);
        if (cancelled) return;
        const ms = m as MaterialWithScorm;
        if (ms.type !== 'scorm') {
          setError('Этот материал не является SCORM-курсом.');
          setLoading(false);
          return;
        }
        const meta = ms.scorm || { root: '', entry: 'index.html' };
        if (!meta.entry) meta.entry = 'index.html';
        (ms as MaterialWithScorm).scorm = meta;
        const st = await loadScormState(id);
        if (cancelled) return;
        setMaterial(ms);
        setInitialState(st || {});
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!material || !initialState || !user) return;
    const cleanup = setupScormAPI({
      initialState,
      user: { id: user.id, name: user.name },
      onTrack: async (payload) => {
        if (isPreview) return;
        try { await trackScorm(material.id, payload, courseId, lessonId); } catch { /* noop */ }
      },
      onFinish: async () => {
        if (isPreview) return;
        try { await finishScorm(material.id, courseId, lessonId); } catch { /* noop */ }
      },
    });
    setApiReady(true);
    return () => {
      setApiReady(false);
      cleanup();
    };
  }, [material, initialState, user, courseId, lessonId, isPreview]);

  const onBack = async () => {
    if (leaving) return;
    setLeaving(true);
    const W = window as unknown as {
      __scormFlush?: () => Promise<void>;
      __scormFinish?: () => Promise<void>;
    };
    if (!isPreview) {
      // Ждём, пока track и finish реально отправятся — иначе CourseTake
      // загрузит прогресс раньше, чем бэкенд запишет lessonCompletion
      if (W.__scormFinish) {
        try { await W.__scormFinish(); } catch { /* noop */ }
      } else if (W.__scormFlush) {
        try { await W.__scormFlush(); } catch { /* noop */ }
      }
    }
    if (isPreview) { navigate('/admin'); return; }
    if (courseId) navigate('/course/' + courseId, { replace: true });
    else if (user?.role === 'admin' || user?.role === 'superadmin') navigate('/admin');
    else navigate('/learner');
  };

  if (loading) {
    return (
      <>
        <AppHeader />
        {isPreview && <PreviewBanner />}
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)' }}>Загружаем SCORM-курс…</div>
      </>
    );
  }
  if (error || !material) {
    return (
      <>
        <AppHeader />
        {isPreview && <PreviewBanner />}
        <div style={{ padding: 40 }}>
          <button className="btn btn-ghost" onClick={() => { setLeaving(false); onBack(); }}>
            <IconArrowLeft size={16} /> Назад
          </button>
          <div className="auth-error" style={{ marginTop: 20 }}>{error || 'Курс не найден'}</div>
        </div>
      </>
    );
  }

  const root = (material.scorm!.root || '').replace(/^\/+|\/+$/g, '');
  const entry = (material.scorm!.entry || 'index.html').replace(/^\/+/, '');
  const entryUrl = '/uploads/scorm/' + material.id + '/' + (root ? root + '/' : '') + entry;

  return (
    <>
      <AppHeader />
      {isPreview && <PreviewBanner />}

      {/* Раскладка через flex — iframe занимает всё оставшееся место */}
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#f1f5f9' }}>
        {/* Панель с названием и кнопкой */}
        <div style={{
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onBack}
            disabled={leaving}
            type="button"
          >
            {leaving ? (
              <>Синхронизация…</>
            ) : (
              <><IconArrowLeft size={16} /> {isPreview ? 'В админку' : courseId ? 'К курсу' : 'Назад'}</>
            )}
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {material.title}
          </span>
          {courseId && (
            <span className="badge badge-primary" style={{ fontSize: 11 }}>
              Урок курса
            </span>
          )}
          {!isPreview && (
            <span className="badge" style={{ background: '#f0fdf4', color: '#166534', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconCheck size={12} /> Прогресс сохраняется
            </span>
          )}
        </div>

        {/* Iframe */}
        {!apiReady ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
            Инициализация SCORM API…
          </div>
        ) : (
          <iframe
            key={material.id}
            src={entryUrl}
            title={material.title}
            style={{ flex: 1, width: '100%', border: 'none', background: '#fff', display: 'block' }}
            allow="fullscreen; autoplay; clipboard-write; clipboard-read"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </>
  );
}