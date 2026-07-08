(async () => {
  const STORE = {
    get(key, def) {
      try { const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch { return def; }
    },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
  };

  const store = {
    get: (k, def) => STORE.get('cb_' + k, def),
    set: (k, v) => STORE.set('cb_' + k, v)
  };

  const state = {
    posts: [],
    activeTag: null,
    skills: [],
    activeSkills: new Set(store.get('active_skills', ['word-count', 'toc-generator', 'share', 'reading-progress'])),
    profile: null,
    adminAuthed: false,
    adminTab: 'dashboard',
    editingPost: null
  };

  const bus = {
    listeners: {},
    on(e, fn) { (this.listeners[e] = this.listeners[e] || []).push(fn); },
    emit(e, p) { (this.listeners[e] || []).forEach(fn => fn(p)); }
  };

  const ctx = {
    on: (e, fn) => bus.on(e, fn),
    dispatch: (e, p) => bus.emit(e, p),
    store,
    toast: (msg) => showToast(msg)
  };

  function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.className = 'toast show ' + type;
    t.innerHTML = `<svg><use href="#i-${type === 'error' ? 'close' : 'check'}"/></svg> ${msg}`;
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  function registerSkills() {
    (window.CB_SKILLS || []).forEach(skill => {
      skill.install(ctx);
      state.skills.push(skill);
    });
  }

  function initTheme() {
    const saved = store.get('theme', 'dark');
    document.documentElement.dataset.theme = saved;
    document.getElementById('themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme;
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      store.set('theme', next);
      document.getElementById('hljs-dark').disabled = next === 'light';
      document.getElementById('hljs-light').disabled = next === 'dark';
    });
  }

  function updateYear() {
    document.getElementById('year').textContent = new Date().getFullYear();
  }

  function setupNav() {
    document.getElementById('menuToggle').addEventListener('click', () => {
      document.getElementById('nav').classList.toggle('open');
    });
  }

  function setupSearch() {
    const input = document.getElementById('searchInput');
    const box = input.closest('.search-box');
    input.addEventListener('focus', () => renderSearchResults('', box, input));
    input.addEventListener('input', () => renderSearchResults(input.value, box, input));
    input.addEventListener('blur', () => setTimeout(() => {
      box.querySelector('.search-results')?.classList.remove('show');
    }, 200));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = box.querySelector('.search-item');
        if (first) location.hash = first.dataset.href;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        input.focus();
      }
    });
  }

  function renderSearchResults(q, box, input) {
    let results = [];
    if (q.trim()) {
      const kw = q.toLowerCase();
      results = state.posts.filter(p =>
        p.title.toLowerCase().includes(kw) ||
        (p.excerpt || '').toLowerCase().includes(kw) ||
        (p.tags || []).some(t => t.toLowerCase().includes(kw))
      );
    } else {
      results = state.posts.slice(0, 5);
    }
    let el = box.querySelector('.search-results');
    if (!el) {
      el = document.createElement('div');
      el.className = 'search-results';
      box.appendChild(el);
    }
    if (!results.length) {
      el.innerHTML = '<div class="search-empty">暂无匹配的文章</div>';
    } else {
      el.innerHTML = results.map((p, i) => `
        <a class="search-item ${i === 0 ? 'active' : ''}" href="#/post/${p.id}" data-href="#/post/${p.id}">
          <div class="title">${p.title}</div>
          <div class="excerpt">${(p.excerpt || '').slice(0, 80)} · ${p.date}</div>
        </a>
      `).join('');
    }
    el.classList.add('show');
  }

  function route() {
    const hash = location.hash || '#/';
    const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const [name, param] = parts;

    document.querySelectorAll('.nav-link').forEach(l => {
      const key = l.dataset.nav;
      const active = (key === 'home' && !name) || key === name;
      l.classList.toggle('active', !!active);
    });

    const app = document.getElementById('app');
    app.classList.remove('fade-in');
    void app.offsetWidth;
    app.classList.add('fade-in');

    switch (name) {
      case '':
      case 'home':
        return renderHome(app);
      case 'post':
        return renderPost(app, param);
      case 'tags':
        return renderTags(app, param);
      case 'skills':
        return renderSkills(app);
      case 'ai':
        return renderAI(app);
      case 'about':
        return renderAbout(app);
      case 'account':
        return renderAccountPage(app);
      case 'admin':
        if (state.adminAuthed || !state.profile?.passwordHash || (window.CBAccounts && window.CBAccounts.isAdmin())) {
          return renderAdmin(app, param);
        } else {
          location.hash = '#/admin-login';
          return renderAdminLogin(app);
        }
      case 'admin-login':
        return renderAdminLogin(app);
      case 'setup':
        return renderSetupWizard(app, true);
      default:
        return renderHome(app);
    }
  }

  function fmtDate(d) {
    try { return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return d; }
  }

  function fmtRelative(ts) {
    try {
      const diff = Date.now() - ts;
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
      if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
      return new Date(ts).toLocaleDateString('zh-CN');
    } catch { return ''; }
  }

  function renderHome(app) {
    const profile = state.profile;
    const posts = state.activeTag
      ? state.posts.filter(p => (p.tags || []).includes(state.activeTag))
      : state.posts;
    const tagCounts = getTagCounts();

    app.innerHTML = `
      <section class="hero">
        <div class="hero-badge">
          <span class="dot"></span>
          <span>v1.0 · 由 AI 驱动的现代化博客</span>
        </div>
        <h1>${profile ? profile.title.split('·')[0].trim() : '分享想法，'}<span class="gradient">连接世界</span><br/>${profile?.blogName || 'C Blog'}</h1>
        <p>${profile?.blogDesc || '一个轻量、现代、开源、原生支持 AI 与 Skill 插件的个人博客。无需后端，部署到 GitHub Pages 即可永久在线。'}</p>
        <div class="hero-actions">
          <a href="#/ai" class="btn btn-primary" data-route>
            <svg><use href="#i-ai"/></svg>
            与 AI 对话
          </a>
          <a href="#/skills" class="btn btn-ghost" data-route>
            <svg><use href="#i-skill"/></svg>
            探索 Skill
          </a>
        </div>
      </section>

      ${tagCounts.length ? `
      <section class="section">
        <div class="section-header">
          <div class="section-title">标签</div>
        </div>
        <div class="tag-cloud">
          <span class="tag ${!state.activeTag ? 'active' : ''}" data-tag="">全部 <span class="count">(${state.posts.length})</span></span>
          ${tagCounts.map(t => `
            <span class="tag ${state.activeTag === t.name ? 'active' : ''}" data-tag="${t.name}">${t.name} <span class="count">(${t.count})</span></span>
          `).join('')}
        </div>
      </section>` : ''}

      <section class="section">
        <div class="section-header">
          <div class="section-title">
            ${state.activeTag ? `#${state.activeTag}` : '最新文章'}
            <span class="count">(${posts.length})</span>
          </div>
          <a href="#/tags" class="section-link" data-route>
            查看全部标签
            <svg><use href="#i-arrow-right"/></svg>
          </a>
        </div>
        <div class="post-grid">
          ${posts.map(p => `
            <a class="post-card" href="#/post/${p.id}" data-route>
              <div class="post-meta">
                <svg><use href="#i-clock"/></svg>
                <span>${fmtDate(p.date)}</span>
                <span class="dot-sep"></span>
                <span>${p.readTime || 4} 分钟阅读</span>
              </div>
              <h2 class="post-title">${p.title}</h2>
              <p class="post-excerpt">${p.excerpt || ''}</p>
              <div class="post-tags">
                ${(p.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
              </div>
            </a>
          `).join('')}
        </div>
      </section>
    `;

    app.querySelectorAll('.tag[data-tag]').forEach(el => {
      el.addEventListener('click', () => {
        state.activeTag = el.dataset.tag || null;
        renderHome(app);
      });
    });

    app.querySelectorAll('[data-route]').forEach(a => {
      a.addEventListener('click', (e) => {
        if (a.target.closest('[data-route]') && a.dataset.route !== undefined) {
          e.preventDefault();
          location.hash = a.getAttribute('href');
        }
      });
    });
  }

  function getTagCounts() {
    const map = {};
    state.posts.forEach(p => (p.tags || []).forEach(t => map[t] = (map[t] || 0) + 1));
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }

  function renderPost(app, id) {
    const post = state.posts.find(p => p.id === id);
    if (!post) {
      app.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted);">文章不存在</div>`;
      return;
    }

    const content = window.marked.parse(post.content || '');
    const profile = state.profile;
    const postAuthor = post.author || profile?.username || 'C';
    const postAvatar = post.avatar || (profile ? `${profile.avatarInitials || profile.username || 'C'}` : 'C');
    const avatarHTML = (profile && post.author === profile.username)
      ? window.CBProfile.avatarHTML(profile, 28)
      : `<span class="avatar">${postAvatar.slice(0, 2).toUpperCase()}</span>`;

    const comments = window.CBComments ? window.CBComments.getByPost(id, !!state.adminAuthed) : [];
    const pendingCount = window.CBComments ? window.CBComments.countPending() : 0;
    const aiEnabled = !!(window.CB_AI && window.CB_AI.config.apiKey);

    const html = `
      <article class="post-detail">
        <header class="post-detail-header">
          <div class="post-meta">
            <span>${fmtDate(post.date)}</span>
            <span class="dot-sep" style="width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.5"></span>
            <span>${post.readTime || 4} 分钟阅读</span>
          </div>
          <h1 class="post-detail-title">${post.title}</h1>
          <div class="post-detail-meta">
            <div class="author">
              ${avatarHTML}
              <span>${postAuthor}</span>
            </div>
            <div class="post-tags" style="display:flex;gap:6px">
              ${(post.tags || []).map(t => `<a class="tag" href="#/tags/${encodeURIComponent(t)}" data-route>#${t}</a>`).join('')}
            </div>
          </div>
        </header>
        <div class="prose">${content}</div>
      </article>
      <section class="comment-section" id="commentSection">
        <div class="comment-header">
          <h2><svg><use href="#i-comment"/></svg> 评论 <span class="count" id="commentCount">${comments.filter(c => c.status === 'approved').length}</span></h2>
          ${aiEnabled ? '<span class="comment-ai-badge" title="已启用 AI 审查"><svg><use href="#i-ai"/></svg> AI 自动审查</span>' : ''}
        </div>
        <div class="comment-form" id="commentForm">
          <div class="comment-form-row">
            <input type="text" id="commentAuthor" placeholder="你的昵称" maxlength="30" />
          </div>
          <textarea id="commentContent" rows="4" placeholder="说点什么吧… 支持 Markdown 语法" maxlength="2000"></textarea>
          <div class="comment-form-foot">
            <span class="hint" id="commentHint">本地评论 · 数据仅保存在你的设备</span>
            <div class="comment-form-actions">
              <button class="btn btn-ghost" id="previewComment" type="button">预览</button>
              <button class="btn btn-primary" id="submitComment" type="button">
                <svg><use href="#i-send"/></svg> 发表评论
              </button>
            </div>
          </div>
        </div>
        <div class="comment-list" id="commentList">
          ${renderCommentList(comments)}
        </div>
      </section>
    `;
    app.innerHTML = html;

    bindCommentSection(id);

    app.querySelectorAll('.prose pre').forEach(pre => {
      const code = pre.querySelector('code');
      if (code && !code.classList.contains('hljs')) {
        try { window.hljs.highlightElement(code); } catch {}
      }
      pre.style.position = 'relative';
      const btn = document.createElement('button');
      btn.className = 'copy-code-btn';
      btn.innerHTML = '<svg><use href="#i-copy"/></svg> 复制';
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(code.innerText).then(() => showToast('代码已复制 ✓'));
      });
      pre.appendChild(btn);
    });

    bus.emit('post:rendered', { container: app, post });

    app.querySelectorAll('[data-route]').forEach(a => {
      a.addEventListener('click', (e) => {
        if (a.target.closest('[data-route]')) {
          e.preventDefault();
          location.hash = a.getAttribute('href');
        }
      });
    });
  }

  function renderCommentList(comments) {
    if (!comments || !comments.length) {
      return `<div class="comment-empty">还没有评论，来抢沙发吧 🛋️</div>`;
    }
    return comments.map(c => {
      const author = window.CBComments.sanitize(c.author);
      const content = window.CBComments.sanitize(c.content);
      let avatar;
      if (c.userId && window.CBAccounts) {
        const u = window.CBAccounts.getUserById(c.userId);
        if (u) {
          avatar = window.CBAccounts.avatarHTML(u, 36);
        } else {
          avatar = `<span class="user-avatar" style="width:36px;height:36px;font-size:14px;">${author.slice(0, 2).toUpperCase()}</span>`;
        }
      } else {
        avatar = `<span class="user-avatar" style="width:36px;height:36px;font-size:14px;">${author.slice(0, 2).toUpperCase()}</span>`;
      }
      const userTag = c.role === 'admin'
        ? `<span class="c-user-tag admin"><svg><use href="#i-shield"/></svg> 管理员</span>`
        : (c.userId ? `<span class="c-user-tag">已登录</span>` : '');
      const authorDisplay = c.userId
        ? `<span class="c-user-link">${author}</span>${userTag}`
        : author;
      const statusBadge = c.status === 'pending'
        ? '<span class="comment-status pending">⏳ 审核中</span>'
        : c.status === 'rejected'
        ? '<span class="comment-status rejected">❌ 已拒绝</span>'
        : '';
      const aiTag = c.aiResult && c.aiResult.tags && c.aiResult.tags.length
        ? `<span class="comment-ai-tag">${c.aiResult.tags.slice(0, 2).join(' · ')}</span>`
        : '';
      return `
        <div class="comment-item" data-id="${c.id}">
          <div class="comment-avatar">${avatar}</div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-author">${authorDisplay}</span>
              <span class="comment-time" title="${new Date(c.createdAt).toLocaleString()}">${fmtRelative(c.createdAt)}</span>
              ${statusBadge}
              ${aiTag}
            </div>
            <div class="comment-content">${content.replace(/\n/g, '<br/>')}</div>
            ${c.aiResult && c.aiResult.reason ? `<div class="comment-ai-note">🤖 ${window.CBComments.sanitize(c.aiResult.reason)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function bindCommentSection(postId) {
    const form = document.getElementById('commentForm');
    if (!form || !window.CBComments) return;

    const authorInput = form.querySelector('#commentAuthor');
    const contentInput = form.querySelector('#commentContent');
    const submitBtn = form.querySelector('#submitComment');
    const previewBtn = form.querySelector('#previewComment');
    const countEl = document.getElementById('commentCount');
    const listEl = document.getElementById('commentList');
    const hintEl = form.querySelector('#commentHint');

    const curUser = window.CBAccounts ? window.CBAccounts.getCurrentUser() : null;
    if (curUser) {
      authorInput.value = window.CBAccounts.displayName(curUser);
      authorInput.disabled = true;
      authorInput.style.background = 'var(--bg-elev)';
      authorInput.style.opacity = '0.8';
      hintEl.textContent = `已登录为 @${curUser.username} · 评论将关联到你的账号`;
    } else {
      const savedName = localStorage.getItem('cb_comment_author') || '';
      if (savedName) authorInput.value = savedName;
      hintEl.textContent = '未登录 · 评论仅本地可见，登录后可关联账号';
    }

    let previewing = false;
    previewBtn.addEventListener('click', () => {
      if (previewing) {
        contentInput.value = contentInput.replace(/<[^>]+>/g, '');
        previewBtn.innerHTML = '预览';
        previewing = false;
      } else {
        const html = window.marked.parse(contentInput.value || '');
        contentInput.value = html;
        previewBtn.innerHTML = '编辑';
        previewing = true;
      }
    });

    submitBtn.addEventListener('click', async () => {
      const author = authorInput.value.trim();
      const content = contentInput.value.trim();
      if (!window.CBComments.canSubmit()) {
        showToast('请稍后再发表评论', 'error');
        return;
      }
      try {
        const opts = {};
        if (curUser) {
          opts.userId = curUser.id;
          opts.role = curUser.role;
        }
        const comment = window.CBComments.create(postId, author, content, opts);
        if (!curUser) {
          localStorage.setItem('cb_comment_author', comment.author);
        }
        contentInput.value = '';
        contentInput.style.height = 'auto';

        const aiEnabled = !!(window.CB_AI && window.CB_AI.config.apiKey);
        if (aiEnabled) {
          showToast('评论已发表，AI 正在审查…');
          renderCommentSection(postId);
          try {
            await window.CBComments.aiReview(comment.id);
          } catch (e) {}
        } else {
          showToast('评论已发表，等待审核');
        }
        renderCommentSection(postId);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    contentInput.addEventListener('input', () => {
      contentInput.style.height = 'auto';
      contentInput.style.height = Math.min(contentInput.scrollHeight, 300) + 'px';
    });
  }

  function renderCommentSection(postId) {
    if (!window.CBComments) return;
    const listEl = document.getElementById('commentList');
    const countEl = document.getElementById('commentCount');
    if (!listEl) return;
    const includePending = !!state.adminAuthed;
    const comments = window.CBComments.getByPost(postId, includePending);
    listEl.innerHTML = renderCommentList(comments);
    if (countEl) {
      countEl.textContent = comments.filter(c => c.status === 'approved').length;
    }
  }

  function renderTags(app, filterTag) {
    const tagCounts = getTagCounts();
    const filteredPosts = filterTag
      ? state.posts.filter(p => (p.tags || []).includes(decodeURIComponent(filterTag)))
      : state.posts;

    app.innerHTML = `
      <section class="section">
        <div class="section-header">
          <div class="section-title">标签墙</div>
        </div>
        <div class="tag-cloud">
          ${tagCounts.map(t => `
            <a class="tag" href="#/tags/${encodeURIComponent(t.name)}" data-route>${t.name} <span class="count">(${t.count})</span></a>
          `).join('')}
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div class="section-title">${filterTag ? `#${decodeURIComponent(filterTag)}` : '全部文章'} <span class="count">(${filteredPosts.length})</span></div>
        </div>
        <div class="post-grid">
          ${filteredPosts.map(p => `
            <a class="post-card" href="#/post/${p.id}" data-route>
              <div class="post-meta">
                <span>${fmtDate(p.date)}</span>
                <span class="dot-sep"></span>
                <span>${p.readTime || 4} 分钟阅读</span>
              </div>
              <h2 class="post-title">${p.title}</h2>
              <p class="post-excerpt">${p.excerpt || ''}</p>
              <div class="post-tags">
                ${(p.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
              </div>
            </a>
          `).join('')}
        </div>
      </section>
    `;

    app.querySelectorAll('[data-route]').forEach(a => {
      a.addEventListener('click', (e) => {
        if (a.target.closest('[data-route]')) {
          e.preventDefault();
          location.hash = a.getAttribute('href');
        }
      });
    });
  }

  function renderSkills(app) {
    app.innerHTML = `
      <section class="skills-intro">
        <h2><svg><use href="#i-skill"/></svg> Skill 插件系统</h2>
        <p>C Blog 的 Skill 系统让功能扩展像搭积木一样简单。启用后会自动注入相应的 UI 与行为。</p>
      </section>
      <div class="skill-grid" id="skillGrid">
        ${state.skills.map(s => `
          <div class="skill-card" data-skill="${s.id}">
            <div class="skill-icon"><svg><use href="#${s.icon || 'i-sparkle'}"/></svg></div>
            <h3 class="skill-title">${s.name}</h3>
            <p class="skill-desc">${s.description}</p>
            <div class="skill-meta">
              <span class="skill-version">v${s.version}</span>
              <button class="skill-toggle ${state.activeSkills.has(s.id) ? 'on' : ''}">
                <span class="status-dot"></span>
                ${state.activeSkills.has(s.id) ? '已启用' : '启用'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    app.querySelectorAll('.skill-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.skill-card');
        const id = card.dataset.skill;
        const skill = state.skills.find(s => s.id === id);
        if (state.activeSkills.has(id)) {
          state.activeSkills.delete(id);
          try { skill.uninstall(ctx); } catch {}
          showToast(`${skill.name} 已禁用`);
        } else {
          state.activeSkills.add(id);
          try { skill.install(ctx); } catch {}
          showToast(`${skill.name} 已启用`);
        }
        store.set('active_skills', [...state.activeSkills]);
        renderSkills(app);
      });
    });

    const style = document.createElement('style');
    style.textContent = `
      .skill-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: 100px;
        font-size: 12px;
        color: var(--text-muted);
        transition: all 0.2s;
      }
      .skill-toggle:hover { color: var(--text); }
      .skill-toggle.on { background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.3); color: var(--success); }
      .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    `;
    document.head.appendChild(style);
  }

  function renderAI(app) {
    const ai = window.CB_AI;
    const providers = [
      { id: 'openrouter', name: 'OpenRouter' },
      { id: 'deepseek', name: 'DeepSeek' },
      { id: 'qwen', name: '阿里云百炼' },
      { id: 'custom', name: '自定义' }
    ];
    const currentProvider = ai.config.provider;
    const isCustom = currentProvider === 'custom';
    const models = ai.models[currentProvider] || [];

    app.innerHTML = `
      <div class="ai-container">
        <div class="ai-header">
          <h2><svg><use href="#i-ai"/></svg> AI 助手</h2>
          <p>所有对话在你的浏览器本地完成，密钥仅保存在此设备。</p>
          <div class="ai-settings">
            <div class="ai-field">
              <label>供应商</label>
              <select id="aiProvider">
                ${providers.map(p => `<option value="${p.id}" ${p.id === currentProvider ? 'selected' : ''}>${p.name}</option>`).join('')}
              </select>
            </div>
            <div class="ai-field" id="aiModelField" style="${isCustom ? 'display:none;' : ''}">
              <label>模型</label>
              <select id="aiModel">
                ${models.map(m => `<option value="${m.id}" ${m.id === ai.config.model ? 'selected' : ''}>${m.name}</option>`).join('')}
              </select>
            </div>
            <div class="ai-field" id="aiCustomModelField" style="${isCustom ? '' : 'display:none;'}">
              <label>模型名称</label>
              <input id="aiCustomModel" type="text" placeholder="例如：my-model-v1" value="${ai.config.customModel}"/>
            </div>
            <div class="ai-field">
              <label>API Key</label>
              <input id="aiKey" type="password" placeholder="sk-..." value="${ai.config.apiKey}"/>
            </div>
            <div class="ai-field" id="aiBaseField" style="${isCustom ? '' : 'display:none;'}">
              <label>Base URL</label>
              <input id="aiBase" type="text" placeholder="https://api.example.com" value="${localStorage.getItem('cb_ai_base') || ''}"/>
            </div>
          </div>
        </div>
        <div class="ai-actions" id="aiPresets">
          ${ai.presets.map((p, i) => `<button class="ai-chip" data-preset="${i}">${p.label}</button>`).join('')}
        </div>
        <div class="ai-chat" id="aiChat"></div>
        <div class="ai-input-wrap">
          <textarea id="aiInput" rows="1" placeholder="输入消息，Shift+Enter 换行…"></textarea>
          <button class="ai-send" id="aiSend" title="发送">
            <svg><use href="#i-send"/></svg>
          </button>
        </div>
      </div>
    `;

    const providerSel = document.getElementById('aiProvider');
    const modelSel = document.getElementById('aiModel');
    const customModelInput = document.getElementById('aiCustomModel');
    const baseInput = document.getElementById('aiBase');
    const keyInput = document.getElementById('aiKey');
    const modelField = document.getElementById('aiModelField');
    const customModelField = document.getElementById('aiCustomModelField');
    const baseField = document.getElementById('aiBaseField');
    const chat = document.getElementById('aiChat');
    const input = document.getElementById('aiInput');
    const sendBtn = document.getElementById('aiSend');

    function applyProviderUI() {
      const isCustom = providerSel.value === 'custom';
      modelField.style.display = isCustom ? 'none' : '';
      customModelField.style.display = isCustom ? '' : 'none';
      baseField.style.display = isCustom ? '' : 'none';
      if (isCustom) {
        if (!baseInput.value.trim()) {
          const cur = localStorage.getItem('cb_ai_base') || '';
          baseInput.value = cur;
        }
      } else {
        const ms = ai.models[providerSel.value] || [];
        modelSel.innerHTML = ms.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
      }
    }

    providerSel.addEventListener('change', () => {
      ai.config.provider = providerSel.value;
      applyProviderUI();
    });
    if (modelSel) modelSel.addEventListener('change', () => ai.config.model = modelSel.value);
    if (customModelInput) {
      customModelInput.addEventListener('input', () => {
        ai.config.customModel = customModelInput.value.trim();
      });
    }
    if (baseInput) {
      baseInput.addEventListener('change', () => {
        const v = baseInput.value.trim();
        if (v) localStorage.setItem('cb_ai_base', v);
        else localStorage.removeItem('cb_ai_base');
      });
    }
    keyInput.addEventListener('change', () => ai.config.apiKey = keyInput.value.trim());
    applyProviderUI();

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    sendBtn.addEventListener('click', send);

    document.getElementById('aiPresets').addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-chip');
      if (!btn) return;
      const preset = ai.presets[parseInt(btn.dataset.preset)];
      const topic = state.posts[0]?.title || '一个有趣的话题';
      input.value = preset.prompt.replace('$TOPIC', topic).replace('$TEXT', state.posts.map(p => p.title).join('\n'));
      input.focus();
    });

    chat.innerHTML = `
      <div class="ai-msg">
        <div class="ai-avatar"><svg><use href="#i-ai"/></svg></div>
        <div class="ai-bubble">你好！我是 C Blog AI 助手 👋<br/>配置好 API Key 后即可开始对话。试试上方的快捷指令吧～</div>
      </div>
    `;

    async function send() {
      const text = input.value.trim();
      if (!text) return;
      if (!ai.config.apiKey) {
        showToast('请先填写 API Key', 'error');
        return;
      }
      addMsg('user', text);
      input.value = '';
      input.style.height = 'auto';

      const typing = addMsg('assistant', '', true);

      try {
        const history = collectHistory();
        const res = await ai.chat([...history, { role: 'user', content: text }], { stream: true });
        let acc = '';
        for await (const delta of ai.streamText(res)) {
          acc += delta;
          typing.querySelector('.ai-bubble').textContent = acc;
        }
        typing.classList.remove('typing');
        typing.querySelector('.ai-bubble').textContent = acc || '（空响应）';
      } catch (err) {
        typing.classList.remove('typing');
        typing.querySelector('.ai-bubble').textContent = '❌ ' + (err.message || '请求失败');
        showToast('AI 请求失败', 'error');
      }
    }

    function collectHistory() {
      return [...chat.querySelectorAll('.ai-msg')]
        .filter(m => !m.classList.contains('typing'))
        .map(m => ({
          role: m.classList.contains('user') ? 'user' : 'assistant',
          content: m.querySelector('.ai-bubble').textContent
        }));
    }

    function addMsg(role, content, typing_ = false) {
      const msg = document.createElement('div');
      msg.className = 'ai-msg ' + (role === 'user' ? 'user' : '') + (typing_ ? ' typing' : '');
      msg.innerHTML = `
        <div class="ai-avatar ${role === 'user' ? 'user-avatar' : ''}">
          <svg><use href="#${role === 'user' ? 'i-user' : 'i-ai'}"/></svg>
        </div>
        <div class="ai-bubble">${typing_ ? '<span></span><span></span><span></span>' : content}</div>
      `;
      chat.appendChild(msg);
      chat.scrollTop = chat.scrollHeight;
      return msg;
    }
  }

  function renderAbout(app) {
    const totalPosts = state.posts.length;
    const totalTags = getTagCounts().length;
    const words = state.posts.reduce((s, p) => s + (p.content ? p.content.length : 0), 0);
    const profile = state.profile || window.CBProfile.DEFAULT;
    const avatarHTML = window.CBProfile.avatarHTML(profile, 120);

    app.innerHTML = `
      <section class="about-hero">
        <div class="about-avatar">
          ${profile.avatarType === 'emoji' && profile.avatarEmoji
            ? `<div style="font-size:54px;display:flex;align-items:center;justify-content:center;">${profile.avatarEmoji}</div>`
            : profile.avatarType === 'image' && profile.avatarImage
              ? `<img src="${profile.avatarImage}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
              : avatarHTML.replace('class="user-avatar"', 'class="user-avatar" style="width:120px;height:120px;font-size:44px;display:flex;align-items:center;justify-content:center;background:var(--gradient);color:white;font-weight:800;"').match(/<span[^>]*>([^<]*)<\/span>/)[1]
          }
        </div>
        <div class="about-info">
          <h1>你好，我是 ${profile.username || 'C'} 👋</h1>
          <p class="title">${profile.title || '独立开发者 · 技术写作者'}</p>
          <p class="bio">${profile.bio || '这里是我的数字花园，记录我对代码、设计、AI 与生活的思考。'}</p>
          <div class="about-socials">
            ${profile.githubUrl ? `<a class="icon-btn" href="${profile.githubUrl}" target="_blank" rel="noreferrer"><svg><use href="#i-github"/></svg></a>` : ''}
            ${profile.twitterUrl ? `<a class="icon-btn" href="${profile.twitterUrl}" target="_blank" rel="noreferrer"><svg><use href="#i-twitter"/></svg></a>` : ''}
            ${profile.websiteUrl ? `<a class="icon-btn" href="${profile.websiteUrl}" target="_blank" rel="noreferrer"><svg><use href="#i-link"/></svg></a>` : ''}
            <a class="icon-btn" href="#/admin" data-route title="编辑个人资料"><svg><use href="#i-edit"/></svg></a>
          </div>
        </div>
      </section>

      <div class="about-stats">
        <div class="stat-card"><div class="stat-value">${totalPosts}</div><div class="stat-label">篇文章</div></div>
        <div class="stat-card"><div class="stat-value">${totalTags}</div><div class="stat-label">个标签</div></div>
        <div class="stat-card"><div class="stat-value">${(words / 1000).toFixed(1)}k</div><div class="stat-label">字</div></div>
        <div class="stat-card"><div class="stat-value">∞</div><div class="stat-label">热爱</div></div>
      </div>

      <section class="about-section">
        <h2><svg><use href="#i-code"/></svg> 技术栈</h2>
        <div class="skill-tags">
          <span class="tag">JavaScript</span>
          <span class="tag">TypeScript</span>
          <span class="tag">React</span>
          <span class="tag">Node.js</span>
          <span class="tag">Python</span>
          <span class="tag">Rust</span>
          <span class="tag">Go</span>
          <span class="tag">Docker</span>
          <span class="tag">AI / LLM</span>
        </div>
      </section>

      <section class="about-section">
        <h2><svg><use href="#i-sparkle"/></svg> C Blog 的故事</h2>
        <p style="color:var(--text-muted);line-height:1.8;">
          C Blog 诞生于 2026 年夏天，初衷是希望拥有一个完全属于自己的、不受任何平台约束的表达空间。
          它的每一行代码都是开源的，你可以自由地 fork、修改、部署。
          如果你也喜欢它，欢迎在 GitHub 上留下一颗 ⭐️。
        </p>
      </section>
    `;
  }

  async function loadPosts() {
    state.posts = (window.CB_POSTS || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function applySkillStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .post-stats {
        display: flex;
        gap: 20px;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px dashed var(--border);
      }
      .stat-item { display: flex; flex-direction: column; }
      .stat-item strong { font-size: 20px; font-weight: 700; background: var(--gradient); -webkit-background-clip: text; background-clip: text; color: transparent; }
      .stat-item span { font-size: 12px; color: var(--text-muted); }
      .toc {
        margin: 20px 0;
        padding: 18px 20px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .toc-title { font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text); }
      .toc a { font-size: 13px; color: var(--text-muted); transition: color 0.2s; }
      .toc a:hover { color: var(--accent); }
      .share-actions {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .share-label { font-size: 13px; color: var(--text-muted); }
      .share-btn {
        padding: 6px 14px;
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: 100px;
        font-size: 12.5px;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.2s;
      }
      .share-btn:hover { color: var(--text); border-color: var(--accent); }
      .ai-polish-btn { width: 100%; }
      @media (max-width: 600px) {
        .post-stats { gap: 12px; }
      }
    `;
    document.head.appendChild(style);
  }

  function updateUserChip() {
    const chip = document.getElementById('userChip');
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    const loginBtn = document.getElementById('loginBtn');

    const curUser = window.CBAccounts && window.CBAccounts.getCurrentUser();
    const profile = state.profile;

    if (curUser) {
      chip.style.display = '';
      chip.setAttribute('href', '#/account');
      chip.setAttribute('title', '我的账号');
      nameEl.textContent = window.CBAccounts.displayName(curUser) + (curUser.role === 'admin' ? ' 👑' : '');
      if (curUser.avatarType === 'emoji' && curUser.avatarEmoji) {
        avatarEl.textContent = curUser.avatarEmoji;
        avatarEl.style.fontSize = '16px';
      } else if (curUser.avatarType === 'image' && curUser.avatarImage) {
        avatarEl.innerHTML = `<img src="${curUser.avatarImage}" alt="avatar">`;
      } else {
        avatarEl.textContent = (curUser.avatarInitials || curUser.nickname || curUser.username || '?').slice(0, 2).toUpperCase();
        avatarEl.style.fontSize = '';
      }
      if (loginBtn) loginBtn.style.display = 'none';
    } else if (profile) {
      chip.style.display = '';
      chip.setAttribute('href', '#/account');
      chip.setAttribute('title', '登录/注册');
      nameEl.textContent = '游客';
      if (profile.avatarType === 'emoji' && profile.avatarEmoji) {
        avatarEl.textContent = profile.avatarEmoji;
        avatarEl.style.fontSize = '16px';
      } else if (profile.avatarType === 'image' && profile.avatarImage) {
        avatarEl.innerHTML = `<img src="${profile.avatarImage}" alt="avatar">`;
      } else {
        avatarEl.textContent = (profile.avatarInitials || profile.username || 'C').slice(0, 2).toUpperCase();
        avatarEl.style.fontSize = '';
      }
      if (loginBtn) loginBtn.style.display = '';
    } else {
      chip.style.display = '';
      chip.setAttribute('href', '#/account');
      chip.setAttribute('title', '登录/注册');
      nameEl.textContent = '游客';
      avatarEl.textContent = '?';
      avatarEl.style.fontSize = '';
      if (loginBtn) loginBtn.style.display = '';
    }
  }

  function initSetupWizard() {
    const overlay = document.getElementById('setupOverlay');
    const form = {
      tabs: overlay.querySelectorAll('.setup-tab'),
      panels: overlay.querySelectorAll('.setup-panel'),
      avatarOptions: overlay.querySelectorAll('input[name="avatarType"]'),
      avatarInitialsRow: document.getElementById('avatarInitialsRow'),
      avatarEmojiRow: document.getElementById('avatarEmojiRow'),
      avatarImageRow: document.getElementById('avatarImageRow'),
      avatarInitials: document.getElementById('avatarInitials'),
      avatarEmoji: document.getElementById('avatarEmoji'),
      avatarImage: document.getElementById('avatarImage'),
      avatarPreview: document.getElementById('avatarPreview'),
      username: document.getElementById('username'),
      title: document.getElementById('title'),
      bio: document.getElementById('bio'),
      blogName: document.getElementById('blogName'),
      blogDesc: document.getElementById('blogDesc'),
      githubUrl: document.getElementById('githubUrl'),
      twitterUrl: document.getElementById('twitterUrl'),
      websiteUrl: document.getElementById('websiteUrl'),
      adminPassword: document.getElementById('adminPassword'),
      adminPasswordConfirm: document.getElementById('adminPasswordConfirm'),
      enableStats: document.getElementById('enableStats'),
      enableAI: document.getElementById('enableAI'),
      saveBtn: document.getElementById('setupSave'),
      skipBtn: document.getElementById('setupSkip')
    };

    const updatePreview = () => {
      const type = form.avatarOptions[0].checked ? 'initials' : form.avatarOptions[1].checked ? 'emoji' : 'image';
      if (type === 'initials') {
        form.avatarPreview.textContent = (form.avatarInitials.value || 'C').slice(0, 2).toUpperCase();
        form.avatarPreview.style.background = '';
      } else if (type === 'emoji') {
        form.avatarPreview.textContent = form.avatarEmoji.value || '😊';
        form.avatarPreview.style.background = '';
      }
    };

    form.avatarOptions.forEach(opt => opt.addEventListener('change', () => {
      const type = opt.value;
      form.avatarInitialsRow.style.display = type === 'initials' ? '' : 'none';
      form.avatarEmojiRow.style.display = type === 'emoji' ? '' : 'none';
      form.avatarImageRow.style.display = type === 'image' ? '' : 'none';
      updatePreview();
    }));

    form.avatarInitials.addEventListener('input', updatePreview);
    form.avatarEmoji.addEventListener('input', updatePreview);

    document.querySelectorAll('#emojiPicker button').forEach(b => {
      b.addEventListener('click', () => {
        form.avatarEmoji.value = b.dataset.emoji;
        updatePreview();
      });
    });

    form.avatarImage.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 200;
          canvas.width = size; canvas.height = size;
          const ctx2 = canvas.getContext('2d');
          const min = Math.min(img.width, img.height);
          ctx2.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          form.avatarImage._dataUrl = dataUrl;
          form.avatarPreview.innerHTML = `<img src="${dataUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;">`;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    form.tabs.forEach(tab => tab.addEventListener('click', () => {
      form.tabs.forEach(t => t.classList.remove('active'));
      form.panels.forEach(p => p.style.display = 'none');
      tab.classList.add('active');
      const panel = document.querySelector(`.setup-panel[data-panel="${tab.dataset.tab}"]`);
      panel.style.display = '';
    }));

    form.username.addEventListener('input', () => {
      const v = form.username.value.trim();
      if (form.avatarOptions[0].checked) {
        form.avatarInitials.value = v.slice(0, 2).toUpperCase() || form.avatarInitials.value;
        updatePreview();
      }
    });

    form.skipBtn.addEventListener('click', () => {
      window.CBProfile.set({
        username: 'C',
        avatarType: 'initials',
        avatarInitials: 'C',
        blogName: 'C Blog',
        blogDesc: '一个现代化、开源、支持 AI 与 Skill 的个人博客',
        createdAt: Date.now()
      });
      hideSetupOverlay();
      state.profile = window.CBProfile.get();
      updateUserChip();
      bus.emit('profile:updated', state.profile);
      route();
    });

    form.saveBtn.addEventListener('click', async () => {
      const username = form.username.value.trim();
      if (!username) {
        showToast('请输入昵称', 'error');
        form.username.focus();
        return;
      }
      const pwd = form.adminPassword.value;
      const pwdConfirm = form.adminPasswordConfirm.value;
      if (pwd || pwdConfirm) {
        if (pwd.length < 6) { showToast('密码至少 6 位', 'error'); return; }
        if (pwd !== pwdConfirm) { showToast('两次密码不一致', 'error'); return; }
      }
      const type = form.avatarOptions[0].checked ? 'initials' : form.avatarOptions[1].checked ? 'emoji' : 'image';
      const patch = {
        username,
        avatarType: type,
        avatarInitials: form.avatarInitials.value.trim().slice(0, 2).toUpperCase() || username.slice(0, 2).toUpperCase(),
        avatarEmoji: type === 'emoji' ? form.avatarEmoji.value.trim() : '',
        avatarImage: type === 'image' ? (form.avatarImage._dataUrl || '') : '',
        title: form.title.value.trim() || '独立开发者 · 技术写作者',
        bio: form.bio.value.trim(),
        blogName: form.blogName.value.trim() || 'C Blog',
        blogDesc: form.blogDesc.value.trim(),
        githubUrl: form.githubUrl.value.trim(),
        twitterUrl: form.twitterUrl.value.trim(),
        websiteUrl: form.websiteUrl.value.trim(),
        enableStats: form.enableStats.checked,
        enableAI: form.enableAI.checked
      };
      if (pwd) {
        patch.passwordHash = await window.CBProfile.hash(pwd);
      }
      patch.createdAt = Date.now();
      window.CBProfile.set(patch);
      state.profile = window.CBProfile.get();
      hideSetupOverlay();
      updateUserChip();
      bus.emit('profile:updated', state.profile);
      showToast(`欢迎 ${state.profile.username}！`);
      route();
    });
  }

  function showSetupOverlay() {
    const overlay = document.getElementById('setupOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
  }
  function hideSetupOverlay() {
    const overlay = document.getElementById('setupOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  function renderSetupWizard(app) {
    showSetupOverlay();
  }

  function renderAdminLogin(app) {
    app.innerHTML = `
      <div style="display:flex;justify-content:center;align-items:center;min-height:400px;">
        <div class="login-dialog" style="width:100%;max-width:400px;background:var(--bg-card);padding:32px;border-radius:20px;border:1px solid var(--border);text-align:center;">
          <div class="setup-logo" style="margin:0 auto 12px;"><svg class="brand-icon"><use href="#i-logo"/></svg></div>
          <h2>🔒 管理员登录</h2>
          <p class="setup-sub">请输入管理员密码进入后台</p>
          <div class="form-row"><input type="password" id="loginPwd" placeholder="管理员密码" autofocus/></div>
          <div id="loginErr" style="display:none;color:var(--danger);font-size:13px;margin-bottom:12px;">❌ 密码不正确，请重试</div>
          <div class="setup-actions" style="display:flex;gap:10px;">
            <button class="btn btn-ghost" id="loginCancel2" style="flex:1;">返回</button>
            <button class="btn btn-primary" id="loginSubmit2" style="flex:1;">登录</button>
          </div>
        </div>
      </div>
    `;
    const pwd = document.getElementById('loginPwd');
    const err = document.getElementById('loginErr');
    pwd.focus();
    const submit = async () => {
      const v = pwd.value;
      const ok = await window.CBProfile.verify(v);
      if (ok) {
        state.adminAuthed = true;
        showToast('登录成功');
        location.hash = '#/admin';
      } else {
        err.style.display = 'block';
        pwd.value = '';
        pwd.focus();
      }
    };
    document.getElementById('loginSubmit2').addEventListener('click', submit);
    pwd.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    document.getElementById('loginCancel2').addEventListener('click', () => location.hash = '#/');
  }

  function initAccountOverlay() {
    const overlay = document.getElementById('accountOverlay');
    if (!overlay) return;

    const tabs = overlay.querySelectorAll('.account-tab');
    const panels = overlay.querySelectorAll('.account-panel');
    const switchTab = (tab) => {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      panels.forEach(p => p.style.display = p.dataset.panel === tab ? '' : 'none');
    };
    tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    const errEl = (id) => {
      const el = document.getElementById(id);
      return {
        show(msg) { if (el) { el.textContent = msg; el.style.display = 'block'; } },
        hide() { if (el) { el.textContent = ''; el.style.display = 'none'; } }
      };
    };

    const loginErr = errEl('loginUserError');
    const regErr = errEl('regError');

    overlay.querySelector('#loginUserSubmit').addEventListener('click', async () => {
      const u = overlay.querySelector('#loginUsername').value.trim();
      const p = overlay.querySelector('#loginUserPassword').value;
      loginErr.hide();
      try {
        await window.CBAccounts.login(u, p);
        hideAccountOverlay();
        updateUserChip();
        showToast('登录成功');
        route();
      } catch (e) {
        loginErr.show(e.message);
      }
    });

    overlay.querySelector('#regSubmit').addEventListener('click', async () => {
      const u = overlay.querySelector('#regUsername').value.trim();
      const n = overlay.querySelector('#regNickname').value.trim();
      const em = overlay.querySelector('#regEmail').value.trim();
      const p1 = overlay.querySelector('#regPassword').value;
      const p2 = overlay.querySelector('#regPasswordConfirm').value;
      regErr.hide();
      if (p1 !== p2) {
        regErr.show('两次输入的密码不一致');
        return;
      }
      try {
        await window.CBAccounts.register({ username: u, nickname: n, email: em, password: p1 });
        hideAccountOverlay();
        updateUserChip();
        showToast('注册成功，欢迎加入');
        route();
      } catch (e) {
        regErr.show(e.message);
      }
    });

    overlay.querySelector('#accountClose').addEventListener('click', hideAccountOverlay);

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showAccountOverlay();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideAccountOverlay();
    });
  }

  function showAccountOverlay(tab = 'login') {
    const overlay = document.getElementById('accountOverlay');
    if (!overlay) return;
    const tabs = overlay.querySelectorAll('.account-tab');
    const panels = overlay.querySelectorAll('.account-panel');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    panels.forEach(p => p.style.display = p.dataset.panel === tab ? '' : 'none');
    overlay.style.display = 'flex';
  }
  function hideAccountOverlay() {
    const overlay = document.getElementById('accountOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  function renderAccountPage(app) {
    const curUser = window.CBAccounts.getCurrentUser();
    if (!curUser) {
      app.innerHTML = `
        <div class="login-required-card">
          <svg><use href="#i-log-in"/></svg>
          <h3>请先登录</h3>
          <p>登录后才能访问个人中心、发表评论、使用更多功能</p>
          <div style="display:flex;gap:10px;justify-content:center;">
            <button class="btn btn-primary" id="toLogin"><svg><use href="#i-log-in"/></svg> 登录</button>
            <button class="btn btn-ghost" id="toRegister"><svg><use href="#i-user-plus"/></svg> 注册</button>
          </div>
        </div>
      `;
      app.querySelector('#toLogin').addEventListener('click', () => showAccountOverlay('login'));
      app.querySelector('#toRegister').addEventListener('click', () => showAccountOverlay('register'));
      return;
    }

    const users = window.CBAccounts.listUsers();
    const myComments = (window.CBComments ? window.CBComments.getAll() : []).filter(c => c.userId === curUser.id).length;
    const roleText = curUser.role === 'admin' ? '管理员' : (curUser.role === 'banned' ? '已封禁' : '普通用户');
    const joinDate = curUser.createdAt ? new Date(curUser.createdAt).toLocaleDateString('zh-CN') : '';

    app.innerHTML = `
      <div class="account-page">
        <aside class="account-profile-card">
          ${window.CBAccounts.avatarHTML(curUser, 84)}
          <h2>${window.CBAccounts.displayName(curUser)}</h2>
          <div class="handle">@${curUser.username}</div>
          <span class="role-tag ${curUser.role}">
            <svg><use href="${curUser.role === 'admin' ? '#i-shield' : (curUser.role === 'banned' ? '#i-ban' : '#i-user')}"/></svg>
            ${roleText}
          </span>
          <div class="stat-row">
            <div class="stat-cell"><div class="num">${users.length}</div><div class="lbl">全站用户</div></div>
            <div class="stat-cell"><div class="num">${myComments}</div><div class="lbl">我的评论</div></div>
          </div>
          <p class="hint" style="font-size:11px;margin:16px 0 0;">注册于 ${joinDate}</p>
          <div style="display:flex;gap:8px;margin-top:16px;flex-direction:column;">
            ${curUser.role === 'admin' ? `<a class="btn btn-primary" href="#/admin" data-route style="justify-content:center;"><svg><use href="#i-shield"/></svg> 进入后台</a>` : ''}
            <button class="btn btn-ghost" id="logoutBtn" style="justify-content:center;"><svg><use href="#i-logout"/></svg> 退出登录</button>
          </div>
        </aside>

        <main class="account-main">
          <section class="account-section">
            <h3><svg><use href="#i-user"/></svg> 基本资料</h3>
            <p class="section-desc">更新你的昵称、邮箱和头像展示</p>
            <div class="account-grid-2">
              <div class="form-row"><label>用户名</label><input type="text" value="${curUser.username}" disabled style="opacity:0.7;background:var(--bg-elev);"/></div>
              <div class="form-row"><label>昵称</label><input type="text" id="accNickname" value="${curUser.nickname || ''}" maxlength="30"/></div>
              <div class="form-row"><label>邮箱</label><input type="email" id="accEmail" value="${curUser.email || ''}" placeholder="可选"/></div>
              <div class="form-row"><label>头像文字</label><input type="text" id="accInitials" value="${curUser.avatarInitials || ''}" maxlength="2"/></div>
            </div>
            <div class="form-row"><label>个人简介</label><textarea id="accBio" rows="3" maxlength="300" placeholder="一句话介绍自己…">${curUser.bio || ''}</textarea></div>
            <button class="btn btn-primary" id="saveProfile"><svg><use href="#i-check"/></svg> 保存修改</button>
          </section>

          <section class="account-section">
            <h3><svg><use href="#i-key"/></svg> 修改密码</h3>
            <p class="section-desc">使用原密码验证后修改新密码</p>
            <div class="account-grid-2">
              <div class="form-row"><label>原密码</label><input type="password" id="oldPwd" autocomplete="current-password"/></div>
              <div class="form-row"><label>新密码</label><input type="password" id="newPwd" autocomplete="new-password"/></div>
            </div>
            <div class="form-row"><label>确认新密码</label><input type="password" id="confirmPwd" autocomplete="new-password"/></div>
            <button class="btn btn-ghost" id="changePwd" style="border-color:rgba(239,68,68,0.3);color:var(--danger);"><svg><use href="#i-lock"/></svg> 修改密码</button>
          </section>
        </main>
      </div>
    `;

    app.querySelector('#logoutBtn').addEventListener('click', () => {
      window.CBAccounts.logout();
      updateUserChip();
      showToast('已退出登录');
      location.hash = '#/';
    });

    app.querySelector('#saveProfile').addEventListener('click', async () => {
      try {
        await window.CBAccounts.updateProfile(curUser.id, {
          nickname: app.querySelector('#accNickname').value.trim(),
          email: app.querySelector('#accEmail').value.trim(),
          avatarInitials: app.querySelector('#accInitials').value.trim(),
          bio: app.querySelector('#accBio').value.trim()
        });
        showToast('资料已更新');
        updateUserChip();
        route();
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    app.querySelector('#changePwd').addEventListener('click', async () => {
      const oldP = app.querySelector('#oldPwd').value;
      const newP = app.querySelector('#newPwd').value;
      const cfmP = app.querySelector('#confirmPwd').value;
      if (newP !== cfmP) { showToast('两次输入的新密码不一致', 'error'); return; }
      try {
        await window.CBAccounts.changePassword(curUser.id, oldP, newP);
        showToast('密码修改成功，请重新登录');
        window.CBAccounts.logout();
        updateUserChip();
        location.hash = '#/account';
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    bindRouteLinks(app);
  }

  function renderAdmin(app, param) {
    const profile = state.profile || window.CBProfile.DEFAULT;
    const curUser = window.CBAccounts ? window.CBAccounts.getCurrentUser() : null;
    const tab = param || state.adminTab || 'dashboard';
    state.adminTab = tab;

    const adminDisplayName = curUser ? window.CBAccounts.displayName(curUser) : (profile.username || 'C');
    const adminAvatarHTML = curUser
      ? window.CBAccounts.avatarHTML(curUser, 36)
      : window.CBProfile.avatarHTML(profile, 36);
    const adminRoleText = curUser ? (curUser.role === 'admin' ? '管理员' : '账号登录') : '管理员';

    app.innerHTML = `
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-user">
            ${adminAvatarHTML}
            <div class="info">
              <div class="name">${adminDisplayName}</div>
              <div class="role">${adminRoleText}</div>
            </div>
            <button class="logout" id="adminLogout" title="退出">
              <svg><use href="#i-logout"/></svg>
            </button>
          </div>
          <h3>菜单</h3>
          <nav class="admin-nav">
            <a class="${tab === 'dashboard' ? 'active' : ''}" data-tab="dashboard" href="#/admin/dashboard">
              <svg><use href="#i-home"/></svg> 仪表盘
            </a>
            <a class="${tab === 'profile' ? 'active' : ''}" data-tab="profile" href="#/admin/profile">
              <svg><use href="#i-user"/></svg> 个人资料
            </a>
            <a class="${tab === 'posts' ? 'active' : ''}" data-tab="posts" href="#/admin/posts">
              <svg><use href="#i-edit"/></svg> 文章管理
            </a>
            <a class="${tab === 'comments' ? 'active' : ''}" data-tab="comments" href="#/admin/comments">
              <svg><use href="#i-comment"/></svg> 评论管理
              ${window.CBComments && window.CBComments.countPending() > 0 ? `<span class="nav-badge">${window.CBComments.countPending()}</span>` : ''}
            </a>
            <a class="${tab === 'skills' ? 'active' : ''}" data-tab="skills" href="#/admin/skills">
              <svg><use href="#i-skill"/></svg> Skill 插件
            </a>
            <a class="${tab === 'ai' ? 'active' : ''}" data-tab="ai" href="#/admin/ai">
              <svg><use href="#i-ai"/></svg> AI 配置
            </a>
            <a class="${tab === 'site' ? 'active' : ''}" data-tab="site" href="#/admin/site">
              <svg><use href="#i-setting"/></svg> 站点设置
            </a>
            <a class="${tab === 'users' ? 'active' : ''}" data-tab="users" href="#/admin/users">
              <svg><use href="#i-user"/></svg> 账号管理
              ${window.CBAccounts ? `<span class="nav-badge">${window.CBAccounts.listUsers().length}</span>` : ''}
            </a>
            <a class="${tab === 'backup' ? 'active' : ''}" data-tab="backup" href="#/admin/backup">
              <svg><use href="#i-download"/></svg> 备份/导入
            </a>
          </nav>
        </aside>
        <section class="admin-content" id="adminContent"></section>
      </div>
    `;

    document.getElementById('adminLogout').addEventListener('click', () => {
      state.adminAuthed = false;
      showToast('已退出登录');
      location.hash = '#/';
    });

    const navs = app.querySelectorAll('.admin-nav a');
    navs.forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      state.adminTab = a.dataset.tab;
      location.hash = '#/admin/' + a.dataset.tab;
    }));

    const content = app.querySelector('#adminContent');
    renderAdminTab(content, tab);
  }

  function renderAdminUsers(container) {
    if (!window.CBAccounts) {
      container.innerHTML = `<div class="admin-user-empty">账号系统未加载</div>`;
      return;
    }
    const users = window.CBAccounts.listUsers();
    const total = users.length;
    const admins = users.filter(u => u.role === 'admin').length;
    const banned = users.filter(u => u.role === 'banned').length;
    const active = total - banned;

    container.innerHTML = `
      <div class="admin-content-header">
        <div>
          <h1><svg><use href="#i-user"/></svg> 账号管理</h1>
          <p>管理注册账号、角色与状态</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost" id="exportUsers"><svg><use href="#i-download"/></svg> 导出</button>
          <button class="btn btn-ghost" id="importUsers"><svg><use href="#i-upload"/></svg> 导入</button>
          <input type="file" id="usersImportFile" accept=".json" style="display:none"/>
          <button class="btn btn-primary" id="addUserBtn"><svg><use href="#i-user-plus"/></svg> 新增账号</button>
        </div>
      </div>

      <div class="admin-user-stats" style="margin-top:16px;">
        <div class="admin-user-stat"><div class="num">${total}</div><div class="lbl">总账号</div></div>
        <div class="admin-user-stat"><div class="num">${active}</div><div class="lbl">活跃账号</div></div>
        <div class="admin-user-stat"><div class="num">${admins}</div><div class="lbl">管理员</div></div>
        <div class="admin-user-stat"><div class="num">${banned}</div><div class="lbl">已封禁</div></div>
      </div>

      <div id="addUserForm" style="display:none;margin-top:20px;padding:20px;background:var(--bg-elev);border:1px solid var(--border);border-radius:14px;">
        <h3 style="margin:0 0 12px;font-size:14px;">新增账号</h3>
        <div class="admin-form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-row"><label>用户名</label><input type="text" id="newUsername" placeholder="3-24 位" maxlength="24"/></div>
          <div class="form-row"><label>昵称</label><input type="text" id="newNickname" placeholder="可选"/></div>
          <div class="form-row"><label>邮箱</label><input type="email" id="newEmail" placeholder="可选"/></div>
          <div class="form-row"><label>初始密码</label><input type="password" id="newPassword" placeholder="至少 6 位"/></div>
          <div class="form-row"><label>角色</label>
            <select id="newRole">
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn btn-primary" id="submitNewUser"><svg><use href="#i-check"/></svg> 创建</button>
          <button class="btn btn-ghost" id="cancelNewUser">取消</button>
        </div>
      </div>

      <div class="admin-user-list">
        ${users.length === 0 ? `<div class="admin-user-empty">暂无注册账号。你可以通过注册或上方按钮新增账号。</div>` : users.map(u => {
          const roleLabel = u.role === 'admin' ? '管理员' : (u.role === 'banned' ? '已封禁' : '普通用户');
          const join = u.createdAt ? fmtDate(u.createdAt) : '-';
          const last = u.lastLoginAt ? fmtRelative(u.lastLoginAt) : '从未登录';
          return `
          <div class="admin-user-row" data-id="${u.id}">
            ${window.CBAccounts.avatarHTML(u, 44)}
            <div class="admin-user-info">
              <div class="u-name">
                ${window.CBAccounts.displayName(u)}
                <span class="admin-user-badge ${u.role}">${roleLabel}</span>
              </div>
              <div class="u-meta">@${u.username} · ${u.email || '无邮箱'} · 加入 ${join} · ${last}</div>
            </div>
            <div class="admin-user-actions">
              <select data-role-select data-id="${u.id}">
                <option value="user" ${u.role === 'user' ? 'selected' : ''}>普通</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>管理员</option>
                <option value="banned" ${u.role === 'banned' ? 'selected' : ''}>封禁</option>
              </select>
              <button class="mini-btn" data-reset-pwd data-id="${u.id}"><svg><use href="#i-key"/></svg> 重置密码</button>
              <button class="mini-btn danger" data-remove data-id="${u.id}"><svg><use href="#i-trash"/></svg> 删除</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;

    const addForm = container.querySelector('#addUserForm');
    container.querySelector('#addUserBtn').addEventListener('click', () => {
      addForm.style.display = addForm.style.display === 'none' ? '' : 'none';
    });
    container.querySelector('#cancelNewUser').addEventListener('click', () => {
      addForm.style.display = 'none';
    });
    container.querySelector('#submitNewUser').addEventListener('click', async () => {
      try {
        await window.CBAccounts.register({
          username: container.querySelector('#newUsername').value,
          nickname: container.querySelector('#newNickname').value,
          email: container.querySelector('#newEmail').value,
          password: container.querySelector('#newPassword').value,
          role: container.querySelector('#newRole').value
        });
        showToast('账号已创建');
        renderAdminUsers(container);
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    container.querySelector('#exportUsers').addEventListener('click', () => {
      const data = window.CBAccounts.exportAll();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `c-blog-users-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('账号数据已导出');
    });

    const importFile = container.querySelector('#usersImportFile');
    container.querySelector('#importUsers').addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const n = window.CBAccounts.importJSON(ev.target.result, { replace: confirm('是否覆盖现有账号？取消则合并导入。') });
          showToast(`已导入 ${n} 条账号`);
          renderAdminUsers(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
      reader.readAsText(file);
      importFile.value = '';
    });

    container.querySelectorAll('[data-role-select]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.id;
        const role = sel.value;
        try {
          window.CBAccounts.adminSetRole(id, role);
          showToast('角色已更新');
          renderAdminUsers(container);
        } catch (e) {
          showToast(e.message, 'error');
          renderAdminUsers(container);
        }
      });
    });

    container.querySelectorAll('[data-reset-pwd]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const newPwd = prompt('请输入新密码（至少 6 位）：');
        if (!newPwd) return;
        try {
          await window.CBAccounts.adminResetPassword(id, newPwd);
          showToast('密码已重置');
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });

    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (!confirm('确认删除该账号？此操作不可恢复。')) return;
        try {
          window.CBAccounts.adminRemoveUser(id);
          showToast('账号已删除');
          renderAdminUsers(container);
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
  }

  function renderAdminTab(container, tab) {
    const profile = state.profile || window.CBProfile.DEFAULT;
    container.innerHTML = '';
    if (tab === 'dashboard') {
      const totalWords = state.posts.reduce((s, p) => s + (p.content ? p.content.length : 0), 0);
      container.innerHTML = `
        <div class="admin-content-header">
          <div>
            <h1><svg><use href="#i-home"/></svg> 仪表盘</h1>
            <p>欢迎回来，${profile.username || 'C'}！这里是你的博客概览。</p>
          </div>
        </div>
        <div class="admin-stats-grid">
          <div class="admin-stat"><div class="label">文章总数</div><div class="value">${state.posts.length}</div></div>
          <div class="admin-stat"><div class="label">标签数量</div><div class="value">${getTagCounts().length}</div></div>
          <div class="admin-stat"><div class="label">累计字数</div><div class="value">${(totalWords / 1000).toFixed(1)}k</div></div>
          <div class="admin-stat"><div class="label">启用 Skill</div><div class="value">${state.activeSkills.size}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
          <div style="padding:20px;background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;">
            <h3 style="margin:0 0 12px;font-size:14px;">📝 最新文章</h3>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${state.posts.slice(0, 5).map(p => `
                <a href="#/post/${p.id}" data-route style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text-muted);">
                  <span style="color:var(--text);max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.title}</span>
                  <span style="font-size:11px;">${p.date}</span>
                </a>
              `).join('')}
            </div>
          </div>
          <div style="padding:20px;background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;">
            <h3 style="margin:0 0 12px;font-size:14px;">🏷️ 热门标签</h3>
            <div class="skill-tags" style="display:flex;flex-wrap:wrap;gap:6px;">
              ${getTagCounts().slice(0, 10).map(t => `<span class="tag">${t.name} (${t.count})</span>`).join('')}
            </div>
          </div>
        </div>
      `;
      bindRouteLinks(container);
    } else if (tab === 'profile') {
      container.innerHTML = `
        <div class="admin-content-header">
          <div>
            <h1><svg><use href="#i-user"/></svg> 个人资料</h1>
            <p>这些信息会显示在首页、关于页和文章作者位置。</p>
          </div>
          <button class="btn btn-primary" id="saveProfile">
            <svg><use href="#i-check"/></svg> 保存更改
          </button>
        </div>
        <div class="avatar-picker">
          <div class="avatar-preview" id="admAvatarPreview">${profile.avatarType === 'emoji' ? profile.avatarEmoji : (profile.avatarInitials || profile.username || 'C').slice(0, 2).toUpperCase()}</div>
          <div class="avatar-options">
            ${['initials', 'emoji', 'image'].map(t => `
              <label class="avatar-option">
                <input type="radio" name="admAvatarType" value="${t}" ${profile.avatarType === t ? 'checked' : ''} />
                <span>${t === 'initials' ? '字母' : t === 'emoji' ? 'Emoji' : '图片'}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="admin-form-grid" style="grid-template-columns:1fr 1fr;">
          <div class="form-row"><label>昵称</label><input type="text" id="admUsername" value="${profile.username || ''}" placeholder="你的昵称"/></div>
          <div class="form-row"><label>身份标题</label><input type="text" id="admTitle" value="${profile.title || ''}" placeholder="独立开发者 · 技术写作者"/></div>
          <div class="form-row"><label>博客名称</label><input type="text" id="admBlogName" value="${profile.blogName || ''}"/></div>
          <div class="form-row"><label>博客描述</label><input type="text" id="admBlogDesc" value="${profile.blogDesc || ''}"/></div>
        </div>
        <div class="form-row"><label>个人简介</label><textarea id="admBio" rows="4">${profile.bio || ''}</textarea></div>
        <div class="admin-form-grid" style="grid-template-columns:1fr 1fr 1fr;">
          <div class="form-row"><label>GitHub</label><input type="text" id="admGithub" value="${profile.githubUrl || ''}" placeholder="https://github.com/you"/></div>
          <div class="form-row"><label>Twitter</label><input type="text" id="admTwitter" value="${profile.twitterUrl || ''}" placeholder="https://twitter.com/you"/></div>
          <div class="form-row"><label>个人站</label><input type="text" id="admWebsite" value="${profile.websiteUrl || ''}" placeholder="https://you.com"/></div>
        </div>
      `;
      document.getElementById('saveProfile').addEventListener('click', () => {
        const patch = {
          username: document.getElementById('admUsername').value.trim() || 'C',
          title: document.getElementById('admTitle').value.trim(),
          blogName: document.getElementById('admBlogName').value.trim(),
          blogDesc: document.getElementById('admBlogDesc').value.trim(),
          bio: document.getElementById('admBio').value.trim(),
          githubUrl: document.getElementById('admGithub').value.trim(),
          twitterUrl: document.getElementById('admTwitter').value.trim(),
          websiteUrl: document.getElementById('admWebsite').value.trim()
        };
        state.profile = window.CBProfile.update(patch);
        updateUserChip();
        bus.emit('profile:updated', state.profile);
        showToast('个人资料已保存');
      });
    } else if (tab === 'posts') {
      renderPostsManager(container);
    } else if (tab === 'comments') {
      renderCommentsManager(container);
    } else if (tab === 'skills') {
      container.innerHTML = `
        <div class="admin-content-header">
          <div>
            <h1><svg><use href="#i-skill"/></svg> Skill 插件</h1>
            <p>启用或禁用已安装的 Skill 插件。</p>
          </div>
        </div>
        <div class="skill-grid">
          ${state.skills.map(s => `
            <div class="skill-card">
              <div class="skill-icon"><svg><use href="#${s.icon || 'i-sparkle'}"/></svg></div>
              <h3 class="skill-title">${s.name}</h3>
              <p class="skill-desc">${s.description}</p>
              <div class="skill-meta">
                <span class="skill-version">v${s.version}</span>
                <button class="skill-toggle ${state.activeSkills.has(s.id) ? 'on' : ''}" data-skill="${s.id}">
                  <span class="status-dot"></span>${state.activeSkills.has(s.id) ? '已启用' : '启用'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      container.querySelectorAll('.skill-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.skill;
          const skill = state.skills.find(s => s.id === id);
          if (state.activeSkills.has(id)) {
            state.activeSkills.delete(id);
            try { skill.uninstall(ctx); } catch {}
          } else {
            state.activeSkills.add(id);
            try { skill.install(ctx); } catch {}
          }
          store.set('active_skills', [...state.activeSkills]);
          renderAdminTab(container, 'skills');
        });
      });
    } else if (tab === 'ai') {
      const curProvider = window.CB_AI.config.provider;
      const isCustom = curProvider === 'custom';
      const modelOptions = (window.CB_AI.models[curProvider] || []).map(m => `<option value="${m.id}" ${window.CB_AI.config.model === m.id ? 'selected' : ''}>${m.name}</option>`).join('');
      container.innerHTML = `
        <div class="admin-content-header">
          <div>
            <h1><svg><use href="#i-ai"/></svg> AI 配置</h1>
            <p>管理默认 AI 供应商、模型与 API Key。</p>
          </div>
          <button class="btn btn-primary" id="saveAI">
            <svg><use href="#i-check"/></svg> 保存
          </button>
        </div>
        <div class="admin-form-grid" style="grid-template-columns:1fr 1fr;">
          <div class="form-row">
            <label>供应商</label>
            <select id="aiProviderSel">
              ${[{id:'openrouter',name:'OpenRouter'},{id:'deepseek',name:'DeepSeek'},{id:'qwen',name:'阿里云百炼'},{id:'custom',name:'自定义'}].map(p => `<option value="${p.id}" ${curProvider === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-row" id="aiModelRow" style="${isCustom ? 'display:none;' : ''}">
            <label>模型</label>
            <select id="aiModelSel">${modelOptions}</select>
          </div>
          <div class="form-row" id="aiCustomModelRow" style="${isCustom ? '' : 'display:none;'}">
            <label>自定义模型名称</label>
            <input type="text" id="aiCustomModelInput" value="${window.CB_AI.config.customModel}" placeholder="例如：my-model-v1"/>
          </div>
        </div>
        <div class="form-row"><label>API Key</label><input type="password" id="aiKeyInput" value="${window.CB_AI.config.apiKey}" placeholder="sk-..."/></div>
        <div class="form-row"><label>Base URL（自定义供应商必填，其他可选覆盖）</label><input type="text" id="aiBaseInput" value="${localStorage.getItem('cb_ai_base') || ''}" placeholder="https://api.example.com"/></div>
      `;
      const providerSel = container.querySelector('#aiProviderSel');
      const modelRow = container.querySelector('#aiModelRow');
      const customModelRow = container.querySelector('#aiCustomModelRow');
      const modelSel = container.querySelector('#aiModelSel');
      providerSel.addEventListener('change', () => {
        const isC = providerSel.value === 'custom';
        modelRow.style.display = isC ? 'none' : '';
        customModelRow.style.display = isC ? '' : 'none';
        if (!isC) {
          const ms = window.CB_AI.models[providerSel.value] || [];
          modelSel.innerHTML = ms.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        }
      });
      container.querySelector('#saveAI').addEventListener('click', () => {
        const provider = providerSel.value;
        window.CB_AI.config.provider = provider;
        if (provider === 'custom') {
          window.CB_AI.config.customModel = container.querySelector('#aiCustomModelInput').value.trim();
        } else {
          window.CB_AI.config.model = modelSel.value;
        }
        window.CB_AI.config.apiKey = container.querySelector('#aiKeyInput').value.trim();
        const base = container.querySelector('#aiBaseInput').value.trim();
        if (base) localStorage.setItem('cb_ai_base', base);
        else localStorage.removeItem('cb_ai_base');
        showToast('AI 配置已保存');
      });
    } else if (tab === 'site') {
      container.innerHTML = `
        <div class="admin-content-header">
          <div>
            <h1><svg><use href="#i-setting"/></svg> 站点设置</h1>
            <p>博客的基础设置与管理员密码管理。</p>
          </div>
          <button class="btn btn-primary" id="saveSite">
            <svg><use href="#i-check"/></svg> 保存
          </button>
        </div>
        <div class="form-row"><label>主题色</label>
          <div style="display:flex;gap:8px;">
            ${[{n:'默认',g:'linear-gradient(135deg,#6366f1,#a855f7,#ec4899)'},{n:'海洋',g:'linear-gradient(135deg,#0ea5e9,#06b6d4,#14b8a6)'},{n:'日落',g:'linear-gradient(135deg,#f59e0b,#ef4444,#ec4899)'},{n:'森林',g:'linear-gradient(135deg,#10b981,#06b6d4,#3b82f6)'}].map((c, i) => `
              <button class="theme-swatch ${i === 0 ? 'active' : ''}" data-grad="${c.g}" style="width:44px;height:44px;border-radius:12px;border:2px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'};background:${c.g};cursor:pointer;" title="${c.n}"></button>
            `).join('')}
          </div>
        </div>
        <div class="admin-form-grid" style="grid-template-columns:1fr 1fr;">
          <div class="form-row"><label>当前主题</label><select id="siteTheme"><option value="dark" ${document.documentElement.dataset.theme === 'dark' ? 'selected' : ''}>暗黑</option><option value="light" ${document.documentElement.dataset.theme === 'light' ? 'selected' : ''}>明亮</option></select></div>
          <div class="form-row"><label>启用访问统计</label><label class="switch-row" style="justify-content:flex-end;"><input type="checkbox" id="siteStats" ${profile.enableStats ? 'checked' : ''}/><span class="switch"></span>启用</label></div>
        </div>
        <div style="margin-top:24px;padding:20px;background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;">
          <h3 style="margin:0 0 12px;font-size:14px;">🔑 管理员密码</h3>
          <p class="hint">当前密码：${profile.passwordHash ? '已设置' : '未设置（无需密码）'}</p>
          <div class="admin-form-grid" style="grid-template-columns:1fr 1fr;">
            <div class="form-row"><label>新密码（留空不修改）</label><input type="password" id="newPwd" placeholder="至少 6 位"/></div>
            <div class="form-row"><label>确认新密码</label><input type="password" id="newPwd2" placeholder="再次输入"/></div>
          </div>
          <button class="btn btn-ghost" id="clearPwd" style="margin-top:10px;color:var(--danger);border-color:rgba(239,68,68,0.3);">清除密码保护</button>
        </div>
      `;
      const currentGrad = store.get('brand_gradient') || getComputedStyle(document.documentElement).getPropertyValue('--gradient').trim();
      container.querySelectorAll('.theme-swatch').forEach(b => {
        if (b.dataset.grad === currentGrad) b.style.borderColor = 'var(--accent)';
        b.addEventListener('click', () => {
          document.documentElement.style.setProperty('--gradient', b.dataset.grad);
          container.querySelectorAll('.theme-swatch').forEach(x => x.style.borderColor = 'var(--border)');
          b.style.borderColor = 'var(--accent)';
          store.set('brand_gradient', b.dataset.grad);
        });
      });
      container.querySelector('#siteTheme').addEventListener('change', (e) => {
        document.documentElement.dataset.theme = e.target.value;
        store.set('theme', e.target.value);
      });
      container.querySelector('#saveSite').addEventListener('click', async () => {
        const np = container.querySelector('#newPwd').value;
        const np2 = container.querySelector('#newPwd2').value;
        const patch = { enableStats: container.querySelector('#siteStats').checked };
        if (np || np2) {
          if (np.length < 6) { showToast('密码至少 6 位', 'error'); return; }
          if (np !== np2) { showToast('两次密码不一致', 'error'); return; }
          patch.passwordHash = await window.CBProfile.hash(np);
        }
        state.profile = window.CBProfile.update(patch);
        showToast('站点设置已保存');
      });
      container.querySelector('#clearPwd').addEventListener('click', () => {
        if (confirm('确认清除管理员密码？清除后访问后台将不再需要密码。')) {
          const p = window.CBProfile.get();
          p.passwordHash = '';
          window.CBProfile.set(p);
          state.profile = window.CBProfile.get();
          showToast('密码已清除');
        }
      });
    } else if (tab === 'users') {
      renderAdminUsers(container);
    } else if (tab === 'backup') {
      container.innerHTML = `
        <div class="admin-content-header">
          <div>
            <h1><svg><use href="#i-download"/></svg> 备份 / 导入</h1>
            <p>导出或导入你的博客配置与文章。</p>
          </div>
        </div>
        <div class="admin-form-grid" style="grid-template-columns:1fr 1fr;gap:20px;">
          <div style="padding:20px;background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;">
            <h3 style="margin:0 0 12px;font-size:15px;">📤 导出</h3>
            <p class="hint" style="margin-bottom:12px;">导出所有配置（个人资料、文章、Skill 设置）为 JSON 文件。</p>
            <button class="btn btn-primary" id="exportAll" style="width:100%;">
              <svg><use href="#i-download"/></svg> 导出全部数据
            </button>
            <button class="btn btn-ghost" id="exportProfile" style="width:100%;margin-top:8px;">导出个人资料</button>
          </div>
          <div style="padding:20px;background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;">
            <h3 style="margin:0 0 12px;font-size:15px;">📥 导入</h3>
            <p class="hint" style="margin-bottom:12px;">从 JSON 文件导入配置（会覆盖当前设置）。</p>
            <label class="upload-btn" style="width:100%;justify-content:center;">
              <input type="file" id="importFile" accept=".json" style="display:none"/>
              <svg><use href="#i-upload"/></svg> 选择 JSON 文件
            </label>
          </div>
        </div>
        <div class="form-row" style="margin-top:24px;">
          <label>原始 JSON（可手动编辑）</label>
          <textarea id="rawJSON" rows="8" style="font-family:var(--font-mono);font-size:12px;">${JSON.stringify({ profile: state.profile, posts: state.posts }, null, 2)}</textarea>
          <button class="btn btn-ghost" id="applyRaw" style="margin-top:8px;">应用 JSON 修改</button>
        </div>
        <div style="margin-top:24px;padding:20px;background:var(--bg-elev);border:1px solid rgba(239,68,68,0.3);border-radius:12px;">
          <h3 style="margin:0 0 8px;font-size:15px;color:var(--danger);">⚠️ 危险操作</h3>
          <p class="hint">以下操作不可逆，请谨慎使用。</p>
          <button class="btn btn-ghost" id="resetAll" style="color:var(--danger);border-color:rgba(239,68,68,0.3);">重置所有数据</button>
        </div>
      `;
      container.querySelector('#exportAll').addEventListener('click', () => {
        const aiConfig = {};
        try {
          aiConfig.provider = localStorage.getItem('cb_ai_provider');
          aiConfig.model = localStorage.getItem('cb_ai_model');
          aiConfig.customModel = localStorage.getItem('cb_ai_custom_model');
          aiConfig.baseUrl = localStorage.getItem('cb_ai_base');
          aiConfig.apiKey = localStorage.getItem('cb_ai_key') ? '***' : '';
        } catch {}
        const data = {
          version: 2,
          exportedAt: new Date().toISOString(),
          profile: state.profile,
          posts: state.posts,
          comments: window.CBComments ? window.CBComments.getAll() : [],
          skills: [...state.activeSkills],
          theme: localStorage.getItem('cb_theme'),
          brandGradient: localStorage.getItem('cb_brand_gradient'),
          ai: aiConfig
        };
        downloadJSON(data, `c-blog-backup-${Date.now()}.json`);
        showToast('导出成功，已包含评论与配置');
      });
      container.querySelector('#exportProfile').addEventListener('click', () => {
        downloadJSON(state.profile, `c-blog-profile-${Date.now()}.json`);
      });
      container.querySelector('#importFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const data = JSON.parse(ev.target.result);
            if (data.profile) { window.CBProfile.set(data.profile); state.profile = window.CBProfile.get(); }
            if (Array.isArray(data.posts)) { store.set('custom_posts', data.posts); state.posts = data.posts; }
            if (Array.isArray(data.comments) && window.CBComments) { window.CBComments.importJSON(JSON.stringify(data.comments)); }
            if (data.skills) { store.set('active_skills', data.skills); state.activeSkills = new Set(data.skills); }
            if (data.theme) { localStorage.setItem('cb_theme', data.theme); }
            if (data.brandGradient) { localStorage.setItem('cb_brand_gradient', data.brandGradient); }
            if (data.ai) {
              if (data.ai.provider) localStorage.setItem('cb_ai_provider', data.ai.provider);
              if (data.ai.model) localStorage.setItem('cb_ai_model', data.ai.model);
              if (data.ai.customModel) localStorage.setItem('cb_ai_custom_model', data.ai.customModel);
              if (data.ai.baseUrl) localStorage.setItem('cb_ai_base', data.ai.baseUrl);
              else localStorage.removeItem('cb_ai_base');
              if (data.ai.apiKey && data.ai.apiKey !== '***') localStorage.setItem('cb_ai_key', data.ai.apiKey);
            }
            showToast('导入成功，页面即将刷新');
            updateUserChip();
            route();
          } catch (err) {
            showToast('导入失败：' + err.message, 'error');
          }
        };
        reader.readAsText(file);
      });
      container.querySelector('#applyRaw').addEventListener('click', () => {
        try {
          const data = JSON.parse(container.querySelector('#rawJSON').value);
          if (data.profile) { window.CBProfile.set(data.profile); state.profile = window.CBProfile.get(); }
          if (Array.isArray(data.posts)) { state.posts = data.posts; store.set('custom_posts', data.posts); }
          if (Array.isArray(data.comments) && window.CBComments) { window.CBComments.importJSON(JSON.stringify(data.comments)); }
          updateUserChip();
          showToast('应用成功');
        } catch (err) {
          showToast('JSON 解析失败', 'error');
        }
      });
      container.querySelector('#resetAll').addEventListener('click', () => {
        if (confirm('确认重置所有数据？这将清除个人资料与自定义文章！')) {
          localStorage.clear();
          location.reload();
        }
      });

      const ghCfg = window.CBGitHubStore.getConfig();
      container.innerHTML += `
        <div style="margin-top:24px;padding:20px;background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;">
          <h3 style="margin:0 0 12px;font-size:15px;">☁️ GitHub 云端同步</h3>
          <p class="hint" style="margin-bottom:16px;">配置 GitHub 仓库后，所有数据将自动同步到云端，换设备也能访问。</p>
          <div class="admin-form-grid" style="grid-template-columns:1fr 1fr;">
            <div class="form-row"><label>GitHub 仓库</label><input type="text" id="ghRepo" value="${ghCfg.repo}" placeholder="username/repo-name"/></div>
            <div class="form-row"><label>Personal Access Token</label><input type="password" id="ghToken" value="${ghCfg.token}" placeholder="ghp_..."/></div>
          </div>
          <p class="hint" style="font-size:12px;color:var(--muted);margin-top:8px;">需要 repo 权限的 PAT，创建地址：https://github.com/settings/tokens</p>
          <div style="display:flex;gap:10px;margin-top:16px;">
            <button class="btn btn-primary" id="saveGH">保存配置</button>
            <button class="btn btn-ghost" id="testGH">测试连接</button>
            <button class="btn btn-ghost" id="syncUp">立即上传</button>
          </div>
          ${ghCfg.repo ? `<div id="ghStatus" style="margin-top:12px;padding:10px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;color:#22c55e;font-size:13px;">✓ 已配置：${ghCfg.repo}</div>` : ''}
        </div>
      `;

      container.querySelector('#saveGH').addEventListener('click', () => {
        const repo = container.querySelector('#ghRepo').value.trim();
        const token = container.querySelector('#ghToken').value.trim();
        if (!repo) { showToast('请输入仓库地址', 'error'); return; }
        if (!token) { showToast('请输入 Token', 'error'); return; }
        window.CBGitHubStore.setConfig({ repo, token });
        showToast('GitHub 配置已保存');
        document.getElementById('ghStatus').innerHTML = `✓ 已配置：${repo}`;
        document.getElementById('ghStatus').style.display = 'block';
      });

      container.querySelector('#testGH').addEventListener('click', async () => {
        const btn = container.querySelector('#testGH');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<svg><use href="#i-loader"/></svg> 测试中...';
        btn.disabled = true;
        try {
          await window.CBGitHubStore.listFiles('data');
          showToast('✓ GitHub 连接成功！');
        } catch (err) {
          showToast('连接失败：' + err.message, 'error');
        }
        btn.innerHTML = oldText;
        btn.disabled = false;
      });

      container.querySelector('#syncUp').addEventListener('click', async () => {
        if (!window.CBGitHubStore.hasConfig()) {
          showToast('请先配置 GitHub', 'error');
          return;
        }
        const btn = container.querySelector('#syncUp');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<svg><use href="#i-loader"/></svg> 上传中...';
        btn.disabled = true;
        try {
          await window.CBGitHubStore.putFile('data/profile.json', JSON.stringify(state.profile, null, 2), 'Sync profile');
          await window.CBGitHubStore.putFile('data/posts.json', JSON.stringify(state.posts, null, 2), 'Sync posts');
          if (window.CBComments) {
            await window.CBGitHubStore.putFile('data/comments.json', JSON.stringify(window.CBComments.getAll(), null, 2), 'Sync comments');
          }
          if (window.CBAccounts) {
            await window.CBGitHubStore.putFile('data/users.json', window.CBAccounts.exportAll(), 'Sync users');
          }
          showToast('✓ 所有数据已上传到 GitHub');
        } catch (err) {
          showToast('上传失败：' + err.message, 'error');
        }
        btn.innerHTML = oldText;
        btn.disabled = false;
      });
    }
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderPostsManager(container) {
    container.innerHTML = `
      <div class="admin-content-header">
        <div>
          <h1><svg><use href="#i-edit"/></svg> 文章管理</h1>
          <p>管理你的所有文章。支持新增、编辑、删除。</p>
        </div>
        <button class="btn btn-primary" id="newPost">
          <svg><use href="#i-plus"/></svg> 新文章
        </button>
      </div>
      <div class="admin-post-list" id="postList">
        ${state.posts.map(p => `
          <div class="admin-post-row" data-id="${p.id}">
            <div class="thumb">${(p.title || '?').slice(0, 1)}</div>
            <div class="meta">
              <p class="title">${p.title}</p>
              <p class="sub">${p.date} · ${(p.tags || []).map(t => '#' + t).join(' ')}</p>
            </div>
            <div class="actions">
              <button class="icon-btn view" title="查看"><svg><use href="#i-eye"/></svg></button>
              <button class="icon-btn edit" title="编辑"><svg><use href="#i-edit"/></svg></button>
              <button class="icon-btn danger delete" title="删除"><svg><use href="#i-trash"/></svg></button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    container.querySelectorAll('.view').forEach(b => b.addEventListener('click', () => {
      const id = b.closest('.admin-post-row').dataset.id;
      location.hash = '#/post/' + id;
    }));
    container.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => {
      openPostEditor(b.closest('.admin-post-row').dataset.id);
    }));
    container.querySelectorAll('.delete').forEach(b => b.addEventListener('click', () => {
      const id = b.closest('.admin-post-row').dataset.id;
      if (!confirm('确定删除此文章？此操作不可撤销。')) return;
      const idxs = state.posts.findIndex(p => p.id === id);
      if (idxs >= 0) {
        state.posts.splice(idxs, 1);
        savePosts(state.posts);
        showToast('文章已删除');
        renderPostsManager(container);
      }
    }));
    container.querySelector('#newPost').addEventListener('click', () => openPostEditor(null));
  }

  function openPostEditor(postId) {
    const existing = postId ? state.posts.find(p => p.id === postId) : null;
    const post = existing || {
      id: 'post-' + Date.now(),
      title: '新文章',
      excerpt: '',
      date: new Date().toISOString().slice(0, 10),
      author: state.profile?.username || 'C',
      avatar: (state.profile?.avatarInitials || 'C'),
      tags: [],
      readTime: 5,
      content: '# 新文章\n\n在此开始写作…\n'
    };

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:760px;">
        <h3>${existing ? '编辑文章' : '新文章'}</h3>
        <div class="admin-form-grid" style="grid-template-columns:1fr 1fr;">
          <div class="form-row"><label>标题</label><input type="text" id="pTitle" value="${post.title}"/></div>
          <div class="form-row"><label>日期</label><input type="date" id="pDate" value="${post.date}"/></div>
          <div class="form-row"><label>作者</label><input type="text" id="pAuthor" value="${post.author}"/></div>
          <div class="form-row"><label>阅读时长</label><input type="number" id="pReadTime" value="${post.readTime}" min="1"/></div>
        </div>
        <div class="form-row"><label>摘要</label><input type="text" id="pExcerpt" value="${post.excerpt || ''}"/></div>
        <div class="form-row"><label>标签（逗号分隔）</label><input type="text" id="pTags" value="${(post.tags || []).join(', ')}"/></div>
        <div class="form-row"><label>Markdown 正文</label><textarea id="pContent" style="min-height:320px;">${post.content}</textarea></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="pCancel">取消</button>
          <button class="btn btn-primary" id="pSave">
            <svg><use href="#i-check"/></svg> 保存
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#pCancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#pSave').addEventListener('click', () => {
      const updated = {
        ...post,
        title: modal.querySelector('#pTitle').value.trim() || '未命名',
        date: modal.querySelector('#pDate').value,
        author: modal.querySelector('#pAuthor').value.trim(),
        readTime: parseInt(modal.querySelector('#pReadTime').value) || 5,
        excerpt: modal.querySelector('#pExcerpt').value.trim(),
        tags: modal.querySelector('#pTags').value.split(',').map(t => t.trim()).filter(Boolean),
        content: modal.querySelector('#pContent').value
      };
      if (existing) {
        const idx = state.posts.findIndex(p => p.id === existing.id);
        if (idx >= 0) state.posts[idx] = updated;
      } else {
        state.posts.unshift(updated);
      }
      savePosts(state.posts);
      modal.remove();
      showToast('文章已保存');
      renderAdminTab(document.querySelector('#adminContent'), 'posts');
      bus.emit('posts:updated', state.posts);
    });
  }

  function renderCommentsManager(container) {
    if (!window.CBComments) {
      container.innerHTML = `<div style="padding:40px;color:var(--text-muted);text-align:center;">评论模块未加载</div>`;
      return;
    }
    const all = window.CBComments.getAll();
    const pending = all.filter(c => c.status === 'pending');
    const approved = all.filter(c => c.status === 'approved');
    const rejected = all.filter(c => c.status === 'rejected');

    container.innerHTML = `
      <div class="admin-content-header">
        <div>
          <h1><svg><use href="#i-comment"/></svg> 评论管理</h1>
          <p>审核所有评论，支持 AI 自动审查。</p>
        </div>
        <div class="admin-form-actions">
          <button class="btn btn-ghost" id="aiReviewAll" ${pending.length === 0 ? 'disabled style="opacity:.5;cursor:not-allowed;"' : ''}>
            <svg><use href="#i-ai"/></svg> AI 批量审查 ${pending.length ? '(' + pending.length + ')' : ''}
          </button>
          <button class="btn btn-primary" id="approveAll" ${pending.length === 0 ? 'disabled style="opacity:.5;cursor:not-allowed;"' : ''}>
            一键通过
          </button>
        </div>
      </div>
      <div class="admin-stats-grid">
        <div class="admin-stat"><div class="label">评论总数</div><div class="value">${all.length}</div></div>
        <div class="admin-stat pending"><div class="label">待审核</div><div class="value">${pending.length}</div></div>
        <div class="admin-stat approved"><div class="label">已通过</div><div class="value">${approved.length}</div></div>
        <div class="admin-stat rejected"><div class="label">已拒绝</div><div class="value">${rejected.length}</div></div>
      </div>
      <div class="admin-tabs" style="display:flex;gap:8px;margin:20px 0 12px;">
        <button class="admin-tab active" data-filter="all">全部 (${all.length})</button>
        <button class="admin-tab" data-filter="pending">待审核 (${pending.length})</button>
        <button class="admin-tab" data-filter="approved">已通过 (${approved.length})</button>
        <button class="admin-tab" data-filter="rejected">已拒绝 (${rejected.length})</button>
      </div>
      <div class="admin-comment-list" id="adminCommentList">
        ${renderAdminCommentList(all, 'all')}
      </div>
    `;

    let currentFilter = 'all';
    container.querySelectorAll('.admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        container.querySelector('#adminCommentList').innerHTML = renderAdminCommentList(
          window.CBComments.getAll(), currentFilter
        );
        bindAdminCommentList(container);
      });
    });

    container.querySelector('#approveAll').addEventListener('click', () => {
      if (!pending.length) return;
      pending.forEach(c => window.CBComments.approve(c.id));
      showToast(`已通过 ${pending.length} 条评论`);
      renderCommentsManager(container);
    });

    container.querySelector('#aiReviewAll').addEventListener('click', async () => {
      if (!pending.length) return;
      const btn = container.querySelector('#aiReviewAll');
      btn.disabled = true;
      btn.textContent = '审查中…';
      showToast(`AI 正在审查 ${pending.length} 条评论`);
      try {
        await window.CBComments.aiReviewBatch(pending.map(c => c.id));
        showToast('AI 审查完成');
      } catch (err) {
        showToast('审查失败：' + err.message, 'error');
      }
      renderCommentsManager(container);
    });

    bindAdminCommentList(container);
  }

  function renderAdminCommentList(all, filter) {
    const list = filter === 'all' ? all : all.filter(c => c.status === filter);
    if (!list.length) {
      return `<div style="padding:40px;color:var(--text-muted);text-align:center;">暂无评论</div>`;
    }
    return list.map(c => {
      const post = state.posts.find(p => p.id === c.postId);
      const postTitle = post ? post.title : '(文章已删除)';
      const postId = c.postId;
      const statusClass = c.status;
      const statusLabel = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[c.status];
      return `
        <div class="admin-comment-row" data-id="${c.id}">
          <div class="thumb">${c.author.slice(0, 2).toUpperCase()}</div>
          <div class="meta" style="flex:1;min-width:0;">
            <p class="title"><strong>${window.CBComments.sanitize(c.author)}</strong> <span class="comment-status ${statusClass}" style="margin-left:8px;">${statusLabel}</span></p>
            <p class="sub">${window.CBComments.sanitize(c.content).slice(0, 200)}${c.content.length > 200 ? '…' : ''}</p>
            <p class="sub" style="font-size:12px;margin-top:4px;">
              <a href="#/post/${postId}" data-route style="color:var(--accent);">${window.CBComments.sanitize(postTitle)}</a>
              · ${new Date(c.createdAt).toLocaleString()}
              ${c.aiResult && c.aiResult.reason ? ` · <span style="color:var(--text-muted);">🤖 ${window.CBComments.sanitize(c.aiResult.reason)}</span>` : ''}
            </p>
          </div>
          <div class="actions">
            ${c.status !== 'approved' ? '<button class="icon-btn approve" title="通过"><svg><use href="#i-check"/></svg></button>' : ''}
            ${c.status !== 'rejected' ? '<button class="icon-btn reject" title="拒绝"><svg><use href="#i-close"/></svg></button>' : ''}
            <button class="icon-btn ai" title="AI 审查"><svg><use href="#i-ai"/></svg></button>
            <button class="icon-btn danger delete" title="删除"><svg><use href="#i-trash"/></svg></button>
          </div>
        </div>
      `;
    }).join('');
  }

  function bindAdminCommentList(container) {
    container.querySelectorAll('.admin-comment-row').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('.approve')?.addEventListener('click', () => {
        window.CBComments.approve(id);
        showToast('已通过');
        renderCommentsManager(container);
      });
      row.querySelector('.reject')?.addEventListener('click', () => {
        window.CBComments.reject(id);
        showToast('已拒绝');
        renderCommentsManager(container);
      });
      row.querySelector('.ai')?.addEventListener('click', async () => {
        showToast('AI 审查中…');
        try {
          await window.CBComments.aiReview(id);
          showToast('审查完成');
        } catch (e) {
          showToast('审查失败：' + e.message, 'error');
        }
        renderCommentsManager(container);
      });
      row.querySelector('.delete')?.addEventListener('click', () => {
        if (!confirm('确认删除此评论？')) return;
        window.CBComments.remove(id);
        showToast('评论已删除');
        renderCommentsManager(container);
      });
    });
    bindRouteLinks(container);
  }

  function bindRouteLinks(root) {
    root.querySelectorAll('[data-route]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        location.hash = a.getAttribute('href');
      });
    });
  }

  async function syncFromGitHub() {
    if (!window.CBGitHubStore || !window.CBGitHubStore.hasConfig()) {
      return;
    }
    try {
      const profileRes = await window.CBGitHubStore.getFile('data/profile.json');
      if (profileRes.exists && profileRes.content) {
        const profile = JSON.parse(profileRes.content);
        window.CBProfile.set(profile);
      }

      const postsRes = await window.CBGitHubStore.getFile('data/posts.json');
      if (postsRes.exists && postsRes.content) {
        const posts = JSON.parse(postsRes.content);
        if (Array.isArray(posts) && posts.length) {
          store.set('custom_posts', posts);
        }
      }

      const commentsRes = await window.CBGitHubStore.getFile('data/comments.json');
      if (commentsRes.exists && commentsRes.content && window.CBComments) {
        window.CBComments.importJSON(commentsRes.content);
      }

      const usersRes = await window.CBGitHubStore.getFile('data/users.json');
      if (usersRes.exists && usersRes.content && window.CBAccounts) {
        window.CBAccounts.importJSON(usersRes.content);
      }
    } catch (err) {
      console.warn('GitHub sync failed:', err.message);
    }
  }

  async function savePosts(posts) {
    store.set('custom_posts', posts);
    if (window.CBGitHubStore && window.CBGitHubStore.hasConfig()) {
      try {
        await window.CBGitHubStore.putFile('data/posts.json', JSON.stringify(posts, null, 2), 'Update posts');
      } catch (err) {
        console.warn('Failed to sync posts to GitHub:', err.message);
      }
    }
  }

  async function main() {
    initTheme();
    updateYear();
    setupNav();
    setupSearch();
    applySkillStyles();
    initSetupWizard();
    initAccountOverlay();

    registerSkills();

    await syncFromGitHub();

    const customPosts = store.get('custom_posts', null);
    if (Array.isArray(customPosts) && customPosts.length) {
      state.posts = customPosts;
    } else {
      await loadPosts();
    }

    state.profile = window.CBProfile.get();
    if (state.profile) {
      if (window.CBAccounts) {
        window.CBAccounts.ensureAdminFromProfile(state.profile);
      }
    }

    if (!state.profile) {
      showSetupOverlay();
    } else {
      updateUserChip();
    }

    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
