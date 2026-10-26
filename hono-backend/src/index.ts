import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { hashPassword, generateToken } from './auth-utils';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Izinkan Frontend PixiJS melakukan request (CORS)
app.use('/api/*', cors({
  origin: 'http://localhost:5173', // Sesuaikan dengan URL port frontend temanmu
  credentials: true,
}));

// 1. FITUR REGISTER
app.post('/api/register', async (c) => {
  const { nama, email, password } = await c.req.json();

  if (!nama || !email || !password) {
    return c.json({ error: 'Nama, email, dan password wajib diisi' }, 400);
  }

  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (existingUser) {
    return c.json({ error: 'Email sudah terdaftar' }, 400);
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    'INSERT INTO users (id, nama, email, password_hash) VALUES (?, ?, ?)'
  ).bind(userId, nama, email, passwordHash).run();

  return c.json({ message: 'Registrasi berhasil', userId }, 201);
});

// 2. FITUR LOGIN & PENCATATAN SESSION
app.post('/api/login', async (c) => {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'Email dan password wajib diisi' }, 400);
  }

  const passwordHash = await hashPassword(password);
  const user = await c.env.DB.prepare(
    'SELECT id, nama, email FROM users WHERE email = ? AND password_hash = ?'
  ).bind(email, passwordHash).first<{ id: string; nama: string; email: string }>();

  if (!user) {
    return c.json({ error: 'Email atau password salah' }, 401);
  }

  // Catat Session di Database D1
  const sessionId = crypto.randomUUID();
  const sessionToken = generateToken();
  
  // Masa berlaku session (misal: 7 hari)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, user.id, sessionToken, expiresAt).run();

  // Simpan session token di HTTP-Only Cookie
  setCookie(c, 'session_token', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return c.json({
    message: 'Login berhasil',
    user: { id: user.id, nama: user.nama, email: user.email },
    token: sessionToken // Opsi dikirim ke frontend jika butuh simpan manual
  });
});

// 3. FITUR CEK SESSION (ME / USER DATA)
app.get('/api/me', async (c) => {
  const token = getCookie(c, 'session_token') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({ authenticated: false, error: 'Tidak ada session' }, 401);
  }

  const session = await c.env.DB.prepare(`
    SELECT s.id as session_id, s.expires_at, u.id as user_id, u.nama, u.email 
    FROM sessions s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.token = ?
  `).bind(token).first<{ session_id: string; expires_at: string; user_id: string; email: string }>();

  if (!session || new Date(session.expires_at) < new Date()) {
    return c.json({ authenticated: false, error: 'Session expired atau tidak valid' }, 401);
  }

  return c.json({
    authenticated: true,
    user: { id: session.user_id, nama: session.nama, email: session.email },
    sessionId: session.session_id
  });
});

// 4. FITUR LOGOUT
app.post('/api/logout', async (c) => {
  const token = getCookie(c, 'session_token') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (token) {
    // Hapus session dari D1
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }

  deleteCookie(c, 'session_token');
  return c.json({ message: 'Logout berhasil' });
});

export default app;