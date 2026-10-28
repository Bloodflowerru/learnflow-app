import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMaterial, updateMaterial, type Material } from '../lib/api';
import { useToast } from '../lib/utils';
import { AppHeader } from '../components/AppHeader';
import { IconArrowLeft, IconCheck, IconLayers, IconEdit, IconPlus } from '../lib/icons';

type QuestionType = 'single' | 'multiple' | 'text';

interface QuizOption { id: string; text: string; correct: boolean; }
interface QuizQuestion { id: string; type: QuestionType; text: string; options: QuizOption[]; }
interface QuizData { questions: QuizQuestion[]; passingScore: number; timeLimit: number; }
interface MaterialWithQuiz extends Material { quiz?: QuizData; }

function uid(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function newOption(): QuizOption {
  return { id: uid('o'), text: '', correct: false };
}

function newQuestion(type: QuestionType): QuizQuestion {
  if (type === 'text') {
    return { id: uid('q'), type, text: '', options: [{ id: uid('o'), text: '', correct: true }] };
  }
  return { id: uid('q'), type, text: '', options: [newOption(), newOption()] };
}

const Q_TYPE_LABELS: Record<QuestionType, string> = {
  single: 'Один ответ', multiple: 'Несколько', text: 'Текстовый',
};

export function QuizEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [material, setMaterial] = useState<MaterialWithQuiz | null>(null);
  const [title, setTitle] = useState('');
  const [quiz, setQuiz] = useState<QuizData>({ questions: [], passingScore: 70, timeLimit: 0 });
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
        const mq = m as MaterialWithQuiz;
        if (mq.type !== 'test') {
          setError('Этот материал не является тестом.');
          setLoading(false);
          return;
        }
        setMaterial(mq);
        setTitle(mq.title);
        setQuiz(mq.quiz || { questions: [], passingScore: 70, timeLimit: 0 });
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const setQuizField = <K extends keyof QuizData>(key: K, value: QuizData[K]) => {
    setQuiz({ ...quiz, [key]: value });
    setDirty(true);
  };

  const updateQuestion = (idx: number, fn: (q: QuizQuestion) => QuizQuestion) => {
    setQuiz({ ...quiz, questions: quiz.questions.map((q, i) => (i === idx ? fn(q) : q)) });
    setDirty(true);
  };

  const addQuestion = (type: QuestionType) => {
    setQuiz({ ...quiz, questions: [...quiz.questions, newQuestion(type)] });
    setDirty(true);
  };

  const deleteQuestion = (idx: number) => {
    setQuiz({ ...quiz, questions: quiz.questions.filter((_, i) => i !== idx) });
    setDirty(true);
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= quiz.questions.length) return;
    const next = [...quiz.questions];
    [next[idx], next[j]] = [next[j], next[idx]];
    setQuiz({ ...quiz, questions: next });
    setDirty(true);
  };

  const save = async (publish: boolean) => {
    if (!material) return;
    if (!title.trim()) { toast('Укажите название', 'error'); return; }
    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];
      if (!q.text.trim()) { toast(`Вопрос ${i + 1}: нет текста`, 'error'); return; }
      const valid = q.options.filter((o) => o.text.trim());
      if (q.type === 'text') {
        if (valid.length < 1) { toast(`Вопрос ${i + 1}: укажите ответ`, 'error'); return; }
      } else {
        if (valid.length < 2) { toast(`Вопрос ${i + 1}: минимум 2 варианта`, 'error'); return; }
        if (q.type === 'single' && valid.filter((o) => o.correct).length !== 1) {
          toast(`Вопрос ${i + 1}: ровно один правильный`, 'error'); return;
        }
        if (q.type === 'multiple' && valid.filter((o) => o.correct).length < 1) {
          toast(`Вопрос ${i + 1}: минимум один правильный`, 'error'); return;
        }
      }
    }
    setSaving(true);
    try {
      await updateMaterial(material.id, {
        title: title.trim(),
        quiz,
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
          Загружаем тест…
        </div>
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
          <div className="auth-error" style={{ marginTop: 20 }}>{error || 'Тест не найден'}</div>
        </div>
      </>
    );
  }

  const isPub = material.status === 'published';

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
            placeholder="Название теста"
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

      <div className="quiz-shell">
        <div className="quiz-settings">
          <div className="field" style={{ flex: 1 }}>
            <label>Проходной балл (%)</label>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              value={quiz.passingScore}
              onChange={(e) => setQuizField('passingScore', Math.max(0, Math.min(100, +e.target.value || 0)))}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Лимит времени (мин)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={quiz.timeLimit}
              onChange={(e) => setQuizField('timeLimit', Math.max(0, +e.target.value || 0))}
            />
          </div>
        </div>

        {quiz.questions.length === 0 ? (
          <div className="editor-empty">
            <IconCheck size={40} />
            <p style={{ marginTop: 12 }}>Добавьте вопрос</p>
          </div>
        ) : (
          quiz.questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              total={quiz.questions.length}
              onChange={(fn) => updateQuestion(i, fn)}
              onDelete={() => deleteQuestion(i)}
              onMove={(dir) => moveQuestion(i, dir)}
            />
          ))
        )}

        <div className="quiz-add-q">
          <button onClick={() => addQuestion('single')}>
            <IconCheck size={16} /> Один ответ
          </button>
          <button onClick={() => addQuestion('multiple')}>
            <IconLayers size={16} /> Несколько
          </button>
          <button onClick={() => addQuestion('text')}>
            <IconEdit size={16} /> Текстовый
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  question, index, total, onChange, onDelete, onMove,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  onChange: (fn: (q: QuizQuestion) => QuizQuestion) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const q = question;

  return (
    <div className="quiz-card">
      <div className="quiz-card-head">
        <div className="quiz-num">{index + 1}</div>
        <span className="quiz-type-badge">{Q_TYPE_LABELS[q.type]}</span>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => onMove(-1)} disabled={index === 0} title="Вверх">↑</button>
        <button className="icon-btn" onClick={() => onMove(1)} disabled={index === total - 1} title="Вниз">↓</button>
        <button className="icon-btn danger" onClick={onDelete} title="Удалить">×</button>
      </div>

      <div className="field">
        <label>Вопрос</label>
        <textarea
          className="textarea"
          value={q.text}
          onChange={(e) => onChange((prev) => ({ ...prev, text: e.target.value }))}
          placeholder="Текст вопроса"
          rows={2}
        />
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label>{q.type === 'text' ? 'Допустимые ответы' : 'Варианты ответа'}</label>
        <div className="quiz-options">
          {q.options.map((opt, i) => (
            <div key={opt.id} className={'option-row' + (opt.correct ? ' correct' : '')}>
              {q.type !== 'text' ? (
                <input
                  type={q.type === 'single' ? 'radio' : 'checkbox'}
                  checked={opt.correct}
                  onChange={() => {
                    onChange((prev) => {
                      if (prev.type === 'single') {
                        return {
                          ...prev,
                          options: prev.options.map((o, k) => ({ ...o, correct: k === i })),
                        };
                      }
                      return {
                        ...prev,
                        options: prev.options.map((o, k) => (k === i ? { ...o, correct: !o.correct } : o)),
                      };
                    });
                  }}
                />
              ) : (
                <IconCheck size={16} />
              )}
              <input
                type="text"
                value={opt.text}
                onChange={(e) => {
                  onChange((prev) => ({
                    ...prev,
                    options: prev.options.map((o, k) => (k === i ? { ...o, text: e.target.value } : o)),
                  }));
                }}
                placeholder={`Вариант ${i + 1}`}
              />
              {q.type !== 'text' && (
                <button
                  className="rm"
                  onClick={() => {
                    onChange((prev) => {
                      if (prev.options.length <= 2) return prev;
                      return { ...prev, options: prev.options.filter((_, k) => k !== i) };
                    });
                  }}
                  disabled={q.options.length <= 2}
                  title="Удалить вариант"
                >×</button>
              )}
            </div>
          ))}
        </div>
        {q.type !== 'text' && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onChange((prev) => ({ ...prev, options: [...prev.options, newOption()] }))}
            style={{ marginTop: 8 }}
          >
            <IconPlus size={14} /> Вариант
          </button>
        )}
      </div>
    </div>
  );
}