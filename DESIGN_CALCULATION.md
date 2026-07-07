# 渐开线花键参数计算与强度校核 — 设计计算书

> **版本**: 1.1 | **日期**: 2026-07-07  
> **依据标准**: GB/T 3478.1-2008、GB/T 17855-1999、《机械设计手册》第五版

---

## 目录

1. [基本几何参数计算](#1-基本几何参数计算)
2. [外花键（轴）几何](#2-外花键轴几何)
3. [内花键（毂）几何](#3-内花键毂几何)
4. [公差体系](#4-公差体系)
5. [齿厚与齿槽宽极限尺寸](#5-齿厚与齿槽宽极限尺寸)
6. [量棒测量（跨棒距/棒间距）](#6-量棒测量跨棒距棒间距)
7. [直径公差（大径/小径）](#7-直径公差大小径)
8. [强度校核 — 《机械设计手册》简化公式](#8-强度校核--机械设计手册简化公式)
9. [GB/T 17855-1999 花键承载能力计算](#9-gbt-17855-1999-花键承载能力计算)
10. [材料与安全系数](#10-材料与安全系数)
11. [数据表索引](#11-数据表索引)
12. [标准验证用例](#12-标准验证用例)

---

## 1. 基本几何参数计算

**依据**: GB/T 3478.1-2008 第5章 公式(1)~(4)  
**函数**: `calcBasicGeometry(m, z, profile)`  
**源文件**: `calc.js:76-109`

### 1.1 输入参数

| 参数 | 符号 | 单位 | 说明 |
|------|------|------|------|
| 模数 | m | mm | 标准系列：0.5~10 |
| 齿数 | z | — | 6~120 |
| 压力角 | α_D | ° | 标准值 30° |
| 齿顶高系数 | ha* | — | 标准值 0.5 |

### 1.2 计算公式

**① 分度圆直径** (公式1)
$$D = m \times z \quad \text{[mm]}$$

**② 基圆直径** (公式2)
$$D_b = D \times \cos\alpha_D = m \times z \times \cos 30° \quad \text{[mm]}$$

**③ 齿距** (公式3)
$$p = \pi \times m \quad \text{[mm]}$$

**④ 基本齿厚 / 基本齿槽宽** (公式4)
$$S_{basic} = E_{basic} = \frac{p}{2} = \frac{\pi m}{2} \quad \text{[mm]}$$

**⑤ 齿顶高**
$$h_a = h_a^* \times m = 0.5m \quad \text{[mm]}$$

**⑥ inv 函数 (渐开线函数)**
$$\text{inv}(\alpha) = \tan\alpha - \alpha \quad \text{[rad]}$$

$$\text{inv}(30°) = \tan 30° - \frac{\pi}{6} \approx 0.053751493$$

### 1.3 输出变量

| 符号 | 名称 | 用途 |
|------|------|------|
| D | 分度圆直径 | 齿厚分配、公差分段、强度校核基准 |
| D_b | 基圆直径 | 渐开线起始/终止圆、量棒测量 |
| p | 齿距 | 齿厚/齿槽宽基本值 |
| S_basic | 基本齿厚 | 外花键齿厚公差基准 |
| E_basic | 基本齿槽宽 | 内花键齿槽宽公差基准 |

---

## 2. 外花键（轴）几何

**依据**: GB/T 3478.1-2008 第6章  
**函数**: `calcExternalSplineDiameters(m, z, rootType, profile)`  
**源文件**: `calc.js:124-144`

### 2.1 齿根形式与系数

| 齿根形式 | name | 小径系数 | 圆角系数 ρ_f* | 适用场景 |
|----------|------|----------|---------------|----------|
| 平齿根 | flatRoot | 1.50 | 0.20 | 通用、拉削加工 |
| 圆齿根 | filletRoot | 1.80 | 0.30 | 受载较大、疲劳敏感 |

### 2.2 计算公式

**① 外花键大径（齿顶圆）基本值**

$$D_{ee} = m \times (z + 2 \cdot h_a^*) = m \times (z + 1) \quad \text{[mm]}$$

**② 外花键小径（齿根圆）基本值**

$$D_{ie} = m \times (z - c_{ext}) \quad \text{[mm]}$$

其中：
- 平齿根：$c_{ext} = 1.50$ → $D_{ie} = m(z - 1.5)$
- 圆齿根：$c_{ext} = 1.80$ → $D_{ie} = m(z - 1.8)$

### 2.3 外花键渐开线起始圆直径最大值 $D_{Fe\ max}$

**函数**: `calcExternalFormDiameter(m, z, D_ie, D_ei_mate)`  
**源文件**: `calc.js:159-176`

$$D_{Fe\ max} = 2\times\sqrt{\left(0.5D_{\text{b}}\right)^2 + \left(0.5D\sin\alpha_{\text{D}} - \dfrac{h_{\text{s}} - \dfrac{0.5\mathrm{ev}_{\text{s}}}{\tan\alpha_{\text{D}}}}{\sin\alpha_{\text{D}}}\right)^2}$$

其中 $c_F = 0.1m$（齿形裕度），$h_s = 0.6m$。

---

## 3. 内花键（毂）几何

**依据**: GB/T 3478.1-2008 第6章  
**函数**: `calcInternalSplineDiameters(m, z, rootType, profile)`  
**源文件**: `calc.js:191-211`

### 3.1 计算公式

**① 内花键大径（齿根圆）基本值**

$$D_{ei} = m \times (z + c_{int}) \quad \text{[mm]}$$

其中：
- 平齿根：$c_{int} = 1.50$ → $D_{ei} = m(z + 1.5)$
- 圆齿根：$c_{int} = 1.80$ → $D_{ei} = m(z + 1.8)$

**② 内花键小径（齿顶圆）基本值**

$$D_{ii} =D_{Fe\ max} +2C_F$$

### 3.2 内花键渐开线终止圆直径最小值 $D_{Fi\ min}$

**函数**: `calcInternalFormDiameter(m, z, D_ei, D_ee_mate)`  
**源文件**: `calc.js:223-230`

$$D_{Fi\ min} = m(z+1)+2c_F$$

其中 $c_F = 0.1m$（齿形裕度）。

---

## 4. 公差体系

**依据**: GB/T 3478.1-2008 第8章  
**函数**: `calcToleranceUnit_D`, `calcToleranceUnit_S`, `calcTotalTolerance`, `calcComprehensiveTolerance`

### 4.1 公差单位

**① 基于直径的公差单位** (公式3)

$$i^* = \begin{cases} 0.45\sqrt[3]{D} + 0.001D & (D \leq 500\text{mm}) \\ 0.004D + 2.1 & (D > 500\text{mm}) \end{cases} \quad [\mu\text{m}]$$

**② 基于齿厚/齿槽宽的公差单位** (公式4)

$$i^{**} = 0.45\sqrt[3]{S} + 0.001S \quad [\mu\text{m}]$$

### 4.2 总公差 $(T+\lambda)$

**依据**: GB/T 3478.1-2008 表8  
**函数**: `calcTotalTolerance(D, S_or_E, grade, gradeData)`

$$T + \lambda = K_1 \cdot i^* + K_2 \cdot i^{**} \quad [\mu\text{m}]$$

**公差等级系数**:

| 等级 | 名称 | 加工方法 | K₁ | K₂ |
|------|------|----------|----|----|
| 4 | 精密级 | 磨削 | 10 | 40 |
| 5 | 精密级 | 磨削/精密拉削 | 16 | 64 |
| 6 | 标准级 | 拉削/滚齿 | 25 | 100 |
| 7 | 普通级 | 一般机械加工 | 40 | 160 |

### 4.3 单项公差

**函数**: `calcComprehensiveTolerance(m, z, D, L_eng, gradeData)`  
**源文件**: `calc.js:304-331`

**① 齿距累积公差** $F_p$（第8.4节）
$$F_p = f_{pA} \cdot \sqrt{L} + f_{pB} \quad [\mu\text{m}]$$

其中：
- $L = \frac{\pi m z}{2}$ — 分度圆周长之半 [mm]
- $f_{pA}$、$f_{pB}$ 按公差等级查表

| 等级 | f_pA | f_pB |
|------|------|------|
| 4 | 2.5 | 6.3 |
| 5 | 3.55 | 9 |
| 6 | 5.0 | 12.5 |
| 7 | 7.1 | 18 |

**② 齿形公差** $f_f$（第8.5节）
$$f_f = f_{fA} \cdot \phi + f_{fB} \quad [\mu\text{m}]$$

其中 $\phi = m + 0.0125 \cdot m \cdot z$ — 公差因数 [mm]

| 等级 | f_fA | f_fB |
|------|------|------|
| 4 | 1.6 | 10 |
| 5 | 2.5 | 16 |
| 6 | 4.0 | 25 |
| 7 | 6.3 | 40 |

**③ 齿向公差** $F_\beta$（第8.6节）
$$F_\beta = f_{\beta A} \cdot \sqrt{g} + f_{\beta B} \quad [\mu\text{m}]$$

其中 $g = L_{eng}$ — 配合长度 [mm]

| 等级 | f_βA | f_βB |
|------|------|------|
| 4 | 0.8 | 4 |
| 5 | 1.0 | 5 |
| 6 | 1.25 | 6.3 |
| 7 | 2.0 | 10 |

**④ 综合公差** $\lambda$
$$\lambda = 0.6 \sqrt{F_p^2 + f_f^2 + F_\beta^2} \quad [\mu\text{m}]$$

**⑤ 加工公差** $T$
$$T = (T + \lambda) - \lambda \quad [\mu\text{m}]$$

---

## 5. 齿厚与齿槽宽极限尺寸

**依据**: GB/T 3478.1-2008 第7章 + 第8章

### 5.1 基本偏差 es_v（作用齿厚上偏差）

**函数**: `calcFundamentalDeviation(D, fitType, totalTol)` + `lookupEsV()`  
**源文件**: `calc.js:348-354`, `data.js:232-255`

es_v 由配合类别和分度圆直径 D 决定：

| 配合代号 | 性质 | es_v 取值规则 |
|----------|------|---------------|
| h | 滑动配合 | es_v = 0（所有直径段） |
| f | 紧滑动配合 | 负值，查表23 |
| e | 转动配合 | 负值，查表23 |
| d | 松转动配合 | 负值，查表23 |
| k | 过渡配合 | es_v = +(T+λ) |
| js | 过渡配合(对称) | es_v = +(T+λ)/2 |

**数据表**: `ESV_TABLE` (data.js:205-223)，按 D 分段 `[6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500]` mm

| D ≤ (mm) | f | e | d |
|-----------|---|---|----|
| 6 | -10 | -20 | -30 |
| 10 | -13 | -25 | -40 |
| 18 | -16 | -32 | -50 |
| 30 | -20 | -40 | -65 |
| 50 | -25 | -50 | -80 |
| 80 | -30 | -60 | -100 |
| 120 | -36 | -72 | -120 |
| 180 | -43 | -85 | -145 |
| 250 | -50 | -100 | -170 |
| 315 | -56 | -110 | -190 |
| 400 | -62 | -125 | -210 |
| 500 | -68 | -135 | -230 |

### 5.2 外花键齿厚极限尺寸

**函数**: `calcToothThicknessLimits(S_basic, es_v, lambda, totalTol)`  
**源文件**: `calc.js:378-408`

实际齿厚上偏差：
$$es = es_v - \lambda \quad [\mu\text{m}]$$

实际齿厚下偏差：
$$ei = es_v - (T + \lambda) \quad [\mu\text{m}]$$

作用齿厚最大值：
$$S_{v\ max} = S_{basic} + \frac{es_v}{1000} \quad [\text{mm}]$$

实际齿厚最大值：
$$S_{max} = S_{basic} + \frac{es_v}{1000} - \frac{\lambda}{1000} \quad [\text{mm}]$$

实际齿厚最小值：
$$S_{min} = S_{basic} + \frac{es_v}{1000} - \frac{T+\lambda}{1000} \quad [\text{mm}]$$

### 5.3 内花键齿槽宽极限尺寸

**函数**: `calcSpaceWidthLimits(E_basic, lambda, totalTol)`  
**源文件**: `calc.js:427-455`

内花键采用基孔制 H（EI = 0）：

作用齿槽宽下偏差：$EI_v = 0$

作用齿槽宽最小值：
$$E_{vmin} = E_{basic} [\text{mm}]$$

作用齿槽宽最大值：
$$E_{vmax} = E_{max} - \lambda[\text{mm}]$$

实际齿槽宽最小值：
$$E_{min} = E_{basic} + \frac{\lambda}{1000} \quad [\text{mm}]$$

实际齿槽宽最大值：
$$E_{max} = E_{basic} + \frac{T+\lambda}{1000} \quad [\text{mm}]$$

### 5.4 配合侧隙

最大侧隙：
$$B_{max} = E_{max} - S_{min} \quad [\text{mm}]$$

最小侧隙：
$$B_{min} = E_{min} - S_{max} \quad [\text{mm}]$$

---

## 6. 量棒测量（跨棒距/棒间距）

**依据**: GB/T 3478.5-2008  
**函数**: `calcMeasurementOverPins()`, `calcMeasurementBetweenPins()`

### 6.1 量棒直径自动推荐

**函数**: `getRecommendedPinDiameter(m)`  
**源文件**: `data.js:412-437`

理论最佳量棒直径（30° 压力角）：
$$D_{R\ theory} = 1.732m \quad [\text{mm}]$$

从 R40 优先数系（0.5~20mm）中选取最接近的标准量棒。

### 6.2 外花键跨棒距 $M_{Re}$

**函数**: `calcMeasurementOverPins(m, z, D, Db, S, pinDia, invAlpha)`  
**源文件**: `calc.js:481-517`

**Step 1**: 求解量棒中心压力角 $\alpha_e$

$$\text{inv}(\alpha_e) = \frac{S}{D} + \text{inv}(\alpha_D) + \frac{D_R}{D_b} - \frac{\pi}{z}$$

**Step 2**: 牛顿迭代反求 $\alpha_e$

牛顿迭代公式：
$$\alpha_{n+1} = \alpha_n - \frac{\tan\alpha_n - \alpha_n - \text{inv}}{\tan^2\alpha_n}$$

初始估计：$\alpha_0 \approx \sqrt[3]{3 \cdot |\text{inv}|}$

收敛条件：$|\Delta| < 10^{-15}$，最多 20 次迭代

**Step 3**: 跨棒距计算

偶齿数：
$$M_{Re} = \frac{D_b}{\cos\alpha_e} + D_R \quad [\text{mm}]$$

奇齿数：
$$M_{Re} = \frac{D_b}{\cos\alpha_e} \cdot \cos\frac{90°}{z} + D_R \quad [\text{mm}]$$

> **边界条件**: 当 $\text{inv}(\alpha_e) \leq 0$ 时，量棒直径过小，接触点不在渐开线齿面上，需增大量棒直径。

### 6.3 内花键棒间距 $M_{Ri}$

**函数**: `calcMeasurementBetweenPins(m, z, D, Db, E, pinDia, invAlpha)`  
**源文件**: `calc.js:538-568`

**Step 1**: 求解量棒中心压力角 $\alpha_i$

$$\text{inv}(\alpha_i) = \frac{E}{D} + \text{inv}(\alpha_D) - \frac{D_R}{D_b}$$

**Step 2**: 牛顿迭代反求（同上）

**Step 3**: 棒间距计算

偶齿数：
$$M_{Ri} = \frac{D_b}{\cos\alpha_i} - D_R \quad [\text{mm}]$$

奇齿数：
$$M_{Ri} = \frac{D_b}{\cos\alpha_i} \cdot \cos\frac{90°}{z} - D_R \quad [\text{mm}]$$

> **边界条件**: 当 $\text{inv}(\alpha_i) \leq 0$ 时，量棒直径过大，接触点不在渐开线齿面上，需减小量棒直径。

---

## 7. 直径公差（大径/小径）

**依据**: GB/T 3478.1-2008 表24+表25, GB/T 1800.4-2009

### 7.1 外花键大径 $D_{ee}$ 公差

**上偏差$$es_v/tan\alpha_D$$**: 查表24（`ESV_TAN_TABLE`，data.js:269-277）

| D ≤ (mm) | f | e | d |
|-----------|---|---|----|
| 6 | -17 | -35 | -52 |
| 10 | -23 | -43 | -69 |
| 18 | -28 | -55 | -87 |
| 30 | -35 | -69 | -113 |
| 50 | -43 | -87 | -139 |
| 80 | -52 | -104 | -173 |
| 120 | -62 | -125 | -208 |
| 180 | -74 | -147 | -251 |
| 250 | -87 | -170 | -294 |
| 315 | -97 | -190 | -329 |
| 400 | -107 | -210 | -364 |
| 500 | -118 | -230 | -398 |

k配合：$+ (T+\lambda) / \tan 30°$  
js配合：$+ (T+\lambda) / (2\tan 30°)$  
h配合：0

**公差**: 查表25（`TABLE25`，data.js:319-331），按模数分段和直径分段直接查取离散值 (μm)

### 表25 内花键小径$D_\mathrm{ii}$极限偏差和外花键大径$D_\mathrm{ee}$公差

单位：微米

| 直径 $D_\mathrm{ii}$ 和 $D_\mathrm{ee}$ / mm | 模数 0.25～0.75<br>内花键 H10 | 模数 1～1.75<br>内花键 H11 | 模数 2～10<br>内花键 H12 | 模数 0.25～0.75<br>外花键 IT10 | 模数 1～1.75<br>外花键 IT11 | 模数 2～10<br>外花键 IT12 |
| :------------------------------------------: | :---------------------------: | :------------------------: | :----------------------: | :----------------------------: | :-------------------------: | :-----------------------: |
|                   $\le 6$                    |         $^{+48}_{0}$          |             —              |            —             |               48               |              —              |             —             |
|                   $>6～10$                   |         $^{+58}_{0}$          |        $^{+90}_{0}$        |            —             |               58               |              —              |             —             |
|                  $>10～18$                   |         $^{+70}_{0}$          |       $^{+110}_{0}$        |      $^{+180}_{0}$       |               70               |             110             |             —             |
|                  $>18～30$                   |         $^{+84}_{0}$          |       $^{+130}_{0}$        |      $^{+210}_{0}$       |               84               |             130             |            210            |
|                  $>30～50$                   |         $^{+100}_{0}$         |       $^{+160}_{0}$        |      $^{+250}_{0}$       |              100               |             160             |            250            |
|                  $>50～80$                   |         $^{+120}_{0}$         |       $^{+190}_{0}$        |      $^{+300}_{0}$       |              120               |             190             |            300            |
|                  $>80～120$                  |               —               |       $^{+220}_{0}$        |      $^{+350}_{0}$       |               —                |             220             |            350            |
|                 $>120～180$                  |               —               |       $^{+250}_{0}$        |      $^{+400}_{0}$       |               —                |             250             |            400            |
|                 $>180～250$                  |               —               |             —              |      $^{+460}_{0}$       |               —                |              —              |            460            |
|                 $>250～315$                  |               —               |             —              |      $^{+520}_{0}$       |               —                |              —              |            520            |
|                 $>315～400$                  |               —               |             —              |      $^{+570}_{0}$       |               —                |              —              |            570            |
|                 $>400～500$                  |               —               |             —              |      $^{+630}_{0}$       |               —                |              —              |            630            |
|                 $>500～630$                  |               —               |             —              |      $^{+700}_{0}$       |               —                |              —              |            700            |
|                 $>630～800$                  |               —               |             —              |      $^{+800}_{0}$       |               —                |              —              |            800            |
|                 $>800～1000$                 |               —               |             —              |      $^{+900}_{0}$       |               —                |              —              |            900            |

外花键大径极限：
$$D_{ee\ max} = D_{ee\ basic} + \text{上偏差}$$
$$D_{ee\ min} = D_{ee\ max} - \text{公差}$$

### 7.2 外花键小径 $D_{ie}$ 公差

上偏差和公差原则同大径（表24 + 表25）。

### 7.3 内花键大径 $D_{ei}$（IT公式回退）

**公差等级**: 按大径尺寸从表中选取（`INT_MAJOR_TOL_GRADE`）

| 公称尺寸段 (mm) | IT12(μm) | IT13(μm) | IT14(μm) |
| --------------- | -------- | -------- | -------- |
| 0～6            | 120      | 180      | 300      |
| 6～10           | 150      | 220      | 360      |
| 10～18          | 180      | 270      | 430      |
| 18～30          | 210      | 330      | 520      |
| 30～50          | 250      | 390      | 620      |
| 50～80          | 300      | 460      | 740      |
| 80～120         | 350      | 540      | 870      |
| 120～180        | 400      | 630      | 1000     |
| 180～250        | 460      | 720      | 1150     |
| 250～315        | 520      | 810      | 1300     |
| 315～400        | 570      | 890      | 1400     |
| 400～500        | 630      | 970      | 1550     |

IT 公差表（GB/T 1800.4-2009）：
$$IT$$从表 `IT_MULTIPLIERS` 查取：

内花键大径（H偏差）：
$$D_{ei\ max} = D_{ei\ basic} + \text{IT}$$
$$D_{ei\ min} = D_{ei\ basic}$$

### 7.4 内花键小径 $D_{ii}$ 公差

H偏差（下偏差=0），上偏差查表25。

---

## 8. 强度校核 — 《机械设计手册》简化公式

**依据**: 《机械设计手册》第五版 第2卷(轴)、第3卷(花键)  
**函数**: `checkContactStrength`, `checkBendingStrength`, `checkShearStrength`, `checkWear10e8`, `checkWearFreeLongTerm`, `checkShaftTorsion`, `checkShaftBending`

### 8.1 转矩推算

**函数**: `calcTorqueFromPower(power_kW, speed_rpm)`  
**源文件**: `calc.js:668-671`

$$T = 9550 \times \frac{P}{n} \quad [\text{N·m}]$$

### 8.2 齿面接触（挤压）强度

**函数**: `checkContactStrength(torque, z, h, l, D_m, psi)`  
**源文件**: `calc.js:588-598`

$$\sigma_H = \frac{2000 \cdot T}{\psi \cdot z \cdot h \cdot l \cdot D_m} \quad [\text{MPa}]$$

| 参数 | 含义 | 取值 |
|------|------|------|
| ψ | 载荷不均系数 | 0.75（8齿以上均载） |
| h | 齿面接触高度 | $(D_{ee} - D_{ii}) / 2$ |
| l | 配合长度 | 输入值（默认1×D） |
| D_m | 平均直径 | ≈ D（分度圆直径） |

### 8.3 齿根弯曲强度

**函数**: `checkBendingStrength(torque, z, h, l, D_m, S_fn, psi)`  
**源文件**: `calc.js:616-625`

$$\sigma_F = \frac{6000 \cdot T \cdot h}{\psi \cdot z \cdot S_{fn}^2 \cdot l \cdot D_m} \quad [\text{MPa}]$$

其中 $S_{fn} \approx \frac{\pi m}{2}$ — 齿根弦齿厚近似值

### 8.4 齿根抗剪强度

**函数**: `checkShearStrength(torque, z, S_fn, l, D_m, psi)`  
**源文件**: `calc.js:690-699`

$$\tau = \frac{2000 \cdot T}{\psi \cdot z \cdot S_{fn} \cdot l \cdot D_m} \quad [\text{MPa}]$$

### 8.5 10⁸ 循环磨损校核（p·v 值法）

**函数**: `checkWear10e8(sigma_H, speed_rpm, h_contact, D)`  
**源文件**: `calc.js:720-744`

滑动速度：
$$v_s = \frac{\pi \cdot h \cdot n}{60000} \quad [\text{m/s}]$$

p·v 值：
$$p \cdot v = \sigma_H \times v_s \quad [\text{MPa·m/s}]$$

10⁸ 循环达到时间：
$$t = \frac{10^8}{n \times 60} \quad [\text{hours}]$$

总滑动距离：
$$L_s = v_s \times t \times 3600 \quad [\text{m}]$$

判定条件：$p \cdot v \leq [p \cdot v]$（许用值见材料表）

### 8.6 长期工作无磨损校核

**函数**: `checkWearFreeLongTerm(sigma_H, allowableWearFreeContact)`  
**源文件**: `calc.js:762-774`

$$\sigma_H \leq [\sigma_{Hw}]$$

裕度：
$$m = \frac{[\sigma_{Hw}]}{\sigma_H}$$

> 机理：当接触应力低于材料微动磨损门槛值时，即使在长期交变载荷下也不会发生显著的材料转移和氧化磨损。

### 8.7 外花键轴扭转强度

**函数**: `checkShaftTorsion(torque, D_ie_min)`  
**源文件**: `calc.js:791-805`

抗扭截面模量：
$$W_t = \frac{\pi d^3}{16} \quad (d = D_{ie\ min},\ \text{实心轴})\ [\text{mm}^3]$$

扭转切应力：
$$\tau_{max} = \frac{1000 \cdot T}{W_t} = \frac{16000 \cdot T}{\pi \cdot D_{ie}^3} \quad [\text{MPa}]$$

### 8.8 外花键轴弯扭合成

**函数**: `checkShaftBending(torque, D_ie_min, bendingMoment)`  
**源文件**: `calc.js:823-852`

抗弯截面模量：
$$W_b = \frac{\pi d^3}{32} \quad [\text{mm}^3]$$

弯曲应力（当 M>0 时）：
$$\sigma_b = \frac{1000 \cdot M}{W_b} \quad [\text{MPa}]$$

弯扭合成应力（第四强度理论）：
$$\sigma_e = \sqrt{\sigma_b^2 + 3\tau^2} \quad [\text{MPa}]$$

### 8.9 通用判定函数

**函数**: `evaluateCheck(actual, allowable, safetyQualified, safetyWarning)`  
**源文件**: `calc.js:862-877`

安全系数：
$$n = \frac{[\sigma]}{\sigma}$$

| 判定 | 条件 |
|------|------|
| 合格 | n ≥ qualified 阈值 |
| 警告 | warning ≤ n < qualified |
| 不合格 | n < warning |

---

## 9. GB/T 17855-1999 花键承载能力计算

**依据**: GB/T 17855-1999《花键承载能力计算方法》  
**函数**: `calcGB17855All(params)` 及其子函数  
**源文件**: `calc.js:880-1299`

### 9.1 计算流程总览

```
P, n  ──→ [公式1] T ──→ [公式2] F_t ──→ [公式3] W ──→ [公式4] σ_H ──→ 接触校核
                                                     ├──→ [公式6] σ_F ──→ 弯曲校核 (需S_Fn)
                  T ──→ [公式7] τ_tn ──→ [公式9] α_tn·τ_tn ──→ 剪切校核
                  σ_H ──→ 表4/表5 ──→ 耐磨校核
```

### 9.2 载荷计算

**Step a) 转矩** (公式1)

$$T = 9549 \times \frac{P}{n} \quad [\text{N·m}]$$

> **注意**: GB/T 17855-1999 使用系数 **9549**（$60000/(2\pi)$），非 9550。

**Step b) 名义切向力** (公式2)

$$F_t = \frac{2000 \cdot T}{D} \quad [\text{N}]$$

**函数**: `calcNominalTangentialForce(T, D)` → `calc.js:907-909`

**Step c) 单位载荷** (公式3)

$$W = \frac{F_t}{z \cdot l \cdot \cos\alpha_D} \quad [\text{N/mm}]$$

**函数**: `calcUnitLoad(Ft, z, l, alphaD_deg)` → `calc.js:922-925`

### 9.3 齿面接触强度

**Step d) 齿面压应力** (公式4)

$$\sigma_H = \frac{W}{h_w} \quad [\text{MPa}]$$

**函数**: `calcContactStressGB17855(W, h_w)` → `calc.js:936-938`

其中 $h_w$ — 工作齿高 (mm)，标准基本齿廓 $h_w = m$。

**Step e) 许用接触应力** (公式10)

$$[\sigma_H] = \frac{\sigma_{0.2}}{S_H \cdot K_1 \cdot K_2 \cdot K_3 \cdot K_4} \quad [\text{MPa}]$$

**函数**: `calcAllowableStressGB(sigmaRef, S, K1, K2, K3, K4)` → `calc.js:1101-1103`

判定：$\sigma_H \leq [\sigma_H]$

### 9.4 齿根弯曲强度

**Step f) 齿根弦齿厚 $S_{Fn}$ — 渐开线几何精确法** (公式5)

$$S_{Fn} = D_{Fe} \times \sin\left[ \frac{S}{D} + \text{inv}\alpha_D - \text{inv}\left(\arccos\frac{D \cdot \cos\alpha_D}{D_{Fe}}\right) \right] \quad [\text{mm}]$$

**函数**: `calcToothRootChordThickness(D, D_Fe, S_basic, alphaD_deg)` → `calc.js:959-998`

**中间步骤详解**:

| 步骤 | 变量 | 公式 |
|------|------|------|
| f1 | $\alpha_D$ (rad) | $\alpha_D° \times \pi/180$ |
| f2 | $\cos\alpha_D$ | $\cos\alpha_D$ |
| f3 | $\text{inv}\alpha_D$ | $\tan\alpha_D - \alpha_D$ |
| f4 | $S/D$ | $S_{basic}/D$ |
| f5 | $\arccos$ 参数 | $D \cdot \cos\alpha_D / D_{Fe}$ |
| f6 | $\alpha_{Fe}$ (rad) | $\arccos(\text{f5})$ |
| f7 | $\text{inv}\alpha_{Fe}$ | $\tan\alpha_{Fe} - \alpha_{Fe}$ |
| f8 | bracket (rad) | $\text{f4} + \text{f3} - \text{f7}$ |
| f9 | **$S_{Fn}$** | $D_{Fe} \times \sin(\text{f8})$ |

> **边界保护**: 当 $D_{Fe}$ 略小于 $D_b$ 时，$\arccos$ 参数可能 ≥ 1.0，此时钳位为 0.9999999999。

**Step g) 齿根弯曲应力** (公式6)

$$\sigma_F = \frac{6 \cdot h \cdot W \cdot \cos\alpha_D}{S_{Fn}^2} \quad [\text{MPa}]$$

**函数**: `calcBendingStressGB17855(h, W, alphaD_deg, S_Fn)` → `calc.js:1011-1014`

**Step h) 许用弯曲应力** (公式10)

$$[\sigma_F] = \frac{\sigma_b}{S_F \cdot K_1 \cdot K_2 \cdot K_3 \cdot K_4} \quad [\text{MPa}]$$

判定：$\sigma_F \leq [\sigma_F]$

### 9.5 齿根剪切强度

**Step i) 当量应力圆直径** (公式8)

$$d_h = D_{ie} + K \times D_{ie} \times \frac{D_{ee} - D_{ie}}{D_{ee}} \quad (K = 0.15) \quad [\text{mm}]$$

式中系数 K 取自下表

| 花键类型         | K 值 |
| ---------------- | ---- |
| 轻系列矩形花键   | 0.50 |
| 中系列矩形花键   | 0.45 |
| 较少齿渐开线花键 | 0.30 |
| 较多齿渐开线花键 | 0.15 |

**函数**: `calcEquivalentDiameterDh(D_ie, D_ee, K)` → `calc.js:1028-1031`

**Step j) 名义剪切应力** (公式7)

$$\tau_{tn} = \frac{16000 \cdot T}{\pi \cdot d_h^3} \quad [\text{MPa}]$$

**函数**: `calcNominalShearStressTauTn(T, dh)` → `calc.js:1042-1044`

**Step k) 齿根应力集中系数** (公式9)

$$\alpha_{tn} = \frac{D_{ie}}{d_h} \times \left\{ 1 + 0.17\frac{h}{\rho}\left[1 + \frac{3.94}{0.1 + h/\rho}\right] + \frac{6.38(1 + 0.1 \cdot h/\rho)}{\left[2.38 + \frac{D_{ie}}{2h}(h/\rho + 0.04)^{1/3}\right]^2} \right\}$$

**函数**: `calcStressConcentrationFactor(D_ie, dh, h, rho)` → `calc.js:1061-1086`

**中间变量分解**:

| 变量 | 公式 |
|------|------|
| ratio | $h / \rho$ |
| bracket1 | $1 + 3.94/(0.1 + \text{ratio})$ |
| term1 | $1 + 0.17 \times \text{ratio} \times \text{bracket1}$ |
| inner | $2.38 + (D_{ie}/(2h)) \times (\text{ratio} + 0.04)^{1/3}$ |
| term2 | $6.38 \times (1 + 0.1 \times \text{ratio}) / \text{inner}^2$ |
| **α_tn** | $(D_{ie}/d_h) \times (\text{term1} + \text{term2})$ |

**Step l) 最大齿根剪切应力**

$$\tau_{Fmax} = \tau_{tn} \times \alpha_{tn} \quad [\text{MPa}]$$

许用剪切应力：
$$[\tau_F] = \frac{[\sigma_F]}{2} \quad [\text{MPa}]$$

判定：$\tau_{Fmax} \leq [\tau_F]$

### 9.6 齿面耐磨能力

**① 10⁶ 循环耐磨** (表4)

$$[\sigma_{H1}] = \text{查表4按材料/热处理} \quad [\text{MPa}]$$

**函数**: `lookupWearAllowable10e6(wearGrade)` → `data.js:620-623`

表4$ [\sigma_{H1}]$值  MPa

| 未经热处理 | 调质处理 | 淬火  |       |       | 渗碳 (氮) 淬火 |
| ---------- | -------- | ----- | ----- | ----- | -------------- |
| 20HRC      | 28HRC    | 40HRC | 45HRC | 50HRC | 60HRC          |
| 95         | 110      | 135   | 170   | 185   | 205            |

判定：$\sigma_H \leq [\sigma_{H1}]$ → 10⁶ 循环无显著磨损

**② 长期工作无磨损** (表5)

表5$ [\sigma_{H2}]$值  MPa

| 热处理方式     | [σH2] 计算公式    |
| -------------- | ----------------- |
| 未经热处理     | 0.028× 布氏硬度值 |
| 调质处理       | 0.032× 布氏硬度值 |
| 淬火           | 0.3× 洛氏硬度值   |
| 渗碳 (氮) 淬火 | 0.4× 洛氏硬度值   |

**函数**: `calcWearAllowableLongTerm(HB)` → `data.js:630-632`

判定：$\sigma_H \leq [\sigma_{H2}]$ → 长期工作无明显磨损



### 9.7 外花键扭转与弯曲合成

**弯扭合成当量应力** (公式13)

$$\sigma_v = \sqrt{\sigma_{Fn}^2 + 3 \cdot \tau_{tn}^2} \quad [\text{MPa}]$$

**函数**: `calcCombinedStressGB17855(sigmaFn, tauTn)` → `calc.js:1116-1118`
$$\sigma_{Fn} = \frac{32000 \cdot M_b}{\pi \cdot D_{ie}^3} \quad [\text{MPa}]$$

$$\tau_{tn} = \frac{16000 \cdot T}{\pi \cdot d_h^3} \quad [\text{MPa}]$$

许用当量应力：
$$[\sigma_v] = \frac{\sigma_{0.2}}{S_F \cdot K_1 \cdot K_2 \cdot K_3 \cdot K_4} \quad [\text{MPa}]$$

判定：$\sigma_v \leq [\sigma_v]$

### 9.8 工况系数说明

**数据表**: `GB17855_APP_TYPES` (data.js:545-576)

要求这以下系数可以页面推荐，也可以给用与自定义选择

使用系数 $K_1$

该系数可以通过精密测量获得，也可经过对全系统分析后确定。在上述方法不能实现时，可参考表取值。

| 原动机（输入端） | 工作机(输出端) |          |            |
| :--------------- | :------------: | :------: | :--------: |
|                  |   均匀、平稳   | 中等冲击 |  严重冲击  |
| 均匀、平稳       |      1.00      |   1.25   | 1.75或更大 |
| 轻微冲击         |      1.25      |   1.50   | 2.00或更大 |
| 中等冲击         |      1.50      |   1.75   | 2.25或更大 |

**注**
1  均匀平稳的原动机：电动机、蒸汽轮机、燃气轮机等；
2  轻微冲击的原动机：多缸内燃机等；
3  中等冲击的原动机：单缸内燃机等；
4  均匀平稳的工作机：电动机、皮带输送机、通风机、透平压缩机、均匀密度材料搅拌机等；
5  中等冲击的工作机：机床主传动、非均匀密度材料搅拌机、多缸柱塞泵、航空或舰船螺旋桨等；
6  严重冲击的工作机：冲床、剪床、轧机、钻机等。

齿侧间隙系数 $K_2$

此影响用齿侧间隙系数 $K_2$ 予以考虑。通常 $K_2=1.1\sim3.0$。

- 当压轴力较小、花键副的精度较高时，可取 $K_2=1.1\sim1.5$；
- 当压轴力较大、花键副的精度较低时，可取 $K_2=2.0\sim3.0$；
- 当压轴力为零、只承受转矩时(见图2)，$K_2=1.0$。

---

分配系数 $K_3$

花键副的内花键和外花键的两轴线在同轴状态下，由于其齿距累积误差(分度误差)的影响，使花键副的理论侧隙(单齿侧隙)不同，各键齿所受载荷也不同。

这种影响用分配系数 $K_3$ 予以考虑：

- 对于磨合前的花键副，精度较高时(按GB/T 1144为精密级矩形花键，或按GB/T 3478.1为5级及以上精度)，$K_3=1.1\sim1.2$；
- 精度较低时(按GB/T 1144为一般用矩形花键，或按GB/T 3478.1精度低于5级)，$K_3=1.3\sim1.6$；
- 对于磨合后的花键副，各键齿均参与工作且受载荷基本相同时，取 $K_3=1.0$。

---

轴向偏载系数 $K_4$

由于花键副在制造时产生的齿向误差和安装后的同轴度误差，以及受载后的扭转变形，使各键齿沿轴向所受载荷不均匀。用轴向偏载系数 $K_4$ 予以考虑，其值可从表中选取。



| 系列或模数 $m$<br>单位：mm                   | 分度圆直径 $D$ / 平均圆直径 $d_m$<br>单位：mm |      $l/D$ 或 $l/d_m$       |                            |                            |
| :------------------------------------------- | :-------------------------------------------: | :-------------------------: | :------------------------: | :------------------------: |
|                                              |                                               | $\boldsymbol{\leqslant1.0}$ | $\boldsymbol{>1.0\sim1.5}$ | $\boldsymbol{>1.5\sim2.0}$ |
| **轻系列或**<br>$\boldsymbol{m\leqslant2}$   |                 $\leqslant30$                 |        $1.1\sim1.3$         |        $1.2\sim1.6$        |        $1.3\sim1.7$        |
|                                              |                  $>30\sim50$                  |        $1.2\sim1.5$         |        $1.4\sim2.0$        |        $1.5\sim2.3$        |
|                                              |                  $>50\sim80$                  |        $1.3\sim1.7$         |        $1.6\sim2.4$        |        $1.7\sim2.9$        |
|                                              |                 $>80\sim120$                  |        $1.4\sim1.9$         |        $1.8\sim2.8$        |        $1.9\sim3.5$        |
|                                              |                    $>120$                     |        $1.5\sim2.1$         |        $2.0\sim3.2$        |        $2.1\sim4.1$        |
| **中系列或**<br>$\boldsymbol{2<m\leqslant5}$ |                 $\leqslant30$                 |        $1.2\sim1.6$         |        $1.3\sim2.1$        |        $1.4\sim2.4$        |
|                                              |                  $>30\sim50$                  |        $1.3\sim1.8$         |        $1.5\sim2.5$        |        $1.6\sim3.0$        |
|                                              |                  $>50\sim80$                  |        $1.4\sim2.0$         |        $1.7\sim2.9$        |        $1.8\sim3.6$        |
|                                              |                 $>80\sim120$                  |        $1.5\sim2.2$         |        $1.9\sim3.3$        |        $2.0\sim4.2$        |
|                                              |                    $>120$                     |        $1.6\sim2.4$         |        $2.1\sim3.6$        |        $2.2\sim4.8$        |
| $\boldsymbol{5<m\leqslant10}$                |                 $\leqslant30$                 |        $1.3\sim2.0$         |        $1.3\sim2.8$        |        $1.5\sim3.4$        |
|                                              |                  $>30\sim50$                  |        $1.4\sim2.2$         |        $1.6\sim3.2$        |        $1.7\sim4.0$        |
|                                              |                  $>50\sim80$                  |        $1.5\sim2.4$         |        $1.8\sim3.6$        |        $1.9\sim4.6$        |
|                                              |                 $>80\sim120$                  |        $1.6\sim2.6$         |        $2.0\sim3.9$        |        $2.1\sim5.2$        |
|                                              |                    $>120$                     |        $1.7\sim2.8$         |        $2.2\sim4.2$        |        $2.3\sim5.6$        |

> 内容出自 **GB/T 17855—1999** 花键承载能力计算标准。

- **S_H**: 齿面接触强度安全系数（1.25~1.5）
- **S_F**: 齿根弯曲强度安全系数（1.25~2.00）

---

## 10. 材料与安全系数

### 10.1 预设材料许用值

**数据表**: `MATERIAL_PROPERTIES` (data.js:492-533)

材料提供自定义窗口，可用用户自行设定

---

## 11. 数据表索引

| 数据表 | 位置 | 来源 | 用途 |
|--------|------|------|------|
| `BASIC_PROFILE_30` | data.js:21-46 | GB/T 3478.1 表1 | 基本齿廓参数 |
| `MODULE_SERIES` | data.js:56-62 | GB/T 3478.1 第4章 | 标准模数系列 |
| `TOLERANCE_GRADES` | data.js:82-131 | GB/T 3478.1 表8 | 公差等级 K1/K2/单项系数 |
| `FIT_TYPES` | data.js:143-186 | GB/T 3478.1 第7章 | 6种配合类别定义 |
| `ESV_TABLE` | data.js:205-223 | GB/T 3478.1 表23 | es_v 作用齿厚上偏差 |
| `ESV_TAN_TABLE` | data.js:269-277 | GB/T 3478.1 表24 | 外花键大径上偏差 |
| `TABLE25` | data.js:319-331 | GB/T 3478.1 表25 | 大径/小径公差离散值 |
| `IT_MULTIPLIERS` | data.js:398-401 | GB/T 1800.4 | IT等级乘数 |
| `MATERIAL_PROPERTIES` | data.js:492-533 | 《机械设计手册》 | 材料许用值 |
| `SAFETY_STANDARDS` | data.js:443-472 | 各行业标准 | 安全系数阈值 |
| `GB17855_APP_TYPES` | data.js:545-576 | GB/T 17855 表1~4 | 工况系数 K1~K4 |
| `GB17855_WEAR_TABLE4` | data.js:582-603 | GB/T 17855 表4 | 10⁶ 循环许用压应力 |
| `GB17855_WEAR_TABLE5` | data.js:610-613 | GB/T 17855 表5 | 长期无磨损系数 |

---

## 12. 标准验证用例

### 12.1 几何验证 — GB/T 3478.1-2008 附录C

5 个标准验证用例，均使用 **m=1.0, z=25, L=12.5mm**：

| 用例 | 类型 | 等级 | 配合 | 齿根 | 验证项目 |
|------|------|------|------|------|----------|
| C.1 | INT | 5 | H | 平 | 内花键基本参数+公差 |
| C.2 | INT | 7 | H | 圆 | 内花键公差对比 |
| C.3 | EXT | 4 | h | 圆 | 外花键基本参数+公差 |
| C.4 | EXT | 6 | e | 圆 | 外花键配合间隙 |
| C.5 | EXT | 5 | js | 平 | 过渡配合对称公差 |

### 12.2 强度验证 — GB/T 17855-1999 第7章 例1

**花键规格**: INT/EXT **44Z×2m×30R×5H/5h**

| 参数 | 值 |
|------|-----|
| 模数 m | 2 mm |
| 齿数 z | 44 |
| 分度圆直径 D | 88 mm |
| 配合长度 l | 32 mm |
| 传递功率 P | 1500 kW |
| 转速 n | 1250 rpm |
| 材料 | 优质合金钢 σ_0.2≥835 MPa, σ_b≥980 MPa, HB 293-341 |
| 工况 | 燃气轮机→螺旋桨 K1=1.25, K2=1.1, K3=1.1, K4=1.5, S_H=1.25, S_F=1.0 |

**期望计算结果**:

| 步骤 | 项目 | 符号 | 期望值 | 函数 |
|------|------|------|--------|------|
| a | 转矩 | T | 11458.8 N·m | `calcTorqueFromPowerGB` |
| b | 名义切向力 | F_t | 260427 N | `calcNominalTangentialForce` |
| c | 单位载荷 | W | 213.6 N/mm | `calcUnitLoad` |
| d | 齿面压应力 | σ_H | 106.8 MPa | `calcContactStressGB17855` |
| d | 许用接触应力 | [σ_H] | 294.4 MPa | `calcAllowableStressGB` |
| e | 齿根弦齿厚 | S_Fn | 4.2977 mm | `calcToothRootChordThickness` |
| e | 齿根弯曲应力 | σ_F | 168.3 MPa | `calcBendingStressGB17855` |
| e | 许用弯曲应力 | [σ_F] | 432 MPa | `calcAllowableStressGB` |
| f | 当量应力圆直径 | d_h | 85.2 mm | `calcEquivalentDiameterDh` |
| f | 名义剪切应力 | τ_tn | 94.4 MPa | `calcNominalShearStressTauTn` |
| f | 应力集中系数 | α_tn | 2.238 | `calcStressConcentrationFactor` |
| f | 最大齿根剪切应力 | τ_Fmax | 211.3 MPa | $τ_{tn} \times α_{tn}$ |
| f | 许用剪切应力 | [τ_F] | 216 MPa | $[\sigma_F]/2$ |
| f | 弯扭当量应力 | σ_v | 163.5 MPa | `calcCombinedStressGB17855` |
| e | 10⁶ 循环耐磨 | [σ_H1] | 110 MPa | `lookupWearAllowable10e6` |
| e | 长期无磨损 | [σ_H2] | 9.4 MPa | `calcWearAllowableLongTerm` |

**校核结论**:

| 项目 | 实际值 | 许用值 | 判定 |
|------|--------|--------|------|
| 齿面接触 | 106.8 | 294.4 | ✅ 合格 |
| 齿根弯曲 | 168.3 | 432 | ✅ 合格 |
| 齿根剪切 | 211.3 | 216 | ✅ 合格 |
| 弯扭合成 | 163.5 | 368 | ✅ 合格 |
| 10⁶循环耐磨 | 106.8 | 110 | ✅ 合格 |
| 长期无磨损 | 106.8 | 9.4 | ❌ 不合格 |

> **注意**: 长期无磨损校核不通过（σ_H=106.8 >> [σ_H2]=9.4MPa），表明该花键在长期连续运行后齿面将发生微动磨损。这在 GB/T 17855-1999 例1中已明确标注。如需无磨损运行，需提高材料硬度或降低接触应力。

---

## 附录 A: 代码文件架构

```
spline-calc/
├── index.html          ← 壳层：6个Tab导航 + 表单面板 + 脚本引用
├── styles.css           ← 全局样式系统
├── data.js              ← 数据层：标准参数表、材料表、常系数
├── calc.js              ← 计算层：纯函数计算（无DOM操作）
└── tab-spline.js        ← 界面层：UI桥接 + 结果渲染
```

## 附录 B: 计算函数索引

| 序号 | 函数名 | 所属章节 | 公式/依据 |
|------|--------|----------|-----------|
| 1 | `calcBasicGeometry` | 基本几何 | GB/T 3478.1 §5 (1)-(4) |
| 2 | `calcExternalSplineDiameters` | 外花键直径 | GB/T 3478.1 §6 |
| 3 | `calcInternalSplineDiameters` | 内花键直径 | GB/T 3478.1 §6 |
| 4 | `calcToleranceUnit_D` | 公差单位 | GB/T 3478.1 §8.3 (3) |
| 5 | `calcToleranceUnit_S` | 公差单位 | GB/T 3478.1 §8.3 (4) |
| 6 | `calcTotalTolerance` | 总公差 | GB/T 3478.1 表8 |
| 7 | `calcComprehensiveTolerance` | 综合公差 | GB/T 3478.1 §8.4-8.6 |
| 8 | `calcFundamentalDeviation` | 基本偏差 | GB/T 3478.1 §7+表23 |
| 9 | `calcToothThicknessLimits` | 齿厚极限 | GB/T 3478.1 §8 |
| 10 | `calcSpaceWidthLimits` | 齿槽宽极限 | GB/T 3478.1 §8 |
| 11 | `calcMeasurementOverPins` | 跨棒距 M_Re | GB/T 3478.5 |
| 12 | `calcMeasurementBetweenPins` | 棒间距 M_Ri | GB/T 3478.5 |
| 13 | `checkContactStrength` | 接触强度(简) | 《机械设计手册》 |
| 14 | `checkBendingStrength` | 弯曲强度(简) | 《机械设计手册》 |
| 15 | `checkShearStrength` | 剪切强度(简) | 《机械设计手册》 |
| 16 | `checkWear10e8` | 10⁸磨损(简) | 《机械设计手册》 |
| 17 | `checkWearFreeLongTerm` | 无磨损(简) | 《机械设计手册》 |
| 18 | `checkShaftTorsion` | 轴扭转(简) | 《机械设计手册》 |
| 19 | `checkShaftBending` | 轴弯曲(简) | 《机械设计手册》 |
| 20 | `calcTorqueFromPowerGB` | 转矩 | GB/T 17855 (1) |
| 21 | `calcNominalTangentialForce` | 切向力 | GB/T 17855 (2) |
| 22 | `calcUnitLoad` | 单位载荷 | GB/T 17855 (3) |
| 23 | `calcContactStressGB17855` | 接触应力 | GB/T 17855 (4) |
| 24 | `calcToothRootChordThickness` | 齿根弦齿厚 | GB/T 17855 (5) |
| 25 | `calcBendingStressGB17855` | 弯曲应力 | GB/T 17855 (6) |
| 26 | `calcNominalShearStressTauTn` | 名义剪应力 | GB/T 17855 (7) |
| 27 | `calcEquivalentDiameterDh` | 当量直径 | GB/T 17855 (8) |
| 28 | `calcStressConcentrationFactor` | 应力集中系数 | GB/T 17855 (9) |
| 29 | `calcAllowableStressGB` | 许用应力 | GB/T 17855 (10) |
| 30 | `calcCombinedStressGB17855` | 弯扭合成 | GB/T 17855 (13) |
| 31 | `calcAll` | 综合计算入口 | 全部 | 
| 32 | `calcGB17855All` | GB17855 综合入口 | GB/T 17855 全部 |

---

> **文档维护**: 本设计计算书应随 `calc.js` 和 `data.js` 的更新同步修订。每次修改计算逻辑后，请更新对应的公式说明、数据表引用和验证期望值。
