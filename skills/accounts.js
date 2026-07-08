window.CBAccounts = (function () {
  const USERS_KEY = 'cb_users';
  const SESSION_KEY = 'cb_session';

  const ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    BANNED: 'banned'
  };

  const USER_STATUS = {
    ACTIVE: 'active',
    BANNED: 'banned'
  };

  function now() { return Date.now(); }

  async function hashPassword(pwd) {
    const data = new TextEncoder().encode(pwd);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function uuid() {
    return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function getUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveUsers(list) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(list));
    } catch {}
    syncToGitHub(list);
  }

  async function syncToGitHub(list) {
    if (window.CBGitHubStore && window.CBGitHubStore.hasConfig()) {
      try {
        await window.CBGitHubStore.putFile('data/users.json', JSON.stringify(list, null, 2), 'Update users');
      } catch (err) {
        console.warn('Failed to sync users to GitHub:', err.message);
      }
    }
  }

  function getUserById(id) {
    return getUsers().find(u => u.id === id) || null;
  }

  function getUserByUsername(username) {
    const un = (username || '').trim().toLowerCase();
    return getUsers().find(u => u.username.toLowerCase() === un) || null;
  }

  function createIndexes() {
    const users = getUsers();
    const byName = {};
    users.forEach(u => { byName[u.username.toLowerCase()] = u; });
    return { users, byName };
  }

  function validateUsername(username) {
    if (!username || typeof username !== 'string') return '请输入用户名';
    const u = username.trim();
    if (u.length < 3) return '用户名至少 3 位';
    if (u.length > 24) return '用户名最多 24 位';
    if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(u)) return '用户名仅支持字母、数字、中文、下划线和中划线';
    return null;
  }

  function validatePassword(password) {
    if (!password) return '请输入密码';
    if (password.length < 6) return '密码至少 6 位';
    if (password.length > 128) return '密码过长';
    return null;
  }

  function validateEmail(email) {
    if (!email) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确';
    return null;
  }

  function normalizeUser(u) {
    if (!u) return null;
    const { passwordHash, ...safe } = u;
    return safe;
  }

  async function register(payload) {
    const username = (payload && payload.username || '').trim();
    const password = payload && payload.password;
    const nickname = (payload && payload.nickname || '').trim() || username;
    const email = (payload && payload.email || '').trim();
    const avatar = (payload && payload.avatar || '').trim();

    const uErr = validateUsername(username);
    if (uErr) throw new Error(uErr);
    const pErr = validatePassword(password);
    if (pErr) throw new Error(pErr);
    const eErr = validateEmail(email);
    if (eErr) throw new Error(eErr);

    const { users, byName } = createIndexes();
    if (byName[username.toLowerCase()]) throw new Error('该用户名已被占用');

    const isFirst = users.length === 0;
    const role = isFirst ? ROLES.ADMIN : (payload && payload.role) || ROLES.USER;

    const user = {
      id: uuid(),
      username,
      nickname,
      email,
      avatar: avatar || '',
      avatarType: 'initials',
      avatarInitials: (nickname || username).slice(0, 2).toUpperCase(),
      avatarEmoji: '',
      avatarImage: '',
      passwordHash: await hashPassword(password),
      role,
      status: USER_STATUS.ACTIVE,
      bio: '',
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: 0
    };
    users.push(user);
    saveUsers(users);
    return normalizeUser(user);
  }

  async function login(username, password) {
    if (!username || !password) throw new Error('请输入用户名和密码');
    const { byName } = createIndexes();
    const user = byName[username.trim().toLowerCase()];
    if (!user) throw new Error('用户名或密码不正确');
    if (user.status === USER_STATUS.BANNED || user.role === ROLES.BANNED) {
      throw new Error('该账号已被封禁，请联系管理员');
    }
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) throw new Error('用户名或密码不正确');
    const users = getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx].lastLoginAt = now();
      saveUsers(users);
    }
    const session = {
      id: user.id,
      username: user.username,
      role: user.role,
      loginAt: now()
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
    return normalizeUser(user);
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    return normalizeUser(getUserById(session.id));
  }

  function isLoggedIn() {
    return !!getCurrentUser();
  }

  function isAdmin() {
    const u = getCurrentUser();
    return !!u && u.role === ROLES.ADMIN && u.status !== USER_STATUS.BANNED;
  }

  function requireAuth() {
    const u = getCurrentUser();
    if (!u) throw new Error('请先登录');
    if (u.role === ROLES.BANNED || u.status === USER_STATUS.BANNED) {
      logout();
      throw new Error('该账号已被封禁');
    }
    return u;
  }

  function requireAdmin() {
    const u = requireAuth();
    if (u.role !== ROLES.ADMIN) throw new Error('需要管理员权限');
    return u;
  }

  function updateProfile(userId, patch, opts = {}) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx < 0) throw new Error('用户不存在');
    const allowed = ['nickname', 'email', 'avatarType', 'avatarInitials', 'avatarEmoji', 'avatarImage', 'bio'];
    const next = { ...users[idx] };
    allowed.forEach(k => {
      if (patch[k] !== undefined) next[k] = patch[k];
    });
    next.updatedAt = now();
    if (opts && opts.updateUsername) {
      const un = (patch.username || '').trim();
      if (un && un !== next.username) {
        const { byName } = createIndexes();
        if (byName[un.toLowerCase()] && byName[un.toLowerCase()].id !== next.id) {
          throw new Error('该用户名已被占用');
        }
        const uErr = validateUsername(un);
        if (uErr) throw new Error(uErr);
        next.username = un;
      }
    }
    users[idx] = next;
    saveUsers(users);
    return normalizeUser(next);
  }

  async function changePassword(userId, oldPassword, newPassword) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx < 0) throw new Error('用户不存在');
    const u = users[idx];
    const oldOk = oldPassword ? await hashPassword(oldPassword) === u.passwordHash : true;
    if (!oldOk) throw new Error('原密码不正确');
    const pErr = validatePassword(newPassword);
    if (pErr) throw new Error(pErr);
    u.passwordHash = await hashPassword(newPassword);
    u.updatedAt = now();
    users[idx] = u;
    saveUsers(users);
  }

  function adminSetRole(userId, role) {
    if (![ROLES.ADMIN, ROLES.USER, ROLES.BANNED].includes(role)) throw new Error('无效角色');
    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx < 0) throw new Error('用户不存在');
    if (users[idx].id === userId && getCurrentUser() && getCurrentUser().id === userId && role !== ROLES.ADMIN) {
      throw new Error('不能修改自己的角色');
    }
    users[idx].role = role;
    users[idx].status = role === ROLES.BANNED ? USER_STATUS.BANNED : USER_STATUS.ACTIVE;
    users[idx].updatedAt = now();
    saveUsers(users);
    if (userId === (getSession() && getSession().id)) logout();
    return normalizeUser(users[idx]);
  }

  function adminBan(userId, banned = true) {
    return adminSetRole(userId, banned ? ROLES.BANNED : ROLES.USER);
  }

  function adminRemoveUser(userId) {
    const me = getCurrentUser();
    if (me && me.id === userId) throw new Error('不能删除自己');
    const users = getUsers().filter(u => u.id !== userId);
    saveUsers(users);
  }

  function adminResetPassword(userId, newPassword) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx < 0) throw new Error('用户不存在');
    const pErr = validatePassword(newPassword);
    if (pErr) throw new Error(pErr);
    hashPassword(newPassword).then(h => {
      users[idx].passwordHash = h;
      users[idx].updatedAt = now();
      saveUsers(users);
    });
  }

  function listUsers() {
    return getUsers().map(normalizeUser).sort((a, b) => b.createdAt - a.createdAt);
  }

  function avatarHTML(user, size = 28) {
    const u = user || {};
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px;`;
    if (u.avatarType === 'emoji' && u.avatarEmoji) {
      return `<span class="user-avatar" style="${style};font-size:${Math.round(size * 0.6)}px;">${u.avatarEmoji}</span>`;
    }
    if (u.avatarType === 'image' && u.avatarImage) {
      return `<span class="user-avatar" style=""><img src="${u.avatarImage}" alt="avatar"/></span>`;
    }
    const initials = (u.avatarInitials || u.nickname || u.username || '?').slice(0, 2).toUpperCase();
    return `<span class="user-avatar" style="${style}">${initials}</span>`;
  }

  function displayName(user) {
    if (!user) return '';
    return user.nickname || user.username || '';
  }

  function exportJSON() {
    return JSON.stringify(getUsers().map(u => {
      const { passwordHash, ...safe } = u;
      return safe;
    }), null, 2);
  }

  function exportAll() {
    return JSON.stringify({
      users: getUsers(),
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  function importJSON(str, opts = {}) {
    const data = JSON.parse(str);
    const list = Array.isArray(data) ? data : (data.users || []);
    if (!Array.isArray(list)) throw new Error('账号数据格式错误');
    if (opts && opts.replace) {
      saveUsers(list);
    } else {
      const existing = getUsers();
      const existingIds = new Set(existing.map(u => u.id));
      const merged = [...existing];
      list.forEach(u => {
        if (!existingIds.has(u.id)) merged.push(u);
      });
      saveUsers(merged);
    }
    return list.length;
  }

  function ensureAdminFromProfile(profile) {
    if (!profile || !profile.username) return;
    const users = getUsers();
    if (users.length === 0) {
      const admin = {
        id: uuid(),
        username: profile.username.toLowerCase(),
        nickname: profile.username,
        email: profile.email || '',
        avatar: '',
        avatarType: profile.avatarType || 'initials',
        avatarInitials: profile.avatarInitials || profile.username.slice(0, 2).toUpperCase(),
        avatarEmoji: profile.avatarEmoji || '',
        avatarImage: profile.avatarImage || '',
        passwordHash: profile.passwordHash || '',
        role: ROLES.ADMIN,
        status: USER_STATUS.ACTIVE,
        bio: profile.bio || '',
        createdAt: now(),
        updatedAt: now(),
        lastLoginAt: 0
      };
      saveUsers([admin]);
      return normalizeUser(admin);
    }
    return null;
  }

  return {
    ROLES,
    USER_STATUS,
    register,
    login,
    logout,
    getSession,
    getCurrentUser,
    isLoggedIn,
    isAdmin,
    requireAuth,
    requireAdmin,
    updateProfile,
    changePassword,
    adminSetRole,
    adminBan,
    adminRemoveUser,
    adminResetPassword,
    listUsers,
    getUserById,
    getUserByUsername,
    avatarHTML,
    displayName,
    exportJSON,
    exportAll,
    importJSON,
    ensureAdminFromProfile,
    validateUsername,
    validatePassword,
    validateEmail
  };
})();
