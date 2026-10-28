import { useNavigate } from 'react-router-dom';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import { IconSparkles, IconArrowRight, IconBook, IconEdit, IconChart } from '../lib/icons';

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <LandingHeader />

      <section className="hero">
        <span className="hero-badge">
          <IconSparkles size={14} /> EdTech-платформа с AI
        </span>
        <h1>
          Корпоративное обучение, <span>которое работает</span>
        </h1>
        <p>
          Создавайте курсы, назначайте их сотрудникам и отслеживайте прогресс —
          без технических специалистов и сложных интеграций.
        </p>
        <div className="hero-actions">
  <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
    Войти в систему <IconArrowRight size={18} />
  </button>
  <button className="btn btn-outline btn-lg" onClick={() => navigate('/login')}>
    Демо-вход
  </button>
</div>
      </section>

      <section className="features">
        <div className="feature-card">
          <div className="feature-icon"><IconBook size={24} /></div>
          <h3>LMS ядро</h3>
          <p>Пользователи, компании, learning paths, назначения и отчёты.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><IconEdit size={24} /></div>
          <h3>Конструктор курсов</h3>
          <p>Курсы, тесты и лонгриды в одном интерфейсе.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><IconChart size={24} /></div>
          <h3>Аналитика</h3>
          <p>Прогресс, активность, топ-сотрудники в реальном времени.</p>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}