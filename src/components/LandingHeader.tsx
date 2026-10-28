import { useNavigate } from 'react-router-dom';
import { LandingLogo } from './LandingLogo';

interface LandingHeaderProps {
  active?: 'features' | 'solutions' | 'pricing' | 'contacts' | '';
}

const NAV = [
  { id: 'features', label: 'Возможности' },
  { id: 'solutions', label: 'Решения' },
  { id: 'pricing', label: 'Тарифы' },
  { id: 'contacts', label: 'Контакты' },
] as const;

export function LandingHeader({ active = '' }: LandingHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="landing-header">
      <div
        className="logo"
        style={{ cursor: 'pointer' }}
        onClick={() => navigate('/')}
      >
        <LandingLogo />
        <span>LearnFlow</span>
      </div>

      <nav className="landing-nav">
        {NAV.map((n) => (
          <a
            key={n.id}
            className={active === n.id ? 'active' : ''}
            onClick={() => navigate('/page/' + n.id)}
            style={{ cursor: 'pointer' }}
          >
            {n.label}
          </a>
        ))}
      </nav>

      <div className="landing-actions">
  <button className="btn btn-primary" onClick={() => navigate('/login')}>
    Войти
  </button>
</div>
    </header>
  );
}