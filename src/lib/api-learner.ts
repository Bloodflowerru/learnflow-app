import type { Material } from './api';

export interface MyLearningCourse {
  id: string;
  title: string;
  desc?: string;
  percent: number;
  completedLessons: number;
  totalLessons: number;
  completed: boolean;
  started: boolean;
}

export interface MyLearningStats {
  totalCourses: number;
  startedCourses: number;
  completedCourses: number;
  lessonsCompleted: number;
  testsPassed: number;
  totalAttempts: number;
  avgScore: number;
}

export interface MyLearning {
  courses: MyLearningCourse[];
  stats: MyLearningStats;
}

export interface MyProgressItem { passed: boolean; best: number; }

export interface RecentAttempt {
  materialTitle: string;
  passed: boolean;
  score: number;
  createdAt: string;
}

export interface MyProgress {
  totalAttempts: number;
  passedCount: number;
  avgScore: number;
  byMaterial: Record<string, MyProgressItem>;
  recent: RecentAttempt[];
}

export interface LearnerMaterial extends Material {
  hasQuiz?: boolean;
}

/** Читаем токен прямо из localStorage — не зависим от параметра */
function getToken(): string | null {
  return localStorage.getItem('lf_token');
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch('/api' + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Ошибка запроса');
  return data as T;
}

export async function loadMyLearning(_token?: string | null): Promise<MyLearning> {
  try {
    return await apiFetch<MyLearning>('/learning/my');
  } catch {
    return {
      courses: [],
      stats: {
        totalCourses: 0, startedCourses: 0, completedCourses: 0,
        lessonsCompleted: 0, testsPassed: 0, totalAttempts: 0, avgScore: 0,
      },
    };
  }
}

export async function loadMyProgress(_token?: string | null): Promise<MyProgress> {
  try {
    return await apiFetch<MyProgress>('/my/progress');
  } catch {
    return { totalAttempts: 0, passedCount: 0, avgScore: 0, byMaterial: {}, recent: [] };
  }
}

export async function loadLearnerMaterials(_token?: string | null): Promise<LearnerMaterial[]> {
  try {
    const d = await apiFetch<{ materials: LearnerMaterial[] }>('/materials');
    return d.materials || [];
  } catch {
    return [];
  }
}

export async function markMaterialComplete(
  materialId: string,
  _token?: string | null,
  extra?: { courseId?: string; lessonId?: string }
): Promise<void> {
  await apiFetch('/materials/' + materialId + '/complete', {
    method: 'POST',
    body: JSON.stringify(extra || {}),
  });
}

export interface QuizAttempt {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  details?: { questionId: string; correct: boolean }[];
}

export interface SubmitQuizResult {
  attempt: QuizAttempt;
  material?: Material;
}

export async function submitQuiz(
  materialId: string,
  answers: Record<string, string | string[]>,
  extra?: { courseId?: string; lessonId?: string }
): Promise<SubmitQuizResult> {
  return apiFetch<SubmitQuizResult>('/materials/' + materialId + '/submit', {
    method: 'POST',
    body: JSON.stringify({ answers, ...(extra || {}) }),
  });
}


// ===== Курсы =====
export interface CourseLesson {
  id: string;
  type: 'longread' | 'test' | 'scorm';
  materialId: string;
  title?: string;
  completed?: boolean;
}

export interface CourseProgress {
  lessons: CourseLesson[];
  completedCount: number;
  totalCount: number;
  percent: number;
  completed: boolean;
}

export async function loadCourseProgress(courseId: string): Promise<CourseProgress> {
  try {
    return await apiFetch<CourseProgress>('/courses/' + courseId + '/progress');
  } catch {
    return { lessons: [], completedCount: 0, totalCount: 0, percent: 0, completed: false };
  }
}



// ===== Назначения =====
export type AssignmentStatus =
  | 'overdue' | 'due-soon' | 'in-progress' | 'new' | 'completed' | 'deleted';

export interface Assignment {
  id: string;
  materialId: string;
  materialTitle: string;
  materialType: 'course' | 'test' | 'longread' | 'scorm' | 'trainer' | 'screencast' | 'flipbook';
  status: AssignmentStatus;
  dueAt: string | null;
  isMandatory: boolean;
  percent: number;
}

export async function loadMyAssignments(): Promise<Assignment[]> {
  try {
    const d = await apiFetch<{ assignments: Assignment[] }>('/assignments/my');
    return d.assignments || [];
  } catch {
    return [];
  }
}