[
  {
    "id": "hello-c-blog",
    "title": "欢迎来到 C Blog — 一个现代化的开源博客",
    "excerpt": "C Blog 是一个现代化、轻量、支持 AI 与 Skill 插件的个人博客。本文介绍它的设计理念与核心能力。",
    "date": "2026-06-20",
    "author": "C",
    "avatar": "C",
    "tags": ["公告", "介绍", "开源"],
    "readTime": 4,
    "content": "# 欢迎来到 C Blog\n\n**C Blog** 是一个专为开发者与创作者设计的现代化个人博客。\n\n## ✨ 核心特性\n\n- 🎨 **现代化 UI**：玻璃拟态、渐变、暗黑模式、响应式\n- 🤖 **AI 原生集成**：内置对话助手、文章润色、摘要生成\n- 🧩 **Skill 插件系统**：一键扩展功能\n- 🔍 **全文搜索**：支持文章与标签快速检索\n- 🏷️ **标签云**：多维分类与聚合\n- 📝 **Markdown 原生**：代码高亮、表格、数学公式\n- 🚀 **GitHub Pages**：开箱即用的部署\n- 💖 **纯前端**：无需后端即可运行\n\n## 🚀 快速开始\n\n```bash\n# 克隆仓库\ngit clone https://github.com/yourname/c-blog.git\ncd c-blog\n\n# 直接用浏览器打开 index.html\n# 或使用静态服务器\npython -m http.server 8080\n```\n\n## 📁 项目结构\n\n```\nc-blog/\n├── index.html          # 主页面\n├── styles.css          # 样式\n├── app.js              # 应用逻辑\n├── data/posts.js       # 文章数据\n├── skills/             # Skill 插件\n└── assets/icons/       # 自定义 SVG 图标\n```\n\n## 🧠 接入 AI\n\n打开导航栏的 **AI** 页面，填入你的 API Key 即可开始对话。所有密钥仅保存在本地。\n\n> 💡 安全提示：C Blog 所有 AI 请求均从浏览器直接发起，密钥不会上传到任何第三方服务器。\n\n## 📝 结语\n\nC Blog 由 ❤️ 打造，欢迎在 GitHub 上 Star 与贡献。"
  },
  {
    "id": "build-modern-ui",
    "title": "打造现代化 UI：从玻璃拟态到渐变美学",
    "excerpt": "解析 C Blog 的视觉设计：玻璃拟态、多层渐变、流畅动效与暗黑模式的完整实现思路。",
    "date": "2026-06-15",
    "author": "C",
    "avatar": "C",
    "tags": ["前端", "设计", "CSS"],
    "readTime": 6,
    "content": "# 打造现代化 UI\n\n现代 Web 设计越来越注重**层次感**、**呼吸感**和**情感化**。本文从 C Blog 的实践出发，聊聊几个关键的设计技巧。\n\n## 1. 玻璃拟态（Glassmorphism）\n\n通过 `backdrop-filter` 可以轻松实现毛玻璃背景：\n\n```css\n.glass {\n  background: rgba(19, 19, 29, 0.72);\n  backdrop-filter: saturate(180%) blur(18px);\n  -webkit-backdrop-filter: saturate(180%) blur(18px);\n}\n```\n\n## 2. 渐变配色系统\n\nC Blog 使用 **Indigo → Purple → Pink** 三段渐变作为主视觉：\n\n```css\n:root {\n  --gradient: linear-gradient(135deg, #6366f1, #a855f7, #ec4899);\n}\n```\n\n## 3. 柔光背景层\n\n通过 `body::before` 叠加多层径向渐变，营造氛围感：\n\n```css\nbody::before {\n  content: '';\n  position: fixed;\n  inset: 0;\n  background:\n    radial-gradient(600px 400px at 10% -10%, rgba(99,102,241,.18), transparent 60%),\n    radial-gradient(600px 400px at 110% 10%, rgba(236,72,153,.14), transparent 60%);\n  z-index: -1;\n}\n```\n\n## 4. 暗黑模式\n\n使用 `data-theme` 属性快速切换：\n\n```javascript\ndocument.documentElement.dataset.theme = 'dark'; // or 'light'\n```\n\n## 5. 动效节奏感\n\n- 卡片 hover 上浮 3-4px\n- 渐变边框 0.3s 渐显\n- 按钮阴影扩散\n\n## 总结\n\n现代化 UI 不等于复杂，而是通过精心打磨的细节，让用户感到**愉悦**与**可信**。"
  },
  {
    "id": "ai-integration-guide",
    "title": "纯前端接入 LLM：用 C Blog 的 AI 助手做实战",
    "excerpt": "如何在静态博客中安全地接入大模型？本文分享密钥本地存储、流式对话、上下文管理的完整方案。",
    "date": "2026-06-08",
    "author": "C",
    "avatar": "C",
    "tags": ["AI", "LLM", "实战"],
    "readTime": 8,
    "content": "# 纯前端接入 LLM\n\n## 🔑 密钥管理\n\n所有密钥保存在 `localStorage`，**永不上传**：\n\n```javascript\nconst apiKey = localStorage.getItem('cb_ai_key');\n```\n\n## 💬 发送对话\n\n```javascript\nasync function chat(messages, apiKey) {\n  const res = await fetch('/v1/chat/completions', {\n    method: 'POST',\n    headers: {\n      'Authorization': `Bearer ${apiKey}`,\n      'Content-Type': 'application/json'\n    },\n    body: JSON.stringify({ model: 'gpt-4o', messages })\n  });\n  return res.json();\n}\n```\n\n## ⚡ 流式输出\n\n使用 `ReadableStream` 解析 SSE：\n\n```javascript\nconst reader = res.body.getReader();\nconst decoder = new TextDecoder();\nwhile (true) {\n  const { value, done } = await reader.read();\n  if (done) break;\n  const chunk = decoder.decode(value);\n  // 解析并追加到 UI\n}\n```\n\n## 🛡️ 安全须知\n\n- 仅使用可信 API 提供商\n- 避免在公共设备保存密钥\n- 使用 Skill 插件扩展多模型支持\n\n## 🎯 场景\n\nC Blog 支持 AI 对话、文章润色、关键词提取、摘要生成等多种场景，全部由 Skill 驱动。"
  },
  {
    "id": "build-skill-system",
    "title": "实现可扩展的 Skill 插件系统",
    "excerpt": "C Blog 的 Skill 系统让功能扩展像搭积木一样简单。本文带你理解其架构与开发方式。",
    "date": "2026-05-30",
    "author": "C",
    "avatar": "C",
    "tags": ["架构", "插件", "开源"],
    "readTime": 7,
    "content": "# Skill 插件系统\n\n## 设计目标\n\n1. **零侵入**：不修改核心代码即可扩展\n2. **可热插拔**：按需加载，按需卸载\n3. **标准化接口**：统一的 `register/unregister`\n\n## 核心接口\n\n```javascript\nCBM.registerSkill({\n  id: 'my-skill',\n  name: 'My Skill',\n  description: '演示 Skill',\n  icon: 'i-sparkle',\n  version: '1.0.0',\n  onMount(ctx) { /* 挂载 */ },\n  onUnmount() { /* 卸载 */ }\n});\n```\n\n## 上下文 API\n\n- `ctx.on(event, handler)`：订阅事件\n- `ctx.dispatch(event, payload)`：派发事件\n- `ctx.store`：读写本地存储\n- `ctx.toast(msg)`：全局提示\n\n## 内置 Skill\n\n| Skill | 功能 |\n|---|---|\n| `word-count` | 文章字数统计 |\n| `reading-time` | 阅读时长估算 |\n| `toc` | 文章目录 |\n| `share` | 一键分享 |\n| `ai-polish` | AI 润色当前文章 |\n\n## 开发自己的 Skill\n\n在 `skills/` 目录下创建 `.js` 文件，导出 Skill 定义即可。"
  },
  {
    "id": "deploy-github-pages",
    "title": "一键部署到 GitHub Pages",
    "excerpt": "用 GitHub Actions 自动构建并部署 C Blog，让你的博客永久在线。",
    "date": "2026-05-20",
    "author": "C",
    "avatar": "C",
    "tags": ["部署", "DevOps", "GitHub"],
    "readTime": 5,
    "content": "# 部署到 GitHub Pages\n\n## 步骤\n\n1. 新建仓库 `yourname/c-blog`\n2. 推送代码到 `main` 分支\n3. 在仓库 Settings → Pages 中选择 **GitHub Actions**\n4. 推送即自动部署 ✨\n\n## 使用 Action\n\n```yaml\nname: Deploy\non:\n  push:\n    branches: [main]\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/upload-pages-artifact@v3\n        with: { path: '.' }\n      - id: deployment\n        uses: actions/deploy-pages@v4\n```\n\n## 自定义域名\n\n在仓库根目录创建 `CNAME`：\n\n```\nyourblog.com\n```\n\n并在 DNS 设置中配置指向 GitHub Pages 的 IP。\n\n## 总结\n\nC Blog 的部署只需一次配置，之后零维护、零成本。"
  },
  {
    "id": "writing-workflow",
    "title": "我的写作工作流：从想法到发布",
    "excerpt": "分享我作为一个写作者的日常：如何用 AI 辅助构思、用 Markdown 打磨、用 C Blog 发布。",
    "date": "2026-05-10",
    "author": "C",
    "avatar": "C",
    "tags": ["写作", "效率"],
    "readTime": 4,
    "content": "# 我的写作工作流\n\n## 1. 收集碎片\n\n- 用 Readwise 同步高亮\n- 在 Obsidian 记录灵感\n\n## 2. AI 辅助构思\n\n打开 C Blog 的 AI 页面，输入：\n\n> 「我想写一篇关于 X 的文章，请给我 5 个角度和大纲」\n\n## 3. Markdown 写作\n\n在任意 Markdown 编辑器中写作，支持：\n\n- 代码块\n- 数学公式\n- 表格\n- Mermaid 图\n\n## 4. 发布\n\n将文章添加到 `data/posts.js` 数组，推送到 GitHub 即可。\n\n## 工具链\n\n```\n想法 → AI 构思 → Markdown 写作 → C Blog 发布 → 读者\n```"
  }
]
