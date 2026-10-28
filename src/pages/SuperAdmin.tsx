import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useToast, getInitials } from '../lib/utils';
import { getAllUsers, getMaterials, type User, type Material } from '../lib/api';
import {
  getAllCompanies, deleteCompany, deleteUser, getGlobalAnalytics,
  type Company, type GlobalAnalytics,
} from '../lib/api-admin';
import { CreateCompanyModal } from '../components/CreateCompanyModal';
import { CreateUserModal } from '../components/CreateUserModal';
import { ImportUsersModal } from '../components/ImportUsersModal';
import {
  IconHome, IconBuilding, IconUsers, IconLayers, IconPlus,
  IconTrash, IconCheck, IconClose, IconChart, IconUser, LOGO,
} from '../lib/icons';

type Tab = 'dashboard' | 'companies' | 'users' | 'materials';

function Avatar({ name, role, size = 32 }: { name: string; role?: string; size?: number }) {
  const fontSize = size > 40 ? Math.round(size * 0.32) : Math.round(size * 0.38);
  return (
    <div
      className={`avatar ${role === 'superadmin' ? 'super' : ''}`}
      style={{ width: size, height: size, fontSize }}
    >
      {getInitials(name)}
    </div>
  );
}

export function SuperAdmin() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('dashboard');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [analytics, setAnalytics] = useState<GlobalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [importUsersOpen, setImportUsersOpen] = useState(false);
  const [usersCompanyFilter, setUsersCompanyFilter] = useState<string>('all');

  const reloadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [c, u, m, an] = await Promise.all([
        getAllCompanies(),
        getAllUsers(),
        getMaterials(),
        getGlobalAnalytics(),
      ]);
      setCompanies(c);
      setUsers(u.users);
      setMaterials(m.materials);
      setAnalytics(an);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'superadmin') return;
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return null;
  if (user.role !== 'superadmin') return <Navigate to="/" replace />;

  const onDeleteCompany = async (c: Company) => {
    if (!confirm(`Удалить компанию «${c.name}»? Все её пользователи и материалы тоже будут удалены.`)) return;
    try {
      await deleteCompany(c.id);
      toast('Компания удалена');
      await reloadAll();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const onDeleteUser = async (u: User) => {
    if (u.role === 'superadmin') return;
    if (!confirm(`Удалить пользователя «${u.name}»?`)) return;
    try {
      await deleteUser(u.id);
      toast('Пользователь удалён');
      await reloadAll();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const filteredUsers = usersCompanyFilter === 'all'
    ? users
    : users.filter((u) => (u as { companyId?: string }).companyId === usersCompanyFilter);

  const companyById = Object.fromEntries(companies.map((c) => [c.id, c]));

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="logo"><LOGO /><span>LearnFlow</span></div>
        <nav className="admin-nav">
          <button className={`admin-nav-item ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
            <IconHome /><span>Дашборд</span>
          </button>
          <button className={`admin-nav-item ${tab === 'companies' ? 'active' : ''}`} onClick={() => setTab('companies')}>
            <IconBuilding /><span>Компании</span>
          </button>
          <button className={`admin-nav-item ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            <IconUsers /><span>Пользователи</span>
          </button>
          <button className={`admin-nav-item ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>
            <IconLayers /><span>Материалы</span>
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <Avatar name={user.name} role={user.role} size={34} />
            <div>
              <div className="u-name">{user.name}</div>
              <div className="u-role">Супер-админ</div>
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
            {tab === 'dashboard' && 'Глобальный дашборд'}
            {tab === 'companies' && 'Компании'}
            {tab === 'users' && 'Все пользователи'}
            {tab === 'materials' && 'Все материалы'}
          </h1>
          <div className="top-actions">
            {tab === 'companies' && (
              <button className="btn btn-primary" onClick={() => setCreateCompanyOpen(true)}>
                <IconPlus size={18} /> Новая компания
              </button>
            )}
            {tab === 'users' && (
              <>
                <button
                  className="btn btn-outline"
                  onClick={() => setImportUsersOpen(true)}
                  disabled={companies.length === 0}
                  title={companies.length === 0 ? 'Сначала создайте компанию' : ''}
                >
                  <IconPlus size={18} /> Импорт CSV
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setCreateUserOpen(true)}
                  disabled={companies.length === 0}
                  title={companies.length === 0 ? 'Сначала создайте компанию' : ''}
                >
                  <IconPlus size={18} /> Добавить пользователя
                </button>
              </>
            )}
          </div>
        </header>

        <div className="admin-content">
          {loading && <div className="ld-empty" style={{ padding: 40 }}>Загружаем данные…</div>}
          {error && !loading && <div className="auth-error" style={{ marginBottom: 20 }}>{error}</div>}

          {!loading && !error && tab === 'dashboard' && analytics && (
            <>
              <div className="ld-stats">
                <div className="ld-stat">
                  <div className="ld-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}><IconBuilding size={22} /></div>
                  <div className="ld-stat-value">{analytics.stats.companies}</div>
                  <div className="ld-stat-label">Компаний</div>
                </div>
                <div className="ld-stat">
                  <div className="ld-stat-icon" style={{ background: '#fef3c7', color: '#f59e0b' }}><IconUsers size={22} /></div>
                  <div className="ld-stat-value">{analytics.stats.users}</div>
                  <div className="ld-stat-label">Пользователей</div>
                </div>
                <div className="ld-stat">
                  <div className="ld-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}><IconChart size={22} /></div>
                  <div className="ld-stat-value">{analytics.stats.avgProgress}%</div>
                  <div className="ld-stat-label">Ср. прогресс</div>
                </div>
                <div className="ld-stat">
                  <div className="ld-stat-icon" style={{ background: '#faf5ff', color: '#8b5cf6' }}><IconCheck size={22} /></div>
                  <div className="ld-stat-value">{analytics.stats.attempts}</div>
                  <div className="ld-stat-label">Попыток тестов</div>
                  <div className="ld-stat-hint">ср. балл {analytics.stats.avgScore}%</div>
                </div>
              </div>

              <div className="ld-section-head"><h2>Компании</h2></div>
              <div className="sa-companies-grid">
                {analytics.companiesStats.length === 0 ? (
                  <div className="ld-empty" style={{ gridColumn: '1/-1' }}>
                    Компаний пока нет. Создайте первую.
                  </div>
                ) : analytics.companiesStats.map((c) => (
                  <div key={c.id} className="sa-company-card" onClick={() => { setUsersCompanyFilter(c.id); setTab('users'); }}>
                    <div className="sa-company-header">
                      <div className="sa-company-logo">{c.name.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <h4>{c.name}</h4>
                        <div className="code">код: {companyById[c.id]?.code || '—'}</div>
                      </div>
                    </div>
                    <div className="sa-company-stats">
                      <div><div className="sa-company-stat-value">{c.users}</div><div className="sa-company-stat-label">Сотрудников</div></div>
                      <div><div className="sa-company-stat-value">{c.courses}</div><div className="sa-company-stat-label">Курсов</div></div>
                      <div><div className="sa-company-stat-value">{c.completedCourses}</div><div className="sa-company-stat-label">Завершено</div></div>
                    </div>
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
                      <div className="progress-mini">
                        <div className="progress-bar-mini" style={{ maxWidth: 'none' }}>
                          <div style={{ width: `${c.avgProgress}%` }} />
                        </div>
                        <strong style={{ fontSize: 12 }}>{c.avgProgress}%</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && !error && tab === 'dashboard' && !analytics && (
            <div className="ld-empty" style={{ padding: 40 }}>Аналитика недоступна</div>
          )}

          {!loading && !error && tab === 'companies' && (
            <div className="panel">
              {companies.length === 0 ? (
                <div className="empty-state">
                  <IconBuilding size={48} />
                  <div>Компаний пока нет</div>
                </div>
              ) : (
                <table className="mat-table">
                  <thead>
                    <tr><th>Компания</th><th>Код</th><th>Создана</th><th></th></tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="mat-title">
                            <div className="mat-icon" style={{ background: '#6366f1' }}><IconBuilding size={18} /></div>
                            <div className="t-name">{c.name}</div>
                          </div>
                        </td>
                        <td><span className="badge badge-primary">{c.code}</span></td>
                        <td>{new Date(c.createdAt).toLocaleDateString('ru')}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setUsersCompanyFilter(c.id); setTab('users'); }}
                          >
                            <IconUsers size={14} /> Пользователи
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ marginLeft: 6 }}
                            onClick={() => onDeleteCompany(c)}
                          >
                            <IconClose size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {!loading && !error && tab === 'users' && (
            <>
              <div className="assign-filters" style={{ marginBottom: 16 }}>
                <button
                  className={`assign-filter ${usersCompanyFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setUsersCompanyFilter('all')}
                >
                  Все <span className="cnt">{users.length}</span>
                </button>
                {companies.map((c) => {
                  const n = users.filter((u) => (u as { companyId?: string }).companyId === c.id).length;
                  return (
                    <button
                      key={c.id}
                      className={`assign-filter ${usersCompanyFilter === c.id ? 'active' : ''}`}
                      onClick={() => setUsersCompanyFilter(c.id)}
                    >
                      {c.name} <span className="cnt">{n}</span>
                    </button>
                  );
                })}
              </div>

              <div className="panel">
                {filteredUsers.length === 0 ? (
                  <div className="empty-state"><IconUsers size={48} /><div>Пользователей нет</div></div>
                ) : (
                  <table className="mat-table">
                    <thead>
                      <tr><th>Пользователь</th><th>Email</th><th>Компания</th><th>Роль</th><th></th></tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const cid = (u as { companyId?: string }).companyId;
                        const company = cid ? companyById[cid] : null;
                        return (
                          <tr key={u.id}>
                            <td>
                              <div className="mat-title">
                                <Avatar name={u.name} role={u.role} size={36} />
                                <div className="t-name">{u.name}</div>
                              </div>
                            </td>
                            <td>{u.email}</td>
                            <td>{company ? company.name : '—'}</td>
                            <td>
                              <span className="badge badge-muted">
                                {u.role === 'superadmin' ? 'Супер-админ' : u.role === 'admin' ? 'Администратор' : 'Учащийся'}
                              </span>
                            </td>
                            <td>
                              {u.role !== 'superadmin' && (
                                <button className="row-action danger" title="Удалить" onClick={() => onDeleteUser(u)}>
                                  <IconTrash size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {!loading && !error && tab === 'materials' && (
            <div className="panel">
              {materials.length === 0 ? (
                <div className="empty-state"><IconLayers size={48} /><div>Материалов нет</div></div>
              ) : (
                <table className="mat-table">
                  <thead>
                    <tr><th>Название</th><th>Тип</th><th>Компания</th><th>Статус</th></tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => {
                      const cid = (m as { companyId?: string }).companyId;
                      const company = cid ? companyById[cid] : null;
                      return (
                        <tr key={m.id}>
                          <td>
                            <div className="mat-title">
                              <div className="mat-icon" style={{ background: '#6366f1' }}><IconLayers size={18} /></div>
                              <div className="t-name">{m.title}</div>
                            </div>
                          </td>
                          <td>{m.type}</td>
                          <td>{company ? company.name : '—'}</td>
                          <td>
                            {m.status === 'published'
                              ? <span className="badge badge-success">● Опубликован</span>
                              : <span className="badge badge-warning">● Черновик</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {createCompanyOpen && (
        <CreateCompanyModal
          onClose={() => setCreateCompanyOpen(false)}
          onCreated={(name) => {
            setCreateCompanyOpen(false);
            toast(`Компания «${name}» создана`);
            reloadAll();
          }}
        />
      )}

      {createUserOpen && (
        <CreateUserModal
          companies={companies}
          allowCompanySelect={true}
          allowRoleSelect={true}
          defaultRole="admin"
          defaultCompanyId={usersCompanyFilter !== 'all' ? usersCompanyFilter : undefined}
          onClose={() => setCreateUserOpen(false)}
          onCreated={(name) => {
            setCreateUserOpen(false);
            toast(`Пользователь «${name}» создан`);
            reloadAll();
          }}
        />
      )}

      {importUsersOpen && (
        <ImportUsersModal
          companies={companies}
          allowCompanySelect={true}
          allowAdminRole={true}
          defaultCompanyId={usersCompanyFilter !== 'all' ? usersCompanyFilter : undefined}
          onClose={() => setImportUsersOpen(false)}
          onImported={() => { reloadAll(); }}
        />
      )}
    </div>
  );
}