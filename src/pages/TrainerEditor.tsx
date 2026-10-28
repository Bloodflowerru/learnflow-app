import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMaterial, updateMaterial, type Material } from '../lib/api';
import { useToast } from '../lib/utils';
import { AppHeader } from '../components/AppHeader';
import {
  createEmptyTrainer, newStep, newOption,
  type TrainerData, type TrainerStep,
} from '../lib/api-trainer';
import { IconArrowLeft, IconCheck, IconPlus } from '../lib/icons';

interface MaterialWithTrainer extends Material {
  trainer?: TrainerData;
}

export function TrainerEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [material, setMaterial] = useState<MaterialWithTrainer | null>(null);
  const [title, setTitle] = useState('');
  const [trainer, setTrainer] = useState<TrainerData>(createEmptyTrainer());
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const { material: m } = await getMaterial(id);
        if (cancelled) return;
        const mt = m as MaterialWithTrainer;
        if (mt.type !== 'trainer') {
          setError('Этот материал не является тренажёром.');
          setLoading(false);
          return;
        }
        setMaterial(mt);
        setTitle(mt.title);
        setTrainer(mt.trainer || createEmptyTrainer());
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const updateTrainer = (fn: (t: TrainerData) => TrainerData) => {
    setTrainer((t) => fn(t));
    setDirty(true);
  };

  const updateStep = (idx: number, fn: (s: TrainerStep) => TrainerStep) => {
    updateTrainer((t) => ({
      ...t,
      steps: t.steps.map((s, i) => (i === idx ? fn(s) : s)),
    }));
  };

  const addStep = () => {
    const st = newStep();
    updateTrainer((t) => ({
      ...t,
      steps: [...t.steps, st],
      startStepId: t.startStepId || st.id,
    }));
    setActiveStepIdx(trainer.steps.length);
  };

  const removeStep = (idx: number) => {
    const step = trainer.steps[idx];
    if (!confirm(`Удалить шаг «${step.title || 'Без названия'}»?`)) return;
    updateTrainer((t) => {
      const steps = t.steps.filter((_, i) => i !== idx);
      const startStepId = t.startStepId === step.id ? (steps[0]?.id || null) : t.startStepId;
      // обнуляем ссылки на удалённый шаг
      const cleaned = steps.map((s) => ({
        ...s,
        options: s.options.map((o) =>
          o.nextStepId === step.id ? { ...o, nextStepId: null } : o
        ),
      }));
      return { ...t, steps: cleaned, startStepId };
    });
    setActiveStepIdx((i) => Math.max(0, i - (i >= idx ? 1 : 0)));
  };

  const setAsStart = (idx: number) => {
    const step = trainer.steps[idx];
    updateTrainer((t) => ({ ...t, startStepId: step.id }));
  };

  const save = async (publish: boolean) => {
    if (!material) return;
    if (!title.trim()) { toast('Укажите название', 'error'); return; }
    if (trainer.steps.length === 0) { toast('Добавьте хотя бы один шаг', 'error'); return; }
    if (!trainer.startStepId) { toast('Отметьте стартовый шаг', 'error'); return; }
    for (let i = 0; i < trainer.steps.length; i++) {
      const s = trainer.steps[i];
      if (!s.text.trim()) {
        toast(`Шаг ${i + 1}: нет текста ситуации`, 'error');
        return;
      }
      if (s.options.length < 2) {
        toast(`Шаг ${i + 1}: нужно минимум 2 варианта`, 'error');
        return;
      }
      if (s.options.some((o) => !o.text.trim())) {
        toast(`Шаг ${i + 1}: пустой текст варианта`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      await updateMaterial(material.id, {
        title: title.trim(),
        trainer,
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
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)' }}>Загружаем тренажёр…</div>
      </>
    );
  }
  if (error || !material) {
    return (
      <>
        <AppHeader />
        <div style={{ padding: 40 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/admin')}>
            <IconArrowLeft size={18} /> В админку
          </button>
          <div className="auth-error" style={{ marginTop: 20 }}>{error || 'Тренажёр не найден'}</div>
        </div>
      </>
    );
  }

  const isPub = material.status === 'published';
  const active = trainer.steps[activeStepIdx];

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
            placeholder="Название тренажёра"
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

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Список шагов */}
        <aside style={{ width: 280, borderRight: '1px solid var(--border)', background: 'var(--surface)', padding: 16, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Шаги ({trainer.steps.length})</div>
            <button className="btn btn-ghost btn-sm" onClick={addStep}>
              <IconPlus size={14} /> Шаг
            </button>
          </div>
          {trainer.steps.map((s, i) => {
            const isStart = s.id === trainer.startStepId;
            return (
              <div
                key={s.id}
                onClick={() => setActiveStepIdx(i)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 4,
                  cursor: 'pointer',
                  background: i === activeStepIdx ? 'var(--primary-50)' : 'transparent',
                  border: '1px solid ' + (i === activeStepIdx ? 'var(--primary)' : 'transparent'),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{i + 1}.</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                    {s.title || s.text.slice(0, 30) || 'Без названия'}
                  </span>
                  {isStart && (
                    <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--success)', color: '#fff', borderRadius: 4 }}>
                      СТАРТ
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  {s.options.length} вариант(ов)
                </div>
              </div>
            );
          })}
        </aside>

        {/* Редактор активного шага */}
        <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {!active ? (
            <div className="editor-empty" style={{ padding: 60 }}>
              <p>Добавьте первый шаг — начните с кнопки «+ Шаг».</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setAsStart(activeStepIdx)}
                  disabled={active.id === trainer.startStepId}
                >
                  {active.id === trainer.startStepId ? '✓ Стартовый шаг' : 'Сделать стартовым'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => removeStep(activeStepIdx)}
                >
                  Удалить шаг
                </button>
              </div>

              <div className="field">
                <label>Название шага (для навигации)</label>
                <input
                  className="input"
                  value={active.title}
                  onChange={(e) => updateStep(activeStepIdx, (s) => ({ ...s, title: e.target.value }))}
                  placeholder="Например: Клиент говорит «дорого»"
                />
              </div>

              <div className="field">
                <label>Ситуация / вопрос</label>
                <textarea
                  className="textarea"
                  value={active.text}
                  onChange={(e) => updateStep(activeStepIdx, (s) => ({ ...s, text: e.target.value }))}
                  placeholder="Клиент: «Слишком дорого, у конкурентов дешевле»"
                  rows={4}
                />
              </div>

              <div className="field">
                <label>Варианты ответа</label>
                {active.options.length === 0 ? (
                  <div className="editor-empty" style={{ padding: 20 }}>
                    <p style={{ fontSize: 13 }}>Добавьте варианты — минимум 2</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {active.options.map((o, oi) => (
                      <div
                        key={o.id}
                        style={{
                          padding: 12,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <input
                            type="text"
                            className="input"
                            style={{ flex: 1 }}
                            value={o.text}
                            onChange={(e) => updateStep(activeStepIdx, (s) => ({
                              ...s,
                              options: s.options.map((x) => x.id === o.id ? { ...x, text: e.target.value } : x),
                            }))}
                            placeholder={`Вариант ${oi + 1}`}
                          />
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => updateStep(activeStepIdx, (s) => ({
                              ...s,
                              options: s.options.filter((x) => x.id !== o.id),
                            }))}
                          >×</button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                            <label style={{ fontSize: 11 }}>Куда ведёт</label>
                            <select
                              className="select"
                              value={o.nextStepId || ''}
                              onChange={(e) => updateStep(activeStepIdx, (s) => ({
                                ...s,
                                options: s.options.map((x) => x.id === o.id ? { ...x, nextStepId: e.target.value || null } : x),
                              }))}
                            >
                              <option value="">— Финал (показать результат)</option>
                              {trainer.steps.filter((s) => s.id !== active.id).map((s, i) => (
                                <option key={s.id} value={s.id}>
                                  Шаг: {s.title || s.text.slice(0, 30) || `${i + 1}`}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field" style={{ width: 120, marginBottom: 0 }}>
                            <label style={{ fontSize: 11 }}>Баллы</label>
                            <input
                              type="number"
                              className="input"
                              min={0}
                              max={100}
                              value={o.score}
                              onChange={(e) => updateStep(activeStepIdx, (s) => ({
                                ...s,
                                options: s.options.map((x) => x.id === o.id ? { ...x, score: Math.max(0, +e.target.value || 0) } : x),
                              }))}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: 10 }}
                  onClick={() => updateStep(activeStepIdx, (s) => ({
                    ...s,
                    options: [...s.options, newOption()],
                  }))}
                >
                  <IconPlus size={14} /> Добавить вариант
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}