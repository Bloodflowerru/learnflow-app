import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconPlay } from '../lib/icons';

export function PreviewBanner() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #fef3c7 0%, #fffbeb 100%)',
        borderBottom: '1px solid #fde68a',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 13,
        color: '#92400e',
        fontWeight: 600,
        position: 'sticky',
        top: 64,
        zIndex: 30,
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconPlay size={14} />
        Предпросмотр — так материал увидят учащиеся. Прогресс не сохраняется.
      </span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigate('/admin')}
        type="button"
      >
        <IconArrowLeft size={14} /> В админку
      </button>
    </div>
  );
}