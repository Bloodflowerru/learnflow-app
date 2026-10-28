import { useRef, useState } from 'react';
import { useToast } from '../lib/utils';
import { IconUpload } from '../lib/icons';

const MAX_SIZE = 100 * 1024 * 1024; // 100 МБ

interface ScormUploadProps {
  onUploaded?: () => void;
  className?: string;
  label?: string;
}

export function ScormUpload({
  onUploaded,
  className = 'btn btn-outline',
  label = 'Загрузить SCORM',
}: ScormUploadProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast('Только ZIP-архивы', 'error');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast('Максимум 100 МБ', 'error');
      return;
    }

    setUploading(true);
    const tid = toast('Загружаем SCORM-пакет…', 'info');
    try {
      const token = localStorage.getItem('lf_token');
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/scorm/upload', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Ошибка загрузки');
      }

      const title = (data as { material?: { title?: string } }).material?.title;
      toast('SCORM «' + (title || file.name) + '» загружен');
      onUploaded?.();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setUploading(false);
      void tid;
    }
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={pick}
        disabled={uploading}
      >
        <IconUpload size={18} />
        {uploading ? 'Загрузка…' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </>
  );
}