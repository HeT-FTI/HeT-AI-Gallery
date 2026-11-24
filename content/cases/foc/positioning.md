---
slug: positioning
projects: [foc, mnn]
title: "轴定位：停得准，也停得稳"
outcome: "目标、窗口、速度和加速度上限在同一条命令链里处理；不合适的目标准确拒绝，而不是悄悄夹到边界。"
summary: "定位不是把一个误差乘上 P。软限位、轨迹整形、原点和齿轮比要一起工作，轴才会停得准、也停得稳。"
audience: [运动控制负责人, 系统集成, 售前]
tags: [定位, 运动控制, 安全边界]
cover: assets/cases/positioning.webp
coverAlt: "受加速度限制的定位轨迹曲线"
figureCaption: "一次受加速度限制的移动：速度指令先上升到上限，再随误差缩小而衰减，位置收敛到目标且不超调。"
source:
  label: "Positioning an axis"
  url: "docs/foc/guides/positioning.html"
featured: false
order: 3
reviewed_at: "2026-11-23"
visible: true
---

## 场景

一根带机械行程限制的轴，需要在窗口内停准，同时尽量不激发机械。

## 问题

把超界目标夹到边界，看起来像“到了”，但控制器从未收到那个目标。机械允许的范围和控制器允许的范围，不能混为一谈。

## 方案

- soft_limit 先把窗口外的目标拒绝掉，并保留上一个目标
- motion_profile 在速度/加速度上限内整形
- position、position_reference、homing 分别处理误差、原点和多圈展开

## 结果

超界目标返回 Param，轴保持在旧目标；图里是一次受加速度限制的移动，速度指令先升到上限，再随误差缩小而衰减，位置收敛且不超调。

## 边界

第一次 index 之前没有绝对位置；轴已经越过机械墙时，软限位不负责把它拉回来。图展示的是积分器轴上的整形与收敛，不是整台电机的动力学。
