import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../lib/api';
import { useAuth } from '../store/auth';
import { useToast } from '../lib/utils';
import { LOGO } from '../lib/icons';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Заполните email и пароль');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await login(email, password);
      setAuth(user, token);
      toast('Добро пожаловать!');
      if (user.role === 'superadmin') navigate('/superadmin', { replace: true });
      else if (user.role === 'admin') navigate('/admin', { replace: true });
      else navigate('/learner', { replace: true });
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
          <h1>С возвращением</h1>
          <p className="lead">Войдите, чтобы продолжить обучение.</p>
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.ru"
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                autoComplete="current-password"
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 12 }}
              disabled={loading}
            >
              {loading ? 'Входим…' : 'Войти'}
            </button>
          </form>
          <div className="login-foot" style={{ textAlign: 'left', marginTop: 24 }}>
            Нет аккаунта? Обратитесь к администратору компании
          </div>
          <div className="auth-demo-box">
            <strong>Демо (пароль demo1234)</strong>
            <div>Учащийся: <code>learner@demo.ru</code></div>
            <div>Админ: <code>admin@demo.ru</code></div>
            <div>Супер-админ: <code>super@demo.ru</code></div>
          </div>
        </div>
      </div>
      <div className="auth-brand-side">
        <div className="auth-brand-content">
          <span className="auth-brand-badge">✨ EdTech-платформа с AI</span>
          <h2>Обучение,<br />которое работает.</h2>
          <p>Единая платформа для курсов, тестов и лонгридов.</p>
        </div>
        <div className="auth-brand-footer">
          <div className="stat"><div className="stat-value">3</div><div className="stat-label">типа контента</div></div>
          <div className="stat"><div className="stat-value">∞</div><div className="stat-label">компаний</div></div>
          <div className="stat"><div className="stat-value">24/7</div><div className="stat-label">доступ</div></div>
        </div>
      </div>
    </div>
  );
}