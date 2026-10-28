import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getMaterial, type Material } from '../lib/api';
import { useToast } from '../lib/utils';
import { AppHeader } from '../components/AppHeader';
import { PreviewBanner } from '../components/PreviewBanner';
import type { TrainerData, TrainerStep, TrainerOption } from '../lib/api-trainer';
import { IconArrowLeft, IconCheck, IconUsers } from '../lib/icons';

interface MaterialWithTrainer extends Material {
  trainer?: TrainerData;
}

interface HistoryStep {
  step: TrainerStep;
  chosen?: TrainerOption;
}

export function TrainerTake() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [material, setMaterial] = useState<MaterialWithTrainer | null>(null);
  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [finished, setFinished] = useState(false);

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
        if (!mt.trainer || !mt.trainer.startStepId || mt.trainer.steps.length === 0) {
          setError('Тренажёр не настроен — нет шагов или стартового шага.');
          setLoading(false);
          return;
        }
        setMaterial(mt);
        const start = mt.trainer.steps.find((s) => s.id === mt.trainer!.startStepId);
        if (!start) {
          setError('Стартовый шаг не найден.');
          setLoading(false);
          return;
        }
        setHistory([{ step: start }]);
        setTotalScore(0);
        setFinished(false);
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const back = () => navigate(isPreview ? '/admin' : '/learner');

  if (loading) {
    return (<><AppHeader />{isPreview && <PreviewBanner />}<main className="course-take"><div className="ld-empty" style={{ padding: 60 }}>Загружаем тренажёр…</div></main></>);
  }
  if (error || !material) {
    return (
      <>
        <AppHeader />
        {isPreview && <PreviewBanner />}
        <main className="course-take">
          <div className="auth-error" style={{ marginBottom: 16 }}>{error || 'Тренажёр не найден'}</div>
          <button className="btn btn-outline" onClick={back}>
            <IconArrowLeft size={16} /> {isPreview ? 'В админку' : 'В кабинет'}
          </button>
        </main>
      </>
    );
  }

  const current = history[history.length - 1];

  const pickOption = (opt: TrainerOption) => {
    const newScore = totalScore + (opt.score || 0);
    const updatedHistory: HistoryStep[] = history.map((h, i) =>
      i === history.length - 1 ? { ...h, chosen: opt } : h
    );
    setTotalScore(newScore);

    if (!opt.nextStepId) {
      setHistory(updatedHistory);
      setFinished(true);
      return;
    }
    const nextStep = material.trainer!.steps.find((s) => s.id === opt.nextStepId);
    if (!nextStep) {
      toast('Следующий шаг не найден', 'error');
      setFinished(true);
      setHistory(updatedHistory);
      return;
    }
    setHistory([...updatedHistory, { step: nextStep }]);
  };

  const restart = () => {
    if (!material.trainer?.startStepId) return;
    const start = material.trainer.steps.find((s) => s.id === material.trainer!.startStepId);
    if (!start) return;
    setHistory([{ step: start }]);
    setTotalScore(0);
    setFinished(false);
  };

  // ===== Результат =====
  if (finished) {
    const stepsCount = history.length;
    return (
      <>
        <AppHeader />
        {isPreview && <PreviewBanner />}
        <main className="quiz-result">
          <div className="quiz-result-top">
            <div className="quiz-result-icon passed">
              <IconCheck size={42} />
            </div>
            <h1>Тренажёр пройден!</h1>
            <div className="score">{totalScore}</div>
            <div className="score-label">набрано баллов · {stepsCount} шагов</div>
          </div>

          <div className="quiz-details">
            <div className="quiz-details-head">Ваш путь</div>
            {history.map((h, i) => (
              <div key={i} className="quiz-detail-row">
                <div className="mark ok">{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{h.step.title || h.step.text.slice(0, 60)}</div>
                  {h.chosen && (
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                      → {h.chosen.text}{h.chosen.score > 0 ? ` (+${h.chosen.score})` : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" style={{ width: '100%', height: 48 }} onClick={back}>
            {isPreview ? 'Вернуться в админку' : 'Вернуться в кабинет'}
          </button>
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={restart}>
            Пройти заново
          </button>
        </main>
      </>
    );
  }

  // ===== Текущий шаг =====
  return (
    <>
      <AppHeader />
      {isPreview && <PreviewBanner />}
      <main className="course-take">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={back}>
            <IconArrowLeft size={16} /> {isPreview ? 'В админку' : 'В кабинет'}
          </button>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            <IconUsers size={14} style={{ display: 'inline', marginRight: 4 }} />
            Шаг {history.length} · {totalScore} баллов
          </div>
        </div>

        <h1 style={{ marginBottom: 8 }}>{material.title}</h1>
        {current.step.title && (
          <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 20 }}>
            {current.step.title}
          </p>
        )}

        <div
          style={{
            padding: 20,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            marginBottom: 24,
            fontSize: 16,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {current.step.text}
        </div>

        <div className="ld-section-head"><h2 style={{ fontSize: 16 }}>Что вы сделаете?</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {current.step.options.map((o, i) => (
            <button
              key={o.id}
              onClick={() => pickOption(o)}
              style={{
                padding: '14px 18px',
                background: 'var(--surface)',
                border: '2px solid var(--border)',
                borderRadius: 10,
                textAlign: 'left',
                fontSize: 15,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <strong style={{ color: 'var(--text-3)', marginRight: 8 }}>{String.fromCharCode(65 + i)}.</strong>
              {o.text}
            </button>
          ))}
        </div>
      </main>
    </>
  );
}