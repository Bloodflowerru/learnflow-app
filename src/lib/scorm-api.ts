export interface ScormInitialState {
  'cmi.core.lesson_status'?: string;
  'cmi.core.score.raw'?: string;
  'cmi.core.score.min'?: string;
  'cmi.core.score.max'?: string;
  'cmi.suspend_data'?: string;
  'cmi.core.lesson_location'?: string;
  'cmi.core.exit'?: string;
  'cmi.core.session_time'?: string;
  attempts?: number;
}

interface SetupOptions {
  initialState: ScormInitialState;
  user: { id: string; name: string };
  onTrack: (payload: Record<string, string>) => Promise<void>;
  onFinish: () => Promise<void>;
}

export function setupScormAPI(opts: SetupOptions): () => void {
  const s: Record<string, string> = {
    'cmi._version': '3.4',
    'cmi.core._children':
      'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time',
    'cmi.core.student_id': opts.user.id,
    'cmi.core.student_name': opts.user.name.replace(/,/g, ' '),
    'cmi.core.lesson_location': opts.initialState['cmi.core.lesson_location'] || '',
    'cmi.core.credit': 'credit',
    'cmi.core.lesson_status': opts.initialState['cmi.core.lesson_status'] || 'not attempted',
    'cmi.core.entry': (opts.initialState.attempts || 0) > 0 ? 'resume' : 'ab-initio',
    'cmi.core.score._children': 'raw,min,max',
    'cmi.core.score.raw': opts.initialState['cmi.core.score.raw'] || '',
    'cmi.core.score.min': opts.initialState['cmi.core.score.min'] || '',
    'cmi.core.score.max': opts.initialState['cmi.core.score.max'] || '',
    'cmi.core.total_time': '00:00:00',
    'cmi.core.lesson_mode': 'normal',
    'cmi.core.exit': '',
    'cmi.core.session_time': '',
    'cmi.suspend_data': opts.initialState['cmi.suspend_data'] || '',
    'cmi.launch_data': '',
    'cmi.comments': '',
    'cmi.comments_from_lms': '',
    'cmi.objectives._children': 'id,score,status',
    'cmi.objectives._count': '0',
    'cmi.student_data._children': 'mastery_score,max_time_allowed,time_limit_action',
    'cmi.student_data.mastery_score': '',
    'cmi.student_data.max_time_allowed': '',
    'cmi.student_data.time_limit_action': '',
    'cmi.student_preference._children': 'audio,language,speed,text',
    'cmi.student_preference.audio': '0',
    'cmi.student_preference.language': '',
    'cmi.student_preference.speed': '0',
    'cmi.student_preference.text': '0',
    'cmi.interactions._children': 'id,objectives,time,type,student_response,result,latency',
    'cmi.interactions._count': '0',
  };

  let initialized = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  // Защита от параллельных flush: если flush уже идёт — ставим в очередь
  let flushing: Promise<void> = Promise.resolve();

  const snapshot = (): Record<string, string> => ({
    'cmi.core.lesson_status': s['cmi.core.lesson_status'],
    'cmi.core.score.raw': s['cmi.core.score.raw'],
    'cmi.core.score.min': s['cmi.core.score.min'],
    'cmi.core.score.max': s['cmi.core.score.max'],
    'cmi.suspend_data': s['cmi.suspend_data'],
    'cmi.core.lesson_location': s['cmi.core.lesson_location'],
    'cmi.core.exit': s['cmi.core.exit'],
    'cmi.core.session_time': s['cmi.core.session_time'],
  });

  /** Отправляет текущее состояние на сервер. Возвращает Promise — можно await. */
  const flush = async (): Promise<void> => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    const data = snapshot();
    flushing = flushing
      .catch(() => { /* игнорируем прошлые ошибки */ })
      .then(() => opts.onTrack(data));
    await flushing;
  };

  /** Отправляет flush + finish. Вызывается при выходе из SCORM-курса. */
  const finish = async (): Promise<void> => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    await flush();
    await opts.onFinish();
  };

  const schedule = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void flush().catch(() => { /* noop */ });
    }, 1000);
  };

  const W = window as unknown as Record<string, unknown>;

  W.API = {
    LMSInitialize: () => { initialized = true; return 'true'; },
    LMSFinish: () => {
      if (!initialized) return 'false';
      // Запускаем flush (track), но НЕ блокируем возврат — SCORM 1.2 требует sync-return
      void flush().catch(() => { /* noop */ });
      initialized = false;
      return 'true';
    },
    LMSGetValue: (key: string) => (s[key] !== undefined ? String(s[key]) : ''),
    LMSSetValue: (key: string, val: string) => {
      const old = s[key];
      s[key] = String(val);
      if (
        key === 'cmi.core.lesson_status' &&
        (val === 'passed' || val === 'completed' || val === 'failed') &&
        old !== val
      ) {
        // Статус финальный — отправляем немедленно, чтобы tryCompleteScormLesson сработал
        void flush().catch(() => { /* noop */ });
      } else {
        schedule();
      }
      return 'true';
    },
    LMSCommit: () => {
      void flush().catch(() => { /* noop */ });
      return 'true';
    },
    LMSGetLastError: () => '0',
    LMSGetErrorString: () => '',
    LMSGetDiagnostic: () => '',
  };

  // SCORM 2004 — заглушка (совместимость с курсами, которые её ищут)
  W.API_1484_11 = {
    Initialize: () => 'true',
    Terminate: () => 'true',
    GetValue: () => '',
    SetValue: () => 'true',
    Commit: () => 'true',
    GetLastError: () => '0',
    GetErrorString: () => '',
    GetDiagnostic: () => '',
  };

  // Экспортируем функции, которые вызывает ScormView перед выходом
  W.__scormFlush = () => flush();
  W.__scormFinish = () => finish();

  // На закрытие/обновление страницы — best effort flush без await
  const onUnload = () => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    const data = snapshot();
    const token = localStorage.getItem('lf_token');
    // sendBeacon не умеет заголовки, поэтому fetch с keepalive
    // но у нас URL с параметрами — нужен trackScorm. Проще — синхронный XHR через fetch keepalive
    try {
      void fetch(
        (W.__scormTrackUrl as string) || '/api/scorm/_/track',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          body: JSON.stringify(data),
          keepalive: true,
        }
      );
    } catch { /* noop */ }
  };
  window.addEventListener('pagehide', onUnload);

  return () => {
    window.removeEventListener('pagehide', onUnload);
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { delete W.API; } catch { /* noop */ }
    try { delete W.API_1484_11; } catch { /* noop */ }
    try { delete W.__scormFlush; } catch { /* noop */ }
    try { delete W.__scormFinish; } catch { /* noop */ }
  };
}