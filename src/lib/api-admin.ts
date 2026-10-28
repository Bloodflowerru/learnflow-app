function authHeader(): Record<string, string> {
  const t = localStorage.getItem('lf_token');
  return t ? { Authorization: 'Bearer ' + t } : {};
}

export async function createAssignment(data: {
  materialId: string;
  userIds: string[];
  dueAt: string | null;
  isMandatory: boolean;
}): Promise<{ count: number }> {
  const res = await fetch('/api/assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Ошибка назначения');
  return json as { count: number };
}

export interface Attempt {
  id: string;
  userId: string;
  userName: string;
  createdAt: string;
  correct: number;
  total: number;
  score: number;
  passed: boolean;
}

export async function getAttempts(materialId: string): Promise<Attempt[]> {
  const res = await fetch('/api/materials/' + materialId + '/attempts', {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error('Не удалось загрузить результаты');
  const json = await res.json().catch(() => ({}));
  return ((json as { attempts?: Attempt[] }).attempts) || [];
}
// ===== Компании и пользователи =====
export interface Company {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface GlobalAnalytics {
  stats: {
    companies: number;
    users: number;
    materials: number;
    attempts: number;
    avgScore: number;
    avgProgress: number;
  };
  companiesStats: Array<{
    id: string;
    name: string;
    users: number;
    courses: number;
    completedCourses: number;
    avgProgress: number;
  }>;
}

export async function getAllCompanies(): Promise<Company[]> {
  const res = await fetch('/api/companies', { headers: authHeader() });
  if (!res.ok) throw new Error('Не удалось загрузить компании');
  const d = await res.json().catch(() => ({}));
  return (d as { companies?: Company[] }).companies || [];
}

export async function createCompany(data: { name: string }): Promise<Company> {
  const res = await fetch('/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Ошибка создания');
  return (json as { company: Company }).company;
}

export async function deleteCompany(id: string): Promise<void> {
  const res = await fetch('/api/companies/' + id, {
    method: 'DELETE',
    headers: authHeader(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string }).error || 'Ошибка удаления');
  }
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: 'learner' | 'admin';
  companyId?: string;
}): Promise<{ id: string; name: string; email: string; role: string }> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Ошибка создания пользователя');
  return (json as { user: { id: string; name: string; email: string; role: string } }).user;
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch('/api/users/' + id, {
    method: 'DELETE',
    headers: authHeader(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string }).error || 'Ошибка удаления');
  }
}

export async function getGlobalAnalytics(): Promise<GlobalAnalytics | null> {
  try {
    const res = await fetch('/api/analytics/global', { headers: authHeader() });
    if (!res.ok) return null;
    return (await res.json()) as GlobalAnalytics;
  } catch {
    return null;
  }
}
// ===== Массовое создание пользователей =====
export interface BulkUserInput {
  name: string;
  email: string;
  password: string;
  role: 'learner' | 'admin';
}

export interface BulkCreateResult {
  created: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    password: string;
  }>;
  skipped: Array<{
    email: string;
    name: string;
    reason: string;
  }>;
  total: number;
}

export async function bulkCreateUsers(
  users: BulkUserInput[],
  companyId?: string
): Promise<BulkCreateResult> {
  const res = await fetch('/api/users/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ users, companyId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Ошибка импорта');
  return json as BulkCreateResult;
}