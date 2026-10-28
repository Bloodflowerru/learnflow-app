import type { User } from './api';

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('lf_token');
  return t ? { Authorization: 'Bearer ' + t } : {};
}

export async function updateProfile(data: { name: string }): Promise<User> {
  const res = await fetch('/api/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Ошибка');
  return (json as { user: User }).user;
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const res = await fetch('/api/users/me/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Ошибка');
}

export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/users/me/avatar', {
    method: 'POST',
    headers: authHeader(),
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Ошибка загрузки');
  return (json as { user: User }).user;
}

export async function deleteAvatar(): Promise<User> {
  const res = await fetch('/api/users/me/avatar', {
    method: 'DELETE',
    headers: authHeader(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Ошибка');
  return (json as { user: User }).user;
}