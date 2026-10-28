import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { AppHeader } from '../components/AppHeader';
import {
  loadMyLearning, loadMyProgress, loadLearnerMaterials, loadMyAssignments,
  type MyLearning, type MyProgress, type LearnerMaterial,
  type Assignment, type AssignmentStatus,
} from '../lib/api-learner';
import { fmtDate } from '../lib/utils';
import {
  IconBook, IconCheck, IconEdit, IconPlay, IconLayers, IconArrowRight,
  IconClock, IconClose, IconUsers,
} from '../lib/icons';

const EMPTY_STATS = {
  totalCourses: 0, startedCourses: 0, completedCourses: 0,
  lessonsCompleted: 0, testsPassed: 0, totalAttempts: 0, avgScore: 0,
};

const ASSIGN_STATUS: Record<AssignmentStatus, {
  label: string; color: string; bg: string; icon: 'close' | 'clock' | 'play' | 'book' | 'check';
}> = {
  'overdue':     { label: 'Просрочено',  color: '#ef4444', bg: '#fef2f2', icon: 'close' },
  'due-soon':    { label: 'Срок близко', color: '#f59e0b', bg: '#fffbeb', icon: 'clock' },
  'in-progress': { label: 'В процессе',  color: '#6366f1', bg: '#eef2ff', icon: 'play'  },
  'new':         { label: 'Не начато',   color: '#64748b', bg: '#f1f5f9', icon: 'book'  },
  'completed':   { label: 'Завершено',   color: '#10b981', bg: '#ecfdf5', icon: 'check' },
  'deleted':     { label: 'Удалён',      color: '#94a3b8', bg: '#f8fafc', icon: 'close' },
};

function AssignIcon({ kind, size = 20 }: { kind: 'close' | 'clock' | 'play' | 'book' | 'check'; size?: number }) {
  if (kind === 'close') return <IconClose size={size} />;
  if (kind === 'clock') return <IconClock size={size} />;
  if (kind === 'play')  return <IconPlay size={size} />;
  if (kind === 'check') return <IconCheck size={size} />;
  return <IconBook size={size} />;
}

export function LearnerHome() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [learning, setLearning] = useState<MyLearning>({ courses: [], stats: EMPTY_STATS });
  const [progress, setProgress] = useState<MyProgress>({
    totalAttempts: 0, passedCount: 0, avgScore: 0, byMaterial: {}, recent: [],
  });
  const [materials, setMaterials] = useState<LearnerMaterial[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [l, p, m, a] = await Promise.all([
        loadMyLearning(),
        loadMyProgress(),
        loadLearnerMaterials(),
        loadMyAssignments(),
      ]);
      if (cancelled) return;
      setLearning(l);
      setProgress(p);
      setMaterials(m);
      setAssignments(a);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const courses = learning.courses || [];
  const stats = learning.stats || EMPTY_STATS;

  const longreads = useMemo(
    () => materials.filter((m) => m.type === 'longread' && m.status === 'published'),
    [materials]
  );
  const tests = useMemo(
    () => materials.filter((m) => m.type === 'test' && m.status === 'published'),
    [materials]
  );
  const scorms = useMemo(
    () => materials.filter((m) => m.type === 'scorm' && m.status === 'published'),
    [materials]
  );
  const trainers = useMemo(
    () => materials.filter((m) => m.type === 'trainer' && m.status === 'published'),
    [materials]
  );

  const activeAssignments = useMemo(
    () => assignments.filter((a) => a.status !== 'completed' && a.status !== 'deleted'),
    [assignments]
  );
  const hotAssignments = useMemo(
    () => activeAssignments.filter((a) => a.status === 'overdue' || a.status === 'due-soon'),
    [activeAssignments]
  );

  const firstName = (user?.name || '').split(' ')[0] || 'друг';

  const openAssignment = (a: Assignment) => {
    if (a.materialType === 'course')         navigate('/course/' + a.materialId);
    else if (a.materialType === 'test')      navigate('/quiz/' + a.materialId);
    else if (a.materialType === 'longread')  navigate('/read/' + a.materialId);
    else if (a.materialType === 'scorm')     navigate('/scorm/' + a.materialId);
    else if (a.materialType === 'trainer')   navigate('/trainer/' + a.materialId);
    else alert('Тип «' + a.materialType + '» пока не поддерживается');
  };

  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="ld-main">
          <div className="ld-empty" style={{ padding: 80 }}>Загружаем кабинет…</div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="ld-main">
        <section className="ld-hero">
          <div className="ld-hero-content">
            {hotAssignments.length > 0 && (
              <div className="ld-hero-alert">
                <IconClock size={16} />{' '}
                <strong>{hotAssignments.length}</strong>{' '}
                {hotAssignments.length === 1
                  ? 'срочное назначение'
                  : hotAssignments.length < 5
                    ? 'срочных назначения'
                    : 'срочных назначений'}
              </div>
            )}
            <h1>Привет, {firstName}! 👋</h1>
            <p>
              {courses.length
                ? `У вас ${courses.filter((c) => c.started && !c.completed).length} курс(ов) в процессе и ${stats.completedCourses} завершено.`
                : 'Скоро здесь появятся ваши курсы.'}
            </p>
          </div>
          <div className="ld-hero-art">
            <svg width="120" height="120" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="9" fill="#4f46e5" />
              <path d="M11 11.5A1.5 1.5 0 0 1 13.2 10.2l7 4.5a1.5 1.5 0 0 1 0 2.6l-7 4.5A1.5 1.5 0 0 1 11 20.5v-9z" fill="#fff" />
            </svg>
          </div>
        </section>

        {activeAssignments.length > 0 && (
          <div className="ld-assignments-section">
            <div className="ld-section-head" style={{ marginTop: 0 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconLayers size={20} /> Мои назначения
              </h2>
              {hotAssignments.length > 0 && (
                <span className="assign-hot-badge">
                  <IconClock size={12} /> {hotAssignments.length} срочных
                </span>
              )}
            </div>

            <div className="my-assignments">
              {activeAssignments.map((a) => {
                const st = ASSIGN_STATUS[a.status] || ASSIGN_STATUS['new'];
                const isHot = a.status === 'overdue' || a.status === 'due-soon';
                const due = a.dueAt ? new Date(a.dueAt) : null;
                const overdue = due && due < new Date() && a.status !== 'completed';
                const dueText = due ? `до ${due.toLocaleDateString('ru')}` : '';

                return (
                  <div
                    key={a.id}
                    className={
                      'my-assignment-card status-' + a.status +
                      (isHot ? ' my-assignment-hot' : '')
                    }
                    onClick={() => openAssignment(a)}
                  >
                    {isHot && (
                      <div className="assign-hot-ribbon">
                        {a.status === 'overdue' ? 'ПРОСРОЧЕНО' : 'СРОЧНО'}
                      </div>
                    )}

                    <div className="my-assignment-head">
                      <div
                        className="my-assignment-icon"
                        style={{ background: st.bg, color: st.color }}
                      >
                        <AssignIcon kind={st.icon} size={20} />
                      </div>
                      <div className="my-assignment-body">
                        <div className="my-assignment-title">{a.materialTitle}</div>
                        <div className="my-assignment-meta">
                          <span className="assign-status-badge" style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                          {a.isMandatory && (
                            <span className="badge badge-danger" style={{ fontSize: 10 }}>
                              обязательно
                            </span>
                          )}
                          {dueText && (
                            <span
                              style={{
                                color: overdue ? 'var(--danger)' : 'var(--text-3)',
                                fontSize: 12,
                                fontWeight: overdue ? 600 : 400,
                              }}
                            >
                              {dueText}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {a.percent > 0 && (
                      <div className="ld-continue-progress">
                        <div style={{ width: a.percent + '%' }} />
                      </div>
                    )}

                    <div className="my-assignment-footer">
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {a.percent}% пройдено
                      </span>
                      <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>
                        Продолжить <IconArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="ld-stats">
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}><IconCheck size={22} /></div>
            <div className="ld-stat-value">{stats.completedCourses}</div>
            <div className="ld-stat-label">Курсов завершено</div>
            <div className="ld-stat-hint">из {stats.totalCourses}</div>
          </div>
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}><IconBook size={22} /></div>
            <div className="ld-stat-value">{stats.lessonsCompleted}</div>
            <div className="ld-stat-label">Уроков пройдено</div>
            <div className="ld-stat-hint">всего</div>
          </div>
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><IconLayers size={22} /></div>
            <div className="ld-stat-value">{stats.testsPassed}</div>
            <div className="ld-stat-label">Тестов сдано</div>
            <div className="ld-stat-hint">из {tests.length}</div>
          </div>
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#faf5ff', color: '#8b5cf6' }}><IconCheck size={22} /></div>
            <div className="ld-stat-value">{stats.avgScore}%</div>
            <div className="ld-stat-label">Ср. балл</div>
            <div className="ld-stat-hint">{stats.totalAttempts} попыток</div>
          </div>
        </div>

        {courses.length > 0 && (
          <>
            <div className="ld-section-head"><h2>Курсы</h2></div>
            <div className="ld-continue-grid">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="ld-continue-card"
                  onClick={() => navigate('/course/' + c.id)}
                >
                  <span className="ld-continue-badge">
                    <IconBook size={12} /> {c.completed ? 'Завершён' : c.started ? 'В процессе' : 'Курс'}
                  </span>
                  <h3>{c.title}</h3>
                  <p>{c.desc || 'Корпоративный курс'}</p>
                  <div className="ld-continue-progress"><div style={{ width: (c.percent || 0) + '%' }} /></div>
                  <div className="ld-continue-footer">
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {c.completedLessons}/{c.totalLessons} уроков
                    </span>
                    <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>
                      {c.percent || 0}% →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="ld-section-head"><h2>Тесты</h2></div>
        <div className="ld-cards">
          {tests.length ? tests.map((t) => {
            const prog = progress.byMaterial?.[t.id];
            return (
              <div
                key={t.id}
                className="ld-card"
                onClick={() => navigate('/quiz/' + t.id)}
              >
                <div className="ld-card-head">
                  <div className="ld-card-icon" style={{ background: '#10b981' }}><IconCheck size={22} /></div>
                  <div>
                    <h4>{t.title}</h4>
                    <span>{(t as { author?: string }).author || ''}</span>
                  </div>
                </div>
                <div className="ld-card-body">{t.desc || (t as { description?: string }).description || 'Проверьте знания'}</div>
                <div className="ld-card-status">
                  {prog
                    ? (prog.passed
                      ? <span className="passed"><IconCheck size={14} /> {prog.best}%</span>
                      : <span>Лучший: <span className="score">{prog.best}%</span></span>)
                    : <span style={{ color: 'var(--text-3)' }}>Не проходился</span>}
                  <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 12 }}>
                    {prog ? 'Снова' : 'Начать'} →
                  </span>
                </div>
              </div>
            );
          }) : <div className="ld-empty" style={{ gridColumn: '1/-1' }}>Пока нет тестов</div>}
        </div>

        {trainers.length > 0 && (
          <>
            <div className="ld-section-head"><h2>Тренажёры</h2></div>
            <div className="ld-cards">
              {trainers.map((t) => (
                <div
                  key={t.id}
                  className="ld-card"
                  onClick={() => navigate('/trainer/' + t.id)}
                >
                  <div className="ld-card-head">
                    <div className="ld-card-icon" style={{ background: '#f59e0b' }}><IconUsers size={22} /></div>
                    <div>
                      <h4>{t.title}</h4>
                      <span>{(t as { author?: string }).author || ''}</span>
                    </div>
                  </div>
                  <div className="ld-card-body">
                    {t.desc || (t as { description?: string }).description || 'Интерактивный кейс'}
                  </div>
                  <div className="ld-card-status">
                    <span style={{ color: 'var(--text-3)' }}>Тренажёр</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 12 }}>
                      Начать <IconArrowRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {scorms.length > 0 && (
          <>
            <div className="ld-section-head"><h2>SCORM-курсы</h2></div>
            <div className="ld-cards">
              {scorms.map((s) => (
                <div
                  key={s.id}
                  className="ld-card"
                  onClick={() => navigate('/scorm/' + s.id)}
                >
                  <div className="ld-card-head">
                    <div className="ld-card-icon" style={{ background: '#0d9488' }}><IconLayers size={22} /></div>
                    <div>
                      <h4>{s.title}</h4>
                      <span>{(s as { author?: string }).author || ''}</span>
                    </div>
                  </div>
                  <div className="ld-card-body">
                    {s.desc || (s as { description?: string }).description || 'Интерактивный курс'}
                  </div>
                  <div className="ld-card-status">
                    <span style={{ color: 'var(--text-3)' }}>SCORM</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 12 }}>
                      Открыть <IconArrowRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="ld-section-head"><h2>Лонгриды</h2></div>
        <div className="ld-cards">
          {longreads.length ? longreads.map((l) => (
            <div
              key={l.id}
              className="ld-card"
              onClick={() => navigate('/read/' + l.id)}
            >
              <div className="ld-card-head">
                <div className="ld-card-icon" style={{ background: '#ec4899' }}><IconEdit size={22} /></div>
                <div>
                  <h4>{l.title}</h4>
                  <span>{(l as { author?: string }).author || ''}</span>
                </div>
              </div>
              <div className="ld-card-body">{l.desc || (l as { description?: string }).description || 'Материал'}</div>
              <div className="ld-card-status">
                <span style={{ color: 'var(--text-3)' }}>Читать</span>
                <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 12 }}>
                  Открыть <IconArrowRight size={12} />
                </span>
              </div>
            </div>
          )) : <div className="ld-empty" style={{ gridColumn: '1/-1' }}>Пока нет лонгридов</div>}
        </div>

        <div className="ld-section-head"><h2>Последние результаты</h2></div>
        <div className="ld-activity">
          {progress.recent?.length ? progress.recent.map((r, i) => (
            <div className="ld-activity-row" key={i}>
              <div className={'ld-activity-mark ' + (r.passed ? 'ok' : 'no')}>
                {r.passed ? <IconCheck size={16} /> : <IconPlay size={16} />}
              </div>
              <div className="ld-activity-body">
                <h5>{r.materialTitle}</h5>
                <span>{fmtDate(r.createdAt)} · {r.passed ? 'зачёт' : 'незачёт'}</span>
              </div>
              <div
                className="ld-activity-score"
                style={{ color: r.passed ? 'var(--success)' : 'var(--danger)' }}
              >
                {r.score}%
              </div>
            </div>
          )) : <div className="ld-empty">Здесь появятся результаты</div>}
        </div>
      </main>
    </>
  );
}