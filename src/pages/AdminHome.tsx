import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useToast, getInitials, fmtDate } from '../lib/utils';
import {
  getMaterials, getAllUsers, getAllAssignments, getAssignmentStats, getCompanyAnalytics,
  deleteMaterial, cancelAssignment,
  type Material, type User, type Assignment, type AdminAnalytics, type AssignmentStats,
  type MaterialType, type AssignmentStatus, type Role,
} from '../lib/api';
import {
  IconHome, IconLayers, IconAward, IconUsers, IconPlus, IconTrash, IconList,
  IconUserPlus, IconBook, IconCheck, IconEdit, IconLayers as IconScorm,
  IconClose, IconClock, IconChart, IconArrowRight, IconUser, IconPlay, LOGO,
} from '../lib/icons';
import { CreateMaterialModal } from '../components/CreateMaterialModal';
import { CreateUserModal } from '../components/CreateUserModal';
import { ImportUsersModal } from '../components/ImportUsersModal';
import { ScormUpload } from '../components/ScormUpload';
import { AdminDashboards } from '../components/AdminDashboards';
import { AssignMaterialModal } from '../components/AssignMaterialModal';
import { AttemptsModal } from '../components/AttemptsModal';

/* ===== мэппинги ===== */
const TYPE_LABELS: Record<MaterialType, string> = {
  course: 'Курс', test: 'Тест', trainer: 'Тренажёр', screencast: 'Скринкаст',
  flipbook: 'Flipbook', longread: 'Лонгрид', scorm: 'SCORM',
};
const TYPE_COLORS: Record<MaterialType, string> = {
  course: '#6366f1', test: '#10b981', trainer: '#f59e0b', screencast: '#ef4444',
  flipbook: '#8b5cf6', longread: '#ec4899', scorm: '#0d9488',
};
const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Супер-админ', admin: 'Администратор', learner: 'Учащийся',
};
const ASSIGN_STATUS: Record<AssignmentStatus, { label: string; color: string; bg: string }> = {
  overdue:       { label: 'Просрочено',  color: '#ef4444', bg: '#fef2f2' },
  'due-soon':    { label: 'Срок близко', color: '#f59e0b', bg: '#fffbeb' },
  'in-progress': { label: 'В процессе',  color: '#6366f1', bg: '#eef2ff' },
  new:           { label: 'Не начато',   color: '#64748b', bg: '#f1f5f9' },
  completed:     { label: 'Завершено',   color: '#10b981', bg: '#ecfdf5' },
  deleted:       { label: 'Удалён',      color: '#94a3b8', bg: '#f8fafc' },
};

type Tab = 'dashboard' | 'materials' | 'assignments' | 'users';

function iconForType(type: MaterialType) {
  switch (type) {
    case 'course':   return <IconBook size={18} />;
    case 'test':     return <IconCheck size={18} />;
    case 'longread': return <IconEdit size={18} />;
    case 'scorm':    return <IconScorm size={18} />;
    case 'trainer':  return <IconUsers size={18} />;
    case 'screencast': return <IconPlay size={18} />;
    case 'flipbook': return <IconBook size={18} />;
    default:         return <IconBook size={18} />;
  }
}

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

function Avatar({ name, avatarUrl, role, size = 32 }: {
  name: string; avatarUrl?: string | null; role?: Role; size?: number;
}) {
  if (avatarUrl) {
    return (
      <div className="avatar avatar-img" style={{ width: size, height: size }}>
        <img src={avatarUrl} alt="" />
      </div>
    );
  }
  const fontSize = size > 40 ? Math.round(size * 0.32) : Math.round(size * 0.38);
  return (
    <div className={`avatar ${role === 'superadmin' ? 'super' : ''}`} style={{ width: size, height: size, fontSize }}>
      {getInitials(name)}
    </div>
  );
}

/* ===== Главный компонент ===== */
export function AdminHome() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('dashboard');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStats | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignFilter, setAssignFilter] = useState<'all' | AssignmentStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [importUsersOpen, setImportUsersOpen] = useState(false);
  const [assignModal, setAssignModal] = useState<{ id: string; title: string } | null>(null);
  const [attemptsModal, setAttemptsModal] = useState<{ id: string; title: string } | null>(null);

  const reloadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [m, u, a, s, an] = await Promise.all([
        getMaterials(),
        getAllUsers(),
        getAllAssignments(),
        getAssignmentStats(),
        getCompanyAnalytics(),
      ]);
      setMaterials(m.materials);
      setUsers(u.users);
      setAssignments(a.assignments);
      setAssignmentStats(s);
      setAnalytics(an);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return null;
  if (user.role === 'learner') return <Navigate to="/learner" replace />;
  if (user.role === 'superadmin') return <Navigate to="/superadmin" replace />;

  const onDeleteMaterial = async (m: Material) => {
    if (!confirm(`Удалить материал «${m.title}»? Действие нельзя отменить.`)) return;
    try {
      await deleteMaterial(m.id);
      toast('Материал удалён');
      await reloadAll();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const onCancelAssignment = async (a: Assignment) => {
    const who = a.userName || 'сотрудника';
    if (!confirm(`Отменить назначение «${a.materialTitle}» для ${who}?`)) return;
    try {
      await cancelAssignment(a.id);
      toast('Назначение отменено');
      await reloadAll();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const onOpenMaterial = (m: Material) => {
    if (m.type === 'longread') navigate('/editor/' + m.id);
    else if (m.type === 'course') navigate('/course-editor/' + m.id);
    else if (m.type === 'test') navigate('/quiz-editor/' + m.id);
    else if (m.type === 'trainer') navigate('/trainer-editor/' + m.id);
    else toast('Редактор для этого типа пока не поддерживается', 'error');
  };

  const onPreview = (m: Material) => {
    const path =
      m.type === 'longread' ? '/read/' :
      m.type === 'test' ? '/quiz/' :
      m.type === 'course' ? '/course/' :
      m.type === 'scorm' ? '/scorm/' :
      m.type === 'trainer' ? '/trainer/' : null;
    if (!path) {
      toast('Предпросмотр для этого типа пока не поддерживается', 'error');
      return;
    }
    navigate(path + m.id + '?preview=1');
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="logo"><LOGO /><span>LearnFlow</span></div>
        <nav className="admin-nav">
          <button className={`admin-nav-item ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
            <IconHome /><span>Дашборд</span>
          </button>
          <button className={`admin-nav-item ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>
            <IconLayers /><span>Материалы</span>
          </button>
          <button className={`admin-nav-item ${tab === 'assignments' ? 'active' : ''}`} onClick={() => setTab('assignments')}>
            <IconAward /><span>Назначения</span>
          </button>
          <button className={`admin-nav-item ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            <IconUsers /><span>Сотрудники</span>
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <Avatar name={user.name} avatarUrl={user.avatarUrl} role={user.role} size={34} />
            <div>
              <div className="u-name">{user.name}</div>
              <div className="u-role">Администратор</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginTop: 8, justifyContent: 'flex-start' }}
            onClick={() => { logout(); window.location.href = '/login'; }}
          >
            <IconUser /> Выйти
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h1>
            {tab === 'dashboard' && 'Дашборд'}
            {tab === 'materials' && 'Материалы'}
            {tab === 'assignments' && 'Назначения'}
            {tab === 'users' && 'Сотрудники'}
          </h1>
          <div className="top-actions">
            {tab === 'materials' && (
              <>
                <ScormUpload onUploaded={() => { void reloadAll(); }} />
                <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                  <IconPlus size={18} /> Создать материал
                </button>
              </>
            )}
            {tab === 'users' && (
              <>
                <button className="btn btn-outline" onClick={() => setImportUsersOpen(true)}>
                  <IconPlus size={18} /> Импорт CSV
                </button>
                <button className="btn btn-primary" onClick={() => setCreateUserOpen(true)}>
                  <IconPlus size={18} /> Добавить сотрудника
                </button>
              </>
            )}
          </div>
        </header>

        <div className="admin-content">
          {loading && <div className="ld-empty" style={{ padding: 40 }}>Загружаем данные…</div>}
          {error && !loading && <div className="auth-error" style={{ marginBottom: 20 }}>{error}</div>}

          {!loading && !error && (
            <>
              {tab === 'dashboard' && (
                <AdminDashboards
                  analytics={analytics}
                  assignments={assignments}
                  assignmentStats={assignmentStats}
                  materials={materials}
                  users={users}
                />
              )}
              {tab === 'materials' && (
                <MaterialsTab
                  materials={materials}
                  onDelete={onDeleteMaterial}
                  onAssign={(m) => setAssignModal({ id: m.id, title: m.title })}
                  onOpen={onOpenMaterial}
                  onAttempts={(m) => setAttemptsModal({ id: m.id, title: m.title })}
                  onPreview={onPreview}
                />
              )}
              {tab === 'assignments' && (
                <AssignmentsTab
                  assignments={assignments}
                  stats={assignmentStats}
                  filter={assignFilter}
                  setFilter={setAssignFilter}
                  onCancel={onCancelAssignment}
                />
              )}
              {tab === 'users' && <UsersTab users={users} />}
            </>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateMaterialModal
          onClose={() => setCreateOpen(false)}
          onCreated={(m) => {
            setCreateOpen(false);
            toast(`Материал «${m.title}» создан`);
            reloadAll();
          }}
        />
      )}

      {createUserOpen && (
        <CreateUserModal
          onClose={() => setCreateUserOpen(false)}
          onCreated={(name) => {
            setCreateUserOpen(false);
            toast(`Сотрудник «${name}» создан`);
            reloadAll();
          }}
        />
      )}

      {importUsersOpen && (
        <ImportUsersModal
          allowCompanySelect={false}
          allowAdminRole={false}
          onClose={() => setImportUsersOpen(false)}
          onImported={() => { reloadAll(); }}
        />
      )}

      {assignModal && (
        <AssignMaterialModal
          material={assignModal}
          users={users}
          onClose={() => setAssignModal(null)}
          onAssigned={async (count) => {
            setAssignModal(null);
            toast(`Назначено ${count} сотрудник(ам)`);
            await reloadAll();
          }}
        />
      )}

      {attemptsModal && (
        <AttemptsModal
          material={attemptsModal}
          onClose={() => setAttemptsModal(null)}
        />
      )}
    </div>
  );
}

/* ================== Materials ================== */
function MaterialsTab({ materials, onDelete, onAssign, onOpen, onAttempts, onPreview }: {
  materials: Material[];
  onDelete: (m: Material) => void;
  onAssign: (m: Material) => void;
  onOpen: (m: Material) => void;
  onAttempts: (m: Material) => void;
  onPreview: (m: Material) => void;
}) {
  if (materials.length === 0) {
    return (
      <div className="panel">
        <div className="empty-state">
          <IconLayers size={48} />
          <div>Материалов пока нет. Создайте первый!</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <table className="mat-table">
        <thead>
          <tr>
            <th>Название</th><th>Тип</th><th>Статус</th><th>Автор</th><th>Обновлён</th><th></th>
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => (
            <tr key={m.id}>
              <td>
                <div className="mat-title">
                  <div className="mat-icon" style={{ background: TYPE_COLORS[m.type] || '#6366f1' }}>
                    {iconForType(m.type)}
                  </div>
                  <div>
                    <div className="t-name">{m.title}</div>
                    <div className="t-desc">{m.desc}</div>
                  </div>
                </div>
              </td>
              <td>{TYPE_LABELS[m.type] || m.type}</td>
              <td>
                {m.status === 'published'
                  ? <span className="badge badge-success">● Опубликован</span>
                  : <span className="badge badge-warning">● Черновик</span>}
              </td>
              <td>{m.author}</td>
              <td>{m.updated}</td>
              <td>
                <div className="row-actions">
                  <button className="row-action" title="Предпросмотр" onClick={() => onPreview(m)}>
                    <IconPlay size={16} />
                  </button>

                  {m.status === 'published' && ['course', 'test', 'longread', 'scorm', 'trainer'].includes(m.type) && (
                    <button className="row-action" title="Назначить" onClick={() => onAssign(m)}>
                      <IconUserPlus size={16} />
                    </button>
                  )}

                  {m.type === 'test' && (
                    <button className="row-action" title="Результаты" onClick={() => onAttempts(m)}>
                      <IconList size={16} />
                    </button>
                  )}

                  {['longread', 'course', 'test', 'trainer'].includes(m.type) && (
                    <button className="row-action" title="Редактировать" onClick={() => onOpen(m)}>
                      <IconEdit size={16} />
                    </button>
                  )}

                  <button className="row-action danger" title="Удалить" onClick={() => onDelete(m)}>
                    <IconTrash size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================== Assignments ================== */
function AssignmentsTab({ assignments, stats, filter, setFilter, onCancel }: {
  assignments: Assignment[];
  stats: AssignmentStats | null;
  filter: 'all' | AssignmentStatus;
  setFilter: (f: 'all' | AssignmentStatus) => void;
  onCancel: (a: Assignment) => void;
}) {
  const filtered = filter === 'all' ? assignments : assignments.filter((a) => a.status === filter);
  const counts = {
    all: assignments.length,
    overdue: assignments.filter((a) => a.status === 'overdue').length,
    'due-soon': assignments.filter((a) => a.status === 'due-soon').length,
    'in-progress': assignments.filter((a) => a.status === 'in-progress').length,
    new: assignments.filter((a) => a.status === 'new').length,
    completed: assignments.filter((a) => a.status === 'completed').length,
    deleted: 0,
  };

  return (
    <>
      {stats && (
        <div className="ld-stats">
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
              <IconAward size={22} />
            </div>
            <div className="ld-stat-value">{stats.total}</div>
            <div className="ld-stat-label">Всего назначений</div>
          </div>
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
              <IconCheck size={22} />
            </div>
            <div className="ld-stat-value">{stats.completed}</div>
            <div className="ld-stat-label">Завершено</div>
          </div>
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
              <IconClose size={22} />
            </div>
            <div className="ld-stat-value">{stats.overdue}</div>
            <div className="ld-stat-label">Просрочено</div>
          </div>
          <div className="ld-stat">
            <div className="ld-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
              <IconClock size={22} />
            </div>
            <div className="ld-stat-value">{stats.dueSoon}</div>
            <div className="ld-stat-label">Срок близко</div>
          </div>
        </div>
      )}

      <div className="assign-filters">
        {([
          ['all', 'Все', counts.all],
          ['overdue', 'Просрочено', counts.overdue],
          ['due-soon', 'Срок близко', counts['due-soon']],
          ['in-progress', 'В процессе', counts['in-progress']],
          ['new', 'Не начато', counts.new],
          ['completed', 'Завершено', counts.completed],
        ] as Array<[string, string, number]>).map(([key, label, n]) => (
          <button
            key={key}
            className={`assign-filter ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key as 'all' | AssignmentStatus)}
          >
            {label} <span className="cnt">{n}</span>
          </button>
        ))}
      </div>

      <div className="panel">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <IconAward size={48} />
            <div>{filter === 'all' ? 'Назначений пока нет' : 'Нет назначений с этим статусом'}</div>
          </div>
        ) : (
          <table className="mat-table">
            <thead>
              <tr>
                <th>Сотрудник</th><th>Материал</th><th>Статус</th><th>Дедлайн</th><th>Прогресс</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const st = ASSIGN_STATUS[a.status];
                const due = a.dueAt ? new Date(a.dueAt).toLocaleDateString('ru') : '—';
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="mat-title">
                        <Avatar name={a.userName || 'Сотрудник'} size={32} />
                        <div>
                          <div className="t-name">{a.userName || 'Сотрудник'}</div>
                          <div className="t-desc">{a.userEmail || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="mat-title">
                        <div className="mat-icon" style={{ background: TYPE_COLORS[a.materialType] || '#6366f1', width: 32, height: 32 }}>
                          {iconForType(a.materialType)}
                        </div>
                        <div className="t-name">{a.materialTitle}</div>
                      </div>
                    </td>
                    <td>
                      <span className="assign-status-badge" style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                      {a.isMandatory && (
                        <span className="badge badge-danger" style={{ fontSize: 10, marginLeft: 6 }}>
                          обязательно
                        </span>
                      )}
                    </td>
                    <td>
                      {due}
                      {a.dueAt && a.status === 'overdue' && (
                        <><br /><span style={{ fontSize: 11, color: 'var(--danger)' }}>просрочено</span></>
                      )}
                    </td>
                    <td><ProgressMini value={a.percent} /></td>
                    <td>
                      <button className="row-action danger" title="Отменить назначение" onClick={() => onCancel(a)}>
                        <IconClose size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ================== Users ================== */
function UsersTab({ users }: { users: User[] }) {
  if (users.length === 0) {
    return (
      <div className="panel">
        <div className="empty-state">
          <IconUsers size={48} />
          <div>Нет сотрудников. Нажмите «Добавить сотрудника» или «Импорт CSV»</div>
        </div>
      </div>
    );
  }
  return (
    <div className="panel">
      <table className="mat-table">
        <thead>
          <tr><th>Сотрудник</th><th>Email</th><th>Роль</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div className="mat-title">
                  <Avatar name={u.name} avatarUrl={u.avatarUrl} role={u.role} size={36} />
                  <div className="t-name">{u.name}</div>
                </div>
              </td>
              <td>{u.email}</td>
              <td><span className="badge badge-muted">{ROLE_LABELS[u.role] || u.role}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}