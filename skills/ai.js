window.CB_AI = {
  config: {
    get provider() { return localStorage.getItem('cb_ai_provider') || 'openrouter'; },
    set provider(v) { localStorage.setItem('cb_ai_provider', v); },
    get apiKey() { return localStorage.getItem('cb_ai_key') || ''; },
    set apiKey(v) { localStorage.setItem('cb_ai_key', v); },
    get model() {
      const p = this.provider;
      if (p === 'custom') {
        return localStorage.getItem('cb_ai_custom_model') || '';
      }
      return localStorage.getItem('cb_ai_model') || 'openrouter/claude-3.5-sonnet';
    },
    set model(v) { localStorage.setItem('cb_ai_model', v); },
    get customModel() { return localStorage.getItem('cb_ai_custom_model') || ''; },
    set customModel(v) { localStorage.setItem('cb_ai_custom_model', v); },
    get baseUrl() {
      const stored = localStorage.getItem('cb_ai_base');
      if (stored) return stored;
      const p = this.provider;
      if (p === 'openrouter') return 'https://openrouter.ai/api/v1';
      if (p === 'deepseek') return 'https://api.deepseek.com';
      if (p === 'qwen') return 'https://dashscope.aliyuncs.com/compatible-mode';
      return '';
    }
  },

  async chat(messages, opts = {}) {
    if (!this.config.apiKey) throw new Error('请先配置 AI API Key');
    if (!this.config.model) throw new Error('请先填写模型名称');
    if (!this.config.baseUrl) throw new Error('请先填写 Base URL');
    const url = this.config.baseUrl + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        stream: opts.stream ? true : undefined
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text || '请求失败'}`);
    }
    return res;
  },

  async *streamText(res) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) yield delta;
        } catch {}
      }
    }
  },

  presets: [
    { label: '✨ 生成文章大纲', prompt: '请为「$TOPIC」生成一份 5 个小节的技术文章大纲，每个小节包含 1-2 句说明。' },
    { label: '📝 总结这篇文章', prompt: '请用 3-5 句话总结以下文章的核心观点：\n\n$TEXT' },
    { label: '💡 润色文字', prompt: '请润色以下文字，使其更专业、更流畅，保持原意不变：\n\n$TEXT' },
    { label: '🏷️ 提取关键词', prompt: '从以下文章中提取 5 个核心关键词与标签：\n\n$TEXT' },
    { label: '🌐 翻译成英文', prompt: '将以下中文翻译成地道的英文：\n\n$TEXT' }
  ],

  models: {
    openrouter: [
      { id: 'openrouter/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'openrouter/gpt-4o', name: 'GPT-4o' },
      { id: 'openrouter/gemini-pro', name: 'Gemini Pro' },
      { id: 'openrouter/deepseek-chat', name: 'DeepSeek Chat' }
    ],
    deepseek: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' }
    ],
    qwen: [
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-max', name: 'Qwen Max' },
      { id: 'qwen-turbo', name: 'Qwen Turbo' }
    ]
  }
};
