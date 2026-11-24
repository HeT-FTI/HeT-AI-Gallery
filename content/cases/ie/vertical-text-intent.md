---
slug: vertical-text-intent
projects: [IE]
title: "垂直文本意图：把自然语言映射为设备动作"
outcome: "在本地将控制语句转换为结构化意图和参数"
summary: "展示 student_text 兼容路径与通用序列内核在垂直控制场景中的应用方式。"
audience: [智能家居, 设备控制, 嵌入式应用]
tags: [意图识别, 垂直模型, 设备控制]
coverAlt: "垂直文本意图到设备动作的映射"
source:
  label: "IE API 与兼容模型接口"
  url: "docs/IE/api_reference.html"
featured: false
order: 2
reviewed_at: "2026-11-24"
visible: true
---

## 场景

家居、仪器和工业面板需要把有限领域的自然语言命令转换为设备可执行的结构化调用。

## 问题

通用大模型成本过高，而每个垂直模型都复制一套专用运行时会导致算子、内存和验证逻辑重复。

## 方案

- 复用 Generic Linear、Conv1D、GRU 和序列处理组件。
- 使用 student_text 兼容接口承载已有垂直意图模型。
- 通过静态 pool 和参考向量验证 FP32/INT8 输出与模型语义。

## 结果

可以在本地完成文本到意图 token 的映射，再由应用执行安全校验和设备动作，无需为每种模型新建一套计算后端。

## 边界

student_text 是早期独立模型的兼容接口，不等同于通用聊天模型。意图覆盖范围、槽位合法性和动作安全策略由具体模型与应用共同保证。
