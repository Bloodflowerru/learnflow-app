import { useEffect, useState } from 'react';
import { getAttempts, type Attempt } from '../lib/api-admin';
import { fmtDate, getInitials, useToast } from '../lib/utils';
import { IconClose, IconList, IconUpload } from '../lib/icons';

interface AttemptsModalProps {
  material: { id: string; title: string };
  onClose: () => void;
}

export function AttemptsModal({ material, onClose }: AttemptsModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'name'>('date');
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await getAttempts(material.id);
        if (!cancelled) {
          setAttempts(list);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [material.id]);

  const filtered = attempts.filter((a) => {
    if (filter === 'passed') return a.passed;
    if (filter === 'failed') return !a.passed;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'score') return b.score - a.score;
    if (sortBy === 'name') return a.userName.localeCompare(b.userName, 'ru');
    return b.createdAt.localeCompare(a.createdAt);
  });

  const stats = {
    total: attempts.length,
    passed: attempts.filter((a) => a.passed).length,
    failed: attempts.filter((a) => !a.passed).length,
    avgScore: attempts.length
      ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
      : 0,
    uniqueUsers: new Set(attempts.map((a) => a.userId)).size,
  };

  const exportCSV = () => {
    if (sorted.length === 0) {
      toast('Нечего экспортировать', 'error');
      return;
    }

    const header = [
      'Сотрудник',
      'Email',
      'Дата и время',
      'Правильных',
      'Всего вопросов',
      'Балл (%)',
      'Статус',
    ];

    const rows = sorted.map((a) => [
      a.userName,
      (a as { userEmail?: string }).userEmail || '',
      formatDateTime(a.createdAt),
      String(a.correct),
      String(a.total),
      String(a.score),
      a.passed ? 'Сдал' : 'Не сдал',
    ]);

    const all = [header, ...rows];
    const csv = '\uFEFF' + all.map((row) => row.map(escapeCSV).join(';')).join('\r\n');

    const safeTitle = material.title.replace(/[^\wа-яА-Я\-_ ]/g, '').trim() || 'test';
    const dateSuffix = new Date().toISOString().slice(0, 10);
    const filename = `results-${safeTitle}-${dateSuffix}.csv`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast(`Экспортировано ${sorted.length} строк`);
  };

  const exportExcel = () => {
    // Для Excel — то же, но с расширением .xls (Excel откроет как таблицу)
    // Это не настоящий xlsx, но Excel и LibreOffice откроют как обычную таблицу
    if (sorted.length === 0) {
      toast('Нечего экспортировать', 'error');
      return;
    }

    const header = ['Сотрудник', 'Email', 'Дата и время', 'Правильных', 'Всего', 'Балл (%)', 'Статус'];
    const rows = sorted.map((a) => [
      a.userName,
      (a as { userEmail?: string }).userEmail || '',
      formatDateTime(a.createdAt),
      String(a.correct),
      String(a.total),
      String(a.score),
      a.passed ? 'Сдал' : 'Не сдал',
    ]);

    const htmlRows = [header, ...rows]
      .map((row, i) =>
        '<tr>' + row.map((c) =>
          i === 0 ? `<th>${escapeHtml(c)}</th>` : `<td>${escapeHtml(c)}</td>`
        ).join('') + '</tr>'
      ).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(material.title)}</title>
<style>
  table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
  th { background: #4f46e5; color: white; padding: 6px 10px; text-align: left; }
  td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
</style></head><body>
<h2>${escapeHtml(material.title)} — результаты</h2>
<table>${htmlRows}</table>
</body></html>`;

    const safeTitle = material.title.replace(/[^\wа-яА-Я\-_ ]/g, '').trim() || 'test';
    const filename = `results-${safeTitle}-${new Date().toISOString().slice(0, 10)}.xls`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast(`Экспортировано ${sorted.length} строк (Excel)`);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 900 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>Результаты теста</h2>
            <p>{material.title}</p>
          </div>
          <button className="btn-icon" onClick={onClose} type="button">
            <IconClose size={18} />
          </button>
        </div>

        {/* Статистика */}
        {!loading && !error && attempts.length > 0 && (
          <div style={{ padding: '16px 24px 0' }}>
            <div className="ld-stats" style={{ marginBottom: 0 }}>
              <div className="ld-stat">
                <div className="ld-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
                  <IconList size={20} />
                </div>
                <div className="ld-stat-value">{stats.total}</div>
                <div className="ld-stat-label">Попыток</div>
                <div className="ld-stat-hint">{stats.uniqueUsers} сотрудник(ов)</div>
              </div>
              <div className="ld-stat">
                <div className="ld-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                  ✓
                </div>
                <div className="ld-stat-value">{stats.passed}</div>
                <div className="ld-stat-label">Сдали</div>
                <div className="ld-stat-hint">
                  {stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}% от попыток
                </div>
              </div>
              <div className="ld-stat">
                <div className="ld-stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
                  ✕
                </div>
                <div className="ld-stat-value">{stats.failed}</div>
                <div className="ld-stat-label">Не сдали</div>
              </div>
              <div className="ld-stat">
                <div className="ld-stat-icon" style={{ background: '#faf5ff', color: '#8b5cf6' }}>
                  %
                </div>
                <div className="ld-stat-value">{stats.avgScore}%</div>
                <div className="ld-stat-label">Ср. балл</div>
              </div>
            </div>
          </div>
        )}

        {/* Фильтры и сортировка */}
        {!loading && !error && attempts.length > 0 && (
          <div style={{ padding: '16px 24px 0', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="assign-filters" style={{ marginBottom: 0 }}>
              <button
                className={`assign-filter ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Все <span className="cnt">{stats.total}</span>
              </button>
              <button
                className={`assign-filter ${filter === 'passed' ? 'active' : ''}`}
                onClick={() => setFilter('passed')}
              >
                Сдали <span className="cnt">{stats.passed}</span>
              </button>
              <button
                className={`assign-filter ${filter === 'failed' ? 'active' : ''}`}
                onClick={() => setFilter('failed')}
              >
                Не сдали <span className="cnt">{stats.failed}</span>
              </button>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Сортировка:</span>
              <select
                className="select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'score' | 'name')}
                style={{ height: 34, padding: '0 10px', fontSize: 13, width: 'auto' }}
              >
                <option value="date">По дате (новые)</option>
                <option value="score">По баллу (высокие)</option>
                <option value="name">По имени (А-Я)</option>
              </select>
            </div>
          </div>
        )}

        <div className="modal-body" style={{ padding: 0 }}>
          {loading && (
            <div className="ld-empty" style={{ padding: 40 }}>Загружаем…</div>
          )}
          {error && !loading && (
            <div style={{ padding: 20 }}>
              <div className="auth-error">{error}</div>
            </div>
          )}
          {!loading && !error && attempts.length === 0 && (
            <div className="ld-empty" style={{ padding: 40 }}>
              <IconList size={36} />
              <p style={{ marginTop: 8 }}>Никто ещё не проходил этот тест</p>
            </div>
          )}
          {!loading && !error && sorted.length === 0 && attempts.length > 0 && (
            <div className="ld-empty" style={{ padding: 40 }}>
              Нет попыток с таким фильтром
            </div>
          )}
          {!loading && !error && sorted.length > 0 && (
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              <table className="mat-table">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Дата</th>
                    <th>Правильных</th>
                    <th>Балл</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="mat-title">
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                            {getInitials(a.userName)}
                          </div>
                          <div>
                            <div className="t-name">{a.userName}</div>
                            {(a as { userEmail?: string }).userEmail && (
                              <div className="t-desc">{(a as { userEmail?: string }).userEmail}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{fmtDate(a.createdAt)}</td>
                      <td>{a.correct} из {a.total}</td>
                      <td>
                        <strong style={{ color: a.passed ? 'var(--success)' : 'var(--danger)' }}>
                          {a.score}%
                        </strong>
                      </td>
                      <td>
                        {a.passed
                          ? <span className="badge badge-success">✓ Сдал</span>
                          : <span className="badge badge-danger">✕ Не сдал</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-foot" style={{ flexWrap: 'wrap', gap: 8 }}>
          {!loading && !error && attempts.length > 0 && (
            <>
              <button
                className="btn btn-outline"
                onClick={exportExcel}
                type="button"
                title="Откроется в Excel как таблица"
              >
                <IconUpload size={16} /> Excel (.xls)
              </button>
              <button
                className="btn btn-primary"
                onClick={exportCSV}
                type="button"
                title="CSV с разделителем «;» — откроется в Excel без настройки"
              >
                <IconUpload size={16} /> Скачать CSV
              </button>
            </>
          )}
          <button
            className="btn btn-ghost"
            onClick={onClose}
            type="button"
            style={{ marginLeft: 'auto' }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== хелперы ===== */
function formatDateTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function escapeCSV(value: string): string {
  const s = String(value ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}