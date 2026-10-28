import { useMemo, useState } from 'react';
import type {
  AdminAnalytics, Assignment, AssignmentStats, Material, User,
} from '../lib/api';
import { fmtDate } from '../lib/utils';
import {
  IconUsers, IconCheck, IconChart, IconAward, IconClock,
  IconClose, IconBook, IconPlay,
} from '../lib/icons';

/* ===== типы ===== */
type Period = 7 | 14 | 30;
type SubTab = 'overview' | 'engagement' | 'courses' | 'assignments' | 'employees';

/* ===== утилиты ===== */
const ASSIGN_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  overdue:       { label: 'Просрочено',  color: '#ef4444', bg: '#fef2f2' },
  'due-soon':    { label: 'Срок близко', color: '#f59e0b', bg: '#fffbeb' },
  'in-progress': { label: 'В процессе',  color: '#6366f1', bg: '#eef2ff' },
  new:           { label: 'Не начато',   color: '#64748b', bg: '#f1f5f9' },
  completed:     { label: 'Завершено',   color: '#10b981', bg: '#ecfdf5' },
  deleted:       { label: 'Удалён',      color: '#94a3b8', bg: '#f8fafc' },
};

function ProgressMini({ value }: { value: number }) {
  return (
    <div className="progress-mini">
      <div className="progress-bar-mini">
        <div style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <strong style={{ fontSize: 12 }}>{value}%</strong>
    </div>
  );
}

const CHART_HEIGHT = 140;
const MIN_VISIBLE_PX = 6;

function ActivityChart({
  data, period,
}: {
  data: { date: string; attempts: number; completions: number }[];
  period: Period;
}) {
  const sliced = data.slice(-period);

  if (sliced.length === 0) {
    return <div className="ld-empty">Нет данных за выбранный период</div>;
  }

  const totals = sliced.map((d) => d.attempts + d.completions);
  const max = Math.max(...totals, 1);
  const sumAll = totals.reduce((s, v) => s + v, 0);
  const hasAnyData = sumAll > 0;

  const periodNote = data.length < period
    ? `Доступно ${data.length} из ${period} дней`
    : null;

  const lastDate = sliced[sliced.length - 1].date;

  return (
    <>
      {periodNote && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
          {periodNote}
        </div>
      )}

      {!hasAnyData && (
        <div style={{
          padding: '16px 20px',
          background: '#f0f9ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          fontSize: 12,
          color: '#1e40af',
          marginBottom: 12,
        }}>
          За последние {period} дней нет ни попыток, ни завершений.
          {data.length > 0 && (
            <> Возможно, данные есть за более широкий период — попробуйте переключить фильтр выше.</>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        Всего за {period} дней: <strong style={{ color: 'var(--text)' }}>{sumAll}</strong>
        {' '}(попыток {sliced.reduce((s, d) => s + d.attempts, 0)}, завершений {sliced.reduce((s, d) => s + d.completions, 0)})
        {' · '}
        пик: <strong style={{ color: 'var(--text)' }}>{max}</strong>
      </div>

      <div className="stat-chart-bars" style={{ height: CHART_HEIGHT + 24 }}>
        {sliced.map((d) => {
          const total = d.attempts + d.completions;
          const heightPx = total === 0
            ? 2
            : Math.max(MIN_VISIBLE_PX, Math.round((total / max) * CHART_HEIGHT));

          const isLast = d.date === lastDate;
          const tooltip = `${d.date}\nпопыток: ${d.attempts}\nзавершений: ${d.completions}`;

          return (
            <div
              key={d.date}
              className="stat-chart-bar"
              title={tooltip}
              style={{ position: 'relative', justifyContent: 'flex-end' }}
            >
              {total > 0 && (
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: isLast ? '#4f46e5' : 'var(--text-2)',
                  marginBottom: 2,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}>
                  {total}
                </div>
              )}

              <div
                style={{
                  width: '100%',
                  height: heightPx + 'px',
                  background: isLast
                    ? 'linear-gradient(180deg, #4f46e5, #8b5cf6)'
                    : 'linear-gradient(180deg, #a5b4fc, #c4b5fd)',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height .3s ease',
                }}
              />

              <div
                className="stat-chart-label"
                style={{ fontWeight: isLast ? 700 : 400, color: isLast ? '#4f46e5' : undefined }}
              >
                {d.date.slice(5)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ===== контейнер ===== */
interface AdminDashboardsProps {
  analytics: AdminAnalytics | null;
  assignments: Assignment[];
  assignmentStats: AssignmentStats | null;
  materials: Material[];
  users: User[];
}

export function AdminDashboards({
  analytics, assignments, assignmentStats, materials, users,
}: AdminDashboardsProps) {
  const [sub, setSub] = useState<SubTab>('overview');
  const [period, setPeriod] = useState<Period>(14);

  const subTabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Обзор', icon: <IconChart size={16} /> },
    { id: 'engagement', label: 'Вовлеченность', icon: <IconUsers size={16} /> },
    { id: 'courses', label: 'Курсы', icon: <IconBook size={16} /> },
    { id: 'assignments', label: 'Назначения', icon: <IconAward size={16} /> },
    { id: 'employees', label: 'Сотрудники', icon: <IconUsers size={16} /> },
  ];

  const periodOptions: { value: Period; label: string }[] = [
    { value: 7, label: '7 дней' },
    { value: 14, label: '14 дней' },
    { value: 30, label: '30 дней' },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div className="assign-filters" style={{ marginBottom: 0 }}>
          {subTabs.map((t) => (
            <button
              key={t.id}
              className={`assign-filter ${sub === t.id ? 'active' : ''}`}
              onClick={() => setSub(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 2 }}>Период:</span>
          {periodOptions.map((p) => (
            <button
              key={p.value}
              className={`assign-filter ${period === p.value ? 'active' : ''}`}
              onClick={() => setPeriod(p.value)}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {sub === 'overview' && (
        <OverviewDashboard analytics={analytics} assignments={assignments} period={period} />
      )}
      {sub === 'engagement' && (
        <EngagementDashboard analytics={analytics} period={period} />
      )}
      {sub === 'courses' && (
        <CoursesDashboard analytics={analytics} />
      )}
      {sub === 'assignments' && (
        <AssignmentsDashboard assignments={assignments} stats={assignmentStats} />
      )}
      {sub === 'employees' && (
        <EmployeesDashboard analytics={analytics} users={users} period={period} />
      )}
    </div>
  );
}

/* ===== 1. Обзор ===== */
function OverviewDashboard({
  analytics, assignments, period,
}: { analytics: AdminAnalytics | null; assignments: Assignment[]; period: Period }) {
  if (!analytics) return <div className="ld-empty">Аналитика недоступна</div>;
  const a = analytics;

  const sliced = useMemo(() => a.activityByDay.slice(-period), [a.activityByDay, period]);
  const periodAttempts = sliced.reduce((s, d) => s + d.attempts, 0);
  const periodCompletions = sliced.reduce((s, d) => s + d.completions, 0);

  return (
    <>
      <div className="ld-stats">
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}><IconUsers size={22} /></div>
          <div className="ld-stat-value">{a.stats.employees}</div>
          <div className="ld-stat-label">Сотрудников</div>
          <div className="ld-stat-hint">{a.stats.active} активных</div>
        </div>
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}><IconCheck size={22} /></div>
          <div className="ld-stat-value">{periodCompletions}</div>
          <div className="ld-stat-label">Завершений за {period} дн.</div>
          <div className="ld-stat-hint">всего: {a.stats.completedAny}</div>
        </div>
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><IconPlay size={22} /></div>
          <div className="ld-stat-value">{periodAttempts}</div>
          <div className="ld-stat-label">Попыток за {period} дн.</div>
          <div className="ld-stat-hint">всего: {a.stats.totalAttempts}</div>
        </div>
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#faf5ff', color: '#8b5cf6' }}><IconAward size={22} /></div>
          <div className="ld-stat-value">{a.stats.avgProgress}%</div>
          <div className="ld-stat-label">Ср. прогресс</div>
          <div className="ld-stat-hint">ср. балл {a.stats.avgScore}%</div>
        </div>
      </div>

      {a.stats.assignments && a.stats.assignments.total > 0 && (
        <div className="ad-panel" style={{ marginBottom: 24 }}>
          <div className="ad-panel-head"><h3><IconAward size={16} /> Назначения</h3></div>
          <div className="ad-panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              <div><div style={{ fontSize: 24, fontWeight: 800 }}>{a.stats.assignments.total}</div><div style={{ fontSize: 12, color: 'var(--text-3)' }}>всего</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>{a.stats.assignments.completed}</div><div style={{ fontSize: 12, color: 'var(--text-3)' }}>завершено</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--danger)' }}>{a.stats.assignments.overdue}</div><div style={{ fontSize: 12, color: 'var(--text-3)' }}>просрочено</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--warning)' }}>{a.stats.assignments.dueSoon}</div><div style={{ fontSize: 12, color: 'var(--text-3)' }}>срок близко</div></div>
            </div>
          </div>
        </div>
      )}

      <div className="ad-panel" style={{ marginBottom: 24 }}>
        <div className="ad-panel-head"><h3>Активность за {period} дней</h3></div>
        <div className="ad-panel-body"><ActivityChart data={a.activityByDay} period={period} /></div>
      </div>

      <div className="ad-panel">
        <div className="ad-panel-head"><h3>Последние попытки</h3></div>
        <div className="ad-panel-body" style={{ padding: '10px 22px' }}>
          {a.recentAttempts.length === 0 ? (
            <div className="ld-empty">Пока нет попыток</div>
          ) : (
            a.recentAttempts.slice(0, 5).map((r, i) => (
              <div key={i} className="ad-user-row">
                <div className={`ld-activity-mark ${r.passed ? 'ok' : 'no'}`} style={{ width: 28, height: 28 }}>
                  {r.passed ? <IconCheck size={14} /> : <IconClose size={14} />}
                </div>
                <div className="info">
                  <h5>{r.userName}</h5>
                  <span>{r.materialTitle} · {fmtDate(r.createdAt)}</span>
                </div>
                <strong style={{ fontSize: 13, color: r.passed ? 'var(--success)' : 'var(--danger)' }}>
                  {r.score}%
                </strong>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

/* ===== 2. Вовлеченность ===== */
function EngagementDashboard({
  analytics, period,
}: { analytics: AdminAnalytics | null; period: Period }) {
  if (!analytics) return <div className="ld-empty">Аналитика недоступна</div>;
  const a = analytics;

  const sliced = a.activityByDay.slice(-period);
  const periodAttempts = sliced.reduce((s, d) => s + d.attempts, 0);
  const periodCompletions = sliced.reduce((s, d) => s + d.completions, 0);
  const activeDays = sliced.filter((d) => d.attempts + d.completions > 0).length;
  const dailyAvg = sliced.length
    ? Math.round((periodAttempts + periodCompletions) / sliced.length * 10) / 10
    : 0;

  return (
    <>
      <div className="ld-stats">
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}><IconUsers size={22} /></div>
          <div className="ld-stat-value">{a.stats.active}</div>
          <div className="ld-stat-label">Активных пользователей</div>
          <div className="ld-stat-hint">из {a.stats.employees}</div>
        </div>
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}><IconClock size={22} /></div>
          <div className="ld-stat-value">{activeDays}</div>
          <div className="ld-stat-label">Активных дней</div>
          <div className="ld-stat-hint">из {sliced.length}</div>
        </div>
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><IconPlay size={22} /></div>
          <div className="ld-stat-value">{periodAttempts}</div>
          <div className="ld-stat-label">Попыток за {period} дн.</div>
          <div className="ld-stat-hint">{dailyAvg} в день</div>
        </div>
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#faf5ff', color: '#8b5cf6' }}><IconCheck size={22} /></div>
          <div className="ld-stat-value">{periodCompletions}</div>
          <div className="ld-stat-label">Завершений за {period} дн.</div>
          <div className="ld-stat-hint">ср. балл {a.stats.avgScore}%</div>
        </div>
      </div>

      <div className="ad-panel">
        <div className="ad-panel-head"><h3>Активность по дням ({period} дн.)</h3></div>
        <div className="ad-panel-body"><ActivityChart data={a.activityByDay} period={period} /></div>
      </div>
    </>
  );
}

/* ===== 3. Курсы ===== */
function CoursesDashboard({ analytics }: { analytics: AdminAnalytics | null }) {
  if (!analytics) return <div className="ld-empty">Аналитика недоступна</div>;
  const a = analytics;

  return (
    <div className="ad-panel">
      <div className="ad-panel-head"><h3>Прогресс по курсам</h3></div>
      <div className="ad-panel-body" style={{ padding: 0 }}>
        {a.courses.length === 0 ? (
          <div className="ld-empty">Курсов пока нет</div>
        ) : (
          <table className="mat-table">
            <thead>
              <tr><th>Курс</th><th>Уроков</th><th>Начали</th><th>Завершили</th><th>Ср. прогресс</th></tr>
            </thead>
            <tbody>
              {a.courses.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="mat-title">
                      <div className="mat-icon" style={{ background: '#6366f1' }}><IconBook size={18} /></div>
                      <div className="t-name">{c.title}</div>
                    </div>
                  </td>
                  <td>{c.totalLessons}</td>
                  <td>{c.started}</td>
                  <td>{c.completed}</td>
                  <td><ProgressMini value={c.avgPercent} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ===== 4. Назначения ===== */
function AssignmentsDashboard({
  assignments, stats,
}: { assignments: Assignment[]; stats: AssignmentStats | null }) {
  return (
    <>
      {stats && (
        <div className="ld-stats">
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}><IconAward size={22} /></div>
            <div className="ld-stat-value">{stats.total}</div>
            <div className="ld-stat-label">Всего назначений</div>
          </div>
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}><IconCheck size={22} /></div>
            <div className="ld-stat-value">{stats.completed}</div>
            <div className="ld-stat-label">Завершено</div>
          </div>
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}><IconClose size={22} /></div>
            <div className="ld-stat-value">{stats.overdue}</div>
            <div className="ld-stat-label">Просрочено</div>
          </div>
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><IconClock size={22} /></div>
            <div className="ld-stat-value">{stats.dueSoon}</div>
            <div className="ld-stat-label">Срок близко</div>
          </div>
        </div>
      )}

      <div className="ad-panel">
        <div className="ad-panel-head"><h3>Последние назначения</h3></div>
        <div className="ad-panel-body" style={{ padding: 0 }}>
          {assignments.length === 0 ? (
            <div className="ld-empty">Назначений пока нет</div>
          ) : (
            <table className="mat-table">
              <thead>
                <tr><th>Сотрудник</th><th>Материал</th><th>Статус</th><th>Дедлайн</th><th>Прогресс</th></tr>
              </thead>
              <tbody>
                {assignments.slice(0, 10).map((a) => {
                  const st = ASSIGN_STATUS[a.status] || ASSIGN_STATUS.new;
                  const due = a.dueAt ? new Date(a.dueAt).toLocaleDateString('ru') : '—';
                  return (
                    <tr key={a.id}>
                      <td>{a.userName}</td>
                      <td>{a.materialTitle}</td>
                      <td>
                        <span className="assign-status-badge" style={{ background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                      <td>{due}</td>
                      <td><ProgressMini value={a.percent} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ===== 5. Сотрудники ===== */
function EmployeesDashboard({
  analytics, users, period,
}: { analytics: AdminAnalytics | null; users: User[]; period: Period }) {
  if (!analytics) return <div className="ld-empty">Аналитика недоступна</div>;
  const a = analytics;

  const periodCompletions = a.activityByDay
    .slice(-period)
    .reduce((s, d) => s + d.completions, 0);

  return (
    <>
      <div className="ld-stats">
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}><IconUsers size={22} /></div>
          <div className="ld-stat-value">{a.stats.employees}</div>
          <div className="ld-stat-label">Всего сотрудников</div>
          <div className="ld-stat-hint">{a.stats.active} активных</div>
        </div>
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}><IconCheck size={22} /></div>
          <div className="ld-stat-value">{periodCompletions}</div>
          <div className="ld-stat-label">Завершений за {period} дн.</div>
        </div>
        <div className="ld-stat">
          <div className="ld-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><IconAward size={22} /></div>
          <div className="ld-stat-value">{a.stats.avgScore}%</div>
          <div className="ld-stat-label">Ср. балл</div>
        </div>
      </div>

      <div className="ad-grid">
        <div className="ad-panel">
          <div className="ad-panel-head"><h3>Топ сотрудников</h3></div>
          <div className="ad-panel-body" style={{ padding: '10px 22px' }}>
            {a.topEmployees.length === 0 ? (
              <div className="ld-empty">Пока нет активности</div>
            ) : (
              a.topEmployees.map((e, i) => (
                <div key={e.id} className="ad-user-row">
                  <div
                    className="avatar"
                    style={{
                      width: 32, height: 32, fontSize: 12,
                      background: i < 3 ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : undefined,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="info">
                    <h5>{e.name}</h5>
                    <span>{e.lessons} уроков · {e.coursesCompleted} курс(ов)</span>
                  </div>
                  <strong style={{ fontSize: 13, color: 'var(--primary)' }}>{e.avgScore}%</strong>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="ad-panel">
          <div className="ad-panel-head"><h3>Последние попытки</h3></div>
          <div className="ad-panel-body" style={{ padding: '10px 22px' }}>
            {a.recentAttempts.length === 0 ? (
              <div className="ld-empty">Пока нет попыток</div>
            ) : (
              a.recentAttempts.slice(0, 5).map((r, i) => (
                <div key={i} className="ad-user-row">
                  <div className={`ld-activity-mark ${r.passed ? 'ok' : 'no'}`} style={{ width: 28, height: 28 }}>
                    {r.passed ? <IconCheck size={14} /> : <IconClose size={14} />}
                  </div>
                  <div className="info">
                    <h5>{r.userName}</h5>
                    <span>{r.materialTitle} · {fmtDate(r.createdAt)}</span>
                  </div>
                  <strong style={{ fontSize: 13, color: r.passed ? 'var(--success)' : 'var(--danger)' }}>
                    {r.score}%
                  </strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}