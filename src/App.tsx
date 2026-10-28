import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './store/auth';
import { Login } from './pages/Login';
import { LearnerHome } from './pages/LearnerHome';
import { Profile } from './pages/Profile';
import { AdminHome } from './pages/AdminHome';
import { LongreadEditor } from './pages/LongreadEditor';
import { Landing } from './pages/Landing';
import { PublicPage } from './pages/PublicPage';
import { Read } from './pages/Read';
import { QuizTake } from './pages/QuizTake';
import { CourseTake } from './pages/CourseTake';
import { ScormView } from './pages/ScormView';
import { CourseEditor } from './pages/CourseEditor';
import { QuizEditor } from './pages/QuizEditor';
import { TrainerEditor } from './pages/TrainerEditor';
import { TrainerTake } from './pages/TrainerTake';
import { SuperAdmin } from './pages/SuperAdmin';
import { DevPanel } from './pages/DevPanel';          // ← 1. добавить импорт

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)' }}>
        Загрузка…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  const location = useLocation();
  if (loading) {
    return <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)' }}>Загрузка…</div>;
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== 'superadmin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Публичные */}
        <Route path="/" element={<Landing />} />
        <Route path="/page/:page" element={<PublicPage />} />
        <Route path="/login" element={<Login />} />

        {/* Dev-панель — только в dev-режиме */}
        {import.meta.env.DEV && (
          <Route path="/dev" element={<DevPanel />} />   // ← 2. добавить роут
        )}

        {/* Учащийся */}
        <Route path="/learner" element={<RequireAuth><LearnerHome /></RequireAuth>} />
        <Route path="/read/:id" element={<RequireAuth><Read /></RequireAuth>} />
        <Route path="/quiz/:id" element={<RequireAuth><QuizTake /></RequireAuth>} />
        <Route path="/course/:id" element={<RequireAuth><CourseTake /></RequireAuth>} />
        <Route path="/trainer/:id" element={<RequireAuth><TrainerTake /></RequireAuth>} />
        <Route path="/scorm/:id" element={<RequireAuth><ScormView /></RequireAuth>} />

        {/* Админ */}
        <Route path="/admin" element={<RequireAuth><AdminHome /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/editor/:id" element={<RequireAuth><LongreadEditor /></RequireAuth>} />
        <Route path="/course-editor/:id" element={<RequireAuth><CourseEditor /></RequireAuth>} />
        <Route path="/quiz-editor/:id" element={<RequireAuth><QuizEditor /></RequireAuth>} />
        <Route path="/trainer-editor/:id" element={<RequireAuth><TrainerEditor /></RequireAuth>} />

        {/* Супер-админ */}
        <Route path="/superadmin" element={<RequireSuperAdmin><SuperAdmin /></RequireSuperAdmin>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}