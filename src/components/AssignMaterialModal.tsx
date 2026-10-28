import { useState } from 'react';
import type { User } from '../lib/api';
import { useToast, getInitials } from '../lib/utils';
import { createAssignment } from '../lib/api-admin';
import { IconClose, IconCheck } from '../lib/icons';

interface AssignMaterialModalProps {
  material: { id: string; title: string };
  users: User[];
  onClose: () => void;
  onAssigned: (count: number) => void | Promise<void>;
}

export function AssignMaterialModal({
  material, users, onClose, onAssigned,
}: AssignMaterialModalProps) {
  const toast = useToast();
  const learners = users.filter((u) => u.role === 'learner');

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = search.trim()
    ? learners.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      )
    : learners;

  const today = new Date().toISOString().slice(0, 10);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds(learners.map((u) => u.id));
  const clearAll = () => setSelectedIds([]);

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      toast('Выберите хотя бы одного сотрудника', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await createAssignment({
        materialId: material.id,
        userIds: selectedIds,
        dueAt: dueAt || null,
        isMandatory,
      });
      await onAssigned(res.count || selectedIds.length);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>Назначить материал</h2>
            <p>{material.title}</p>
          </div>
          <button className="btn-icon" onClick={onClose} type="button">
            <IconClose size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>
              Сотрудники ({selectedIds.length} выбрано из {learners.length})
            </label>
            <input
              className="input"
              type="text"
              placeholder="Поиск по имени или email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 10 }}
            />

            {learners.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
                В компании пока нет сотрудников
              </div>
            ) : (
              <div className="assign-employees">
                {filtered.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    Ничего не найдено
                  </div>
                ) : (
                  filtered.map((u) => {
                    const checked = selectedIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={'assign-employee-row' + (checked ? ' checked' : '')}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUser(u.id)}
                        />
                        {u.avatarUrl ? (
                          <div className="avatar avatar-img" style={{ width: 32, height: 32 }}>
                            <img src={u.avatarUrl} alt="" />
                          </div>
                        ) : (
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                            {getInitials(u.name)}
                          </div>
                        )}
                        <div className="info">
                          <div className="name">{u.name}</div>
                          <div className="email">{u.email}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={selectAll} type="button">
                Выбрать всех
              </button>
              <button className="btn btn-ghost btn-sm" onClick={clearAll} type="button">
                Снять всех
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Дедлайн (необязательно)</label>
              <input
                className="input"
                type="date"
                value={dueAt}
                min={today}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Обязательный</label>
              <label
                className="toggle-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, height: 44,
                  padding: '0 14px', border: '1px solid var(--border)',
                  borderRadius: 8, background: 'var(--surface)', cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isMandatory}
                  onChange={(e) => setIsMandatory(e.target.checked)}
                  style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14 }}>Да</span>
              </label>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose} type="button">
            Отмена
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || selectedIds.length === 0}
            type="button"
          >
            <IconCheck size={16} />
            {saving ? 'Назначаем…' : `Назначить (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}