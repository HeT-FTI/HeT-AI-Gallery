# HeT-AI-Gallery

HeT-FTI 的项目、第三方 Conan 配方和真实应用案例统一入口。

线上页面由 `docs/index.html` 提供；页面本身不依赖 Vue/jQuery，也不请求 `img.shields.io`。

## 目录

```text
config/
  repos.yml                 # 文档矩阵：只放 name + git url
  gallery.json              # 站点/词表/卡片/徽章配置
content/
  cases/<project>/*.md      # 应用案例（一个案例一个 Markdown）
scripts/
  build_gallery_manifest.py # 生成 preview/production 的 data.js
.github/workflows/
  build-docs.yml            # 构建各子项目 Sphinx + 组装主页
  static/
    template/index.html     # 主页模板
    gallery/                # 主页 CSS/JS/assets
    pngs/logo.png           # 站点 logo / favicon
workspace/                  # 本地预览与迁移归档（gitignored）
docs/                       # CI 生成并提交的发布目录
```

## 本地预览

预览目录仍保留在 `workspace/preview/`，但不使用旧的 `sync-data.py`：

```bash
python3 scripts/build_gallery_manifest.py --mode preview
python3 -m http.server 8124 --directory workspace/preview
```

打开 <http://127.0.0.1:8124/>。

`--mode preview` 保留 `docs/` 和 `assets/` 路径，便于直接复用仓库里的 `docs/` 素材。

## 配置

### 新增项目

1. 在 `config/repos.yml` 增加文档矩阵条目：

```yaml
repos:
  - name: foo
    url: git@github.com:HeT-FTI/foo.git
```

2. 在 `config/gallery.json` 的 `cards` 增加一条卡片；`name` 必须与矩阵完全一致：

```json
{
  "name": "foo",
  "displayName": "foo",
  "origin": "first-party",
  "kind": "library",
  "status": "ready",
  "domains": ["control"],
  "summary": "一句话说明这个项目解决什么问题。",
  "url": "docs/foo/",
  "cover": "assets/covers/foo.webp",
  "logo": "assets/logos/foo.png",
  "badges": [
    { "preset": "author", "value": "owner" },
    { "preset": "version", "value": "0.1.0" }
  ]
}
```

`config/repos.yml` 只负责“构建哪些仓库”；`config/gallery.json` 只负责“怎么展示”。两边的 `name` 由构建脚本校验，不会静默漂移。

### 第三方 recipe

recipe 放进 `config/gallery.json`，不要放进 `config/repos.yml`（否则文档矩阵会尝试 clone 上游仓库）：

```json
{
  "name": "mnn",
  "origin": "third-party",
  "kind": "recipe",
  "status": "ready",
  "domains": ["infra", "vision"],
  "summary": "阿里 MNN 推理引擎的 Conan 配方。",
  "badges": [
    { "preset": "recipe", "value": "by HeT-FTI" },
    { "preset": "upstream", "value": "阿里 MNN 3.4.1" }
  ]
}
```

### 新增应用案例

在 `content/cases/<project>/<slug>.md` 新建 Markdown。frontmatter 至少要有：

```yaml
---
slug: positioning
projects: [foc, mnn]       # 至少一个；第一方项目或第三方 recipe
title: "轴定位：停得准，也停得稳"
outcome: "首屏一句话结果"
summary: "案例卡两行摘要"
source:
  label: "完整技术细节"
  url: "docs/foc/guides/positioning.html"
reviewed_at: "2026-11-23"
visible: true
---
```

正文固定使用：

```text
## 场景
## 问题
## 方案
## 结果
## 边界
```

`projects` 的名字必须存在于 `config/gallery.json` 的 `cards`；未知项目、缺段落或重复 slug 会让构建失败。案例作者指南见 `content/cases/README.md`。

### 徽章

颜色和 preset 在 `config/gallery.json` 的 `badgeRegistry` 统一定义；项目只写：

```json
{ "preset": "doi", "value": "10.48550/arXiv.2511.00001", "url": "https://doi.org/10.48550/arXiv.2511.00001" }
```

`url` 是可选的点击目标，必须是绝对 `http(s)`；页面不会请求它。带 `url` 的 badge 会渲染成独立链，卡片主链接使用 `article` + `.card-hit`，不会产生嵌套 `<a>`。

### 封面和 logo

- 封面来自 `assets/covers/*.webp`；
- 项目 logo 优先从 `docs/<name>/_static/OUT_logo.*` 或 `_images/OUT_logo.*` 生成，统一为 **128×128 PNG**；`ALL_logo` 只是 favicon 级兜底；
- 站点 logo/favicon 使用 `.github/workflows/static/pngs/logo.png`；
- 替换图片后更新 `config/gallery.json` 的 `site.assetVersion`，让 preview 本地图片绕过缓存。

## 生产构建

生产构建在 `.github/workflows/build-docs.yml` 的 `build-all` 中完成：

1. 下载各子项目 Sphinx 文档；
2. 复制 `.github/workflows/static/gallery` 和 `pngs`；
3. 复制新模板到 `docs/index.html`；
4. 运行：

```bash
python3 scripts/build_gallery_manifest.py \
  --mode production \
  --asset-version "$GITHUB_SHA"
```

5. 生成 `docs/_static/gallery/js/data.js` 和 `docs/_config/gallery.json`；
6. 替换模板里的 `__BUILD__`，提交 `docs/`。

生产 mode 会把：

- `assets/...` → `_static/gallery/assets/...`
- `docs/<name>/...` → `<name>/...`
- `site.logo` → `_static/pngs/logo.png`

## 校验

```bash
python3 scripts/build_gallery_manifest.py --mode preview
node --check .github/workflows/static/gallery/js/app.js
node --check workspace/preview/js/data.js
python3 -m json.tool config/gallery.json > /dev/null
```

迁移期间不再需要的旧 Vue/jQuery/Element 资源和旧模板，已移到 `workspace/.old/`（gitignored），不会进入发布页面。


