---
slug: modulation-limits
projects: [foc]
title: "高速与调制边界：把母线电压用干净"
outcome: "在母线电压见底之前，知道还能输出多少；当输出不了时，电流环也不会继续按“已经给到”去积分。"
summary: "饱和、最小脉宽和六步退化，通常被当成控制器故障；这个案例把它们变成可读的信号。"
audience: [电控负责人, 系统集成, 售前]
tags: [高速, 调制, 可解释]
cover: assets/cases/modulation-limits.webp
coverAlt: "不同电角度下的调制幅值扫描曲线"
figureCaption: "同一请求在 0° 与 30° 电角度下的幅值扫描：两条曲线随请求线性增长，但在不同幅值饱和。"
source:
  label: "High speed and modulation"
  url: "docs/foc/guides/modulation-limits.html"
featured: true
order: 2
reviewed_at: "2026-11-23"
visible: true
---

## 场景

一台无感电机已经上了台架，母线电压有限，转速还要继续往上走。

## 问题

电压请求超过桥能交付的范围后，控制器如果继续按“已交付”积分，现场看到的就是电流环或转矩异常，而不是饱和本身。

## 方案

- 先由 svpwm 把电压请求换成三相占空比，饱和时给出标志
- min_pulse 把请求了却没发出去的伏秒差按相报出来
- six_step 的限速表负责拒绝假 hall 跳变，并把拒绝次数记下来

## 结果

同一张图里，0° 与 30° 的饱和点并不一样；页面也说明图没有展示过调制后的基波。

## 边界

这一页覆盖的是调制器的饱和、最小脉宽和六步退化；mode II / 顶点保持，以及“六步替代磁场定向”都不在结论范围内。
