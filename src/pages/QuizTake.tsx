import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getMaterial, type Material } from '../lib/api';
import { submitQuiz, type SubmitQuizResult } from '../lib/api-learner';
import { AppHeader } from '../components/AppHeader';
import { PreviewBanner } from '../components/PreviewBanner';
import { useToast } from '../lib/utils';
import { IconArrowLeft, IconArrowRight, IconCheck, IconClose } from '../lib/icons';

interface QuizOption { id: string; text: string; correct: boolean; }
interface QuizQuestion { id: string; type: 'single' | 'multiple' | 'text'; text: string; options: QuizOption[]; }
interface Quiz { questions: QuizQuestion[]; passingScore: number; timeLimit: number; }
interface MaterialWithQuiz extends Material { quiz?: Quiz; }

export function QuizTake() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId') || undefined;
  const lessonId = searchParams.get('lessonId') || undefined;
  const isPreview = searchParams.get('preview') === '1';

  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [material, setMaterial] = useState<MaterialWithQuiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitQuizResult | null>(null);

  const returnPath = isPreview ? '/admin' : (courseId ? '/course/' + courseId : '/learner');

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
        if (mq.type !== 'test') { setError('Этот материал не является тестом.'); setLoading(false); return; }
        if (!mq.quiz || !Array.isArray(mq.quiz.questions) || mq.quiz.questions.length === 0) {
          setError('В тесте нет вопросов.'); setLoading(false); return;
        }
        setMaterial(mq); setCurrentIdx(0); setAnswers({}); setResult(null); setLoading(false);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (<><AppHeader />{isPreview && <PreviewBanner />}<main className="quiz-take"><div className="ld-empty" style={{ padding: 80 }}>Загружаем тест…</div></main></>);
  }
  if (error || !material) {
    return (
      <>
        <AppHeader />
        {isPreview && <PreviewBanner />}
        <main className="quiz-take">
          <div className="auth-error" style={{ marginBottom: 16 }}>{error || 'Тест не найден'}</div>
          <button className="btn btn-outline" onClick={() => navigate(returnPath)}>
            <IconArrowLeft size={16} /> {isPreview ? 'В админку' : courseId ? 'К курсу' : 'В кабинет'}
          </button>
        </main>
      </>
    );
  }

  if (result) {
    const a = result.attempt;
    const qs = material.quiz!.questions;
    const ps = material.quiz!.passingScore ?? 70;
    return (
      <>
        <AppHeader />
        <main className="quiz-result">
          <div className="quiz-result-top">
            <div className={'quiz-result-icon ' + (a.passed ? 'passed' : 'failed')}>
              {a.passed ? <IconCheck size={42} /> : <IconClose size={42} />}
            </div>
            <h1>{a.passed ? 'Тест пройден!' : 'Тест не пройден'}</h1>
            <div className="score">{a.score}%</div>
            <div className="score-label">{a.correct} из {a.total} · проходной {ps}%</div>
          </div>
          <div className="quiz-details">
            <div className="quiz-details-head">Разбор</div>
            {qs.map((q, i) => {
              const det = result.attempt.details?.find((x) => x.questionId === q.id);
              const ok = det ? det.correct : false;
              return (
                <div className="quiz-detail-row" key={q.id}>
                  <div className={'mark ' + (ok ? 'ok' : 'no')}>{ok ? '✓' : '✕'}</div>
                  <div>{i + 1}. {q.text}</div>
                </div>
              );
            })}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', height: 48 }} onClick={() => navigate(returnPath)}>
            {isPreview ? 'Вернуться в админку' : courseId ? 'Вернуться к курсу' : 'Вернуться в кабинет'}
          </button>
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => { setResult(null); setCurrentIdx(0); setAnswers({}); }}>
            Пройти заново
          </button>
        </main>
      </>
    );
  }

  const questions = material.quiz!.questions;
  const q = questions[currentIdx];
  const total = questions.length;
  const isLast = currentIdx === total - 1;
  const currentAnswer = answers[q.id];
  const isSingle = q.type === 'single';
  const isMultiple = q.type === 'multiple';
  const isText = q.type === 'text';

  const isSelected = (optId: string) => {
    if (isSingle) return currentAnswer === optId;
    if (isMultiple) return Array.isArray(currentAnswer) && currentAnswer.includes(optId);
    return false;
  };

  const pickAnswer = (optId: string) => {
    if (isSingle) setAnswers({ ...answers, [q.id]: optId });
    else if (isMultiple) {
      const cur = Array.isArray(currentAnswer) ? currentAnswer : [];
      const next = cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId];
      setAnswers({ ...answers, [q.id]: next });
    }
  };

  const handleSubmit = async () => {
    if (isPreview) {
      alert('В предпросмотре отправка отключена. Используйте «В админку» сверху.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitQuiz(material.id, answers, { courseId, lessonId });
      setResult(res);
      window.scrollTo({ top: 0 });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader />
      {isPreview && <PreviewBanner />}
      <main className="quiz-take">
        <div className="quiz-take-head">
          <h1>{material.title}</h1>
          <p>Вопрос {currentIdx + 1} из {total}</p>
        </div>
        <div className="quiz-progress">
          {questions.map((_, k) => (<span key={k} className={k <= currentIdx ? 'done' : ''} />))}
        </div>
        <div className="quiz-question-card">
          <div className="quiz-q-title">{q.text}</div>
          <div className="quiz-q-hint">
            {isSingle ? 'Выберите один ответ' : isMultiple ? 'Выберите несколько ответов' : 'Введите ответ'}
          </div>
          {isText ? (
            <input className="quiz-answer-text" value={typeof currentAnswer === 'string' ? currentAnswer : ''}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder="Введите ответ" />
          ) : (
            <div className="quiz-answer-list">
              {q.options.map((o) => {
                const sel = isSelected(o.id);
                return (
                  <div key={o.id} className={'quiz-answer' + (sel ? ' selected' : '')} onClick={() => pickAnswer(o.id)}>
                    <input type={isSingle ? 'radio' : 'checkbox'} checked={sel} onChange={() => { /* noop */ }} />
                    <span>{o.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="quiz-nav">
          <button className="btn btn-outline" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}>
            <IconArrowLeft size={16} /> Назад
          </button>
          {isLast ? (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              <IconCheck size={16} /> {isPreview ? 'Завершить (demo)' : submitting ? 'Отправляем…' : 'Завершить'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setCurrentIdx(Math.min(total - 1, currentIdx + 1))}>
              Далее <IconArrowRight size={16} />
            </button>
          )}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 16, fontSize: 13 }}
          onClick={() => {
            if (isPreview) { navigate('/admin'); return; }
            if (confirm('Прервать тест? Ответы не сохранятся.')) navigate(returnPath);
          }}>
          {isPreview ? 'В админку' : 'Прервать'}
        </button>
      </main>
    </>
  );
}