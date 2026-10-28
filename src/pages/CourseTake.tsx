import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getMaterial, type Material } from '../lib/api';
import { loadCourseProgress, type CourseProgress, type CourseLesson } from '../lib/api-learner';
import { AppHeader } from '../components/AppHeader';
import { PreviewBanner } from '../components/PreviewBanner';
import { IconArrowLeft, IconBook, IconCheck, IconEdit, IconLayers } from '../lib/icons';

export function CourseTake() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [course, setCourse] = useState<Material | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);

  // Загружаем прогресс. Зависимость от location.key: при возврате из SCORM
  // (navigate('/course/:id')) создаётся новая запись истории → перезагружаем
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const isRefresh = course !== null;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    (async () => {
      try {
        const [mRes, prog] = await Promise.all([
          getMaterial(id),
          loadCourseProgress(id),
        ]);
        if (cancelled) return;
        if (mRes.material.type !== 'course') {
          setError('Этот материал не является курсом.');
          setLoading(false);
          setRefreshing(false);
          return;
        }
        setCourse(mRes.material);
        setProgress(prog);
        setLoading(false);
        setRefreshing(false);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => { cancelled = true; };
    // location.key меняется при каждом navigate — это и есть «вернулись из SCORM»
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.key]);

  const back = () => navigate(isPreview ? '/admin' : '/learner');

  if (loading) {
    return (
      <>
        <AppHeader />
        {isPreview && <PreviewBanner />}
        <main className="course-take">
          <div className="ld-empty" style={{ padding: 60 }}>Загружаем курс…</div>
        </main>
      </>
    );
  }
  if (error || !course || !progress) {
    return (
      <>
        <AppHeader />
        {isPreview && <PreviewBanner />}
        <main className="course-take">
          <div className="auth-error" style={{ marginBottom: 16 }}>{error || 'Курс не найден'}</div>
          <button className="btn btn-outline" onClick={back}>
            <IconArrowLeft size={16} /> {isPreview ? 'В админку' : 'В кабинет'}
          </button>
        </main>
      </>
    );
  }

  const desc = (course as { desc?: string; description?: string }).desc
    || (course as { description?: string }).description
    || '';

  const openLesson = (lesson: CourseLesson) => {
    if (!id) return;
    const extra = isPreview ? '&preview=1' : '';
    const params = `?courseId=${encodeURIComponent(id)}&lessonId=${encodeURIComponent(lesson.id)}${extra}`;
    if (lesson.type === 'longread') navigate('/read/' + lesson.materialId + params);
    else if (lesson.type === 'test') navigate('/quiz/' + lesson.materialId + params);
    else if (lesson.type === 'scorm') navigate('/scorm/' + lesson.materialId + params);
    else alert('Неизвестный тип урока: ' + lesson.type);
  };

  return (
    <>
      <AppHeader />
      {isPreview && <PreviewBanner />}
      <main className="course-take">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={back} disabled={refreshing}>
            <IconArrowLeft size={16} /> {isPreview ? 'В админку' : 'В кабинет'}
          </button>
          {refreshing && (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Обновляем прогресс…</span>
          )}
        </div>
        <h1>{course.title}</h1>
        {desc && <p className="lead">{desc}</p>}
        <div className="course-progress-bar">
          <div className="progress"><div style={{ width: (progress.percent || 0) + '%' }} /></div>
          <div className="course-progress-text">
            <span>{progress.completedCount || 0} из {progress.totalCount || 0} уроков</span>
            <strong>{progress.percent || 0}%</strong>
          </div>
        </div>
        {progress.completed && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span className="badge badge-success" style={{ fontSize: 14, padding: '8px 16px' }}>
              <IconCheck size={16} /> Курс завершён
            </span>
          </div>
        )}
        {progress.lessons.length === 0 ? (
          <div className="ld-empty" style={{ padding: 60 }}>В курсе пока нет уроков</div>
        ) : (
          <div className="course-lessons">
            {progress.lessons.map((lesson, i) => {
              const isLong = lesson.type === 'longread';
              const isScorm = lesson.type === 'scorm';
              const done = !!lesson.completed;
              const iconBg = done
                ? 'var(--success)'
                : isLong ? '#ec4899' : isScorm ? '#0d9488' : '#10b981';
              const Icon = done ? IconCheck : isLong ? IconEdit : isScorm ? IconLayers : IconBook;
              const typeLabel = isLong ? 'Лонгрид' : isScorm ? 'SCORM-курс' : 'Тест';
              return (
                <div
                  key={lesson.id}
                  className={'course-lesson-card' + (done ? ' lesson-completed' : '')}
                  onClick={() => openLesson(lesson)}
                >
                  <div className="card-icon" style={{ background: iconBg }}>
                    <Icon size={22} />
                  </div>
                  <div className="card-body">
                    <h4>{i + 1}. {lesson.title || 'Материал'}</h4>
                    <span>
                      {typeLabel}
                      {done ? ' · пройден' : ''}
                      {isScorm && !done && progress.lessons.some((l) => l.type === 'scorm' && l.completed)
                        ? '' : ''}
                    </span>
                  </div>
                  <div className="card-action">
                    {done ? 'Повторить' : isLong ? 'Открыть' : isScorm ? 'Запустить' : 'Начать'} →
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}