window.CBComments = (function () {
  const KEY = 'cb_comments';
  const MAX_CONTENT = 2000;
  const MAX_NAME = 30;
  const ANTI_SPAM_KEY = 'cb_comment_last_submit';
  const SUBMIT_COOLDOWN_MS = 8000;

  const STATUSES = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  };

  function getAll() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveAll(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {}
    syncToGitHub(list);
  }

  async function syncToGitHub(list) {
    if (window.CBGitHubStore && window.CBGitHubStore.hasConfig()) {
      try {
        await window.CBGitHubStore.putFile('data/comments.json', JSON.stringify(list, null, 2), 'Update comments');
      } catch (err) {
        console.warn('Failed to sync comments to GitHub:', err.message);
      }
    }
  }

  function getByPost(postId, includePending = false) {
    return getAll()
      .filter(c => c.postId === postId)
      .filter(c => includePending || c.status === STATUSES.APPROVED)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function getById(id) {
    return getAll().find(c => c.id === id) || null;
  }

  function countByPost(postId) {
    return getAll().filter(c => c.postId === postId && c.status === STATUSES.APPROVED).length;
  }

  function countPending() {
    return getAll().filter(c => c.status === STATUSES.PENDING).length;
  }

  function validateAuthor(name) {
    if (!name || typeof name !== 'string') return '请填写昵称';
    const trimmed = name.trim();
    if (trimmed.length < 1) return '昵称不能为空';
    if (trimmed.length > MAX_NAME) return `昵称最多 ${MAX_NAME} 字`;
    if (/[<>"\\]/.test(trimmed)) return '昵称包含非法字符';
    return null;
  }

  function validateContent(content) {
    if (!content || typeof content !== 'string') return '请填写评论内容';
    const trimmed = content.trim();
    if (trimmed.length < 1) return '评论内容不能为空';
    if (trimmed.length > MAX_CONTENT) return `评论最多 ${MAX_CONTENT} 字`;
    return null;
  }

  function sanitize(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function canSubmit() {
    try {
      const last = parseInt(localStorage.getItem(ANTI_SPAM_KEY) || '0', 10);
      return (Date.now() - last) > SUBMIT_COOLDOWN_MS;
    } catch {
      return true;
    }
  }

  function markSubmitted() {
    try {
      localStorage.setItem(ANTI_SPAM_KEY, String(Date.now()));
    } catch {}
  }

  function create(postId, author, content, opts = {}) {
    const aErr = validateAuthor(author);
    if (aErr) throw new Error(aErr);
    const cErr = validateContent(content);
    if (cErr) throw new Error(cErr);

    const list = getAll();
    const comment = {
      id: 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      postId,
      author: author.trim(),
      content: content.trim(),
      status: opts.autoApprove ? STATUSES.APPROVED : STATUSES.PENDING,
      aiResult: null,
      userId: opts.userId || null,
      role: opts.role || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ip: null,
      userAgent: navigator.userAgent ? navigator.userAgent.slice(0, 200) : ''
    };
    list.push(comment);
    saveAll(list);
    markSubmitted();
    return comment;
  }

  function update(id, patch) {
    const list = getAll();
    const idx = list.findIndex(c => c.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
    saveAll(list);
    return list[idx];
  }

  function remove(id) {
    const list = getAll().filter(c => c.id !== id);
    saveAll(list);
  }

  function setStatus(id, status, aiResult) {
    const patch = { status, updatedAt: Date.now() };
    if (aiResult !== undefined) patch.aiResult = aiResult;
    return update(id, patch);
  }

  function approve(id) { return setStatus(id, STATUSES.APPROVED); }
  function reject(id, reason) { return setStatus(id, STATUSES.REJECTED, { reason: reason || '被管理员拒绝' }); }

  function exportJSON() {
    return JSON.stringify(getAll(), null, 2);
  }

  function importJSON(str) {
    const data = JSON.parse(str);
    if (!Array.isArray(data)) throw new Error('评论数据格式错误');
    saveAll(data);
    return data;
  }

  function clearAll() {
    try { localStorage.removeItem(KEY); } catch {}
  }

  async function aiReview(commentId, opts = {}) {
    const comment = getById(commentId);
    if (!comment) throw new Error('评论不存在');
    if (comment.status === STATUSES.APPROVED || comment.status === STATUSES.REJECTED) {
      return { skipped: true, reason: '已经审核过' };
    }
    if (!window.CB_AI || !window.CB_AI.config.apiKey) {
      return { skipped: true, reason: '未配置 AI', commentId };
    }

    const prompt = `你是一个博客评论审查员。请审查下面这条用户评论，判断是否符合发布标准。

【评论者】：${comment.author}
【评论内容】：
${comment.content}

请从以下维度评估：
1. 是否包含违法、仇恨、歧视、色情、暴力内容
2. 是否包含垃圾广告、外链推广
3. 是否包含人身攻击、恶意言语
4. 是否包含敏感话题或不当言论

请严格以如下 JSON 格式输出，不要附加其他文字：
{"safe": true/false, "reason": "简要原因", "tags": ["标签1", "标签2"]}`;

    const messages = [
      { role: 'system', content: '你是严格的评论审查员。必须按要求输出 JSON。' },
      { role: 'user', content: prompt }
    ];

    try {
      const res = await window.CB_AI.chat(messages, { temperature: 0.1 });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { safe: true };
      const result = {
        safe: !!parsed.safe,
        reason: parsed.reason || (parsed.safe ? '内容合规' : '内容不合规'),
        tags: Array.isArray(parsed.tags) ? parsed.tags : []
      };
      const finalStatus = result.safe ? STATUSES.APPROVED : STATUSES.REJECTED;
      return setStatus(commentId, finalStatus, result);
    } catch (err) {
      return setStatus(commentId, STATUSES.PENDING, {
        reason: 'AI 审查失败：' + (err.message || '未知错误')
      });
    }
  }

  async function aiReviewBatch(commentIds, opts = {}) {
    const results = [];
    for (const id of commentIds) {
      try {
        results.push(await aiReview(id, opts));
      } catch (err) {
        results.push({ id, error: err.message });
      }
    }
    return results;
  }

  return {
    STATUSES,
    getAll,
    getByPost,
    getById,
    countByPost,
    countPending,
    create,
    update,
    remove,
    approve,
    reject,
    setStatus,
    aiReview,
    aiReviewBatch,
    validateAuthor,
    validateContent,
    sanitize,
    canSubmit,
    exportJSON,
    importJSON,
    clearAll
  };
})();
