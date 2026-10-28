import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createCompany } from '../lib/api-admin';
import { IconClose } from '../lib/icons';

interface Props {
  onClose: () => void;
  onCreated: (name: string) => void;
}

export function CreateCompanyModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!name.trim()) { setError('Укажите название'); return; }
    setLoading(true);
    try {
      await createCompany({ name: name.trim() });
      onCreated(name.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Новая компания</h2>
            <p>Создайте компанию и получите код для сотрудников</p>
          </div>
          <button className="btn-icon" onClick={onClose} type="button">
            <IconClose size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Название компании</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ООО Ромашка"
              autoFocus
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose} type="button" disabled={loading}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={submit} type="button" disabled={loading}>
            {loading ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}