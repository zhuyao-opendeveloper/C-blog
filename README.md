# C Blog · 现代化个人博客

[![Status](https://img.shields.io/badge/status-active-brightgreen.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()
[![Modern](https://img.shields.io/badge/UI-modern-purple.svg)]()
[![AI](https://img.shields.io/badge/AI-native-pink.svg)]()
[![Skill](https://img.shields.io/badge/skill-system-orange.svg)]()

> 🎨 现代化 · 🤖 AI 原生 · 🧩 Skill 插件 · 🚀 GitHub Pages 一键部署

**C Blog** 是一个专为独立开发者与写作者设计的轻量个人博客。它基于纯前端构建，**零构建步骤、零后端依赖**，却拥有你期望中的一切现代博客功能。

![Screenshot](./screenshot.svg)

---

## ✨ 特性一览

### 视觉
- 🎨 **玻璃拟态 + 渐变美学**：主视觉使用 Indigo → Purple → Pink 三段渐变
- 🌓 **暗黑 / 明亮**：一键切换，记忆偏好
- 📱 **响应式**：移动端、平板、桌面完美适配
- 🖼️ **自定义 SVG 图标集**：所有图标均为本项目原创，支持 CSS 渐变着色

### 功能
- 📝 **Markdown 原生**：GFM、代码高亮、数学公式（KaTeX）、流程图（Mermaid）
- 🔍 **全文搜索**：支持标题、摘要、标签检索，快捷键 `\/` 唤起
- 🏷️ **标签聚合**：标签墙 + 多维筛选
- 🧭 **Hash 路由**：纯前端 SPA，刷新不丢状态
- 📊 **字数 / 阅读时长**：文章级统计

### AI 原生 🤖
- 💬 **多模型对话**：支持 OpenRouter / DeepSeek / 阿里云百炼 / 自定义
- 🔐 **密钥本地存储**：零服务端，完全安全
- ⚡ **流式响应**：逐字呈现，体验流畅
- 🎯 **场景快捷指令**：大纲生成、文章总结、润色、翻译、关键词提取

### Skill 插件系统 🧩
C Blog 内置可插拔的 Skill 系统，启用即可获得额外能力：

| Skill | 功能 |
|---|---|
| `word-count` | 文章字数 / 字符数统计 |
| `reading-progress` | 顶部阅读进度条 |
| `toc-generator` | 自动生成目录大纲 |
| `share` | 一键分享（Twitter / 微博 / 复制链接） |
| `ai-polish` | AI 润色当前文章 |
| `math` | 启用 KaTeX 公式渲染 |
| `mermaid` | 渲染 ```mermaid 流程图 |

> 开发自己的 Skill 只需实现 `install(ctx)` / `uninstall(ctx)` 两个方法，详见 [技能开发文档](#开发自己的-skill)。

### 部署 🚀
- 支持 **GitHub Actions** 全自动部署
- 支持 **git worktree** 本地一键发布
- 自定义域名 + HTTPS（GitHub Pages 原生支持）

---

## 🚀 快速开始

### 方式一：直接打开（最简单）

```bash
# 克隆仓库
git clone https://github.com/yourname/c-blog.git
cd c-blog

# 方式 1：直接双击 index.html
# 方式 2：用任意静态服务器
python -m http.server 8080
# 或
npx serve .
```

访问 `http://localhost:8080` 即可。

### 方式二：发布到 GitHub Pages

```bash
# 1. 在 GitHub 新建仓库，例如 yourname/c-blog
# 2. 推送代码
git remote add origin https://github.com/yourname/c-blog.git
git push -u origin main

# 3. 启用 Pages：Settings → Pages → Source = GitHub Actions
# 4. 推送即自动部署 ✨
```

或使用本地脚本发布到 `gh-pages` 分支：

```bash
bash scripts/deploy.sh
```

---

## 📁 项目结构

```
c-blog/
├── index.html              # 主入口（含所有 SVG 图标与骨架）
├── styles.css              # 全局样式（主题/布局/组件）
├── app.js                  # 应用逻辑（路由、渲染、Skill 系统）
├── data/
│   └── posts.js            # 文章数据（Markdown 字符串）
├── skills/
│   ├── index.js            # 内置 Skill 集合
│   └── ai.js               # AI 客户端（多模型 + 流式）
├── assets/
│   └── icons/
│       └── favicon.svg     # 站点图标
├── scripts/
│   └── deploy.sh           # 本地一键发布脚本
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions 工作流
└── README.md
```

---

## ✍️ 撰写文章

在 `data/posts.js` 中追加一条记录：

```js
{
  id: 'my-new-post',
  title: '文章标题',
  excerpt: '摘要（列表页展示）',
  date: '2026-06-26',
  author: '你的名字',
  avatar: 'C',              // 列表页头像字符
  tags: ['前端', '随笔'],
  readTime: 5,              // 阅读分钟
  content: `# Markdown 正文
  
支持 GFM、代码、表格、公式…
`
}
```

刷新即可看到新文章。

---

## 🤖 配置 AI

1. 打开导航栏 **AI** 页
2. 选择供应商（推荐 OpenRouter 以访问多种模型）
3. 粘贴 API Key（会保存到 `localStorage`）
4. 开始对话 ✨

**密钥安全说明**：
- 所有请求从你的浏览器直接发往模型供应商
- 密钥仅存在本机 `localStorage`，永不上传任何服务器
- 使用公共设备后记得清除

---

## 🧩 开发自己的 Skill

在 `skills/` 目录新建文件：

```js
window.CB_SKILLS.push({
  id: 'my-awesome-skill',
  name: 'My Skill',
  description: '一个超棒的 Skill',
  icon: 'i-sparkle',      // 引用 index.html 中 SVG sprite 的 id
  version: '1.0.0',
  install(ctx) {
    // 挂载时调用，ctx 提供以下 API：
    // ctx.on(event, fn)         订阅事件
    // ctx.dispatch(event, p)    派发事件
    // ctx.store.get/set(k, v)   本地存储
    // ctx.toast(msg)            全局提示
    //
    // 常用事件：
    //   'post:rendered'  —— 文章渲染完成
    //   'navigate'       —— 路由切换
  },
  uninstall(ctx) {
    // 卸载时清理
  }
});
```

保存后刷新，Skill 会自动出现在 Skill 页面。

---

## 🎨 自定义

### 品牌色

编辑 `styles.css` 开头的 CSS 变量：

```css
:root {
  --accent: #a855f7;
  --accent-2: #6366f1;
  --accent-3: #ec4899;
  --gradient: linear-gradient(135deg, #6366f1, #a855f7, #ec4899);
}
```

### 站点信息

编辑 `index.html` 中的站点文案、页脚链接与个人信息。

### 图标

所有图标以 SVG `<symbol>` 形式集中定义在 `index.html` 顶部。修改或新增都只改这一处。

---

## 📜 许可证

[MIT License](./LICENSE) © C Blog Contributors

## 🙏 致谢

- [Marked](https://github.com/markedjs/marked) — Markdown 解析
- [Highlight.js](https://highlightjs.org/) — 代码高亮
- [Google Fonts](https://fonts.google.com/) — 字体
- 以及每一位贡献者 ❤️

---

**如果你喜欢 C Blog，请在 GitHub 上留下一颗 ⭐️，让更多人看见。**
