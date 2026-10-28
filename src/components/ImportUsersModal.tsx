import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../lib/utils';
import {
  bulkCreateUsers, type BulkCreateResult, type Company,
} from '../lib/api-admin';
import {
  IconClose, IconUpload, IconCheck, IconUsers, IconTrash,
} from '../lib/icons';

interface Props {
  companies?: Company[];
  defaultCompanyId?: string;
  allowCompanySelect?: boolean;
  allowAdminRole?: boolean;
  onClose: () => void;
  onImported: (result: BulkCreateResult) => void;
}

interface ParsedRow {
  name: string;
  email: string;
  password: string;
  role: 'learner' | 'admin';
  error?: string;
}

/* ===== CSV-парсер (поддерживает "кавычки", ;, \t, запятые) ===== */
function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t';
  if (line.includes(';') && !line.includes(',')) return ';';
  return ',';
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((s) => s.trim());
}

function parseCSV(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, ''); // BOM
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => parseCSVLine(line, delimiter));
}

/* ===== Валидация ===== */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validateRows(
  raw: string[][],
  allowAdminRole: boolean
): { rows: ParsedRow[]; headerSkipped: boolean } {
  if (raw.length === 0) return { rows: [], headerSkipped: false };

  // Определяем, есть ли заголовок
  const first = raw[0].map((c) => c.toLowerCase());
  const hasHeader =
    first.includes('name') ||
    first.includes('имя') ||
    first.includes('email') ||
    first.includes('почта');

  const dataRows = hasHeader ? raw.slice(1) : raw;

  const rows: ParsedRow[] = dataRows.map((cols) => {
    const [name = '', email = '', password = '', roleRaw = ''] = cols;
    const role = roleRaw.toLowerCase().trim();

    const row: ParsedRow = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      role: role === 'admin' ? 'admin' : 'learner',
    };

    // Валидация
    if (!row.name) { row.error = 'Нет имени'; return row; }
    if (!row.email) { row.error = 'Нет email'; return row; }
    if (!EMAIL_RE.test(row.email)) { row.error = 'Некорректный email'; return row; }
    if (row.password && row.password.length < 6) {
      row.error = 'Пароль короче 6 символов';
      return row;
    }
    if (role && role !== 'learner' && role !== 'admin' && role !== 'учащийся' && role !== 'админ' && role !== 'администратор') {
      row.error = `Неизвестная роль: ${roleRaw}`;
      return row;
    }
    if (row.role === 'admin' && !allowAdminRole) {
      row.error = 'Админ недоступен для вашей роли';
      return row;
    }

    return row;
  });

  return { rows, headerSkipped: hasHeader };
}

/* ===== Генерация пароля ===== */
function genPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function ImportUsersModal({
  companies = [],
  defaultCompanyId,
  allowCompanySelect = false,
  allowAdminRole = false,
  onClose,
  onImported,
}: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [companyId, setCompanyId] = useState<string>(
    defaultCompanyId || (companies[0]?.id ?? '')
  );
  const [fileName, setFileName] = useState('');
  const [headerSkipped, setHeaderSkipped] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkCreateResult | null>(null);
  const [error, setError] = useState('');

  const validRows = rows.filter((r) => !r.error);
  const errorRows = rows.filter((r) => r.error);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError('Только CSV или TXT файлы');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Файл больше 2 МБ');
      return;
    }

    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setError('Файл пуст');
          return;
        }
        const { rows: parsedRows, headerSkipped: hs } = validateRows(parsed, allowAdminRole);
        setRows(parsedRows);
        setHeaderSkipped(hs);
      } catch (err) {
        setError('Ошибка парсинга: ' + (err as Error).message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const removeRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const handleImport = async () => {
    if (validRows.length === 0) {
      setError('Нет валидных строк для импорта');
      return;
    }
    if (allowCompanySelect && !companyId) {
      setError('Выберите компанию');
      return;
    }

    setError('');
    setImporting(true);

    try {
      const users = validRows.map((r) => ({
        name: r.name,
        email: r.email,
        password: r.password || genPassword(),
        role: r.role,
      }));

      const res = await bulkCreateUsers(users, allowCompanySelect ? companyId : defaultCompanyId);
      setResult(res);
      toast(`Создано ${res.created.length} из ${res.total}`);
      onImported(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const header = 'name,email,password,role';
    const example = [
      'Иван Иванов,ivan@company.ru,,learner',
      'Пётр Петров,petr@company.ru,,learner',
      allowAdminRole
        ? 'Мария Сидорова,maria@company.ru,,admin'
        : '',
    ].filter(Boolean).join('\n');
    const csv = '\uFEFF' + header + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users-template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('Шаблон скачан');
  };

  const downloadResultCSV = () => {
    if (!result) return;
    const header = 'name,email,password,role,status';
    const lines: string[] = [header];
    result.created.forEach((u) => {
      lines.push(`${escapeCSV(u.name)},${u.email},${u.password},${u.role},создан`);
    });
    result.skipped.forEach((s) => {
      lines.push(`${escapeCSV(s.name)},${s.email},,,"пропущен: ${s.reason}"`);
    });
    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users-import-result.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const modal = (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 800 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>Импорт пользователей из CSV</h2>
            <p>
              {result
                ? 'Результат импорта'
                : rows.length === 0
                  ? 'Загрузите CSV-файл с пользователями'
                  : `Найдено ${rows.length} строк · валидных: ${validRows.length}`}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} type="button">
            <IconClose size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* === Результат === */}
          {result ? (
            <>
              <div className="ld-stats" style={{ marginBottom: 16 }}>
                <div className="ld-stat">
                  <div className="ld-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                    <IconCheck size={22} />
                  </div>
                  <div className="ld-stat-value">{result.created.length}</div>
                  <div className="ld-stat-label">Создано</div>
                </div>
                <div className="ld-stat">
                  <div className="ld-stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
                    <IconClose size={22} />
                  </div>
                  <div className="ld-stat-value">{result.skipped.length}</div>
                  <div className="ld-stat-label">Пропущено</div>
                </div>
                <div className="ld-stat">
                  <div className="ld-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
                    <IconUsers size={22} />
                  </div>
                  <div className="ld-stat-value">{result.total}</div>
                  <div className="ld-stat-label">Всего обработано</div>
                </div>
              </div>

              {result.created.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--success)' }}>
                    ✓ Созданные пользователи (пароли сохранены в CSV)
                  </div>
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table className="mat-table" style={{ minWidth: 0 }}>
                      <thead>
                        <tr><th>Имя</th><th>Email</th><th>Пароль</th><th>Роль</th></tr>
                      </thead>
                      <tbody>
                        {result.created.map((u) => (
                          <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td><code style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{u.password}</code></td>
                            <td>
                              <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-muted'}`}>
                                {u.role === 'admin' ? 'Админ' : 'Учащийся'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.skipped.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--danger)' }}>
                    ✕ Пропущено (уже существуют или ошибка)
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                    {result.skipped.map((s, i) => (
                      <div key={i} style={{ fontSize: 12, padding: '6px 8px', borderBottom: i < result.skipped.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <strong>{s.email}</strong> — {s.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* === Компания === */}
              {allowCompanySelect && (
                <div className="field">
                  <label>Компания</label>
                  <select
                    className="select"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    {companies.length === 0 ? (
                      <option value="">— Нет компаний —</option>
                    ) : (
                      companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* === Загрузка файла === */}
              {rows.length === 0 ? (
                <>
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: 40,
                      border: '2px dashed var(--border)',
                      borderRadius: 10,
                      background: 'var(--bg)',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFile}
                      style={{ display: 'none' }}
                    />
                    <IconUpload size={32} />
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Выберите CSV или перетащите</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Колонки: name, email, password, role
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Пароль можно оставить пустым — сгенерируется автоматически
                    </div>
                  </label>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn btn-outline btn-sm" onClick={downloadTemplate} type="button">
                      📥 Скачать шаблон CSV
                    </button>
                  </div>

                  <div style={{ marginTop: 16, padding: 12, background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1e40af' }}>
                    <strong>Пример файла:</strong>
                    <pre style={{ margin: '6px 0 0', fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.5 }}>
{`name,email,password,role
Иван Иванов,ivan@company.ru,,learner
Пётр Петров,petr@company.ru,mypass123,learner${allowAdminRole ? '\nМария Сидорова,maria@company.ru,,admin' : ''}`}
                    </pre>
                  </div>
                </>
              ) : (
                <>
                  {/* === Превью === */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {fileName} {headerSkipped && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(заголовок пропущен)</span>}
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setRows([]); setFileName(''); setHeaderSkipped(false); }}
                      type="button"
                    >
                      × Выбрать другой файл
                    </button>
                  </div>

                  <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table className="mat-table" style={{ minWidth: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th>
                          <th>Имя</th>
                          <th>Email</th>
                          <th>Пароль</th>
                          <th>Роль</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} style={{ background: r.error ? '#fef2f2' : undefined }}>
                            <td style={{ color: 'var(--text-3)', fontSize: 11 }}>{i + 1}</td>
                            <td>{r.name || <em style={{ color: 'var(--text-3)' }}>—</em>}</td>
                            <td>{r.email || <em style={{ color: 'var(--text-3)' }}>—</em>}</td>
                            <td>
                              {r.password
                                ? <code style={{ fontSize: 11, background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>{r.password}</code>
                                : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>сгенерируется</span>}
                            </td>
                            <td>
                              <span className={`badge ${r.role === 'admin' ? 'badge-primary' : 'badge-muted'}`} style={{ fontSize: 10 }}>
                                {r.role === 'admin' ? 'Админ' : 'Учащийся'}
                              </span>
                            </td>
                            <td>
                              {r.error ? (
                                <span title={r.error} style={{ color: 'var(--danger)', fontSize: 11, cursor: 'help' }}>⚠</span>
                              ) : (
                                <button
                                  className="row-action danger"
                                  onClick={() => removeRow(i)}
                                  type="button"
                                  title="Удалить строку"
                                >
                                  <IconTrash size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {errorRows.length > 0 && (
                    <div style={{ marginTop: 10, padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                      <strong>Ошибки в {errorRows.length} строк(ах):</strong>
                      <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                        {errorRows.slice(0, 5).map((r, i) => (
                          <li key={i}>Строка {rows.indexOf(r) + 1}: {r.error} ({r.email || r.name})</li>
                        ))}
                        {errorRows.length > 5 && <li>…и ещё {errorRows.length - 5}</li>}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
            </>
          )}
        </div>

        <div className="modal-foot">
          {result ? (
            <>
              <button className="btn btn-outline" onClick={downloadResultCSV} type="button">
                📥 Скачать результат (CSV)
              </button>
              <button className="btn btn-primary" onClick={onClose} type="button">
                Готово
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={onClose} type="button" disabled={importing}>
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                type="button"
              >
                <IconCheck size={16} />
                {importing
                  ? 'Импортируем…'
                  : `Импортировать ${validRows.length} пользовател${validRows.length === 1 ? 'я' : 'ей'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function escapeCSV(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}