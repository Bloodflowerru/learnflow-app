import { useParams, useNavigate } from 'react-router-dom';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';

type PageId = 'features' | 'solutions' | 'pricing' | 'contacts';

const TITLES: Record<PageId, { title: string; subtitle: string; badge: string }> = {
  features: {
    badge: 'Возможности',
    title: 'Всё для корпоративного обучения',
    subtitle: 'Одна платформа вместо пяти: курсы, назначения, аналитика.',
  },
  solutions: {
    badge: 'Решения',
    title: 'Кому подходит LearnFlow',
    subtitle: 'Для HR, L&D-менеджеров, методологов и целых отделов.',
  },
  pricing: {
    badge: 'Тарифы',
    title: 'Простые и понятные цены',
    subtitle: 'Платите только за активных сотрудников.',
  },
  contacts: {
    badge: 'Контакты',
    title: 'Свяжитесь с нами',
    subtitle: 'Ответим на вопросы, поможем с тарифом и проведём демо.',
  },
};

export function PublicPage() {
  const { page } = useParams<{ page: string }>();
  const navigate = useNavigate();
  const id = (page as PageId) in TITLES ? (page as PageId) : 'features';
  const data = TITLES[id];

  return (
    <div className="landing">
      <LandingHeader active={id} />
      <section className="page-hero">
        <span className="hero-badge">{data.badge}</span>
        <h1>{data.title}</h1>
        <p>{data.subtitle}</p>
      </section>
      <section className="page-section">
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
          Полный контент страницы «{data.badge}» можно перенести из исходного
          {' '}<code>views-pages.js</code> — структура и классы те же.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Войти в систему
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/')}>
            ← На главную
          </button>
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}