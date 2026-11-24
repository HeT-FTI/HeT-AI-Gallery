---
slug: sensorless-startup
projects: [foc]
title: "无感启动：从静止到可观速度"
outcome: "没有位置传感器，也能让电机从静止走到观测器能接管的速度；即使启动失败，也知道卡在哪一步。"
summary: "无感控制真正难的是起步。这个案例把对齐、强拖、交接拆成三个可观察状态，而不是一个黑盒。"
audience: [电控负责人, 系统集成, 售前]
tags: [无感, 启动, 调试]
cover: assets/cases/sensorless-startup.webp
coverAlt: "强制角度与启动电流配方曲线"
figureCaption: "强制角度（展开）和配方电流：平台保持、开始强拖、加速度抛物线。图里没有 plant，不能回答“转子是否跟上”。"
source:
  label: "Bringing a sensorless machine up"
  url: "docs/foc/guides/startup-sensorless.html"
featured: false
order: 1
reviewed_at: "2026-11-23"
visible: true
---

## 场景

电机上电时没有编码器，转子停在哪里是未知的。控制器得先把它带到观测器能工作的速度，再交给闭环。

## 问题

如果只看到“转不起来”，很难判断是对齐电流不够、强拖斜坡不对，还是交接太早。现场往往只能反复试。

## 方案

- 先做对齐，把转子拉到已知角度
- 再按受控加速度强拖到交接速度
- 交接后交给观测器；交接速度为零的配方会被 validate() 拒绝，而不是先跑起来再放弃

## 结果

启动被拆成对齐、强拖、交接三个状态；图里能看到强制角度和电流配方。要注意，这张图只反映指令，没有 plant，不能据此判断转子是否跟上。

## 边界

这台机器实际会看到多大的滑差，取决于转子与强制矢量的初始错位，换一台机器要重新量；斜坡本身不负责给出这个数。
