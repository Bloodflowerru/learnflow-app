import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { AppHeader } from '../components/AppHeader';
import { useToast, getInitials } from '../lib/utils';
import {
  updateProfile, changePassword, uploadAvatar, deleteAvatar,
} from '../lib/api-profile';
import {
  IconUpload, IconClose, IconLogout, IconArrowLeft,
} from '../lib/icons';

const ROLE_LABEL: Record<string, string> = {
  learner: 'Учащийся',
  admin: 'Администратор',
  superadmin: 'Супер-админ',
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function Profile() {
  const user = useAuth((s) => s.user);
  const setAuth = useAuth((s) => s.setAuth);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!user) {
    return (
      <>
        <AppHeader />
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)' }}>
          Профиль недоступен
        </div>
      </>
    );
  }

  const token = localStorage.getItem('lf_token') || '';
  const homePath = user.role === 'learner' ? '/learner' : '/admin';
  const initials = getInitials(user.name);

  const clearMessages = () => { setError(''); setSuccess(''); };

  const handleSaveName = async () => {
    clearMessages();
    const trimmed = name.trim();
    if (!trimmed) { setError('Укажите имя'); return; }
    if (trimmed === user.name) { toast('Имя не изменилось'); return; }
    setSavingName(true);
    try {
      const updated = await updateProfile({ name: trimmed });
      setAuth(updated, token);
      setSuccess('Имя обновлено');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    clearMessages();
    if (!currentPassword) { setError('Укажите текущий пароль'); return; }
    if (newPassword.length < 6) { setError('Новый пароль минимум 6 символов'); return; }
    if (newPassword !== newPassword2) { setError('Пароли не совпадают'); return; }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
      setSuccess('Пароль изменён');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Только изображения', 'error');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast('Максимум 5 МБ', 'error');
      return;
    }
    setUploadingAvatar(true);
    try {
      const updated = await uploadAvatar(file);
      setAuth(updated, token);
      toast('Фото обновлено');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Удалить фото профиля?')) return;
    setUploadingAvatar(true);
    try {
      const updated = await deleteAvatar();
      setAuth(updated, token);
      toast('Фото удалено');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    if (!confirm('Выйти из аккаунта?')) return;
    logout();
    toast('Вы вышли');
    navigate('/', { replace: true });
  };

  return (
    <>
      <AppHeader />
      <div className="profile-shell">
        <div className="profile-header">
          <div className="profile-avatar-wrap">
            {user.avatarUrl ? (
              <img className="profile-avatar-img" src={user.avatarUrl} alt={user.name} />
            ) : (
              <div className={'profile-avatar' + (user.role === 'superadmin' ? ' super' : '')}>
                {initials}
              </div>
            )}

            <button
              className="profile-avatar-btn"
              onClick={handleAvatarPick}
              disabled={uploadingAvatar}
              title="Загрузить фото"
              type="button"
            >
              <IconUpload size={16} />
            </button>

            {user.avatarUrl && (
              <button
                className="profile-avatar-remove"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                title="Удалить фото"
                type="button"
              >
                <IconClose size={14} />
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>

          <div>
            <h1>{user.name}</h1>
            <p>{user.email} · {ROLE_LABEL[user.role] || user.role}</p>
          </div>
        </div>

        <div className="profile-section">
          <h2>Личные данные</h2>
          <div className="field">
            <label>Имя</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              value={user.email}
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button
            className="btn btn-primary"
            onClick={handleSaveName}
            disabled={savingName}
            type="button"
          >
            {savingName ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>

        <div className="profile-section">
          <h2>Смена пароля</h2>
          <div className="field">
            <label>Текущий пароль</label>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label>Новый пароль</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label>Повторите новый пароль</label>
            <input
              className="input"
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleChangePassword}
            disabled={savingPassword}
            type="button"
          >
            {savingPassword ? 'Меняем…' : 'Сменить пароль'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate(homePath)} type="button">
            <IconArrowLeft size={16} /> {user.role === 'learner' ? 'В кабинет' : 'В админку'}
          </button>
          <button className="btn btn-danger" onClick={handleLogout} type="button">
            <IconLogout size={16} /> Выйти
          </button>
        </div>
      </div>
    </>
  );
}