export type Role = 'superadmin' | 'admin' | 'learner';
export type MaterialType = 'course' | 'test' | 'longread' | 'scorm' | 'trainer' | 'screencast' | 'flipbook';
export type AssignmentStatus = 'new' | 'in-progress' | 'due-soon' | 'overdue' | 'completed' | 'deleted';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Material {
  id: string;
  companyId: string;
  title: string;
  desc: string;
  type: MaterialType;
  status: 'draft' | 'published';
  author: string;
  updated: string;
  learners: number;
  hasQuiz?: boolean;
  lessonCount?: number;
  completedLessons?: number;
  percent?: number;
  started?: boolean;
  completed?: boolean;
  scormStatus?: string;
  scormScore?: number | null;
  scormCompleted?: boolean;
  scormVersion?: string;
  assigned?: boolean;
  assignmentStatus?: AssignmentStatus;
  dueAt?: string | null;
  isMandatory?: boolean;
  ontent?: Array<Record<string, unknown>>;
  style?: Record<string, unknown>;
  quiz?: Record<string, unknown> | null;
  lessons?: Array<{ id: string; type: string; materialId: string }>;
}

export interface CourseProgress {
  id: string;
  title: string;
  desc: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  started: boolean;
  completed: boolean;
}

export interface LearningMy {
  courses: CourseProgress[];
  stats: {
    totalCourses: number;
    startedCourses: number;
    completedCourses: number;
    lessonsCompleted: number;
    testsPassed: number;
    totalAttempts: number;
    avgScore: number;
  };
}

export interface Assignment {
  id: string;
  materialId: string;
  userId: string;
  dueAt: string | null;
  isMandatory: boolean;
  createdAt: string;
  materialTitle: string;
  materialType: MaterialType;
  materialDesc: string;
  status: AssignmentStatus;
  percent: number;
  completed: boolean;
  assignedByName?: string;
  // Поля с сервера для admin-таблицы
  userName?: string;
  userEmail?: string;
}

export interface MyProgress {
  totalAttempts: number;
  passedCount: number;
  avgScore: number;
  byMaterial: Record<string, { attempts: number; best: number; passed: boolean; lastAt: string | null }>;
  recent: Array<{ materialId: string; materialTitle: string; score: number; passed: boolean; createdAt: string }>;
}

export interface AdminAnalytics {
  stats: {
    employees: number;
    active: number;
    completedAny: number;
    avgProgress: number;
    totalCourses: number;
    totalAttempts: number;
    avgScore: number;
    assignments: {
      total: number;
      completed: number;
      overdue: number;
      dueSoon: number;
      inProgress: number;
      notStarted: number;
    };
  };
  courses: Array<{
    id: string;
    title: string;
    totalLessons: number;
    started: number;
    completed: number;
    avgPercent: number;
  }>;
  activityByDay: Array<{ date: string; attempts: number; completions: number }>;
  topEmployees: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    lessons: number;
    testsPassed: number;
    coursesCompleted: number;
    avgScore: number;
  }>;
  recentAttempts: Array<{
    userName: string;
    materialTitle: string;
    score: number;
    passed: boolean;
    createdAt: string;
  }>;
}

export interface AssignmentStats {
  total: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  inProgress: number;
  notStarted: number;
}

const TOKEN_KEY = 'lf_token';
const USER_KEY = 'lf_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error((data.error as string) || 'Ошибка запроса') as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

/* ===== Auth ===== */
export async function login(email: string, password: string): Promise<LoginResponse> {
  return api<LoginResponse>('/login', { method: 'POST', body: { email, password } });
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  role: 'learner' | 'admin';
  companyName?: string;
  companyCode?: string;
}): Promise<LoginResponse> {
  return api<LoginResponse>('/register', { method: 'POST', body: payload });
}

export async function me(): Promise<{ user: User }> {
  return api<{ user: User }>('/me');
}

export async function updateMe(name: string): Promise<{ user: User }> {
  return api<{ user: User }>('/users/me', { method: 'PUT', body: { name } });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>('/users/me/password', { method: 'POST', body: { currentPassword, newPassword } });
}

/* ===== LMS data ===== */
export async function getMyLearning(): Promise<LearningMy> {
  return api<LearningMy>('/learning/my');
}

export async function getMyAssignments(): Promise<{ assignments: Assignment[] }> {
  return api<{ assignments: Assignment[] }>('/assignments/my');
}

export async function getMaterials(): Promise<{ materials: Material[] }> {
  return api<{ materials: Material[] }>('/materials');
}

export async function getMyProgress(): Promise<MyProgress> {
  return api<MyProgress>('/my/progress');
}

/* ===== Admin ===== */
export async function getCompanyAnalytics(): Promise<AdminAnalytics> {
  return api<AdminAnalytics>('/analytics/company');
}

export async function getAllUsers(): Promise<{ users: User[] }> {
  return api<{ users: User[] }>('/users');
}

export async function getAllAssignments(): Promise<{ assignments: Assignment[] }> {
  return api<{ assignments: Assignment[] }>('/assignments');
}

export async function getAssignmentStats(): Promise<AssignmentStats> {
  return api<AssignmentStats>('/assignments/stats');
}

export async function deleteMaterial(id: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/materials/${id}`, { method: 'DELETE' });
}

export async function cancelAssignment(id: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/assignments/${id}`, { method: 'DELETE' });
}

export async function createAssignments(payload: {
  materialId: string;
  userIds: string[];
  dueAt: string | null;
  isMandatory: boolean;
}): Promise<{ assignments: Assignment[]; count: number }> {
  return api<{ assignments: Assignment[]; count: number }>('/assignments', {
    method: 'POST',
    body: payload
  });
}
export async function createMaterial(payload: {
  title: string;
  description?: string;
  type: MaterialType;
  ai?: boolean;
}): Promise<{ material: Material }> {
  return api<{ material: Material }>('/materials', { method: 'POST', body: payload });
}
export async function getMaterial(id: string): Promise<{ material: Material }> {
  return api<{ material: Material }>(`/materials/${id}`);
}

export async function updateMaterial(
  id: string,
  payload: Record<string, unknown>
): Promise<{ material: Material }> {
  return api<{ material: Material }>(`/materials/${id}`, { method: 'PUT', body: payload });
}