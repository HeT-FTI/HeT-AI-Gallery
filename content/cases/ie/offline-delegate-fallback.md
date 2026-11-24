---
slug: offline-delegate-fallback
projects: [IE]
title: "离线 Delegate：加速器计划与 CPU 回退共用一张图"
outcome: "离线命令流、registry 和 CPU fallback 在同一执行计划中协同工作"
summary: "展示面向 NPU/异构加速器的命令流绑定、会话隔离和数值回退机制。"
audience: [加速器驱动, BSP, 架构评审]
tags: [Delegate, NPU, Registry]
coverAlt: "离线 delegate 与 CPU 回退架构"
source:
  label: "IE v2 architecture"
  url: "docs/IE/architecture.html"
featured: false
order: 4
reviewed_at: "2026-11-24"
visible: true
---

## 场景

产品希望利用 NPU 或其他异构加速器，但不能因部分算子不支持、布局不匹配或驱动失败而丢失整张图的执行能力。

## 问题

加速器接入若散落在算子和执行循环中，会形成硬件特例分支、重复状态和难以验证的回退路径。

## 方案

- 离线生成 delegate 命令流并在 IEM 中携带。
- resolve 时统一绑定后端、范围和每层 opCode，热路径只执行槽位函数。
- 每层保留 CPU fallback，并使用独立会话状态支持多图和复用只读计划。

## 结果

同一模型可以在 CPU、模拟 delegate 和离线命令流路径之间保持一致的数值与错误语义，为真实加速器适配提供稳定基线。

## 边界

mock delegate 只验证调度、隔离和回退，不代表任何厂商 NPU 已支持。真实驱动提交、DMA 同步和性能仍需目标平台验收。
