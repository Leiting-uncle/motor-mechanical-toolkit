# 电机机械结构校核工具集

离线可用的网页计算工具，覆盖电机传动系统六大关键结构校核环节。

## 六大工具模块

| Tab | 模块 | 依据标准 | 核心功能 |
|-----|------|----------|----------|
| 1 | 渐开线花键 | GB/T 3478.1-2008 | 几何参数、公差配合、6项强度校核 |
| 2 | 平键校核 | GB/T 1096-2003 | 标准键截面、挤压/剪切强度 |
| 3 | 定子铁心-机座过盈 | GB/T 5371-2004 | 接触压力、温度效应、应力校核 |
| 4 | 转子铁心-转轴过盈 | GB/T 5371-2004 | 离心力、温差效应、高速过盈损失 |
| 5 | 轴承校核 | SKF/NSK/ISO 281 | 寿命计算、摩擦功耗、临界转速 |
| 6 | 屏蔽套失效 | Vasiliev/Tsai-Wu/CLT | 屈曲分析、复合材料失效、失效机制图 |

## 快速使用

1. 克隆或下载本仓库
2. 双击 `index.html` 用浏览器打开（file:// 协议，无需服务器）
3. 在左侧面板输入参数，点击「开始校核计算」
4. 右侧查看详细计算结果

## 文件结构

```
spline-calc/
  index.html          ← 壳层：6 个 Tab 导航 + 布局
  styles.css           ← 全局样式
  ├── 数据层（纯数据，无计算）
  │   data.js, key-data.js, pressfit-data.js, bearing-data.js, sleeve-data.js
  ├── 计算层（纯函数，无 DOM）
  │   calc.js, key-calc.js, stator-frame-calc.js, rotor-shaft-calc.js,
  │   bearing-calc.js, sleeve-calc.js
  └── 界面层（UI 桥接，无公式）
      tab-spline.js, tab-keyway.js, tab-stator.js, tab-rotor.js,
      tab-bearing.js, tab-sleeve.js
```

## 设计原则

- **计算准确性绝对优先**：所有公式、系数、安全系数阈值有明确标准依据
- **计算逻辑与界面交互完全分离**：数据层→计算层→界面层三层架构
- **完整中间变量保留**：支持分步溯源核对
- **离线兼容**：file:// 协议可用，无外部 CDN 依赖

## 浏览器兼容

- Chrome 90+ / Firefox 90+ / Edge 90+
- file:// 协议直接打开
- 无需 Node.js 或 Web 服务器

## 详细文档

参见 [USER_GUIDE.md](USER_GUIDE.md)
