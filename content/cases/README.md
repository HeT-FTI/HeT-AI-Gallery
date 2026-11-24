# 案例内容源

一个案例一个 Markdown 文件：`content/cases/<project>/<slug>.md`。

## Frontmatter

```yaml
---
slug: modulation-limits
projects: [foc]          # 至少一个；可以同时写第一方项目和第三方 recipe
title: "高速与调制边界：把母线电压用干净"
outcome: "首屏一句话结果"
summary: "案例卡上的两行摘要"
audience: [电控负责人, 系统集成, 售前]
tags: [高速, 调制, 可解释]
cover: assets/cases/modulation-limits.webp
coverAlt: "图的替代文本"
figureCaption: "图注；没有图就留空"
source:
  label: "High speed and modulation"
  url: "docs/foc/guides/modulation-limits.html"
featured: true
order: 2
reviewed_at: "2026-11-23"
visible: true
---
```

## 正文

固定五个二级标题，缺一个构建脚本直接失败：

```markdown
## 场景

## 问题

## 方案

- 一条方案

## 结果

## 边界
```

## 约束

- `projects` 至少一个，每个名字都必须存在于 `config/gallery.json` 的 `cards`（第一方项目或第三方 recipe）；当前 `positioning` 用 `[foc, mnn]` 作为多关联示例；
- `source.url` 必须指到精确 Sphinx 页；
- 文案里出现的数字必须能在 `source.url` 找到，不写“估算 KPI”；
- `callers` 这类“图不是控制结果”的案例，必须在“结果/边界”里写明图的边界；
- 改完运行：

```bash
python3 scripts/build_gallery_manifest.py --mode preview
```
