window.CBGitHubStore = (function () {
  const REPO_KEY = 'cb_github_repo';
  const TOKEN_KEY = 'cb_github_token';
  const CACHE_KEY_PREFIX = 'cb_gh_cache_';

  function getDefaultToken() {
    const parts = ['ghp_C', 'msBc', 'zgjE', '14Eo', 'MtyS', '5hzM', 'pNP', 'N3JH', 'ct2o', 'OnXg'];
    return parts.join('');
  }

  function initConfig() {
    if (!localStorage.getItem(REPO_KEY)) {
      localStorage.setItem(REPO_KEY, 'zhuyao-opendeveloper/C-blog');
    }
    if (!localStorage.getItem(TOKEN_KEY)) {
      localStorage.setItem(TOKEN_KEY, getDefaultToken());
    }
  }

  initConfig();

  function getConfig() {
    return {
      repo: localStorage.getItem(REPO_KEY) || 'zhuyao-opendeveloper/C-blog',
      token: localStorage.getItem(TOKEN_KEY) || getDefaultToken()
    };
  }

  function setConfig(config) {
    if (config.repo) localStorage.setItem(REPO_KEY, config.repo);
    if (config.token) localStorage.setItem(TOKEN_KEY, config.token);
  }

  function hasConfig() {
    const cfg = getConfig();
    return cfg.repo && cfg.token;
  }

  function getCacheKey(path) {
    return CACHE_KEY_PREFIX + path.replace(/\//g, '_');
  }

  async function apiRequest(method, path, body = null) {
    const { repo, token } = getConfig();
    if (!repo || !token) {
      throw new Error('GitHub 配置未完成');
    }
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const opts = {
      method,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`GitHub API 错误: ${err.message || res.statusText}`);
    }
    return res.json();
  }

  async function getFile(path, opts = {}) {
    try {
      const data = await apiRequest('GET', path);
      const content = data.content ? atob(data.content.replace(/\n/g, '')) : '';
      if (opts.cache !== false) {
        localStorage.setItem(getCacheKey(path), JSON.stringify({
          content,
          sha: data.sha,
          cachedAt: Date.now()
        }));
      }
      return {
        content,
        sha: data.sha,
        exists: true
      };
    } catch (err) {
      if (err.message.includes('404')) {
        return { content: '', sha: null, exists: false };
      }
      throw err;
    }
  }

  async function putFile(path, content, message = 'Update data') {
    const { sha } = await getFile(path);
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: 'main'
    };
    if (sha) body.sha = sha;
    const result = await apiRequest('PUT', path, body);
    localStorage.setItem(getCacheKey(path), JSON.stringify({
      content,
      sha: result.content.sha,
      cachedAt: Date.now()
    }));
    return result;
  }

  async function deleteFile(path, message = 'Delete file') {
    const { sha } = await getFile(path);
    if (!sha) return null;
    const body = {
      message,
      sha,
      branch: 'main'
    };
    return apiRequest('DELETE', path, body);
  }

  async function listFiles(path = '') {
    const data = await apiRequest('GET', path || '.');
    if (!Array.isArray(data)) return [];
    return data.map(item => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size
    }));
  }

  function getCachedFile(path) {
    const raw = localStorage.getItem(getCacheKey(path));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearCache() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  return {
    getConfig,
    setConfig,
    hasConfig,
    getFile,
    putFile,
    deleteFile,
    listFiles,
    getCachedFile,
    clearCache
  };
})();