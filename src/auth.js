
/*
 * Tech Tap Authentication
 *
 * Mode demo: untuk pengujian tampilan frontend saja.
 * Setelah backend siap, ubah AUTH_MODE menjadi 'api'
 * dan isi API_BASE_URL dengan URL backend temanmu.
 */

const AUTH_MODE = 'demo';
const API_BASE_URL = '';

const AUTH_ENDPOINTS = {
  register: '/api/auth/register',
  login: '/api/auth/login',
  me: '/api/auth/me',
  logout: '/api/auth/logout',
};

const USER_SESSION_KEY = 'techTapDemoUser';

let demoAccount = null;
let currentUser = null;

function getElement(id) {
  return document.getElementById(id);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

function normalizeUser(data) {
  const user = data?.user ?? data?.data?.user ?? data?.data ?? data;

  if (!user || typeof user !== 'object' || !user.email) {
    throw new Error('Respons pengguna dari server tidak valid.');
  }

  return {
    name: user.name ?? user.nama ?? user.username ?? user.email.split('@')[0],
    email: user.email,
  };
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.message ||
      result.error ||
      `Permintaan gagal (${response.status}).`
    );
  }

  return result;
}

const authService = {
  async register({ name, email, password }) {
    if (AUTH_MODE === 'demo') {
      // Password hanya berada di memori selama halaman terbuka.
      // Tidak disimpan di localStorage atau sessionStorage.
      demoAccount = { name, email, password };

      return {
        message: 'Registrasi demo berhasil. Silakan login.',
      };
    }

    return request(AUTH_ENDPOINTS.register, {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  async login({ email, password }) {
    if (AUTH_MODE === 'demo') {
      if (!demoAccount) {
        throw new Error('Akun demo belum tersedia. Silakan registrasi dahulu.');
      }

      if (
        email.toLowerCase() !== demoAccount.email.toLowerCase() ||
        password !== demoAccount.password
      ) {
        throw new Error('Email atau password tidak sesuai.');
      }

      return { user: { name: demoAccount.name, email: demoAccount.email } };
    }

    return request(AUTH_ENDPOINTS.login, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async me() {
    if (AUTH_MODE === 'demo') {
      try {
        const savedUser = sessionStorage.getItem(USER_SESSION_KEY);
        return savedUser ? JSON.parse(savedUser) : null;
      } catch {
        return null;
      }
    }

    try {
      const result = await request(AUTH_ENDPOINTS.me, {
        method: 'GET',
      });

      return normalizeUser(result);
    } catch {
      return null;
    }
  },

  async logout() {
    if (AUTH_MODE === 'api') {
      await request(AUTH_ENDPOINTS.logout, {
        method: 'POST',
      });
    }

    sessionStorage.removeItem(USER_SESSION_KEY);
    currentUser = null;
  },
};

function showMessage(message = '', type = 'error') {
  const messageElement = getElement('auth-message');

  if (!messageElement) return;

  messageElement.textContent = message;
  messageElement.className = `auth-message ${type}`;
  messageElement.hidden = !message;
}

function setLoading(form, loading) {
  const button = form.querySelector('button[type="submit"]');

  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = 'Memproses...';
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function renderAuthPage() {
  document.body.classList.remove('authenticated');
  getElement('auth-root').hidden = false;
  getElement('user-menu').hidden = true;
  getElement('profile-dropdown').hidden = true;

  getElement('auth-root').innerHTML = `
    <main class="auth-page">
      <section class="auth-card">
        <a class="brand" href="#" aria-label="Tech Tap">
          <span class="brand-mark">T</span>
          <span>TECH <strong>TAP</strong></span>
        </a>

        <p class="eyebrow">WEB TECHNOLOGY GAME</p>
        <h1 id="auth-title">Selamat datang!</h1>
        <p id="auth-description" class="auth-description">
          Login untuk melanjutkan permainanmu.
        </p>

        <div class="demo-notice">
          <span class="status-dot"></span>
          MODE DEMO FRONTEND
          <small>Belum terhubung ke server.</small>
        </div>

        <div id="auth-message" class="auth-message" role="alert" hidden></div>

        <form id="login-form" class="auth-form">
          <label for="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            placeholder="nama@email.com"
            autocomplete="email"
            required
          />

          <label for="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            placeholder="Masukkan password"
            autocomplete="current-password"
            required
          />

          <button class="primary-button" type="submit">Login</button>

          <p class="auth-switch">
            Belum punya akun?
            <button type="button" class="text-button" id="show-register">
              Registrasi
            </button>
          </p>
        </form>

        <form id="register-form" class="auth-form" hidden>
          <label for="register-name">Nama</label>
          <input
            id="register-name"
            name="name"
            type="text"
            placeholder="Nama kamu"
            autocomplete="name"
            minlength="2"
            maxlength="60"
            required
          />

          <label for="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            placeholder="nama@email.com"
            autocomplete="email"
            required
          />

          <label for="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            placeholder="Minimal 8 karakter"
            autocomplete="new-password"
            minlength="8"
            required
          />

          <button class="primary-button" type="submit">
            Buat Akun
          </button>

          <p class="auth-switch">
            Sudah punya akun?
            <button type="button" class="text-button" id="show-login">
              Login
            </button>
          </p>
        </form>

        <p class="auth-footer">
          Tech Tap · Belajar teknologi sambil bermain
        </p>
      </section>
    </main>
  `;

  getElement('show-register').addEventListener('click', () => {
    getElement('login-form').hidden = true;
    getElement('register-form').hidden = false;
    getElement('auth-title').textContent = 'Buat akun';
    getElement('auth-description').textContent =
      'Daftar dahulu untuk mulai bermain.';
    showMessage('');
    getElement('register-name').focus();
  });

  getElement('show-login').addEventListener('click', () => {
    getElement('register-form').hidden = true;
    getElement('login-form').hidden = false;
    getElement('auth-title').textContent = 'Selamat datang!';
    getElement('auth-description').textContent =
      'Login untuk melanjutkan permainanmu.';
    showMessage('');
    getElement('login-email').focus();
  });

  getElement('register-form').addEventListener('submit', handleRegister);
  getElement('login-form').addEventListener('submit', handleLogin);
}

async function handleRegister(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);

  const name = String(data.get('name') || '').trim();
  const email = String(data.get('email') || '').trim().toLowerCase();
  const password = String(data.get('password') || '');

  if (name.length < 2) {
    showMessage('Nama minimal 2 karakter.');
    return;
  }

  if (password.length < 8) {
    showMessage('Password minimal 8 karakter.');
    return;
  }

  setLoading(form, true);
  showMessage('');

  try {
    await authService.register({ name, email, password });

    getElement('register-form').reset();
    getElement('show-login').click();
    getElement('login-email').value = email;

    showMessage(
      AUTH_MODE === 'demo'
        ? 'Registrasi demo berhasil. Silakan login dengan email dan password tadi.'
        : 'Registrasi berhasil. Silakan login.',
      'success'
    );
  } catch (error) {
    showMessage(error.message || 'Registrasi gagal.');
  } finally {
    setLoading(form, false);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);

  const email = String(data.get('email') || '').trim().toLowerCase();
  const password = String(data.get('password') || '');

  setLoading(form, true);
  showMessage('');

  try {
    const result = await authService.login({ email, password });
    currentUser = normalizeUser(result);

    if (AUTH_MODE === 'demo') {
      sessionStorage.setItem(
        USER_SESSION_KEY,
        JSON.stringify(currentUser)
      );
    }

    enterApplication(currentUser);
  } catch (error) {
    showMessage(error.message || 'Login gagal. Periksa data akunmu.');
  } finally {
    setLoading(form, false);
  }
}

function enterApplication(user) {
  currentUser = user;

  getElement('auth-root').hidden = true;
  document.body.classList.add('authenticated');

  const avatar = getElement('user-avatar');
  const name = getElement('user-name');
  const email = getElement('user-email');

  avatar.textContent = (user.name || user.email).trim().charAt(0).toUpperCase();
  name.textContent = user.name;
  email.textContent = user.email;

  getElement('user-menu').hidden = false;
  getElement('profile-dropdown').hidden = true;
}

function createUserMenu() {
  const menu = document.createElement('header');

  menu.id = 'user-menu';
  menu.className = 'user-menu';
  menu.hidden = true;

  menu.innerHTML = `
    <div class="session-label">
      <span class="status-dot"></span>
      <span>Sesi ${AUTH_MODE === 'demo' ? 'Demo' : 'Aktif'}</span>
    </div>

    <button
      type="button"
      id="profile-toggle"
      class="profile-toggle"
      aria-label="Buka menu profil"
      aria-expanded="false"
    >
      <span id="user-avatar" class="user-avatar">Y</span>
      <span class="profile-chevron">⌄</span>
    </button>

    <div id="profile-dropdown" class="profile-dropdown" hidden>
      <div class="profile-details">
        <strong id="user-name"></strong>
        <span id="user-email"></span>
      </div>
      <div class="dropdown-divider"></div>
      <button type="button" id="logout-button" class="logout-button">
        <span aria-hidden="true">↪</span> Logout
      </button>
    </div>
  `;

  document.body.appendChild(menu);

  getElement('profile-toggle').addEventListener('click', () => {
    const dropdown = getElement('profile-dropdown');
    dropdown.hidden = !dropdown.hidden;

    getElement('profile-toggle').setAttribute(
      'aria-expanded',
      String(!dropdown.hidden)
    );
  });

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) {
      getElement('profile-dropdown').hidden = true;
      getElement('profile-toggle').setAttribute('aria-expanded', 'false');
    }
  });

  getElement('logout-button').addEventListener('click', async () => {
    try {
      await authService.logout();
    } catch (error) {
      showMessage(error.message || 'Logout gagal. Coba lagi.');
      return;
    }

    renderAuthPage();
  });
}

async function initializeAuth() {
  createUserMenu();

  if (AUTH_MODE === 'demo') {
    renderAuthPage();
    const savedUser = await authService.me();

    if (savedUser) {
      enterApplication(savedUser);
    }

    return;
  }

  const user = await authService.me();

  if (user) {
    enterApplication(user);
  } else {
    renderAuthPage();
  }
}

initializeAuth().catch((error) => {
  console.error('Gagal memulai autentikasi:', error);
  renderAuthPage();
});
