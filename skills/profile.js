window.CBProfile = (function () {
  const KEY = 'cb_profile';
  const DEFAULT = {
    username: 'C',
    avatarType: 'initials',
    avatarInitials: 'C',
    avatarEmoji: '',
    avatarImage: '',
    title: '独立开发者 · 技术写作者',
    bio: '这里是我的数字花园，记录我对代码、设计与生活的思考。',
    blogName: 'C Blog',
    blogDesc: '一个现代化、开源、支持 AI 与 Skill 的个人博客',
    githubUrl: '',
    twitterUrl: '',
    websiteUrl: '',
    passwordHash: '',
    enableStats: true,
    enableAI: true,
    createdAt: 0
  };

  async function hashPassword(pwd) {
    const data = new TextEncoder().encode(pwd);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getProfile() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return { ...DEFAULT, ...JSON.parse(raw) };
    } catch {
      return null;
    }
  }

  function hasProfile() {
    return !!localStorage.getItem(KEY);
  }

  function setProfile(patch) {
    const cur = getProfile() || { ...DEFAULT, createdAt: Date.now() };
    const next = { ...cur, ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    syncToGitHub(next);
    return next;
  }

  async function syncToGitHub(profile) {
    if (window.CBGitHubStore && window.CBGitHubStore.hasConfig()) {
      try {
        await window.CBGitHubStore.putFile('data/profile.json', JSON.stringify(profile, null, 2), 'Update profile');
      } catch (err) {
        console.warn('Failed to sync profile to GitHub:', err.message);
      }
    }
  }

  function updateProfile(patch) {
    return setProfile(patch);
  }

  function clearProfile() {
    localStorage.removeItem(KEY);
  }

  async function verifyPassword(pwd) {
    const profile = getProfile();
    if (!profile || !profile.passwordHash) return true;
    const hash = await hashPassword(pwd);
    return hash === profile.passwordHash;
  }

  function avatarHTML(profile, size = 28) {
    const p = profile || {};
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px;`;
    if (p.avatarType === 'emoji' && p.avatarEmoji) {
      return `<span class="user-avatar" style="${style};font-size:${Math.round(size * 0.6)}px;">${p.avatarEmoji}</span>`;
    }
    if (p.avatarType === 'image' && p.avatarImage) {
      return `<span class="user-avatar" style=""><img src="${p.avatarImage}" alt="avatar"/></span>`;
    }
    const initials = (p.avatarInitials || p.username || 'C').slice(0, 2).toUpperCase();
    return `<span class="user-avatar" style="${style}">${initials}</span>`;
  }

  function displayName(profile) {
    return profile?.username || 'C';
  }

  function exportJSON() {
    const profile = getProfile();
    return JSON.stringify(profile, null, 2);
  }

  function importJSON(str) {
    const data = JSON.parse(str);
    return setProfile(data);
  }

  return {
    get: getProfile,
    has: hasProfile,
    set: setProfile,
    update: updateProfile,
    clear: clearProfile,
    verify: verifyPassword,
    hash: hashPassword,
    avatarHTML,
    displayName,
    exportJSON,
    importJSON,
    DEFAULT
  };
})();
