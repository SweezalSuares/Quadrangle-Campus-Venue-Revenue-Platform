import { api } from '../api.js';
import { saveSession } from '../state.js';

let pickedRole = 'external';

function showError(msg) {
  document.getElementById('auth-error').innerHTML = msg ? `<div class="error-msg">${msg}</div>` : '';
}

export function mountAuth(onSuccess) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginPanel = document.getElementById('login-panel');
  const registerPanel = document.getElementById('register-panel');

  function setTab(t) {
    tabLogin.classList.toggle('active', t === 'login');
    tabRegister.classList.toggle('active', t === 'register');
    loginPanel.style.display = t === 'login' ? 'block' : 'none';
    registerPanel.style.display = t === 'register' ? 'block' : 'none';
    showError('');
  }
  tabLogin.addEventListener('click', () => setTab('login'));
  tabRegister.addEventListener('click', () => setTab('register'));

  document.querySelectorAll('[data-demo]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const [email, pass] = a.dataset.demo.split(':');
      document.getElementById('li-email').value = email;
      document.getElementById('li-pass').value = pass;
    });
  });

  document.querySelectorAll('.role-pick').forEach((btn) => {
    btn.addEventListener('click', () => {
      pickedRole = btn.dataset.role;
      document.querySelectorAll('.role-pick').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  loginPanel.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const email = document.getElementById('li-email').value.trim();
    const pass = document.getElementById('li-pass').value;
    if (!email || !pass) { showError('Enter your email and password.'); return; }
    try {
      const { token, user } = await api.auth.login(email, pass);
      saveSession(token, user);
      onSuccess(user);
    } catch (err) {
      showError(err.message);
    }
  });

  registerPanel.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const name = document.getElementById('rg-name').value.trim();
    const email = document.getElementById('rg-email').value.trim();
    const password = document.getElementById('rg-pass').value;
    if (!name || !email || !password) { showError('Fill in your name, email and a password.'); return; }
    if (password.length < 6) { showError('Password should be at least 6 characters.'); return; }
    try {
      const { token, user } = await api.auth.register({ name, email, password, role: pickedRole });
      saveSession(token, user);
      onSuccess(user);
    } catch (err) {
      showError(err.message);
    }
  });

  return setTab;
}
