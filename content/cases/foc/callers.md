---
slug: callers
projects: [foc]
title: "接进现有系统：一套控制回路，三种交付形态"
outcome: "同一套控制回路，可以用冻结的 C11 ABI、Python 绑定或 FMI FMU 交付；集成方不必为了换语言重写算法。"
summary: "C ABI、Python、FMU 三种接法共用一套控制；ABI 兼容性和错误码让集成阶段的问题更容易定位。"
audience: [系统集成, 平台负责人, 售前]
tags: [集成, C ABI, Python/FMU]
cover: assets/cases/callers.webp
coverAlt: "转矩指令通过 C ABI 的电流与占空比曲线"
figureCaption: "转矩指令通过 C ABI：电流跟随指令，回调写回的占空比随每一步变化。图只证明值穿过 ABI，不是控制性能。"
source:
  label: "Consuming the library from outside C++"
  url: "docs/foc/guides/c-and-cpp-callers.html"
featured: false
order: 4
reviewed_at: "2026-11-23"
visible: true
---

## 场景

控制律已经选定，板子也做好了，但上层应用不是 C++。团队需要从 C、Python 或仿真主站把回路跑起来。

## 问题

每接一种语言就重写一遍控制，等于维护多套行为；更麻烦的是 ABI 升级、错误码和句柄生命周期，问题往往到集成后期才暴露。

## 方案

- C11 接口保持冻结：opaque handle、不把 C++ 头文件带进调用方、每个返回码都能检查
- callbacks 把电流采样、死区和母线电压留给集成方
- Python 绑定与 FMU 只是同一回路的薄封装；struct_size 让旧调用方兼容新增字段

## 结果

一个转矩指令通过 C ABI 后，电流跟随、占空比写回。这张图说明的是值能完整穿过 ABI；它不构成控制性能结论。

## 边界

这张图只覆盖 ABI 调用链：误码率、突发长度、移位帧检测都没有对应的证据。Figure 1.7 的 host 是 Ohm's law + L/R 的替身，用来验证 ABI，不代表真实功率级。
