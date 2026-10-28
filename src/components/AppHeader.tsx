import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { getInitials, useToast } from '../lib/utils';
import { IconUser, IconLogout, IconHome, IconBook, LOGO } from '../lib/icons';

export function AppHeader() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const toast = useToast();

  if (!user) return null;

  const isLearner = user.role === 'learner';
  const homePath = isLearner ? '/learner' : '/admin';

  const handleLogout = () => {
    if (!confirm('Выйти из аккаунта?')) return;
    logout();
    toast('Вы вышли');
    navigate('/', { replace: true });
  };

  return (
    <header className="app-header">
      <Link to="/" className="logo" style={{ textDecoration: 'none' }} title="На главную сайта">
        <LOGO />
        <span>LearnFlow</span>
      </Link>

      <div className="right">
        <Link
          to={homePath}
          className="btn btn-ghost btn-sm"
          style={{ textDecoration: 'none' }}
          title={isLearner ? 'Личный кабинет' : 'Админ-панель'}
        >
          <IconBook size={16} /> {isLearner ? 'Кабинет' : 'Админка'}
        </Link>

        <Link
          to="/"
          className="btn btn-ghost btn-sm"
          style={{ textDecoration: 'none' }}
          title="На главную сайта"
        >
          <IconHome size={16} /> На главную
        </Link>

        <Link to="/profile" className="btn-icon" title="Профиль">
          <IconUser />
        </Link>

        <Link to="/profile" className="user-chip" style={{ textDecoration: 'none', color: 'inherit' }}>
          {user.avatarUrl ? (
            <div className="avatar avatar-img" style={{ width: 34, height: 34 }}>
              <img src={user.avatarUrl} alt="" />
            </div>
          ) : (
            <div className={`avatar ${user.role === 'superadmin' ? 'super' : ''}`}>
              {getInitials(user.name)}
            </div>
          )}
          <div>
            <div className="u-name">{user.name}</div>
            <div className="u-role">
              {user.role === 'admin' ? 'Администратор' : user.role === 'superadmin' ? 'Супер-админ' : 'Учащийся'}
            </div>
          </div>
        </Link>

        <button className="btn-icon" onClick={handleLogout} title="Выйти">
          <IconLogout />
        </button>
      </div>
    </header>
  );
}