---
slug: local-decoder-generation
projects: [IE]
title: "本地 Decoder-only：在端侧完成连续文本生成"
outcome: "无需服务器即可完成 prompt 处理、KV 缓存与逐 token 生成"
summary: "展示 IE v2 的 IEM、Qwen3 兼容执行、chunked prefill、采样和 tokenizer 能力。"
audience: [嵌入式 AI, 本地智能产品, 系统集成]
tags: [本地LLM, Decoder, IEM]
coverAlt: "IE 本地 decoder-only 生成流程"
source:
  label: "Local decoder-only models"
  url: "docs/IE/components/local_llm.html"
featured: true
order: 1
reviewed_at: "2026-11-24"
visible: true
---

## 场景

设备需要理解并生成领域文本，但网络连接、云端成本或数据出域要求不允许依赖远程大模型服务。

## 问题

本地生成不仅是一次矩阵乘法，还涉及模型容器、prompt 分块、KV 生命周期、采样、EOS、tokenizer 和有限的运行时内存。

## 方案

- 使用 IEM 统一交付模型、执行计划、tokenizer 和可选 delegate 数据。
- 通过 IeLlm 完成 prefill、chunked prefill、decode 和 generate。
- 使用调用方 pool 管理 ACT、KV、IO 与权重窗口，按需选择量化配置。

## 结果

形成完整的本地 decoder-only 推理链，并可用独立参考输出、质量门禁和会话 reset 验证其行为。

## 边界

当前可执行家族为 Qwen3 兼容路径；W4A8 和权重流送是独立构建选项。功能验证不等于目标板 token/s 或功耗承诺。
