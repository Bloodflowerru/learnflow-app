import type { ScormInitialState } from './scorm-api';

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('lf_token');
  return t ? { Authorization: 'Bearer ' + t } : {};
}

export async function loadScormState(materialId: string): Promise<ScormInitialState | null> {
  try {
    const res = await fetch('/api/scorm/' + materialId + '/state', { headers: authHeader() });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.state as ScormInitialState) || null;
  } catch {
    return null;
  }
}

export async function trackScorm(
  materialId: string,
  payload: Record<string, string>,
  courseId?: string,
  lessonId?: string
): Promise<void> {
  try {
    await fetch('/api/scorm/' + materialId + '/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ ...payload, courseId, lessonId }),
    });
  } catch { /* noop */ }
}

export async function finishScorm(
  materialId: string,
  courseId?: string,
  lessonId?: string
): Promise<void> {
  try {
    await fetch('/api/scorm/' + materialId + '/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ courseId, lessonId }),
    });
  } catch { /* noop */ }
}