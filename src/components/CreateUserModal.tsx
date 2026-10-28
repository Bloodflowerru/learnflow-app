import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createUser, type Company } from '../lib/api-admin';
import { useToast } from '../lib/utils';
import { IconClose, IconUsers } from '../lib/icons';

interface Props {
  defaultCompanyId?: string;
  defaultRole?: 'learner' | 'admin';
  companies?: Company[];
  allowRoleSelect?: boolean;
  allowCompanySelect?: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}

export function CreateUserModal({
  defaultCompanyId,
  defaultRole = 'learner',
  companies = [],
  allowRoleSelect = false,
  allowCompanySelect = false,
  onClose,
  onCreated,
}: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'learner' | 'admin'>(defaultRole);
  const [companyId, setCompanyId] = useState<string>(defaultCompanyId || (companies[0]?.id ?? ''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!name.trim()) { setError('Укажите имя'); return; }
    if (!email.trim()) { setError('Укажите email'); return; }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }
    if (allowCompanySelect && !companyId) { setError('Выберите компанию'); return; }

    setLoading(true);
    try {
      await createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        companyId: allowCompanySelect ? companyId : defaultCompanyId,
      });
      onCreated(name.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Добавить пользователя</h2>
            <p>
              {allowCompanySelect
                ? 'Создайте администратора или учащегося для компании'
                : 'Создайте учётную запись учащегося'}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} type="button">
            <IconClose size={18} />
          </button>
        </div>

        <div className="modal-body">
          {allowCompanySelect && (
            <div className="field">
              <label>Компания</label>
              <select
                className="select"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                {companies.length === 0 ? (
                  <option value="">— Нет компаний —</option>
                ) : (
                  companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {allowRoleSelect && (
            <div className="field">
              <label>Роль</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`btn ${role === 'learner' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setRole('learner')}
                >
                  Учащийся
                </button>
                <button
                  type="button"
                  className={`btn ${role === 'admin' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setRole('admin')}
                >
                  Администратор
                </button>
              </div>
            </div>
          )}

          <div className="field">
            <label>Имя</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Анна Смирнова"
              autoFocus
            />
          </div>

          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="anna@company.ru"
            />
          </div>

          <div className="field">
            <label>Пароль</label>
            <input
              className="input"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
            />
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
              <IconUsers size={12} style={{ display: 'inline', marginRight: 4 }} />
              Передайте эти данные {role === 'admin' ? 'администратору' : 'сотруднику'} — вход через форму на главной.
            </div>
          </div>

          {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose} type="button" disabled={loading}>
            Отмена
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            type="button"
            disabled={loading || (allowCompanySelect && companies.length === 0)}
          >
            {loading ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}