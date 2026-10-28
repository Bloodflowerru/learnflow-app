import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createMaterial, type Material, type MaterialType } from '../lib/api';
import {
  IconClose, IconBook, IconCheck, IconEdit, IconUsers, IconPlay,
  IconFileText, IconSparkles, IconUpload
} from '../lib/icons';

interface Props {
  onClose: () => void;
  onCreated: (m: Material) => void;
}

const TYPES: Array<{ id: MaterialType; label: string; icon: JSX.Element }> = [
  { id: 'course',   label: 'Курс',      icon: <IconBook size={22} /> },
  { id: 'test',     label: 'Тест',      icon: <IconCheck size={22} /> },
  { id: 'longread', label: 'Лонгрид',   icon: <IconEdit size={22} /> },
  { id: 'trainer',  label: 'Тренажёр',  icon: <IconUsers size={22} /> },
];

export function CreateMaterialModal({ onClose, onCreated }: Props) {
  const [type, setType] = useState<MaterialType>('course');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ai, setAi] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Укажите название'); return; }
    setLoading(true);
    try {
      const { material } = await createMaterial({
        title: title.trim(),
        description: description.trim(),
        type,
        ai
      });
      onCreated(material);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onPickFile = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFileName(f.name);
  };

  const modal = (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Новый материал</h2>
            <p>Выберите тип и заполните информацию</p>
          </div>
          <button className="btn-icon" onClick={onClose} type="button">
            <IconClose />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Тип материала</label>
            <div className="type-grid">
              {TYPES.map((t) => (
                <div
                  key={t.id}
                  className={`type-option ${type === t.id ? 'active' : ''}`}
                  onClick={() => setType(t.id)}
                >
                  {t.icon}
                  <div>{t.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Название</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Онбординг новых сотрудников"
              autoFocus
            />
          </div>

          <div className="field">
            <label>Описание</label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Коротко о содержании"
            />
          </div>

          {type === 'longread' && (
            <div className="ai-box" style={{ background: '#fdf2f8', borderColor: '#fbcfe8' }}>
              <div className="ai-title" style={{ color: '#ec4899' }}>
                <IconEdit size={18} /> Лонгрид
              </div>
              <div className="ai-sub" style={{ marginTop: 6 }}>
                После создания откроется блочный редактор (следующий шаг).
              </div>
            </div>
          )}

          {type === 'test' && (
            <div className="ai-box" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
              <div className="ai-title" style={{ color: '#10b981' }}>
                <IconCheck size={18} /> Тест
              </div>
              <div className="ai-sub" style={{ marginTop: 6 }}>
                После создания откроется редактор вопросов (следующий шаг).
              </div>
            </div>
          )}

          {type === 'course' && (
            <div className="ai-box">
              <div className="ai-title"><IconBook size={18} /> Курс</div>
              <div className="ai-sub" style={{ marginTop: 6 }}>
                После создания откроется редактор уроков (следующий шаг).
              </div>
            </div>
          )}

         {type === 'trainer' && (
  <div className="ai-box" style={{ background: '#fef3c7', borderColor: '#fde68a' }}>
    <div className="ai-title" style={{ color: '#92400e' }}>
      <IconUsers size={18} /> Тренажёр-кейс
    </div>
    <div className="ai-sub" style={{ marginTop: 6 }}>
      После создания откроется редактор шагов-ситуаций. Каждый выбор ведёт к следующей ситуации.
    </div>
  </div>
)}

          {error && <div className="auth-error" style={{ marginTop: 16 }}>{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose} type="button" disabled={loading}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={submit} type="button" disabled={loading}>
            {loading ? 'Создаём…' : 'Создать материал'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}