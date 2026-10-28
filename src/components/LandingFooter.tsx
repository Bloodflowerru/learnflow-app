import { useNavigate } from 'react-router-dom';
import { LandingLogo } from './LandingLogo';

export function LandingFooter() {
  const navigate = useNavigate();

  return (
    <footer className="landing-footer">
      <div className="footer-inner">
        <div className="footer-col">
          <div className="logo">
            <LandingLogo />
            <span>LearnFlow</span>
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 12, maxWidth: 260 }}>
            Платформа корпоративного обучения с AI-ассистентом
          </p>
        </div>

        <div className="footer-col">
          <h4>Продукт</h4>
          <a onClick={() => navigate('/page/features')}>Возможности</a>
          <a onClick={() => navigate('/page/pricing')}>Тарифы</a>
          <a onClick={() => navigate('/login')}>Войти</a>
        </div>

        <div className="footer-col">
          <h4>Компания</h4>
          <a onClick={() => navigate('/page/solutions')}>Решения</a>
          <a onClick={() => navigate('/page/contacts')}>Контакты</a>
        </div>

        <div className="footer-col">
          <h4>Правовое</h4>
          <a>Политика конфиденциальности</a>
          <a>Условия использования</a>
        </div>
      </div>

      <div className="footer-bottom">© 2026 LearnFlow. Все права защищены.</div>
    </footer>
  );
}