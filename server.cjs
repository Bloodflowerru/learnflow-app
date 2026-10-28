const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'learnflow-dev-secret-change-in-production';
const JWT_EXPIRES = '7d';
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const SCORM_DIR = path.join(UPLOADS_DIR, 'scorm');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(SCORM_DIR)) fs.mkdirSync(SCORM_DIR, { recursive: true });

function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      const cleanArr = (arr) => Array.isArray(arr) ? arr.filter(x => x && typeof x === 'object') : [];
      d.companies = cleanArr(d.companies);
      d.users = cleanArr(d.users).filter(u => u.id && u.email);
      d.materials = cleanArr(d.materials).filter(m => m.id && m.companyId);
      d.attempts = cleanArr(d.attempts).filter(a => a.userId && a.materialId);
      d.lessonCompletions = cleanArr(d.lessonCompletions).filter(lc => lc.userId && lc.materialId);
      d.assignments = cleanArr(d.assignments).filter(a => a.userId && a.materialId);
      d.scormAttempts = cleanArr(d.scormAttempts).filter(sa => sa.userId && sa.materialId);
      return d;
    }
  } catch (e) { console.error('data.json:', e.message); }
  return { companies: [], users: [], materials: [], attempts: [], lessonCompletions: [], assignments: [], scormAttempts: [] };
}
function saveDB() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
let db = loadDB();
saveDB();

function genCompanyCode(name) {
  const base = String(name || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10) || 'company';
  let code = base, i = 1;
  while (db.companies.some(c => c.code === code)) code = base + (i++);
  return code;
}

async function seed() {
  let changed = false;
  const hash = await bcrypt.hash('demo1234', 10);
  if (!db.users.find(u => u.role === 'superadmin')) {
    db.users.push({ id: 'u_super', name: 'Супер Администратор', email: 'super@demo.ru', passwordHash: hash, role: 'superadmin', companyId: null, createdAt: new Date().toISOString() });
    changed = true;
  }
  let demo = db.companies.find(c => c.code === 'demo');
  if (!demo) { demo = { id: 'c_demo', name: 'Demo Company', code: 'demo', createdAt: new Date().toISOString() }; db.companies.push(demo); changed = true; }
  if (!db.companies.find(c => c.code === 'acme')) { db.companies.push({ id: 'c_acme', name: 'Acme Corp', code: 'acme', createdAt: new Date().toISOString() }); changed = true; }
  if (!db.users.find(u => u.email === 'admin@demo.ru')) {
    db.users.push({ id: 'u_demo_admin', name: 'Игорь Петров', email: 'admin@demo.ru', passwordHash: hash, role: 'admin', companyId: demo.id, createdAt: new Date().toISOString() }); changed = true;
  }
  if (!db.users.find(u => u.email === 'learner@demo.ru')) {
    db.users.push({ id: 'u_demo_learner', name: 'Анна Смирнова', email: 'learner@demo.ru', passwordHash: hash, role: 'learner', companyId: demo.id, createdAt: new Date().toISOString() }); changed = true;
  }
  for (const u of db.users) { if (!u.companyId && u.role !== 'superadmin') { u.companyId = demo.id; changed = true; } }
  for (const m of db.materials) {
    if (!m.companyId) { m.companyId = demo.id; changed = true; }
    if (m.type === 'course' && !Array.isArray(m.lessons)) { m.lessons = []; changed = true; }
  }
  if (changed) saveDB();
}

/* === Утилиты SCORM === */
function parseScormTime(t) {
  if (!t) return 0;
  const parts = String(t).split(':');
  if (parts.length !== 3) return 0;
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  return h * 3600 + m * 60 + s;
}
function formatScormTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function getScormAttempt(materialId, userId) {
  return db.scormAttempts.find(a => a.materialId === materialId && a.userId === userId);
}
function upsertScormAttempt(materialId, userId, companyId, updates) {
  let a = getScormAttempt(materialId, userId);
  if (!a) {
    a = {
      id: 'sca_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      materialId, userId, companyId,
      attempts: 0, total_time: '00:00:00',
      lesson_status: 'not attempted',
      score_raw: '', score_min: '', score_max: '',
      suspend_data: '', lesson_location: '', exit: '', session_time: '',
      courseId: null, lessonId: null,
      createdAt: new Date().toISOString(),
      lastLaunchedAt: null, updatedAt: new Date().toISOString()
    };
    db.scormAttempts.push(a);
  }
  Object.assign(a, updates);
  a.updatedAt = new Date().toISOString();
  return a;
}
function tryCompleteScormLesson(a) {
  if (!a || (a.lesson_status !== 'passed' && a.lesson_status !== 'completed')) return false;
  if (!a.courseId || !a.lessonId) return false;
  const course = db.materials.find(x => x && x.id === a.courseId);
  if (!course || course.type !== 'course') return false;
  const exists = db.lessonCompletions.find(lc => lc.userId === a.userId && lc.courseId === a.courseId && lc.lessonId === a.lessonId);
  if (exists) return false;
  db.lessonCompletions.push({
    id: 'lc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    userId: a.userId, companyId: a.companyId,
    materialId: a.materialId, type: 'scorm',
    courseId: a.courseId, lessonId: a.lessonId,
    completedAt: new Date().toISOString()
  });
  return true;
}

/* === Multer === */
const MIME_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
  'image/webp': '.webp', 'image/svg+xml': '.svg',
  'font/woff2': '.woff2', 'font/woff': '.woff', 'font/ttf': '.ttf', 'application/font-woff': '.woff',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov'
};
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = MIME_EXT[file.mimetype] || path.extname(file.originalname).toLowerCase();
    cb(null, 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({
  storage, limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/', 'font/', 'video/'];
    if (allowed.some(p => file.mimetype.startsWith(p))) cb(null, true);
    else cb(new Error('Разрешены только изображения, шрифты и видео'));
  }
});
const scormUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isZip = ['application/zip','application/x-zip-compressed','multipart/x-zip'].includes(file.mimetype) ||
                  file.originalname.toLowerCase().endsWith('.zip');
    if (isZip) cb(null, true); else cb(new Error('Только ZIP-архивы'));
  }
});

app.use((req, res, next) => { res.setHeader('Permissions-Policy', 'unload=*'); next(); });
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    const user = db.users.find(u => u && u.id === p.id);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user; next();
  } catch { res.status(401).json({ error: 'Сессия истекла' }); }
}
function publicUser(u) { if (!u) return null; const { passwordHash, ...rest } = u; return rest; }
function sanitizeMaterialForLearner(m) {
  if (!m) return null;
  const copy = JSON.parse(JSON.stringify(m));
  if (copy.quiz && Array.isArray(copy.quiz.questions)) copy.quiz.questions.forEach(q => (q.options || []).forEach(o => { delete o.correct; }));
  return copy;
}
function canAccessMaterial(user, m) {
  if (!user || !m) return false;
  if (user.role === 'superadmin') return true;
  if (m.companyId !== user.companyId) return false;
  if (user.role === 'learner' && m.status !== 'published') return false;
  return true;
}
function calcCourseProgress(course, userId) {
  if (!course || !userId) return { total: 0, done: 0, percent: 0 };
  const validIds = new Set((course.lessons || []).map(l => l.id));
  const comps = db.lessonCompletions.filter(lc => lc.userId === userId && lc.courseId === course.id && validIds.has(lc.lessonId));
  return { total: validIds.size, done: comps.length, percent: validIds.size ? Math.round(comps.length / validIds.size * 100) : 0 };
}
function assignmentStatus(a, userId) {
  if (!a) return { status: 'deleted', percent: 0, completed: false };
  const m = db.materials.find(x => x.id === a.materialId);
  if (!m) return { status: 'deleted', percent: 0, completed: false };
  let completed = false, percent = 0;
  if (m.type === 'course') {
    const validIds = new Set((m.lessons || []).map(l => l.id));
    const comps = db.lessonCompletions.filter(lc => lc.userId === userId && lc.courseId === m.id && validIds.has(lc.lessonId));
    percent = validIds.size ? Math.round(comps.length / validIds.size * 100) : 0;
    completed = validIds.size > 0 && comps.length === validIds.size;
  } else if (m.type === 'test') {
    const attempts = db.attempts.filter(x => x.userId === userId && x.materialId === m.id);
    const passed = attempts.find(x => x.passed);
    completed = !!passed;
    percent = passed ? 100 : (attempts.length ? Math.max(...attempts.map(x => x.score)) : 0);
  } else if (m.type === 'longread') {
    const comp = db.lessonCompletions.find(lc => lc.userId === userId && lc.materialId === m.id);
    completed = !!comp; percent = comp ? 100 : 0;
  } else if (m.type === 'scorm') {
    const sa = db.scormAttempts.find(x => x.userId === userId && x.materialId === m.id);
    const lc = db.lessonCompletions.find(lc => lc.userId === userId && lc.materialId === m.id && lc.type === 'scorm');
    const saPassed = sa && (sa.lesson_status === 'passed' || sa.lesson_status === 'completed');
    completed = !!saPassed || !!lc;
    if (sa && sa.score_raw) percent = Math.min(100, parseInt(sa.score_raw) || 0);
    else percent = completed ? 100 : 0;
  }
  const now = new Date();
  const due = a.dueAt ? new Date(a.dueAt) : null;
  let status = 'new';
  if (completed) status = 'completed';
  else if (due && due < now) status = 'overdue';
  else if (due && (due - now) < 3 * 24 * 60 * 60 * 1000) status = 'due-soon';
  else if (percent > 0) status = 'in-progress';
  return { status, percent, completed, dueAt: a.dueAt };
}

/* === Upload === */
app.post('/api/upload', auth, (req, res) => {
  if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    res.json({ url: '/uploads/' + req.file.filename, name: req.file.originalname, size: req.file.size, mime: req.file.mimetype });
  });
});

/* === SCORM upload === */
app.post('/api/scorm/upload', auth, (req, res) => {
  if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });
  scormUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    let targetDir = null;
    try {
      const zip = new AdmZip(req.file.buffer);
      const entries = zip.getEntries();
      const manifestEntry = entries.find(e => !e.isDirectory && (e.entryName === 'imsmanifest.xml' || e.entryName.endsWith('/imsmanifest.xml')));
      if (!manifestEntry) return res.status(400).json({ error: 'В архиве нет imsmanifest.xml' });
      const manifestXml = manifestEntry.getData().toString('utf8');
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: true });
      const manifest = parser.parse(manifestXml);
      let version = '1.2';
      const schemaVersion = manifest?.manifest?.metadata?.schemaversion;
      if (schemaVersion && String(schemaVersion).includes('2004')) version = '2004';
      const resources = manifest?.manifest?.resources?.resource;
      const resArray = Array.isArray(resources) ? resources : (resources ? [resources] : []);
      let scoResource = resArray.find(r => {
        const st = r['@_adlcp:scormtype'] || r['@_scormtype'] || '';
        return st.toLowerCase() === 'sco' && r['@_href'];
      });
      if (!scoResource) scoResource = resArray.find(r => r['@_href']);
      if (!scoResource || !scoResource['@_href']) return res.status(400).json({ error: 'В манифесте нет ресурса с href' });
      const entryHref = String(scoResource['@_href']);
      let courseTitle = '';
      const orgs = manifest?.manifest?.organizations?.organization;
      const orgArr = Array.isArray(orgs) ? orgs : (orgs ? [orgs] : []);
      if (orgArr.length > 0) {
        const ot = orgArr[0]?.title;
        if (typeof ot === 'string') courseTitle = ot;
        else if (ot && typeof ot === 'object' && ot['#text']) courseTitle = String(ot['#text']);
      }
      const materialId = 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      targetDir = path.join(SCORM_DIR, materialId);
      const targetResolved = path.resolve(targetDir);
      fs.mkdirSync(targetDir, { recursive: true });
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const relPath = entry.entryName.replace(/\\/g, '/');
        const resolved = path.resolve(targetDir, relPath);
        if (resolved !== targetResolved && !resolved.startsWith(targetResolved + path.sep)) throw new Error('Небезопасный путь: ' + relPath);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, entry.getData());
      }
      const manifestRelPath = manifestEntry.entryName.replace(/\\/g, '/');
      const scormRoot = manifestRelPath.includes('/') ? manifestRelPath.substring(0, manifestRelPath.lastIndexOf('/') + 1) : '';
      let targetCompany = req.user.companyId;
      if (req.user.role === 'superadmin') {
        if (!req.body.companyId) { fs.rmSync(targetDir, { recursive: true, force: true }); return res.status(400).json({ error: 'Укажите компанию' }); }
        if (!db.companies.find(c => c.id === req.body.companyId)) { fs.rmSync(targetDir, { recursive: true, force: true }); return res.status(400).json({ error: 'Компания не найдена' }); }
        targetCompany = req.body.companyId;
      }
      const material = {
        id: materialId, companyId: targetCompany,
        title: courseTitle || req.file.originalname.replace(/\.zip$/i, ''),
        desc: 'SCORM ' + version + ' · ' + (req.file.size / 1024 / 1024).toFixed(1) + ' МБ',
        type: 'scorm', status: 'published', author: req.user.name,
        updated: new Date().toISOString().slice(0, 10), learners: 0,
        content: [], quiz: null, style: {},
        scorm: { version, root: scormRoot, entry: entryHref, size: req.file.size }
      };
      db.materials.unshift(material); saveDB();
      res.status(201).json({ material });
    } catch (e) {
      console.error('SCORM upload error:', e);
      if (targetDir) { try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch {} }
      res.status(500).json({ error: 'Ошибка распаковки: ' + e.message });
    }
  });
});

/* === SCORM state / track / finish === */
app.get('/api/scorm/:id/state', auth, (req, res) => {
  const m = db.materials.find(x => x && x.id === req.params.id);
  if (!m || m.type !== 'scorm') return res.status(404).json({ error: 'Не SCORM' });
  if (!canAccessMaterial(req.user, m)) return res.status(403).json({ error: 'Нет доступа' });
  let a = getScormAttempt(m.id, req.user.id);
  if (!a) a = upsertScormAttempt(m.id, req.user.id, m.companyId, {});
  a.attempts = (a.attempts || 0) + 1;
  a.lastLaunchedAt = new Date().toISOString();
  a.updatedAt = a.lastLaunchedAt;
  saveDB();
  res.json({
    state: {
      lesson_status: a.lesson_status || 'not attempted',
      score_raw: a.score_raw || '',
      score_min: a.score_min || '',
      score_max: a.score_max || '',
      suspend_data: a.suspend_data || '',
      lesson_location: a.lesson_location || '',
      total_time: a.total_time || '00:00:00',
      exit: a.exit || '',
      attempts: a.attempts
    }
  });
});

app.post('/api/scorm/:id/track', auth, (req, res) => {
  const m = db.materials.find(x => x && x.id === req.params.id);
  if (!m || m.type !== 'scorm') return res.status(404).json({ error: 'Не SCORM' });
  if (!canAccessMaterial(req.user, m)) return res.status(403).json({ error: 'Нет доступа' });
  const b = req.body || {};
  const updates = {};
  const map = {
    'cmi.core.lesson_status': 'lesson_status',
    'cmi.core.score.raw': 'score_raw',
    'cmi.core.score.min': 'score_min',
    'cmi.core.score.max': 'score_max',
    'cmi.suspend_data': 'suspend_data',
    'cmi.core.lesson_location': 'lesson_location',
    'cmi.core.exit': 'exit',
    'cmi.core.session_time': 'session_time'
  };
  for (const [k, v] of Object.entries(map)) {
    if (b[k] !== undefined) updates[v] = String(b[k]);
  }
  if (b.courseId) updates.courseId = b.courseId;
  if (b.lessonId) updates.lessonId = b.lessonId;
  const a = upsertScormAttempt(m.id, req.user.id, m.companyId, updates);
  const completed = tryCompleteScormLesson(a);
  saveDB();
  res.json({ ok: true, completed });
});

app.post('/api/scorm/:id/finish', auth, (req, res) => {
  const m = db.materials.find(x => x && x.id === req.params.id);
  if (!m || m.type !== 'scorm') return res.status(404).json({ error: 'Не SCORM' });
  if (!canAccessMaterial(req.user, m)) return res.status(403).json({ error: 'Нет доступа' });
  const a = getScormAttempt(m.id, req.user.id);
  if (!a) return res.json({ ok: true });
  if (a.session_time) {
    const addSec = parseScormTime(a.session_time);
    const totalSec = parseScormTime(a.total_time);
    a.total_time = formatScormTime(totalSec + addSec);
    a.session_time = '';
  }
  const b = req.body || {};
  if (b.courseId && !a.courseId) a.courseId = b.courseId;
  if (b.lessonId && !a.lessonId) a.lessonId = b.lessonId;
  tryCompleteScormLesson(a);
  a.updatedAt = new Date().toISOString();
  saveDB();
  res.json({ ok: true });
});

/* === Аватар === */
app.post('/api/users/me/avatar', auth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    if (!req.file.mimetype.startsWith('image/')) { try { fs.unlinkSync(req.file.path); } catch {} return res.status(400).json({ error: 'Только изображения' }); }
    if (req.user.avatarUrl) { const oldPath = path.join(__dirname, 'public', req.user.avatarUrl.replace(/^\//, '')); try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch {} }
    req.user.avatarUrl = '/uploads/' + req.file.filename;
    saveDB();
    res.json({ user: publicUser(req.user) });
  });
});
app.delete('/api/users/me/avatar', auth, (req, res) => {
  if (req.user.avatarUrl) { const oldPath = path.join(__dirname, 'public', req.user.avatarUrl.replace(/^\//, '')); try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch {} req.user.avatarUrl = null; saveDB(); }
  res.json({ user: publicUser(req.user) });
});

/* === Auth === */
app.post('/api/register', async (req, res) => {
  const { name, email, password, role, companyName, companyCode } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Укажите имя' });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Некорректный email' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Пароль короче 6 символов' });
  const emailLower = email.trim().toLowerCase();
  if (db.users.some(u => u.email === emailLower)) return res.status(409).json({ error: 'Email уже занят' });
  let companyId = null;
  const finalRole = role === 'admin' ? 'admin' : 'learner';
  if (finalRole === 'admin') {
    if (!companyName || !companyName.trim()) return res.status(400).json({ error: 'Укажите название компании' });
    const c = { id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: companyName.trim(), code: genCompanyCode(companyName), createdAt: new Date().toISOString() };
    db.companies.push(c); companyId = c.id;
  } else {
    if (!companyCode || !companyCode.trim()) return res.status(400).json({ error: 'Укажите код компании' });
    const c = db.companies.find(x => x.code === companyCode.trim().toLowerCase());
    if (!c) return res.status(404).json({ error: 'Компания не найдена' });
    companyId = c.id;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.trim(), email: emailLower, passwordHash, role: finalRole, companyId, createdAt: new Date().toISOString() };
  db.users.push(user); saveDB();
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.status(201).json({ token, user: publicUser(user) });
});
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Укажите email и пароль' });
  const user = db.users.find(u => u.email === String(email).trim().toLowerCase());
  if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });
  if (!(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Неверный email или пароль' });
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: publicUser(user) });
});
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.put('/api/users/me', auth, (req, res) => {
  const { name } = req.body || {};
  if (name !== undefined) req.user.name = String(name).trim() || req.user.name;
  saveDB();
  res.json({ user: publicUser(req.user) });
});
app.post('/api/users/me/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Укажите пароли' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Новый пароль короче 6' });
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) return res.status(401).json({ error: 'Неверный текущий пароль' });
  req.user.passwordHash = await bcrypt.hash(newPassword, 10);
  saveDB();
  res.json({ ok: true });
});

/* === Прогресс === */
app.get('/api/my/progress', auth, (req, res) => {
  const myAttempts = db.attempts.filter(a => a.userId === req.user.id);
  const byMaterial = {};
  for (const a of myAttempts) {
    if (!byMaterial[a.materialId]) byMaterial[a.materialId] = { attempts: 0, best: 0, passed: false, lastAt: null };
    const m = byMaterial[a.materialId];
    m.attempts++; if (a.score > m.best) m.best = a.score; if (a.passed) m.passed = true;
    if (!m.lastAt || a.createdAt > m.lastAt) m.lastAt = a.createdAt;
  }
  const passedCount = Object.values(byMaterial).filter(x => x.passed).length;
  const avgScore = myAttempts.length ? Math.round(myAttempts.reduce((s, a) => s + a.score, 0) / myAttempts.length) : 0;
  const recent = [...myAttempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
    .map(a => ({ materialId: a.materialId, materialTitle: a.materialTitle, score: a.score, passed: a.passed, createdAt: a.createdAt }));
  res.json({ totalAttempts: myAttempts.length, passedCount, avgScore, byMaterial, recent });
});

app.get('/api/learning/my', auth, (req, res) => {
  const courses = db.materials.filter(m => m && m.companyId === req.user.companyId && m.type === 'course' && m.status === 'published');
  const myComps = db.lessonCompletions.filter(lc => lc.userId === req.user.id);
  const myAttempts = db.attempts.filter(a => a.userId === req.user.id);
  const coursesProgress = courses.map(c => {
    const validIds = new Set((c.lessons || []).map(l => l.id));
    const done = myComps.filter(lc => lc.courseId === c.id && validIds.has(lc.lessonId)).length;
    const total = validIds.size;
    return { id: c.id, title: c.title, desc: c.desc, totalLessons: total, completedLessons: done, percent: total ? Math.round(done / total * 100) : 0, started: done > 0, completed: total > 0 && done === total };
  });
  const standaloneDone = myComps.filter(lc => !lc.courseId && lc.type === 'longread').length;
  const passedTestIds = new Set(myAttempts.filter(a => a.passed).map(a => a.materialId));
  res.json({
    courses: coursesProgress,
    stats: {
      totalCourses: courses.length,
      startedCourses: coursesProgress.filter(c => c.started).length,
      completedCourses: coursesProgress.filter(c => c.completed).length,
      lessonsCompleted: myComps.filter(lc => lc.courseId).length + standaloneDone,
      testsPassed: passedTestIds.size,
      totalAttempts: myAttempts.length,
      avgScore: myAttempts.length ? Math.round(myAttempts.reduce((s, a) => s + a.score, 0) / myAttempts.length) : 0
    }
  });
});

/* === Компании === */
app.get('/api/companies/public', (req, res) => res.json({ companies: db.companies.map(c => ({ id: c.id, name: c.name, code: c.code })) }));
app.get('/api/companies', auth, (req, res) => {
  if (req.user.role === 'superadmin') return res.json({ companies: db.companies });
  if (req.user.role === 'admin') return res.json({ companies: db.companies.filter(c => c.id === req.user.companyId) });
  res.json({ companies: [] });
});
app.post('/api/companies', auth, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Только супер-администратор' });
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Укажите название' });
  const c = { id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: name.trim(), code: genCompanyCode(name), createdAt: new Date().toISOString() };
  db.companies.push(c); saveDB();
  res.status(201).json({ company: c });
});
app.delete('/api/companies/:id', auth, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Только супер-администратор' });
  const idx = db.companies.findIndex(c => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Компания не найдена' });
  const scormMats = db.materials.filter(m => m.companyId === req.params.id && m.type === 'scorm');
  for (const m of scormMats) { const d = path.join(SCORM_DIR, m.id); try { if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true }); } catch {} }
  db.companies.splice(idx, 1);
  db.users = db.users.filter(u => u.companyId !== req.params.id || u.role === 'superadmin');
  db.materials = db.materials.filter(m => m.companyId !== req.params.id);
  db.attempts = db.attempts.filter(a => a.companyId !== req.params.id);
  db.lessonCompletions = db.lessonCompletions.filter(lc => lc.companyId !== req.params.id);
  db.assignments = db.assignments.filter(a => a.companyId !== req.params.id);
  db.scormAttempts = db.scormAttempts.filter(sa => sa.companyId !== req.params.id);
  saveDB(); res.json({ ok: true });
});

/* === Users === */
app.get('/api/users', auth, (req, res) => {
  if (req.user.role === 'superadmin') {
    let list = db.users;
    if (req.query.companyId) list = list.filter(u => u.companyId === req.query.companyId);
    return res.json({ users: list.map(publicUser).filter(Boolean) });
  }
  if (req.user.role === 'admin') return res.json({ users: db.users.filter(u => u.companyId === req.user.companyId).map(publicUser).filter(Boolean) });
  res.json({ users: [] });
});

/* === Создание пользователя (admin / superadmin) === */
app.post('/api/users', auth, async (req, res) => {
  try {
    if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });

    const { name, email, password, role, companyId } = req.body || {};

    if (!name || !name.trim()) return res.status(400).json({ error: 'Укажите имя' });
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    }

    const emailLower = String(email).trim().toLowerCase();
    if (db.users.some(u => u.email === emailLower)) {
      return res.status(409).json({ error: 'Email уже занят' });
    }

    let finalCompanyId = req.user.companyId;
    let finalRole = 'learner';

    if (req.user.role === 'superadmin') {
      if (role === 'admin' || role === 'learner') finalRole = role;
      if (!companyId) return res.status(400).json({ error: 'Укажите компанию' });
      if (!db.companies.find(c => c.id === companyId)) {
        return res.status(400).json({ error: 'Компания не найдена' });
      }
      finalCompanyId = companyId;
    } else {
      // admin — создаёт только learner в своей компании
      if (!finalCompanyId) return res.status(400).json({ error: 'Компания не определена' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: String(name).trim(),
      email: emailLower,
      passwordHash,
      role: finalRole,
      companyId: finalCompanyId,
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    saveDB();

    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    console.error('POST /api/users:', e);
    res.status(500).json({ error: e.message });
  }
});

/* === Удаление пользователя (admin / superadmin) === */
app.delete('/api/users/:id', auth, (req, res) => {
  try {
    if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });

    const target = db.users.find(u => u.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

    if (target.role === 'superadmin') {
      return res.status(403).json({ error: 'Нельзя удалить супер-администратора' });
    }
    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
    }
    if (req.user.role === 'admin' && target.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    db.users = db.users.filter(u => u.id !== target.id);
    db.assignments = db.assignments.filter(a => a.userId !== target.id);
    db.attempts = db.attempts.filter(a => a.userId !== target.id);
    db.lessonCompletions = db.lessonCompletions.filter(lc => lc.userId !== target.id);
    db.scormAttempts = db.scormAttempts.filter(sa => sa.userId !== target.id);

    if (target.avatarUrl) {
      const avatarPath = path.join(__dirname, 'public', target.avatarUrl.replace(/^\//, ''));
      try { if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath); } catch {}
    }

    saveDB();
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/users:', e);
    res.status(500).json({ error: e.message });
  }
});

/* === Материалы === */
app.get('/api/materials', auth, (req, res) => {
  let list = db.materials;
  if (req.user.role === 'superadmin') {
    if (req.query.companyId) list = list.filter(m => m.companyId === req.query.companyId);
  } else if (req.user.role === 'admin') {
    list = list.filter(m => m.companyId === req.user.companyId);
  } else {
    list = list.filter(m => m.companyId === req.user.companyId && m.status === 'published').map(m => {
      const base = { id: m.id, companyId: m.companyId, title: m.title, desc: m.desc, type: m.type, status: m.status, author: m.author, updated: m.updated, learners: m.learners || 0, hasQuiz: !!(m.quiz && m.quiz.questions && m.quiz.questions.length), lessonCount: Array.isArray(m.lessons) ? m.lessons.length : 0 };
      if (m.type === 'course') {
        const p = calcCourseProgress(m, req.user.id);
        base.completedLessons = p.done; base.percent = p.percent; base.started = p.done > 0; base.completed = p.total > 0 && p.done === p.total;
      }
      if (m.type === 'scorm') {
        const sa = db.scormAttempts.find(x => x.userId === req.user.id && x.materialId === m.id);
        base.scormStatus = sa ? sa.lesson_status : 'not attempted';
        base.scormScore = sa && sa.score_raw ? parseInt(sa.score_raw) : null;
        base.scormCompleted = sa && (sa.lesson_status === 'passed' || sa.lesson_status === 'completed');
        base.scormVersion = m.scorm?.version || '1.2';
      }
      const myAs = db.assignments.find(a => a.materialId === m.id && a.userId === req.user.id);
      if (myAs) {
        const st = assignmentStatus(myAs, req.user.id);
        base.assigned = true; base.assignmentStatus = st.status; base.dueAt = myAs.dueAt; base.isMandatory = myAs.isMandatory;
      } else base.assigned = false;
      return base;
    });
  }
  res.json({ materials: list });
});

app.get('/api/materials/:id', auth, (req, res) => {
  const m = db.materials.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Материал не найден' });
  if (!canAccessMaterial(req.user, m)) return res.status(404).json({ error: 'Материал не найден' });
  let result = m;
  if (req.user.role === 'learner') {
    result = sanitizeMaterialForLearner(m);
    const qCourseId = req.query.courseId || null;
    const qLessonId = req.query.lessonId || null;
    if (m.type === 'longread') {
      let done;
      if (qCourseId && qLessonId) done = db.lessonCompletions.some(lc => lc.userId === req.user.id && lc.courseId === qCourseId && lc.lessonId === qLessonId);
      else done = db.lessonCompletions.some(lc => lc.userId === req.user.id && lc.materialId === m.id && !lc.courseId);
      result.myStatus = { completed: done, context: qCourseId ? 'course' : 'standalone' };
    } else if (m.type === 'test') {
      const myAttempts = db.attempts.filter(a => a.userId === req.user.id && a.materialId === m.id);
      result.myStatus = { attempts: myAttempts.length, best: myAttempts.length ? Math.max(...myAttempts.map(a => a.score)) : 0, passed: myAttempts.some(a => a.passed) };
    } else if (m.type === 'course') {
      const p = calcCourseProgress(m, req.user.id);
      result.myStatus = { totalLessons: p.total, completedLessons: p.done, percent: p.percent, started: p.done > 0, completed: p.total > 0 && p.done === p.total };
    } else if (m.type === 'scorm') {
      const sa = db.scormAttempts.find(x => x.userId === req.user.id && x.materialId === m.id);
      result.myStatus = sa ? { lesson_status: sa.lesson_status, score: sa.score_raw, total_time: sa.total_time, attempts: sa.attempts } : { lesson_status: 'not attempted', attempts: 0 };
    }
  }
  res.json({ material: result });
});

app.post('/api/materials/batch', auth, (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
  const list = db.materials.filter(m => ids.includes(m.id) && canAccessMaterial(req.user, m))
    .map(m => req.user.role === 'learner' ? sanitizeMaterialForLearner(m) : m);
  res.json({ materials: list });
});

app.post('/api/materials', auth, (req, res) => {
  if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });
  const { title, description, type, ai, companyId } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Укажите название' });
  let targetCompany = req.user.companyId;
  if (req.user.role === 'superadmin') {
    if (!companyId) return res.status(400).json({ error: 'Укажите компанию' });
    if (!db.companies.find(c => c.id === companyId)) return res.status(400).json({ error: 'Компания не найдена' });
    targetCompany = companyId;
  }
  const material = { id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), companyId: targetCompany, title: title.trim(), desc: (description || '').trim() || (ai ? 'Сгенерировано AI' : 'Без описания'), type: type || 'course', status: 'draft', author: req.user.name, updated: new Date().toISOString().slice(0, 10), learners: 0, content: [], lessons: type === 'course' ? [] : undefined, quiz: null, style: {} };
  db.materials.unshift(material); saveDB();
  res.status(201).json({ material });
});

app.put('/api/materials/:id', auth, (req, res) => {
  if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });
  const m = db.materials.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Материал не найден' });
  if (!canAccessMaterial(req.user, m)) return res.status(403).json({ error: 'Нет доступа' });
  const { title, description, content, quiz, lessons, status, style, trainer } = req.body || {};
  if (title !== undefined) m.title = String(title).trim() || m.title;
  if (description !== undefined) m.desc = String(description).trim();
  if (Array.isArray(content)) m.content = content;
  if (quiz !== undefined) m.quiz = quiz;
  if (trainer !== undefined) m.trainer = trainer;
  if (Array.isArray(lessons) && m.type === 'course') m.lessons = lessons.map(l => ({ id: l.id, type: l.type, materialId: l.materialId }));
  if (status === 'draft' || status === 'published') m.status = status;
  if (style !== undefined) m.style = style;
  m.updated = new Date().toISOString().slice(0, 10);
  saveDB(); res.json({ material: m });
});

app.delete('/api/materials/:id', auth, (req, res) => {
  if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });
  const idx = db.materials.findIndex(m => m.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Материал не найден' });
  const m = db.materials[idx];
  if (!canAccessMaterial(req.user, m)) return res.status(403).json({ error: 'Нет доступа' });
  if (m.type === 'scorm') { const scormPath = path.join(SCORM_DIR, m.id); try { if (fs.existsSync(scormPath)) fs.rmSync(scormPath, { recursive: true, force: true }); } catch {} }
  db.materials.splice(idx, 1);
  for (const mat of db.materials) { if (mat.type === 'course' && Array.isArray(mat.lessons)) mat.lessons = mat.lessons.filter(l => l.materialId !== m.id); }
  db.attempts = db.attempts.filter(a => a.materialId !== m.id);
  db.lessonCompletions = db.lessonCompletions.filter(lc => lc.materialId !== m.id);
  db.assignments = db.assignments.filter(a => a.materialId !== m.id);
  db.scormAttempts = db.scormAttempts.filter(sa => sa.materialId !== m.id);
  saveDB();
  res.json({ ok: true });
});

app.get('/api/materials/:id/attempts', auth, (req, res) => {
  if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });
  const m = db.materials.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Материал не найден' });
  if (!canAccessMaterial(req.user, m)) return res.status(403).json({ error: 'Нет доступа' });
  const attempts = db.attempts.filter(a => a.materialId === m.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const scorm = db.scormAttempts.filter(a => a.materialId === m.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.json({ attempts, scorm });
});

app.post('/api/materials/:id/complete', auth, (req, res) => {
  if (req.user.role !== 'learner') return res.status(403).json({ error: 'Только для учащихся' });
  const m = db.materials.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Материал не найден' });
  if (!canAccessMaterial(req.user, m)) return res.status(403).json({ error: 'Нет доступа' });
  if (m.type !== 'longread') return res.status(400).json({ error: 'Только для лонгридов' });
  const { courseId, lessonId } = req.body || {};
  if (courseId) {
    const course = db.materials.find(x => x.id === courseId);
    if (!course || course.type !== 'course' || !canAccessMaterial(req.user, course)) return res.status(400).json({ error: 'Курс не найден' });
    const lesson = (course.lessons || []).find(l => l.id === lessonId);
    if (!lesson || lesson.materialId !== m.id) return res.status(400).json({ error: 'Урок не найден' });
  }
  const existing = db.lessonCompletions.find(lc => lc.userId === req.user.id && lc.materialId === m.id && (courseId ? lc.courseId === courseId && lc.lessonId === lessonId : !lc.courseId));
  if (existing) return res.json({ completion: existing, alreadyDone: true });
  const completion = { id: 'lc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), userId: req.user.id, companyId: req.user.companyId, materialId: m.id, type: 'longread', courseId: courseId || null, lessonId: lessonId || null, completedAt: new Date().toISOString() };
  db.lessonCompletions.push(completion); saveDB();
  res.json({ completion, alreadyDone: false });
});

app.get('/api/courses/:id/progress', auth, (req, res) => {
  const course = db.materials.find(x => x.id === req.params.id);
  if (!course || course.type !== 'course') return res.status(404).json({ error: 'Курс не найден' });
  if (!canAccessMaterial(req.user, course)) return res.status(404).json({ error: 'Курс не найден' });
  if (req.user.role === 'learner') {
    let changed = false;
    for (const l of course.lessons || []) {
      const exists = db.lessonCompletions.find(lc => lc.userId === req.user.id && lc.courseId === course.id && lc.lessonId === l.id);
      if (exists) continue;
      const mat = db.materials.find(x => x.id === l.materialId);
      if (!mat) continue;
      if (mat.type === 'longread') {
        const standalone = db.lessonCompletions.find(lc => lc.userId === req.user.id && lc.materialId === mat.id && !lc.courseId);
        if (standalone) { db.lessonCompletions.push({ id: 'lc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), userId: req.user.id, companyId: req.user.companyId, materialId: mat.id, type: 'longread', courseId: course.id, lessonId: l.id, completedAt: standalone.completedAt, autoSynced: true }); changed = true; }
      }
      if (mat.type === 'test') {
        const passed = db.attempts.find(a => a.userId === req.user.id && a.materialId === mat.id && a.passed);
        if (passed) { db.lessonCompletions.push({ id: 'lc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), userId: req.user.id, companyId: req.user.companyId, materialId: mat.id, type: 'test', courseId: course.id, lessonId: l.id, attemptId: passed.id, completedAt: passed.createdAt, autoSynced: true }); changed = true; }
      }
      if (mat.type === 'scorm') {
        const sa = db.scormAttempts.find(x => x.userId === req.user.id && x.materialId === mat.id);
        if (sa && (sa.lesson_status === 'passed' || sa.lesson_status === 'completed')) {
          db.lessonCompletions.push({ id: 'lc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), userId: req.user.id, companyId: req.user.companyId, materialId: mat.id, type: 'scorm', courseId: course.id, lessonId: l.id, completedAt: sa.updatedAt || new Date().toISOString(), autoSynced: true });
          changed = true;
        }
      }
    }
    if (changed) saveDB();
  }
  const comps = db.lessonCompletions.filter(lc => lc.userId === req.user.id && lc.courseId === course.id);
  const compMap = Object.fromEntries(comps.map(c => [c.lessonId, c]));
  const lessons = (course.lessons || []).map(l => {
    const mat = db.materials.find(m => m.id === l.materialId);
    const comp = compMap[l.id];
    return { id: l.id, type: l.type, materialId: l.materialId, title: mat ? mat.title : '(материал удалён)', completed: !!comp, completedAt: comp ? comp.completedAt : null };
  });
  const completedCount = lessons.filter(l => l.completed).length;
  const totalCount = lessons.length;
  res.json({ course: { id: course.id, title: course.title, desc: course.desc, status: course.status }, lessons, completedCount, totalCount, percent: totalCount ? Math.round(completedCount / totalCount * 100) : 0, completed: totalCount > 0 && completedCount === totalCount });
});

app.post('/api/materials/:id/submit', auth, (req, res) => {
  const m = db.materials.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Материал не найден' });
  if (!canAccessMaterial(req.user, m)) return res.status(403).json({ error: 'Нет доступа' });
  if (m.type !== 'test' || !m.quiz) return res.status(400).json({ error: 'Это не тест' });
  if (m.status !== 'published') return res.status(400).json({ error: 'Тест не опубликован' });
  const { answers, courseId, lessonId } = req.body || {};
  const questions = m.quiz.questions || [];
  let correct = 0;
  const details = [];
  for (const q of questions) {
    const a = answers[q.id];
    let ok = false;
    if (q.type === 'single') { const co = (q.options || []).find(o => o.correct); ok = !!(co && a === co.id); }
    else if (q.type === 'multiple') {
      const correctIds = new Set((q.options || []).filter(o => o.correct).map(o => o.id));
      const givenIds = new Set(Array.isArray(a) ? a : []);
      ok = correctIds.size > 0 && correctIds.size === givenIds.size && [...correctIds].every(id => givenIds.has(id));
    } else if (q.type === 'text') {
      const norm = String(a || '').trim().toLowerCase();
      const valid = (q.options || []).map(o => (o.text || '').trim().toLowerCase()).filter(Boolean);
      ok = norm.length > 0 && valid.includes(norm);
    }
    if (ok) correct++;
    details.push({ questionId: q.id, correct: ok });
  }
  const total = questions.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  const passingScore = Number(m.quiz.passingScore ?? 70);
  const passed = total > 0 && score >= passingScore;
  const attempt = { id: 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), materialId: m.id, materialTitle: m.title, companyId: m.companyId, userId: req.user.id, userName: req.user.name, answers, correct, total, score, passed, createdAt: new Date().toISOString() };
  db.attempts.push(attempt);
  if (passed && courseId) {
    const course = db.materials.find(x => x.id === courseId);
    if (course && course.type === 'course' && canAccessMaterial(req.user, course)) {
      const lesson = (course.lessons || []).find(l => l.id === lessonId);
      if (lesson && lesson.materialId === m.id) {
        const exists = db.lessonCompletions.find(lc => lc.userId === req.user.id && lc.courseId === courseId && lc.lessonId === lessonId);
        if (!exists) db.lessonCompletions.push({ id: 'lc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), userId: req.user.id, companyId: req.user.companyId, materialId: m.id, type: 'test', courseId, lessonId, attemptId: attempt.id, completedAt: new Date().toISOString() });
      }
    }
  }
  saveDB();
  res.json({ attempt, details });
});

/* === Назначения === */
app.get('/api/assignments/my', auth, (req, res) => {
  const my = db.assignments.filter(a => a.userId === req.user.id);
  const result = my.map(a => {
    const m = db.materials.find(x => x.id === a.materialId);
    const st = assignmentStatus(a, req.user.id);
    return { ...a, materialTitle: m?.title || 'Удалён', materialType: m?.type || 'unknown', materialDesc: m?.desc || '', ...st };
  }).filter(a => a.status !== 'deleted');
  const order = { 'overdue': 0, 'due-soon': 1, 'in-progress': 2, 'new': 3, 'completed': 4, 'deleted': 5 };
  result.sort((x, y) => order[x.status] - order[y.status]);
  res.json({ assignments: result });
});
app.get('/api/assignments', auth, (req, res) => {
  if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });
  let list = db.assignments;
  if (req.user.role === 'admin') list = list.filter(a => a.companyId === req.user.companyId);
  else if (req.query.companyId) list = list.filter(a => a.companyId === req.query.companyId);
  const result = list.map(a => {
    const m = db.materials.find(x => x.id === a.materialId);
    const u = db.users.find(x => x.id === a.userId);
    const st = assignmentStatus(a, a.userId);
    return { ...a, materialTitle: m?.title || 'Удалён', materialType: m?.type || 'unknown', userName: u?.name || 'Удалён', userEmail: u?.email || '', ...st };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ assignments: result });
});
app.get('/api/assignments/stats', auth, (req, res) => {
  if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });
  const companyId = req.user.role === 'superadmin' ? (req.query.companyId || null) : req.user.companyId;
  let list = db.assignments;
  if (companyId) list = list.filter(a => a.companyId === companyId);
  let total = 0, completed = 0, overdue = 0, dueSoon = 0, inProgress = 0, notStarted = 0;
  for (const a of list) {
    const st = assignmentStatus(a, a.userId);
    total++;
    if (st.status === 'completed') completed++;
    else if (st.status === 'overdue') overdue++;
    else if (st.status === 'due-soon') dueSoon++;
    else if (st.status === 'in-progress') inProgress++;
    else notStarted++;
  }
  res.json({ total, completed, overdue, dueSoon, inProgress, notStarted });
});
app.post('/api/assignments', auth, (req, res) => {
  if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });
  const { materialId, userIds, dueAt, isMandatory } = req.body || {};
  if (!materialId) return res.status(400).json({ error: 'Укажите материал' });
  if (!Array.isArray(userIds) || !userIds.length) return res.status(400).json({ error: 'Выберите сотрудников' });
  const m = db.materials.find(x => x.id === materialId);
  if (!m) return res.status(404).json({ error: 'Материал не найден' });
  if (req.user.role === 'admin' && m.companyId !== req.user.companyId) return res.status(403).json({ error: 'Нет доступа' });
  if (m.status !== 'published') return res.status(400).json({ error: 'Материал не опубликован' });
  const companyUsers = db.users.filter(u => u.companyId === m.companyId && u.role === 'learner');
  const validIds = userIds.filter(id => companyUsers.some(u => u.id === id));
  if (!validIds.length) return res.status(400).json({ error: 'Нет подходящих сотрудников' });
  const created = [];
  for (const uid of validIds) {
    const exists = db.assignments.find(a => a.materialId === materialId && a.userId === uid);
    if (exists) continue;
    const a = { id: 'as_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), companyId: m.companyId, materialId, userId: uid, assignedById: req.user.id, assignedByName: req.user.name, dueAt: dueAt || null, isMandatory: !!isMandatory, createdAt: new Date().toISOString() };
    db.assignments.push(a);
    created.push(a);
  }
  saveDB();
  res.status(201).json({ assignments: created, count: created.length });
});
app.delete('/api/assignments/:id', auth, (req, res) => {
  if (req.user.role === 'learner') return res.status(403).json({ error: 'Нет доступа' });
  const idx = db.assignments.findIndex(a => a.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Не найдено' });
  if (req.user.role === 'admin' && db.assignments[idx].companyId !== req.user.companyId) return res.status(403).json({ error: 'Нет доступа' });
  db.assignments.splice(idx, 1);
  saveDB();
  res.json({ ok: true });
});

/* === Аналитика === */
app.get('/api/analytics/company', auth, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') return res.status(403).json({ error: 'Нет доступа' });
  const companyId = req.query.companyId || req.user.companyId;
  if (!companyId) return res.status(400).json({ error: 'Не указана компания' });
  if (req.user.role === 'admin' && companyId !== req.user.companyId) return res.status(403).json({ error: 'Нет доступа' });
  const employees = db.users.filter(u => u.companyId === companyId && u.role === 'learner');
  const courses = db.materials.filter(m => m.companyId === companyId && m.type === 'course');
  const attempts = db.attempts.filter(a => a.companyId === companyId);
  const completions = db.lessonCompletions.filter(lc => lc.companyId === companyId);
  const assignments = db.assignments.filter(a => a.companyId === companyId);
  let totalPct = 0, counted = 0;
  for (const c of courses) {
    const total = (c.lessons || []).length;
    if (!total) continue;
    for (const u of employees) {
      const validIds = new Set((c.lessons || []).map(l => l.id));
      const done = completions.filter(lc => lc.userId === u.id && lc.courseId === c.id && validIds.has(lc.lessonId)).length;
      totalPct += done / total * 100; counted++;
    }
  }
  const activeUsers = new Set([...attempts.map(a => a.userId), ...completions.map(c => c.userId)]);
  const completedAny = new Set();
  for (const c of courses) {
    const total = (c.lessons || []).length;
    if (!total) continue;
    const validIds = new Set((c.lessons || []).map(l => l.id));
    for (const u of employees) {
      const done = completions.filter(lc => lc.userId === u.id && lc.courseId === c.id && validIds.has(lc.lessonId)).length;
      if (done === total) completedAny.add(u.id);
    }
  }
  const coursesStats = courses.map(c => {
    const total = (c.lessons || []).length;
    const validIds = new Set((c.lessons || []).map(l => l.id));
    const started = new Set(completions.filter(lc => lc.courseId === c.id && validIds.has(lc.lessonId)).map(lc => lc.userId)).size;
    let completed = 0, sumPct = 0;
    for (const u of employees) {
      const done = completions.filter(lc => lc.userId === u.id && lc.courseId === c.id && validIds.has(lc.lessonId)).length;
      if (total && done === total) completed++;
      sumPct += total ? done / total * 100 : 0;
    }
    return { id: c.id, title: c.title, totalLessons: total, started, completed, avgPercent: employees.length ? Math.round(sumPct / employees.length) : 0 };
  });
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, attempts: attempts.filter(a => a.createdAt.slice(0, 10) === dateStr).length, completions: completions.filter(c => c.completedAt.slice(0, 10) === dateStr).length });
  }
  const topEmployees = employees.map(u => {
    const uAttempts = attempts.filter(a => a.userId === u.id);
    const uComps = completions.filter(lc => lc.userId === u.id);
    let coursesCompleted = 0;
    for (const c of courses) {
      const total = (c.lessons || []).length;
      const validIds = new Set((c.lessons || []).map(l => l.id));
      const done = uComps.filter(lc => lc.courseId === c.id && validIds.has(lc.lessonId)).length;
      if (total && done === total) coursesCompleted++;
    }
    return { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl || null, lessons: uComps.length, testsPassed: new Set(uAttempts.filter(a => a.passed).map(a => a.materialId)).size, coursesCompleted, avgScore: uAttempts.length ? Math.round(uAttempts.reduce((s, a) => s + a.score, 0) / uAttempts.length) : 0 };
  }).sort((a, b) => b.lessons - a.lessons).slice(0, 5);
  const recentAttempts = [...attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)
    .map(a => ({ userName: a.userName, materialTitle: a.materialTitle, score: a.score, passed: a.passed, createdAt: a.createdAt }));
  const assignmentStats = { total: 0, completed: 0, overdue: 0, dueSoon: 0, inProgress: 0, notStarted: 0 };
  for (const a of assignments) {
    const st = assignmentStatus(a, a.userId);
    assignmentStats.total++;
    if (st.status === 'completed') assignmentStats.completed++;
    else if (st.status === 'overdue') assignmentStats.overdue++;
    else if (st.status === 'due-soon') assignmentStats.dueSoon++;
    else if (st.status === 'in-progress') assignmentStats.inProgress++;
    else assignmentStats.notStarted++;
  }
  res.json({
    stats: { employees: employees.length, active: activeUsers.size, completedAny: completedAny.size, avgProgress: counted ? Math.round(totalPct / counted) : 0, totalCourses: courses.length, totalAttempts: attempts.length, avgScore: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0, assignments: assignmentStats },
    courses: coursesStats, activityByDay: days, topEmployees, recentAttempts
  });
});

app.get('/api/analytics/global', auth, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Только супер-администратор' });
  const companiesStats = db.companies.map(c => {
    const users = db.users.filter(u => u.companyId === c.id && u.role === 'learner');
    const courses = db.materials.filter(m => m.companyId === c.id && m.type === 'course');
    const attempts = db.attempts.filter(a => a.companyId === c.id);
    const completions = db.lessonCompletions.filter(lc => lc.companyId === c.id);
    let totalPct = 0, counted = 0, completedCourses = 0;
    for (const crs of courses) {
      const total = (crs.lessons || []).length;
      if (!total) continue;
      const validIds = new Set((crs.lessons || []).map(l => l.id));
      for (const u of users) {
        const done = completions.filter(lc => lc.userId === u.id && lc.courseId === crs.id && validIds.has(lc.lessonId)).length;
        totalPct += done / total * 100; counted++;
        if (done === total) completedCourses++;
      }
    }
    return { id: c.id, name: c.name, code: c.code, users: users.length, courses: courses.length, attempts: attempts.length, completedCourses, avgProgress: counted ? Math.round(totalPct / counted) : 0, avgScore: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0 };
  });
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, attempts: db.attempts.filter(a => a.createdAt.slice(0, 10) === dateStr).length, completions: db.lessonCompletions.filter(c => c.completedAt.slice(0, 10) === dateStr).length });
  }
  res.json({
    stats: { companies: db.companies.length, users: db.users.filter(u => u.role !== 'superadmin').length, courses: db.materials.filter(m => m.type === 'course').length, attempts: db.attempts.length, avgProgress: companiesStats.length ? Math.round(companiesStats.reduce((s, c) => s + c.avgProgress, 0) / companiesStats.length) : 0, avgScore: db.attempts.length ? Math.round(db.attempts.reduce((s, a) => s + a.score, 0) / db.attempts.length) : 0 },
    companiesStats, activityByDay: days
  });
});

/* === Dev-only: полное состояние (только вне production) === */
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/dev/state', (req, res) => {
    res.json({
      users: db.users.map(publicUser).filter(Boolean),
      companies: db.companies,
      materials: db.materials.map(m => ({
        id: m.id,
        title: m.title,
        type: m.type,
        status: m.status,
        companyId: m.companyId,
      })),
      knownAccounts: [
        { email: 'super@demo.ru', password: 'demo1234', role: 'superadmin', label: 'Супер-админ', hint: 'Управление всеми компаниями' },
        { email: 'admin@demo.ru', password: 'demo1234', role: 'admin', label: 'Администратор Demo', hint: 'Demo Company · материалы, сотрудники' },
        { email: 'learner@demo.ru', password: 'demo1234', role: 'learner', label: 'Учащийся Demo', hint: 'Demo Company · кабинет ученика' },
      ],
    });
  });
}

/* === Массовое создание пользователей (bulk import) === */
app.post('/api/users/bulk', auth, async (req, res) => {
  try {
    if (req.user.role === 'learner') {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const { users, companyId } = req.body || {};
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'Пустой список пользователей' });
    }
    if (users.length > 500) {
      return res.status(400).json({ error: 'Максимум 500 пользователей за раз' });
    }

    // Определяем компанию
    let finalCompanyId = req.user.companyId;
    if (req.user.role === 'superadmin') {
      if (!companyId) return res.status(400).json({ error: 'Укажите компанию' });
      if (!db.companies.find(c => c.id === companyId)) {
        return res.status(400).json({ error: 'Компания не найдена' });
      }
      finalCompanyId = companyId;
    }
    if (!finalCompanyId) {
      return res.status(400).json({ error: 'Компания не определена' });
    }

    const created = [];
    const skipped = [];
    const seenEmails = new Set();

    for (const u of users) {
      const name = String(u.name || '').trim();
      const email = String(u.email || '').trim().toLowerCase();
      const password = String(u.password || '').trim();
      const role = u.role === 'admin' ? 'admin' : 'learner';

      // Валидация
      if (!name) {
        skipped.push({ name, email, reason: 'Нет имени' });
        continue;
      }
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        skipped.push({ name, email, reason: 'Некорректный email' });
        continue;
      }
      if (password && password.length < 6) {
        skipped.push({ name, email, reason: 'Пароль короче 6 символов' });
        continue;
      }
      if (seenEmails.has(email)) {
        skipped.push({ name, email, reason: 'Дубликат в файле' });
        continue;
      }
      seenEmails.add(email);

      // Проверка роли
      if (role === 'admin' && req.user.role !== 'superadmin') {
        skipped.push({ name, email, reason: 'Только супер-админ может создавать админов' });
        continue;
      }

      // Email уже в базе?
      if (db.users.some(existing => existing.email === email)) {
        skipped.push({ name, email, reason: 'Email уже зарегистрирован' });
        continue;
      }

      // Генерируем пароль если пустой
      let finalPassword = password;
      if (!finalPassword) {
        const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
        finalPassword = '';
        for (let i = 0; i < 8; i++) {
          finalPassword += chars[Math.floor(Math.random() * chars.length)];
        }
      }

      try {
        const passwordHash = await bcrypt.hash(finalPassword, 10);
        const newUser = {
          id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + created.length,
          name,
          email,
          passwordHash,
          role,
          companyId: finalCompanyId,
          createdAt: new Date().toISOString(),
        };
        db.users.push(newUser);
        created.push({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          password: finalPassword,
        });
      } catch (e) {
        skipped.push({ name, email, reason: 'Ошибка создания: ' + e.message });
      }
    }

    if (created.length > 0) saveDB();

    res.json({
      created,
      skipped,
      total: users.length,
    });
  } catch (e) {
    console.error('POST /api/users/bulk:', e);
    res.status(500).json({ error: e.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Некорректный JSON' });
  console.error(err); res.status(500).json({ error: 'Внутренняя ошибка' });
});

seed().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  LearnFlow: http://localhost:${PORT}`);
    console.log(`  super@demo.ru / admin@demo.ru / learner@demo.ru`);
    console.log(`  пароль: demo1234  ·  код компании: demo`);
    console.log(`  SCORM: ${SCORM_DIR}\n`);
  });
});