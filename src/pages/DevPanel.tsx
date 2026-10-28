import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useToast, getInitials } from '../lib/utils';
import {
  getMaterials, getAllUsers,
  type Material, type User,
} from '../lib/api';
import { getAllCompanies, type Company } from '../lib/api-admin';
import {
  IconHome, IconUsers, IconLayers, IconCheck, IconEdit,
  IconPlay, IconClose, IconArrowRight, IconSparkles, LOGO,
} from '../lib/icons';

/* ===== Известные dev-аккаунты ===== */
interface KnownAccount {
  email: string;
  password: string;
  role: 'superadmin' | 'admin' | 'learner';
  label: string;
  hint: string;
}

const KNOWN_ACCOUNTS: KnownAccount[] = [
  {
    email: 'super@demo.ru',
    password: 'demo1234',
    role: 'superadmin',
    label: 'Супер-админ',
    hint: 'Управление всеми компаниями',
  },
  {
    email: 'admin@demo.ru',
    password: 'demo1234',
    role: 'admin',
    label: 'Администратор Demo',
    hint: 'Demo Company · материалы, сотрудники',
  },
  {
    email: 'learner@demo.ru',
    password: 'demo1234',
    role: 'learner',
    label: 'Учащийся Demo',
    hint: 'Demo Company · кабинет ученика',
  },
];

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Супер-админ',
  admin: 'Администратор',
  learner: 'Учащийся',
};

const ROLE_COLOR: Record<string, string> = {
  superadmin: '#f59e0b',
  admin: '#6366f1',
  learner: '#10b981',
};

const TYPE_COLOR: Record<string, string> = {
  course: '#6366f1',
  test: '#10b981',
  longread: '#ec4899',
  trainer: '#f59e0b',
  scorm: '#0d9488',
};

const TYPE_LABEL: Record<string, string> = {
  course: 'Курс',
  test: 'Тест',
  longread: 'Лонгрид',
  trainer: 'Тренажёр',
  scorm: 'SCORM',
};

const TYPE_PATH: Record<string, string> = {
  course: '/course/',
  test: '/quiz/',
  longread: '/read/',
  trainer: '/trainer/',
  scorm: '/scorm/',
};

const TYPE_EDIT_PATH: Record<string, string> = {
  course: '/course-editor/',
  test: '/quiz-editor/',
  longread: '/editor/',
  trainer: '/trainer-editor/',
};

interface DevState {
  users: User[];
  companies: Company[];
  materials: Material[];
  knownAccounts: KnownAccount[];
}

export function DevPanel() {
  const isDev = import.meta.env.DEV;
  if (!isDev) return <Navigate to="/" replace />;

  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const setAuth = useAuth((s) => s.setAuth);
  const logout = useAuth((s) => s.logout);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DevState | null>(null);
  const [err, setErr] = useState('');
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const token = localStorage.getItem('lf_token');
      const res = await fetch('/api/dev/state', {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setData(d as DevState);
        setLoading(false);
        return;
      }
      // fallback — грузим через обычные API (если superadmin)
      if (user?.role === 'superadmin') {
        const [u, c, m] = await Promise.all([
          getAllUsers(),
          getAllCompanies(),
          getMaterials(),
        ]);
        setData({
          users: u.users,
          companies: c,
          materials: m.materials,
          knownAccounts: KNOWN_ACCOUNTS,
        });
      } else {
        setData({
          users: [],
          companies: [],
          materials: [],
          knownAccounts: KNOWN_ACCOUNTS,
        });
      }
      setLoading(false);
    } catch (e) {
      setErr((e as Error).message);
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(null), 1500);
    } catch {
      toast('Не удалось скопировать', 'error');
    }
  };

  const loginAs = async (acc: KnownAccount) => {
    setLoggingIn(acc.email);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, password: acc.password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Ошибка логина');
      const { token, user: u } = json as { token: string; user: User };
      setAuth(u, token);
      toast(`Вошли как ${acc.email}`);
      if (u.role === 'superadmin') navigate('/superadmin');
      else if (u.role === 'admin') navigate('/admin');
      else navigate('/learner');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setLoggingIn(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#94a3b8', fontSize: 14 }}>
        Загружаем dev-панель…
      </div>
    );
  }

  const users = data?.users || [];
  const companies = data?.companies || [];
  const materials = data?.materials || [];
  const known = data?.knownAccounts || KNOWN_ACCOUNTS;

  const byType = (t: string) => materials.filter((m) => m.type === t);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '24px 20px 60px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              <span style={{ color: '#8b5cf6' }}>◆</span> LearnFlow <span style={{ color: '#64748b', fontWeight: 400 }}>dev</span>
            </div>
            <span style={{ background: '#8b5cf6', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>
              DEV ONLY
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  Зашли как <strong style={{ color: '#e2e8f0' }}>{user.email}</strong> ({ROLE_LABEL[user.role]})
                </span>
                <button
                  onClick={() => { logout(); window.location.href = '/login'; }}
                  style={{ background: '#334155', color: '#e2e8f0', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  Выйти
                </button>
              </>
            ) : (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Не залогинены</span>
            )}
            <button
              onClick={() => navigate('/')}
              style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
            >
              На сайт →
            </button>
          </div>
        </header>

        {err && (
          <div style={{ background: '#7f1d1d', border: '1px solid #991b1b', color: '#fecaca', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
            {err}
          </div>
        )}

        {/* === Dev-аккаунты === */}
        <Section title="🔑 Dev-аккаунты" hint="Известные учётки с паролями — клик «Войти» переключает сессию">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {known.map((acc) => (
              <div
                key={acc.email}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: ROLE_COLOR[acc.role],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 13,
                    }}
                  >
                    {acc.role === 'superadmin' ? '👑' : acc.role === 'admin' ? '⚙' : '👤'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{acc.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{acc.hint}</div>
                  </div>
                </div>

                <Field
                  label="email"
                  value={acc.email}
                  onCopy={() => copy(acc.email, acc.email)}
                  copied={copyFeedback === acc.email}
                />
                <Field
                  label="password"
                  value={acc.password}
                  onCopy={() => copy(acc.password, acc.password)}
                  copied={copyFeedback === acc.password}
                />

                <button
                  onClick={() => loginAs(acc)}
                  disabled={loggingIn !== null}
                  style={{
                    background: loggingIn === acc.email ? '#475569' : ROLE_COLOR[acc.role],
                    color: '#fff',
                    border: 'none',
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loggingIn !== null ? 'wait' : 'pointer',
                    marginTop: 4,
                  }}
                >
                  {loggingIn === acc.email ? 'Входим…' : 'Войти как ' + acc.role} →
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* === Компании === */}
        <Section title="🏢 Компании" hint={`Всего: ${companies.length}`}>
          {companies.length === 0 ? (
            <Empty>
              {user?.role === 'superadmin'
                ? 'Компаний пока нет'
                : 'Войдите как super@demo.ru, чтобы увидеть все компании'}
            </Empty>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {companies.map((c) => (
                <div key={c.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                    ID: <span style={{ color: '#cbd5e1' }}>{c.id}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    Код для регистрации:{' '}
                    <button
                      onClick={() => copy(c.code, 'code-' + c.id)}
                      style={{
                        background: '#0f172a', color: '#8b5cf6', border: '1px solid #334155',
                        padding: '2px 6px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {copyFeedback === 'code-' + c.id ? '✓ скопировано' : c.code}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* === Пользователи === */}
        <Section title="👥 Пользователи" hint={`Всего: ${users.length}`}>
          {users.length === 0 ? (
            <Empty>
              {user?.role === 'superadmin'
                ? 'Пользователей нет'
                : 'Войдите как super@demo.ru, чтобы увидеть всех пользователей'}
            </Empty>
          ) : (
            <div style={{ overflowX: 'auto', background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
                    <Th>Email</Th>
                    <Th>Имя</Th>
                    <Th>Роль</Th>
                    <Th>Компания</Th>
                    <Th>ID</Th>
                    <Th>Пароль</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const companyId = (u as { companyId?: string }).companyId;
                    const company = companies.find((c) => c.id === companyId);
                    const knownAcc = known.find((k) => k.email === u.email);
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid #0f172a' }}>
                        <Td>
                          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{u.email}</span>
                        </Td>
                        <Td>{u.name}</Td>
                        <Td>
                          <span style={{
                            background: ROLE_COLOR[u.role],
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                          }}>
                            {ROLE_LABEL[u.role] || u.role}
                          </span>
                        </Td>
                        <Td>{company ? company.name : '—'}</Td>
                        <Td>
                          <span style={{ color: '#64748b', fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>{u.id}</span>
                        </Td>
                        <Td>
                          {knownAcc ? (
                            <button
                              onClick={() => copy(knownAcc.password, 'pw-' + u.id)}
                              style={{
                                background: '#0f172a',
                                color: '#10b981',
                                border: '1px solid #334155',
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: 10,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              {copyFeedback === 'pw-' + u.id ? '✓' : knownAcc.password}
                            </button>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: 10 }}>custom</span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* === Материалы === */}
        <Section title="📚 Материалы" hint={`Всего: ${materials.length}`}>
          {materials.length === 0 ? (
            <Empty>Материалов нет</Empty>
          ) : (
            ['longread', 'test', 'course', 'trainer', 'scorm'].map((type) => {
              const list = byType(type);
              if (list.length === 0) return null;
              return (
                <div key={type} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[type] }} />
                    {TYPE_LABEL[type]} ({list.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {list.map((m) => {
                      const companyId = (m as { companyId?: string }).companyId;
                      const company = companies.find((c) => c.id === companyId);
                      const viewPath = TYPE_PATH[type] ? TYPE_PATH[type] + m.id : null;
                      const editPath = TYPE_EDIT_PATH[type] ? TYPE_EDIT_PATH[type] + m.id : null;
                      return (
                        <div
                          key={m.id}
                          style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 6,
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, marginBottom: 3 }}>
                              {m.title}
                              <span style={{
                                marginLeft: 8,
                                padding: '1px 6px',
                                borderRadius: 3,
                                background: m.status === 'published' ? '#065f46' : '#78350f',
                                color: '#fff',
                                fontSize: 9,
                                fontWeight: 700,
                              }}>
                                {m.status === 'published' ? 'PUBLISHED' : 'DRAFT'}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>
                              ID: {m.id} · {company ? company.name : '—'}
                            </div>
                          </div>
                          {viewPath && (
                            <button
                              onClick={() => navigate(viewPath + '?preview=1')}
                              style={{ background: '#1e40af', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              ▶ Preview
                            </button>
                          )}
                          {editPath && (
                            <button
                              onClick={() => navigate(editPath)}
                              style={{ background: '#6d28d9', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              ✏ Edit
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </Section>

        {/* === Быстрые ссылки === */}
        <Section title="⚡ Быстрые ссылки" hint="Переходы по страницам приложения">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {[
              { to: '/', label: 'Главная (Landing)' },
              { to: '/login', label: 'Вход' },
              { to: '/learner', label: 'Кабинет учащегося' },
              { to: '/admin', label: 'Админка' },
              { to: '/superadmin', label: 'Супер-админка' },
              { to: '/profile', label: 'Профиль' },
            ].map((l) => (
              <button
                key={l.to}
                onClick={() => navigate(l.to)}
                style={{
                  background: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                {l.label} <span style={{ color: '#64748b', fontSize: 11 }}>→ {l.to}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* === API endpoints === */}
        <Section title="🔗 API endpoints" hint="Для отладки — все основные ручки бэкенда">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
            {[
              ['POST', '/api/login', 'вход'],
              ['GET', '/api/me', 'текущий пользователь'],
              ['GET', '/api/materials', 'список материалов'],
              ['POST', '/api/materials', 'создать материал'],
              ['GET', '/api/materials/:id', 'материал по id'],
              ['PUT', '/api/materials/:id', 'обновить материал'],
              ['GET', '/api/users', 'список пользователей'],
              ['POST', '/api/users', 'создать пользователя'],
              ['DELETE', '/api/users/:id', 'удалить пользователя'],
              ['GET', '/api/companies', 'список компаний'],
              ['POST', '/api/companies', 'создать компанию'],
              ['GET', '/api/assignments', 'назначения'],
              ['GET', '/api/analytics/company', 'аналитика компании'],
              ['GET', '/api/analytics/global', 'глобальная аналитика'],
              ['GET', '/api/learning/my', 'обучение учащегося'],
              ['POST', '/api/materials/:id/submit', 'сдать тест'],
              ['POST', '/api/scorm/upload', 'загрузить SCORM'],
            ].map(([method, path, desc]) => (
              <div
                key={method + path}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{
                  background: method === 'GET' ? '#1e40af' : method === 'POST' ? '#065f46' : method === 'PUT' ? '#78350f' : '#7f1d1d',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 700,
                  minWidth: 42,
                  textAlign: 'center',
                }}>
                  {method}
                </span>
                <code style={{ color: '#cbd5e1', flex: 1, fontSize: 11 }}>{path}</code>
                <span style={{ color: '#64748b', fontSize: 10 }}>{desc}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ color: '#8b5cf6' }}>◆</span> LearnFlow DevPanel · только для разработки
          </div>
          <button
            onClick={load}
            style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '6px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ↻ Обновить данные
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== UI-хелперы ===== */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', margin: 0, fontFamily: '-apple-system, sans-serif' }}>{title}</h2>
        {hint && <span style={{ fontSize: 12, color: '#64748b' }}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 20, background: '#1e293b', border: '1px dashed #334155', borderRadius: 8, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
      {children}
    </div>
  );
}

function Field({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color: '#64748b', minWidth: 70 }}>{label}:</span>
      <code style={{ flex: 1, color: '#e2e8f0', background: '#0f172a', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>{value}</code>
      <button
        onClick={onCopy}
        style={{
          background: copied ? '#065f46' : '#334155',
          color: '#fff',
          border: 'none',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 10,
          cursor: 'pointer',
          fontFamily: 'inherit',
          minWidth: 60,
        }}
      >
        {copied ? '✓' : 'copy'}
      </button>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{children}</td>;
}