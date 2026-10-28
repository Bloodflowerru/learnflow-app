import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMaterial, getMaterials, updateMaterial, type Material } from '../lib/api';
import { useToast } from '../lib/utils';
import { AppHeader } from '../components/AppHeader';
import { IconArrowLeft, IconCheck, IconBook, IconPlus } from '../lib/icons';

type LessonType = 'longread' | 'test' | 'scorm';

interface CourseLesson {
  id: string;
  type: LessonType;
  materialId: string;
}

interface MaterialWithCourse extends Material {
  lessons?: CourseLesson[];
}

const TYPE_LABELS: Record<string, string> = {
  course: 'Курс', test: 'Тест', longread: 'Лонгрид', scorm: 'SCORM',
};

const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  longread: 'Лонгрид', test: 'Тест', scorm: 'SCORM',
};

export function CourseEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [course, setCourse] = useState<MaterialWithCourse | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [available, setAvailable] = useState<Material[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [{ material: m }, { materials: all }] = await Promise.all([
          getMaterial(id),
          getMaterials(),
        ]);
        if (cancelled) return;
        const mc = m as MaterialWithCourse;
        if (mc.type !== 'course') {
          setError('Этот материал не является курсом.');
          setLoading(false);
          return;
        }
        setCourse(mc);
        setTitle(mc.title);
        setDesc(
          (mc as { desc?: string; description?: string }).desc
          || (mc as { description?: string }).description
          || ''
        );
        setLessons(mc.lessons || []);
        setAvailable(
          (all || []).filter(
            (x) =>
              (x.type === 'longread' || x.type === 'test' || x.type === 'scorm') &&
              x.id !== id
          )
        );
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const addLesson = () => {
    if (!selectedMaterialId) { toast('Выберите материал', 'error'); return; }
    const m = available.find((x) => x.id === selectedMaterialId);
    if (!m) return;
    setLessons([
      ...lessons,
      {
        id: 'l_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: m.type as LessonType,
        materialId: m.id,
      },
    ]);
    setSelectedMaterialId('');
    setDirty(true);
  };

  const removeLesson = (idx: number) => {
    setLessons(lessons.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const moveLesson = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= lessons.length) return;
    const next = [...lessons];
    [next[idx], next[j]] = [next[j], next[idx]];
    setLessons(next);
    setDirty(true);
  };

  const save = async (publish: boolean) => {
    if (!course) return;
    if (!title.trim()) { toast('Укажите название', 'error'); return; }
    setSaving(true);
    try {
      await updateMaterial(course.id, {
        title: title.trim(),
        description: desc,
        lessons,
        ...(publish ? { status: 'published' } : {}),
      });
      setDirty(false);
      toast(publish ? 'Опубликован' : 'Сохранено');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const onBack = () => {
    if (dirty && !confirm('Несохранённые изменения будут потеряны. Выйти?')) return;
    navigate('/admin');
  };

  if (loading) {
    return (
      <>
        <AppHeader />
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)' }}>
          Загружаем курс…
        </div>
      </>
    );
  }
  if (error || !course) {
    return (
      <>
        <AppHeader />
        <div style={{ padding: 40 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/admin')}>
            <IconArrowLeft size={18} /> В админку
          </button>
          <div className="auth-error" style={{ marginTop: 20 }}>{error || 'Курс не найден'}</div>
        </div>
      </>
    );
  }

  const isPub = course.status === 'published';

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
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            placeholder="Название курса"
          />
        </div>
        <div className="editor-topbar-right">
          <button className="btn btn-outline" onClick={() => save(false)} disabled={saving}>
            {saving ? '…' : 'Сохранить'}
          </button>
          <button className="btn btn-primary" onClick={() => save(true)} disabled={saving}>
            <IconCheck size={16} /> {isPub ? 'Опубликован' : 'Опубликовать'}
          </button>
        </div>
      </header>

      <div className="course-shell">
        <div className="field">
          <label>Описание</label>
          <textarea
            className="textarea"
            value={desc}
            onChange={(e) => { setDesc(e.target.value); setDirty(true); }}
            placeholder="О чём этот курс"
            rows={3}
          />
        </div>

        <div className="ld-section-head">
          <h2>Уроки ({lessons.length})</h2>
        </div>

        {lessons.length === 0 ? (
          <div className="editor-empty">
            <IconBook size={40} />
            <p style={{ marginTop: 12 }}>Добавьте уроки</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lessons.map((lesson, i) => {
              const mat = available.find((x) => x.id === lesson.materialId);
              return (
                <div key={lesson.id} className="lesson-row">
                  <div className="lesson-num">{i + 1}</div>
                  <div className="lesson-info">
                    <h4>{mat?.title || 'Удалён'}</h4>
                    <span>{mat ? TYPE_LABELS[mat.type] || '' : ''}</span>
                  </div>
                  <span className="lesson-type-badge">
                    {LESSON_TYPE_LABELS[lesson.type] || lesson.type}
                  </span>
                  <div className="lesson-actions">
                    <button
                      className="icon-btn"
                      onClick={() => moveLesson(i, -1)}
                      disabled={i === 0}
                      title="Вверх"
                    >↑</button>
                    <button
                      className="icon-btn"
                      onClick={() => moveLesson(i, 1)}
                      disabled={i === lessons.length - 1}
                      title="Вниз"
                    >↓</button>
                    <button
                      className="icon-btn danger"
                      onClick={() => removeLesson(i)}
                      title="Удалить"
                    >×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="lesson-add">
          <select
            value={selectedMaterialId}
            onChange={(e) => setSelectedMaterialId(e.target.value)}
          >
            <option value="">— Выберите материал —</option>
            {available.map((x) => (
              <option key={x.id} value={x.id}>
                {TYPE_LABELS[x.type]}: {x.title}
                {x.status !== 'published' ? ' (черновик)' : ''}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={addLesson}>
            <IconPlus size={16} /> Добавить
          </button>
        </div>
      </div>
    </div>
  );
}