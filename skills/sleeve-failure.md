# 屏蔽套失效计算工具

## 概述
针对油冷电机复合材料屏蔽套（Sleeve），采用 Vasiliev 屈曲理论 + Tsai-Wu 复合材料失效准则 + 经典层合板理论（CLT），分析薄壁圆筒在外压/内压下的双重失效机制。

## 核心功能

### 1. 层合板力学分析 (CLT)
- 单层折减刚度 Q 矩阵
- 坐标变换 Q̄ 矩阵（任意铺层角度）
- ABD 矩阵（拉伸 A + 耦合 B + 弯曲 D）
- 等效工程常数（E_x, E_y, G_xy, ν_xy）
- 铺层 z 坐标表

### 2. Vasiliev 屈曲分析
- 简化半薄膜壳公式: p_cr(n) = (D₂₂/R³)(n²−1) + π⁴A₁₁R³/(L⁴·n⁴·(n²−1))
- n = 2..30 遍历，自动寻找最小临界压力
- 屈曲折减因子 0.75

### 3. Tsai-Wu 材料失效
- F₁σ₁ + F₂σ₂ + F₁₁σ₁² + F₂₂σ₂² + F₆₆τ₁₂² + 2F₁₂σ₁σ₂
- F₁₂ = −½√(F₁₁·F₂₂)（标准 von Mises 等效）
- 逐层失效指数 + 二分法求失效压力
- 失效模式判定（纤维拉/压、基体拉/压、剪切）

### 4. 失效机制图
- Canvas 绘制壁厚-临界压力双曲线图
- 三区着色: 绿色(安全) + 橙色(过渡) + 设计点标注
- 直观判断屈曲失稳区、强度失效区、结构安全区

## 输入参数
- 几何: R, L, t_ply, n_layers
- 铺层: 5 种模板 + 自定义角度序列
- 材料: 6 种预设 (CFRP/GFRP/AFRP) + 9 参数自定义
- 工况: 承压方向、端部条件、轴向端盖、设计压力

## 铺层角度约定
- 0° = 纤维沿圆柱轴向（x 方向）
- 90° = 纤维沿圆周方向（环向/θ 方向）
- 正角度 = 逆时针（右旋螺旋）

## 复合材料预设
| 材料 | E₁(GPa) | X_t(MPa) | Y_t(MPa) | 密度 |
|------|---------|---------|---------|------|
| CFRP T700/环氧 | 135 | 2100 | 50 | 1.55 |
| CFRP T800/环氧 | 160 | 2700 | 55 | 1.58 |
| CFRP M40J/环氧 | 230 | 2100 | 35 | 1.55 |
| GFRP E-Glass/环氧 | 45 | 1100 | 40 | 1.85 |
| GFRP S2-Glass/环氧 | 55 | 1600 | 50 | 1.95 |
| AFRP Kevlar49/环氧 | 76 | 1380 | 30 | 1.38 |

## 安全系数
- 屈曲 SF_buckle = p_cr × 0.75 / p_design: 合格 ≥2.0, 警告 ≥1.5
- 材料 SF_strength = p_fail / p_design: 合格 ≥2.0, 警告 ≥1.5

## 理论依据
- Vasiliev V.V. *Mechanics of Composite Structures* (1993)
- Vasiliev V.V., Morozov E.V. *Advanced Mechanics of Composite Materials* (2007)
- Tsai S.W., Wu E.M. *A General Theory of Strength for Anisotropic Materials*, J. Composite Materials (1971)
- Classical Lamination Theory (CLT)
