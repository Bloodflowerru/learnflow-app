import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../lib/api';
import { useAuth } from '../store/auth';
import { useToast } from '../lib/utils';
import { LOGO, IconBook, IconLayers } from '../lib/icons';

type Role = 'learner' | 'admin';

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [role, setRole] = useState<Role>('learner');
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('demo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Укажите имя');
    if (!email.trim()) return setError('Укажите email');
    if (password.length < 6) return setError('Пароль минимум 6 символов');
    if (password !== password2) return setError('Пароли не совпадают');
    if (role === 'admin' && !companyName.trim()) return setError('Укажите название компании');
    if (role === 'learner' && !companyCode.trim()) return setError('Укажите код компании');

    setLoading(true);
    try {
      const { token, user } = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        companyName: role === 'admin' ? companyName.trim() : undefined,
        companyCode: role === 'learner' ? companyCode.trim() : undefined
      });
      setAuth(user, token);
      toast('Аккаунт создан!');
      navigate(user.role === 'learner' ? '/' : '/admin', { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-form-side">
        <div className="auth-form-inner">
          <div className="auth-logo">
            <LOGO />
            <span>LearnFlow</span>
          </div>
          <h1>Создать аккаунт</h1>
          <p className="lead">Зарегистрируйтесь как учащийся или создайте компанию.</p>

          <div className="role-select">
            <div
              className={`role-option ${role === 'learner' ? 'active' : ''}`}
              onClick={() => setRole('learner')}
            >
              <div className="role-icon"><IconBook size={32} /></div>
              <div className="role-name">Учащийся</div>
              <div className="role-desc">Войти по коду</div>
            </div>
            <div
              className={`role-option ${role === 'admin' ? 'active' : ''}`}
              onClick={() => setRole('admin')}
            >
              <div className="role-icon"><IconLayers size={32} /></div>
              <div className="role-name">Администратор</div>
              <div className="role-desc">Создать компанию</div>
            </div>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="field">
              <label>Имя</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Анна Смирнова" />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.ru" />
            </div>
            {role === 'admin' ? (
              <div className="field">
                <label>Название компании</label>
                <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ООО Ромашка" />
              </div>
            ) : (
              <div className="field">
                <label>Код компании</label>
                <input className="input" value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} placeholder="demo" />
              </div>
            )}
            <div className="field">
              <label>Пароль</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" />
            </div>
            <div className="field">
              <label>Повторите пароль</label>
              <input className="input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Ещё раз" />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {loading ? 'Создаём…' : 'Зарегистрироваться'}
            </button>
          </form>
          <div className="login-foot" style={{ textAlign: 'left', marginTop: 24 }}>
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </div>
        </div>
      </div>
      <div className="auth-brand-side">
        <div className="auth-brand-content">
          <span className="auth-brand-badge">✨ Присоединяйтесь</span>
          <h2>Начните<br />учиться.</h2>
          <p>Один аккаунт — доступ к курсам вашей компании.</p>
        </div>
      </div>
    </div>
  );
}