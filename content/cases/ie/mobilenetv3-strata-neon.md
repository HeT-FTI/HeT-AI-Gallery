---
slug: mobilenetv3-strata-neon
projects: [IE]
title: "MobileNetV3 整图：Strata v3 与 NEON 协同部署"
outcome: "标准 MobileNetV3 从 TFLite 转换到 IE，并完成整图输出对拍"
summary: "展示 255+ 通道、1000 类分类头、紧凑执行计划和 NEON CNN 内核的组合能力。"
audience: [视觉算法, MCU 部署, 性能优化]
tags: [MobileNetV3, Strata, NEON]
coverAlt: "MobileNetV3 与 Strata v3 部署流程"
source:
  label: "Model deployment and Strata"
  url: "docs/IE/model_deployment.html"
featured: false
order: 3
reviewed_at: "2026-11-24"
visible: true
---

## 场景

视觉产品需要部署标准 MobileNetV3，而不是只能运行裁剪通道数和分类头的小模型。

## 问题

旧格式的一字节计数会限制 255+ 通道和 1000 类输出，同时通用解释器容易在热路径重复解析图描述。

## 方案

- 使用 Strata v3 逃逸式变长计数保存大维度信息。
- 在 survey 冷路径生成固定宽度执行计划，热路径直接逐层调用。
- 通过 registry 选择 NEON Conv2D、DWConv2D、Dense 和 GAP，并保留 scalar 回退。

## 结果

标准 alpha=1.0、1000 类、1024 维分类头的 MobileNetV3 可完成转换和整图 TFLite 对拍，覆盖常规与扩展计数场景。

## 边界

QEMU Cortex-A7 结果证明目标 ISA 的功能与数值一致性，不代表真实开发板的帧率、功耗或加速比。
