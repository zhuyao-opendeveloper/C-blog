window.CB_SKILLS = [
  {
    id: 'word-count',
    name: 'Word Count',
    description: '显示文章字数统计与字符数',
    icon: 'i-code',
    version: '1.0.0',
    install(ctx) {
      ctx.on('post:rendered', ({ container, post }) => {
        const prose = container.querySelector('.prose');
        if (!prose) return;
        const text = prose.innerText || '';
        const chars = text.length;
        const words = text.trim().split(/\s+/).length;
        const stat = document.createElement('div');
        stat.className = 'post-stats';
        stat.innerHTML = `
          <div class="stat-item"><strong>${chars.toLocaleString()}</strong><span>字符</span></div>
          <div class="stat-item"><strong>${words.toLocaleString()}</strong><span>词</span></div>
        `;
        container.querySelector('.post-detail-header')?.appendChild(stat);
        ctx.toast(`统计完成：${chars} 字符 / ${words} 词`);
      });
    },
    uninstall() {}
  },
  {
    id: 'reading-progress',
    name: 'Reading Progress',
    description: '顶部显示阅读进度条',
    icon: 'i-clock',
    version: '1.0.0',
    install(ctx) {
      const bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;width:0%;background:var(--gradient);z-index:999;transition:width .15s';
      document.body.appendChild(bar);
      const onScroll = () => {
        const h = document.documentElement;
        const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight) * 100;
        bar.style.width = scrolled + '%';
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      ctx._cleanup = () => {
        window.removeEventListener('scroll', onScroll);
        bar.remove();
      };
    },
    uninstall(ctx) { ctx._cleanup && ctx._cleanup(); }
  },
  {
    id: 'toc-generator',
    name: 'TOC Generator',
    description: '自动为文章生成目录大纲',
    icon: 'i-bookmark',
    version: '1.0.0',
    install(ctx) {
      ctx.on('post:rendered', ({ container }) => {
        const headings = container.querySelectorAll('.prose h2, .prose h3');
        if (!headings.length) return;
        const toc = document.createElement('nav');
        toc.className = 'toc';
        toc.innerHTML = '<div class="toc-title">📑 目录</div>';
        headings.forEach((h, i) => {
          if (!h.id) h.id = 'toc-' + i;
          const a = document.createElement('a');
          a.href = '#' + h.id;
          a.textContent = h.textContent;
          a.style.paddingLeft = (h.tagName === 'H3' ? 18 : 6) + 'px';
          toc.appendChild(a);
        });
        container.querySelector('.post-detail-header')?.after(toc);
      });
    },
    uninstall() {}
  },
  {
    id: 'share',
    name: 'Share',
    description: '为文章添加一键分享按钮（微博/Twitter/复制链接）',
    icon: 'i-link',
    version: '1.0.0',
    install(ctx) {
      ctx.on('post:rendered', ({ container, post }) => {
        const actions = document.createElement('div');
        actions.className = 'share-actions';
        const url = encodeURIComponent(location.href);
        const title = encodeURIComponent(post.title);
        actions.innerHTML = `
          <span class="share-label">分享：</span>
          <a class="share-btn" href="https://twitter.com/intent/tweet?text=${title}&url=${url}" target="_blank" rel="noreferrer">Twitter</a>
          <a class="share-btn" href="https://service.weibo.com/share/share.php?title=${title}&url=${url}" target="_blank" rel="noreferrer">微博</a>
          <button class="share-btn copy-link">复制链接</button>
        `;
        container.querySelector('.prose')?.appendChild(actions);
        actions.querySelector('.copy-link')?.addEventListener('click', () => {
          navigator.clipboard.writeText(location.href).then(() => ctx.toast('链接已复制 ✓'));
        });
      });
    },
    uninstall() {}
  },
  {
    id: 'ai-polish',
    name: 'AI Polish',
    description: '为文章添加「AI 润色」按钮（需配置 AI Key）',
    icon: 'i-ai',
    version: '1.0.0',
    install(ctx) {
      ctx.on('post:rendered', ({ container }) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost ai-polish-btn';
        btn.innerHTML = '<svg><use href="#i-sparkle"/></svg> AI 润色全文';
        btn.style.marginTop = '16px';
        btn.addEventListener('click', () => {
          ctx.dispatch('navigate', '/ai');
          ctx.store.set('cb_ai_polish_target', container.querySelector('.prose')?.innerText || '');
        });
        container.querySelector('.prose')?.appendChild(btn);
      });
    },
    uninstall() {}
  },
  {
    id: 'math',
    name: 'Math',
    description: '为 Markdown 启用 KaTeX 数学公式渲染',
    icon: 'i-sparkle',
    version: '1.0.0',
    install(ctx) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
      document.head.appendChild(link);
      ctx.toast('Math Skill 已启用：支持 $...$ 与 $$...$$ 公式');
    },
    uninstall() {}
  },
  {
    id: 'mermaid',
    name: 'Mermaid',
    description: '将 ```mermaid 代码块渲染为流程图',
    icon: 'i-code',
    version: '1.0.0',
    install(ctx) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
      s.onload = () => window.mermaid?.initialize({ startOnLoad: false });
      document.head.appendChild(s);
      ctx.on('post:rendered', ({ container }) => {
        const blocks = container.querySelectorAll('pre code.language-mermaid');
        blocks.forEach(async (code) => {
          const pre = code.parentElement;
          const div = document.createElement('div');
          div.className = 'mermaid';
          div.textContent = code.textContent;
          pre.replaceWith(div);
          try { await window.mermaid?.run({ querySelector: '.mermaid' }, div); } catch (e) {}
        });
      });
    },
    uninstall() {}
  }
];
