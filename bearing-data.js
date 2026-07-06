/**
 * ============================================================
 * bearing-data.js — 轴承校核数据层
 * 依据：SKF General Catalogue (Rolling Bearings)
 *       ISO 281:2007《滚动轴承 额定动载荷和额定寿命》
 *       GB/T 6391-2010《滚动轴承 额定动载荷和额定寿命》
 *       NSK Super Precision Bearings Catalogue
 *       《机械设计手册》第五版 第2卷
 *
 * 职责：仅存放国标参数表、材料性能表、系数常量
 * 禁止：任何计算逻辑、DOM 操作
 *
 * 默认单位：长度 mm，力 N，应力/压强 MPa，
 *           转矩 N·m，粘度 mm²/s (cSt)，温度 ℃
 * ============================================================
 */

// ============================================================
// 一、轴承类型定义 (X/Y 系数表 GB/T 6391)
// ============================================================

const BEARING_TYPES = {
  deepGrooveBall: {
    name: '深沟球轴承 (Deep Groove Ball)',
    code: '6xxx',
    family: 'ball',         // p=3 for life exponent
    lifeExponent: 3,        // ball bearings: p=3
    hasAxialCapacity: true,

    /**
     * 深沟球轴承 X/Y 系数 — 依据 GB/T 6391 表2
     * 流程:
     *  1. 计算 Fa/C0 → 查表得 e
     *  2. 比较 Fa/Fr
     *     - Fa/Fr ≤ e:  X=1,   Y=0
     *     - Fa/Fr > e:  X=0.56, Y 根据 Fa/C0 内插
     *
     * f0·Fa/C0 范围与 e, Y 的对应关系
     * 注：对于深沟球，需先假设 f0≈14 (标准游隙)
     * 实际简化：直接用 Fa/C0 查表
     */
    eTable: [
      { Fa_C0: 0.014, e: 0.19, Y: 2.30 },
      { Fa_C0: 0.028, e: 0.22, Y: 1.99 },
      { Fa_C0: 0.056, e: 0.26, Y: 1.71 },
      { Fa_C0: 0.084, e: 0.28, Y: 1.55 },
      { Fa_C0: 0.11,  e: 0.30, Y: 1.45 },
      { Fa_C0: 0.17,  e: 0.34, Y: 1.31 },
      { Fa_C0: 0.28,  e: 0.38, Y: 1.15 },
      { Fa_C0: 0.42,  e: 0.42, Y: 1.04 },
      { Fa_C0: 0.56,  e: 0.44, Y: 1.00 }
    ],
    X1: 1.0,   Y1: 0,       // 当 Fa/Fr ≤ e
    X2: 0.56,                // 当 Fa/Fr > e, Y2 从 eTable 内插

    // 静载系数 X0, Y0 — GB/T 4662
    X0: 0.6,   Y0: 0.50,

    // 摩擦系数 (SKF model) — Grr, Gsl 参考值
    frictionGrr_base: 0.45,     // rolling friction coefficient base
    frictionGsl_base: 1.5,     // sliding friction coefficient base
    frictionR1: 3.2,           // dm/Dw related coefficient
    frictionS1: 0.26,          // sliding coefficient
    phi_ish: 1.0,              // inlet shear heating factor (typically 1.0)
    phi_rs: 1.0                // kinematic replenishment factor

  },

  cylindricalRoller: {
    name: '圆柱滚子轴承 (Cylindrical Roller)',
    code: 'NU/NJ/NUP',
    family: 'roller',
    lifeExponent: 3.333,       // roller bearings: p=10/3
    hasAxialCapacity: false,   // 标准NU/NJ型不承受轴向力

    // 圆柱滚子：纯径向
    // Fa/Fr ≤ e 条件下：X=1, Y=0
    // 通常不承受轴向力，如承受(Fa/Fr≤0.5)：X=0.5，Y根据设计确定
    eTable: [
      { Fa_C0: 0.01, e: 0.2, Y: 0.6 }
    ],
    X1: 1.0,   Y1: 0,
    X2: 0.5,   // 若有轴向力时

    X0: 1.0,   Y0: 0,

    frictionGrr_base: 0.55,
    frictionGsl_base: 1.7,
    frictionR1: 3.5,
    frictionS1: 0.30,
    phi_ish: 1.0,
    phi_rs: 1.0
  },

  angularContactBall: {
    name: '角接触球轴承 (Angular Contact Ball)',
    code: '7xxx',
    family: 'ball',
    lifeExponent: 3,
    hasAxialCapacity: true,

    /**
     * 角接触球轴承 X/Y 系数按接触角分类
     * 15° (C型): 同深沟球逻辑
     * 25° (A5型): e≈0.68, X2=0.41, Y2=0.87
     * 40° (B型):  e≈1.14, X2=0.35, Y2=0.57
     */
    eTable: [
      { Fa_C0: 0.015, e: 0.38, Y: 1.47 },   // α=15°
      { Fa_C0: 0.029, e: 0.40, Y: 1.40 },
      { Fa_C0: 0.058, e: 0.43, Y: 1.30 },
      { Fa_C0: 0.087, e: 0.46, Y: 1.23 },
      { Fa_C0: 0.12,  e: 0.47, Y: 1.19 },
      { Fa_C0: 0.17,  e: 0.50, Y: 1.12 },
      { Fa_C0: 0.29,  e: 0.55, Y: 1.02 }
    ],
    // 默认：15° contact (C型)
    X1: 1.0,   Y1: 0,
    X2: 0.44,                // 当 Fa/Fr > e，默认15°
    Y2_default: 1.0,         // 根据 α 变化

    // 接触角修正后的 X2/Y2 速查
    series_15deg: { e: 0.38, X2: 0.44, Y2: 1.47, X0: 0.5, Y0: 0.26 },
    series_25deg: { e: 0.68, X2: 0.41, Y2: 0.87, X0: 0.5, Y0: 0.38 },
    series_40deg: { e: 1.14, X2: 0.35, Y2: 0.57, X0: 0.5, Y0: 0.26 },

    X0: 0.5,   Y0: 0.26,    // α=15°

    frictionGrr_base: 0.40,
    frictionGsl_base: 1.4,
    frictionR1: 3.2,
    frictionS1: 0.25,
    phi_ish: 1.0,
    phi_rs: 1.0
  },

  taperedRoller: {
    name: '圆锥滚子轴承 (Tapered Roller)',
    code: '3xxx',
    family: 'roller',
    lifeExponent: 3.333,
    hasAxialCapacity: true,

    /**
     * 圆锥滚子轴承：单列承受联合载荷
     * e = 1.5 * tan(α) (α为接触角，通常10°-30°)
     * 典型值：e ≈ 0.35-0.42
     * Fa/Fr ≤ e: P = Fr + Y1·Fa
     * Fa/Fr > e:  P = 0.4·Fr + Y·Fa
     */
    eTable: [
      { Fa_C0: 0.01, e: 0.27, Y: 1.4 }
    ],
    X1: 1.0,   Y1: 0,
    X2: 0.4,                // Y2 从 eTable 取 (典型 Y≈1.6)

    X0: 0.5,   Y0_cotAlpha: 0.22,  // Y0 = 0.22·cot(α) ≈ 0.5

    frictionGrr_base: 0.65,
    frictionGsl_base: 2.0,
    frictionR1: 3.8,
    frictionS1: 0.35,
    phi_ish: 1.0,
    phi_rs: 1.0
  },

  sphericalRoller: {
    name: '调心滚子轴承 (Spherical Roller)',
    code: '2xxx',
    family: 'roller',
    lifeExponent: 3.333,
    hasAxialCapacity: true,

    eTable: [
      { Fa_C0: 0.01, e: 0.22, Y: 2.8 }
    ],
    X1: 1.0,   Y1: 2.5,      // 调心滚子 Y1 较大
    X2: 0.67,                 // Y2 从 eTable 取

    X0: 1.0,   Y0: 1.5,

    frictionGrr_base: 0.55,
    frictionGsl_base: 1.8,
    frictionR1: 3.5,
    frictionS1: 0.30,
    phi_ish: 1.0,
    phi_rs: 1.0
  }
};

// ============================================================
// 二、可靠度修正系数 a1 — ISO 281:2007 表12
// ============================================================

const RELIABILITY_FACTORS = {
  '90': { a1: 1.00, Lnm: 'L10m', failureProb: '10%', name: '90% 可靠度' },
  '95': { a1: 0.62, Lnm: 'L5m',  failureProb: '5%',  name: '95% 可靠度' },
  '96': { a1: 0.53, Lnm: 'L4m',  failureProb: '4%',  name: '96% 可靠度' },
  '97': { a1: 0.44, Lnm: 'L3m',  failureProb: '3%',  name: '97% 可靠度' },
  '98': { a1: 0.33, Lnm: 'L2m',  failureProb: '2%',  name: '98% 可靠度' },
  '99': { a1: 0.21, Lnm: 'L1m',  failureProb: '1%',  name: '99% 可靠度' }
};

// ============================================================
// 三、额定粘度 ν₁ 表
// 依据：SKF General Catalogue 图1 "额定粘度 ν₁"
// dm: 轴承平均直径 (d+D)/2, mm
// n:  转速, rpm
// ν₁: 额定运动粘度, mm²/s
// ============================================================

const RATED_VISCOSITY_TABLE = {
  dm_values: [5, 10, 20, 50, 100, 200, 500],
  n_values: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000],
  /**
   * grid[dmIdx][nIdx] = ν₁ [mm²/s]
   * 数值来源于 SKF 图1 "Required viscosity ν₁ at operating temperature" 数字化
   * 参考：SKF General Catalogue, Diagram 1
   * 经验公式近似: ν₁ ≈ 45000 × dm^(-0.5) × n^(-0.85)
   */
  grid: [
    // dm = 5 mm
    [200, 140, 85, 56, 37, 22, 15.5, 10.5, 6.5, 4.2, 2.8, 1.7, 1.1],
    // dm = 10 mm
    [360, 250, 150, 100, 66, 40, 28, 19, 12, 7.5, 5.0, 3.0, 2.0],
    // dm = 20 mm
    [650, 450, 270, 180, 120, 72, 50, 34, 21.5, 13.5, 9.0, 5.5, 3.5],
    // dm = 50 mm
    [1500, 1050, 650, 430, 280, 170, 115, 78, 49, 31, 21, 13.5, 8.5],
    // dm = 100 mm
    [3000, 2100, 1300, 850, 550, 330, 225, 155, 100, 62, 42, 27, 17.5],
    // dm = 200 mm
    [6000, 4200, 2600, 1700, 1100, 660, 450, 310, 200, 125, 85, 55, 36],
    // dm = 500 mm
    [14000, 9800, 6000, 4000, 2600, 1550, 1050, 720, 470, 300, 200, 130, 85]
  ]
};

// ============================================================
// 四、污染系数 ηc
// 依据：SKF General Catalogue 表4
// ============================================================

const CONTAMINATION_FACTORS = {
  extremeClean:  { eta_c: 1.0,  desc: '极度清洁 — 油膜过滤 ≤1μm, 洁净室环境', detail: '轴承安装表面清洁度极高，油膜过滤精度≤1μm' },
  highClean:     { eta_c: 0.8,  desc: '高度清洁 — 油膜过滤 ≤3μm', detail: '油膜经精细过滤，污染颗粒≤3μm，典型密封轴承' },
  normal:        { eta_c: 0.5,  desc: '正常清洁 — 油膜过滤 ≤10μm', detail: '标准工业齿轮箱过滤等级，污染颗粒≤10μm' },
  contaminated:  { eta_c: 0.3,  desc: '轻度污染 — 典型工业环境', detail: '一般工业环境，未经过滤或粗过滤，存在中等污染' },
  dirty:         { eta_c: 0.1,  desc: '严重污染 — 磨粒/多粉尘环境', detail: '矿山、建筑、农业机械等重污染环境'}
};

// ============================================================
// 五、润滑油/脂数据
// 依据：ISO 3448 (粘度等级), ASTM D341 (粘温关系)
// ============================================================

const ISO_VG_VISCOSITY = {
  // ISO VG → ν40 (mm²/s)
  // A, B 参数由 getOperatingViscosity() 根据 ν40 和估算 ν100 动态计算
  2:   { nu40: 2.2 },
  5:   { nu40: 4.6 },
  7:   { nu40: 6.8 },
  10:  { nu40: 10.0 },
  15:  { nu40: 15.0 },
  22:  { nu40: 22.0 },
  32:  { nu40: 32.0 },
  46:  { nu40: 46.0 },
  68:  { nu40: 68.0 },
  100: { nu40: 100.0 },
  150: { nu40: 150.0 },
  220: { nu40: 220.0 },
  320: { nu40: 320.0 },
  460: { nu40: 460.0 },
  680: { nu40: 680.0 }
};

// 脂润滑 — 基础油粘度典型值
const GREASE_BASE_OIL = {
  // 常用电机轴承润滑脂
  'LGMT2':  { nu40: 110,  name: 'SKF LGMT 2 — 通用锂基脂', minTemp: -30, maxTemp: 120 },
  'LGMT3':  { nu40: 120,  name: 'SKF LGMT 3 — 高温锂基脂', minTemp: -30, maxTemp: 140 },
  'LGHP2':  { nu40: 95,   name: 'SKF LGHP 2 — 高温高性能', minTemp: -40, maxTemp: 150 },
  'LGLT2':  { nu40: 15,   name: 'SKF LGLT 2 — 低温脂',     minTemp: -55, maxTemp: 110 },
  'LGHB2':  { nu40: 420,  name: 'SKF LGHB 2 — 重载脂',     minTemp: -20, maxTemp: 150 },
  'NSK_MTS': { nu40: 26,  name: 'NSK MTS — 超高速脂',      minTemp: -50, maxTemp: 130 },
  'NSK_MTE': { nu40: 130, name: 'NSK MTE — 重载高速脂',    minTemp: -40, maxTemp: 160 }
};

// ============================================================
// 六、最小静强度安全系数 s₀
// 依据：SKF General Catalogue 表5
// ============================================================

const MIN_STATIC_SAFETY = {
  smooth:         { s0: 0.5, name: '平稳运行、低噪声要求',     desc: '仅承受平稳载荷，对运行精度要求不高' },
  normal:         { s0: 1.0, name: '正常运行',                desc: '常规工业电机、泵、风机等典型工况' },
  moderateShock:  { s0: 1.5, name: '中等冲击载荷',            desc: '齿轮箱、起重机、破碎机等中冲击工况' },
  heavyShock:     { s0: 2.0, name: '重冲击载荷',              desc: '轧机、振动筛、冲击设备等重载工况' },
  severeShock:    { s0: 3.0, name: '严重冲击、安全关键设备',  desc: '安全关键设备、不允许任何塑性变形' },
  highPrecision:  { s0: 2.0, name: '高精度/超精密设备',       desc: '机床主轴、精密旋转设备，需高运行精度' },
  // 球轴承 vs 滚子轴承修正系数
  ballBearingAdjust: 0.5,  // 球轴承 s0 = 基准×0.5 (通常比滚子轴承低)
};

// ============================================================
// 七、常用电机轴承参考库
// 依据：SKF 滚动轴承综合型录
// 单位：d/D/B (mm), C/C0/Pu (kN), dm/Dpw/Dw (mm), Z(数量)
// ============================================================

const BEARING_CATALOG = {
  // ---- 深沟球轴承 62系列 (最常用电机轴承) ----
  '6203': { type: 'deepGrooveBall', d: 17,  D: 40,  B: 12,  C: 9.95,  C0: 4.75,  Pu: 0.20,  dm: 28.5, Dpw: 28.5, Dw: 6.75,  Z: 8,  alpha: 0,  speedGrease: 24000, speedOil: 28000 },
  '6204': { type: 'deepGrooveBall', d: 20,  D: 47,  B: 14,  C: 13.5,  C0: 6.55,  Pu: 0.28,  dm: 33.5, Dpw: 33.5, Dw: 7.938, Z: 8,  alpha: 0,  speedGrease: 20000, speedOil: 24000 },
  '6205': { type: 'deepGrooveBall', d: 25,  D: 52,  B: 15,  C: 14.8,  C0: 7.8,   Pu: 0.335, dm: 38.5, Dpw: 38.5, Dw: 7.938, Z: 9,  alpha: 0,  speedGrease: 18000, speedOil: 20000 },
  '6206': { type: 'deepGrooveBall', d: 30,  D: 62,  B: 16,  C: 20.3,  C0: 11.2,  Pu: 0.475, dm: 46,   Dpw: 46,   Dw: 9.525, Z: 9,  alpha: 0,  speedGrease: 15000, speedOil: 17000 },
  '6207': { type: 'deepGrooveBall', d: 35,  D: 72,  B: 17,  C: 27.0,  C0: 15.3,  Pu: 0.655, dm: 53.5, Dpw: 53.5, Dw: 11.112,Z: 9,  alpha: 0,  speedGrease: 13000, speedOil: 15000 },
  '6208': { type: 'deepGrooveBall', d: 40,  D: 80,  B: 18,  C: 32.5,  C0: 19.0,  Pu: 0.80,  dm: 60,   Dpw: 60,   Dw: 12.7,  Z: 9,  alpha: 0,  speedGrease: 11000, speedOil: 13000 },
  '6209': { type: 'deepGrooveBall', d: 45,  D: 85,  B: 19,  C: 35.1,  C0: 21.6,  Pu: 0.915, dm: 65,   Dpw: 65,   Dw: 12.7,  Z: 10, alpha: 0,  speedGrease: 10000, speedOil: 12000 },
  '6210': { type: 'deepGrooveBall', d: 50,  D: 90,  B: 20,  C: 37.1,  C0: 23.2,  Pu: 0.98,  dm: 70,   Dpw: 70,   Dw: 12.7,  Z: 10, alpha: 0,  speedGrease: 9500,  speedOil: 11000 },
  '6211': { type: 'deepGrooveBall', d: 55,  D: 100, B: 21,  C: 46.2,  C0: 29.0,  Pu: 1.25,  dm: 77.5, Dpw: 77.5, Dw: 14.288,Z: 10, alpha: 0,  speedGrease: 8500,  speedOil: 10000 },
  '6212': { type: 'deepGrooveBall', d: 60,  D: 110, B: 22,  C: 55.3,  C0: 36.0,  Pu: 1.53,  dm: 85,   Dpw: 85,   Dw: 15.081,Z: 10, alpha: 0,  speedGrease: 8000,  speedOil: 9500 },
  '6213': { type: 'deepGrooveBall', d: 65,  D: 120, B: 23,  C: 58.5,  C0: 40.5,  Pu: 1.73,  dm: 92.5, Dpw: 92.5, Dw: 16.669,Z: 10, alpha: 0,  speedGrease: 7500,  speedOil: 8500 },
  '6214': { type: 'deepGrooveBall', d: 70,  D: 125, B: 24,  C: 63.7,  C0: 45.0,  Pu: 1.9,   dm: 97.5, Dpw: 97.5, Dw: 16.669,Z: 11, alpha: 0,  speedGrease: 7000,  speedOil: 8000 },
  '6215': { type: 'deepGrooveBall', d: 75,  D: 130, B: 25,  C: 68.9,  C0: 49.0,  Pu: 2.08,  dm: 102.5,Dpw: 102.5,Dw: 17.463,Z: 11, alpha: 0,  speedGrease: 6700,  speedOil: 7500 },

  // ---- 深沟球轴承 63系列 (重载系列) ----
  '6306': { type: 'deepGrooveBall', d: 30,  D: 72,  B: 19,  C: 29.6,  C0: 16.0,  Pu: 0.67,  dm: 51,   Dpw: 51,   Dw: 11.906,Z: 8,  alpha: 0,  speedGrease: 13000, speedOil: 15000 },
  '6307': { type: 'deepGrooveBall', d: 35,  D: 80,  B: 21,  C: 35.1,  C0: 19.0,  Pu: 0.815, dm: 57.5, Dpw: 57.5, Dw: 13.494,Z: 8,  alpha: 0,  speedGrease: 12000, speedOil: 14000 },
  '6308': { type: 'deepGrooveBall', d: 40,  D: 90,  B: 23,  C: 42.3,  C0: 24.0,  Pu: 1.02,  dm: 65,   Dpw: 65,   Dw: 15.081,Z: 8,  alpha: 0,  speedGrease: 10000, speedOil: 12000 },
  '6309': { type: 'deepGrooveBall', d: 45,  D: 100, B: 25,  C: 55.3,  C0: 31.5,  Pu: 1.34,  dm: 72.5, Dpw: 72.5, Dw: 17.463,Z: 8,  alpha: 0,  speedGrease: 9000,  speedOil: 11000 },
  '6310': { type: 'deepGrooveBall', d: 50,  D: 110, B: 27,  C: 65.0,  C0: 38.0,  Pu: 1.60,  dm: 80,   Dpw: 80,   Dw: 19.05, Z: 8,  alpha: 0,  speedGrease: 8500,  speedOil: 9500 },
  '6311': { type: 'deepGrooveBall', d: 55,  D: 120, B: 29,  C: 74.1,  C0: 45.0,  Pu: 1.90,  dm: 87.5, Dpw: 87.5, Dw: 20.638,Z: 8,  alpha: 0,  speedGrease: 7500,  speedOil: 8500 },
  '6312': { type: 'deepGrooveBall', d: 60,  D: 130, B: 31,  C: 85.2,  C0: 52.0,  Pu: 2.20,  dm: 95,   Dpw: 95,   Dw: 22.225,Z: 8,  alpha: 0,  speedGrease: 7000,  speedOil: 8000 },
  '6313': { type: 'deepGrooveBall', d: 65,  D: 140, B: 33,  C: 97.5,  C0: 60.0,  Pu: 2.50,  dm: 102.5,Dpw: 102.5,Dw: 24.0,  Z: 8,  alpha: 0,  speedGrease: 6300,  speedOil: 7500 },
  '6314': { type: 'deepGrooveBall', d: 70,  D: 150, B: 35,  C: 111,   C0: 68.0,  Pu: 2.85,  dm: 110,  Dpw: 110,  Dw: 25.4,  Z: 8,  alpha: 0,  speedGrease: 5600,  speedOil: 6700 },

  // ---- 圆柱滚子轴承 NU3系列 (NU=外圈无挡边) ----
  'NU306': { type: 'cylindricalRoller', d: 30, D: 72,  B: 19, C: 46.8, C0: 37.5, Pu: 4.75, dm: 51,  Dpw: 51,  Dw: 9.0,   Z: 12, alpha: 0, speedGrease: 12000, speedOil: 14000 },
  'NU307': { type: 'cylindricalRoller', d: 35, D: 80,  B: 21, C: 56.1, C0: 46.5, Pu: 6.0,  dm: 57.5,Dpw: 57.5, Dw: 10.0,  Z: 12, alpha: 0, speedGrease: 11000, speedOil: 13000 },
  'NU308': { type: 'cylindricalRoller', d: 40, D: 90,  B: 23, C: 73.5, C0: 63.0, Pu: 8.0,  dm: 65,  Dpw: 65,  Dw: 11.0,  Z: 13, alpha: 0, speedGrease: 9500,  speedOil: 11000 },
  'NU309': { type: 'cylindricalRoller', d: 45, D: 100, B: 25, C: 93.5, C0: 81.5, Pu: 10.4, dm: 72.5,Dpw: 72.5, Dw: 12.0,  Z: 13, alpha: 0, speedGrease: 8500,  speedOil: 10000 },
  'NU310': { type: 'cylindricalRoller', d: 50, D: 110, B: 27, C: 112,  C0: 100,  Pu: 12.9, dm: 80,  Dpw: 80,  Dw: 13.0,  Z: 14, alpha: 0, speedGrease: 8000,  speedOil: 9000 },
  'NU311': { type: 'cylindricalRoller', d: 55, D: 120, B: 29, C: 138,  C0: 125,  Pu: 16.0, dm: 87.5,Dpw: 87.5, Dw: 14.0,  Z: 14, alpha: 0, speedGrease: 7500,  speedOil: 8500 },
  'NU312': { type: 'cylindricalRoller', d: 60, D: 130, B: 31, C: 160,  C0: 146,  Pu: 18.6, dm: 95,  Dpw: 95,  Dw: 15.0,  Z: 15, alpha: 0, speedGrease: 6700,  speedOil: 7500 },
  'NU313': { type: 'cylindricalRoller', d: 65, D: 140, B: 33, C: 183,  C0: 166,  Pu: 21.2, dm: 102.5,Dpw:102.5,Dw: 16.0,  Z: 15, alpha: 0, speedGrease: 6000,  speedOil: 7000 },
  'NU314': { type: 'cylindricalRoller', d: 70, D: 150, B: 35, C: 216,  C0: 196,  Pu: 25.0, dm: 110, Dpw: 110, Dw: 17.0,  Z: 16, alpha: 0, speedGrease: 5600,  speedOil: 6300 },

  // ---- 角接触球轴承 73xxB 系列 (40°接触角) ----
  '7306B': { type: 'angularContactBall', sub: 'series40', d: 30, D: 72,  B: 19, C: 31.0, C0: 19.3, Pu: 0.83, dm: 51,  Dpw: 51,  Dw: 11.5,  Z: 11, alpha: 40, speedGrease: 12000, speedOil: 16000 },
  '7307B': { type: 'angularContactBall', sub: 'series40', d: 35, D: 80,  B: 21, C: 37.7, C0: 22.8, Pu: 0.98, dm: 57.5,Dpw: 57.5, Dw: 13.0,  Z: 11, alpha: 40, speedGrease: 10000, speedOil: 14000 },
  '7308B': { type: 'angularContactBall', sub: 'series40', d: 40, D: 90,  B: 23, C: 50.0, C0: 32.5, Pu: 1.37, dm: 65,  Dpw: 65,  Dw: 14.0,  Z: 11, alpha: 40, speedGrease: 9000,  speedOil: 12000 },
  '7309B': { type: 'angularContactBall', sub: 'series40', d: 45, D: 100, B: 25, C: 61.8, C0: 40.5, Pu: 1.73, dm: 72.5,Dpw: 72.5, Dw: 15.5,  Z: 12, alpha: 40, speedGrease: 8000,  speedOil: 10000 },
  '7310B': { type: 'angularContactBall', sub: 'series40', d: 50, D: 110, B: 27, C: 74.1, C0: 50.0, Pu: 2.12, dm: 80,  Dpw: 80,  Dw: 17.0,  Z: 12, alpha: 40, speedGrease: 7500,  speedOil: 9500 },
  '7311B': { type: 'angularContactBall', sub: 'series40', d: 55, D: 120, B: 29, C: 86.5, C0: 60.0, Pu: 2.55, dm: 87.5,Dpw: 87.5, Dw: 18.5,  Z: 12, alpha: 40, speedGrease: 7000,  speedOil: 8500 },
  '7312B': { type: 'angularContactBall', sub: 'series40', d: 60, D: 130, B: 31, C: 97.5, C0: 69.5, Pu: 2.70, dm: 95,  Dpw: 95,  Dw: 20.0,  Z: 12, alpha: 40, speedGrease: 6300,  speedOil: 7500 },

  // ---- 圆锥滚子轴承 302系列 (最常用) ----
  '30206': { type: 'taperedRoller', d: 30, D: 62, B: 17.25, C: 43.5, C0: 47.5, Pu: 5.3, dm: 46,  Dpw: 46,  Dw: 7.0,  Z: 17, alpha: 14, speedGrease: 10000, speedOil: 12000 },
  '30207': { type: 'taperedRoller', d: 35, D: 72, B: 18.25, C: 56.5, C0: 60.0, Pu: 6.95,dm: 53.5,Dpw: 53.5,Dw: 8.0,  Z: 17, alpha: 14, speedGrease: 9000,  speedOil: 11000 },
  '30208': { type: 'taperedRoller', d: 40, D: 80, B: 19.75, C: 68.5, C0: 72.0, Pu: 8.3, dm: 60,  Dpw: 60,  Dw: 9.0,  Z: 17, alpha: 14, speedGrease: 8000,  speedOil: 9500 },
  '30209': { type: 'taperedRoller', d: 45, D: 85, B: 20.75, C: 78.0, C0: 85.0, Pu: 9.5, dm: 65,  Dpw: 65,  Dw: 9.5,  Z: 18, alpha: 14, speedGrease: 7000,  speedOil: 8500 },
  '30210': { type: 'taperedRoller', d: 50, D: 90, B: 21.75, C: 83.0, C0: 91.5, Pu: 10.4,dm: 70,  Dpw: 70,  Dw: 10.0, Z: 18, alpha: 14, speedGrease: 6700,  speedOil: 8000 },
  '30211': { type: 'taperedRoller', d: 55, D: 100,B: 22.75, C: 106,  C0: 118,  Pu: 13.2,dm: 77.5,Dpw: 77.5,Dw: 11.0, Z: 18, alpha: 14, speedGrease: 6300,  speedOil: 7500 },
  '30212': { type: 'taperedRoller', d: 60, D: 110,B: 23.75, C: 120,  C0: 132,  Pu: 15.0,dm: 85,  Dpw: 85,  Dw: 12.0, Z: 18, alpha: 14, speedGrease: 6000,  speedOil: 7000 }
};

// ============================================================
// 八、aSKF 系数查找表
// 依据：SKF General Catalogue 图2-5
// 简化：二维网格（κ × ηc·Pu/P）→ aSKF
//
// κ (viscosity ratio): 0.1, 0.2, 0.5, 1, 2, 4
// ηc·Pu/P: 0.1, 0.2, 0.5, 1, 2, 5, 10
//
// 数据取自 SKF 球轴承 aSKF 图（深沟球/角接触球轴承通用）
// ============================================================

const aSKF_TABLE_BALL = {
  // Values for ball bearings (p=3)
  kappa_values: [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.5, 2.0, 3.0, 4.0],
  pu_p_eta_values: [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 2.0, 3.0, 5.0, 8.0, 10.0],
  /**
   * grid[kappaIdx][pu_p_etaIdx] = aSKF (capped at 50)
   */
  grid: [
    // κ=0.1: extremely poor lubrication
    [0.1, 0.15, 0.18, 0.2, 0.22, 0.23, 0.24, 0.25, 0.26, 0.3, 0.35, 0.4, 0.5, 0.6],
    // κ=0.15
    [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.42, 0.45, 0.48, 0.55, 0.6, 0.7, 0.8, 0.9],
    // κ=0.2
    [0.2, 0.3, 0.35, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.85, 1.0, 1.2, 1.5, 1.8],
    // κ=0.3
    [0.25, 0.45, 0.55, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.6, 2.0, 2.5, 3.0, 3.5],
    // κ=0.4
    [0.3, 0.55, 0.7, 1.0, 1.2, 1.3, 1.4, 1.6, 1.8, 2.2, 3.0, 4.0, 5.0, 5.5],
    // κ=0.5
    [0.35, 0.65, 0.85, 1.2, 1.5, 1.7, 1.8, 2.0, 2.2, 3.0, 3.8, 5.5, 7.0, 8.0],
    // κ=0.6
    [0.4, 0.75, 1.0, 1.4, 1.8, 2.0, 2.2, 2.5, 2.8, 3.8, 5.0, 7.0, 9.0, 10.5],
    // κ=0.8
    [0.5, 0.95, 1.2, 1.8, 2.2, 2.5, 2.8, 3.2, 3.5, 5.0, 6.5, 10.0, 14.0, 17.0],
    // κ=1.0
    [0.55, 1.1, 1.4, 2.1, 2.6, 3.0, 3.4, 4.0, 4.5, 7.0, 9.0, 15.0, 22.0, 28.0],
    // κ=1.5
    [0.65, 1.3, 1.8, 2.6, 3.4, 4.0, 4.5, 5.5, 6.0, 12.0, 18.0, 30.0, 45.0, 50.0],
    // κ=2.0
    [0.7, 1.45, 2.0, 3.0, 4.0, 4.8, 5.5, 7.0, 8.0, 16.0, 28.0, 42.0, 50.0, 50.0],
    // κ=3.0
    [0.75, 1.6, 2.2, 3.4, 4.5, 5.5, 6.5, 8.5, 10.0, 22.0, 38.0, 50.0, 50.0, 50.0],
    // κ=4.0
    [0.8, 1.7, 2.4, 3.6, 4.8, 6.0, 7.0, 9.5, 12.0, 28.0, 45.0, 50.0, 50.0, 50.0]
  ]
};

const aSKF_TABLE_ROLLER = {
  // Values for roller bearings (p=10/3) — slightly different curve
  kappa_values: [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.5, 2.0, 3.0, 4.0],
  pu_p_eta_values: [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 2.0, 3.0, 5.0, 8.0, 10.0],
  grid: [
    [0.1, 0.15, 0.18, 0.22, 0.25, 0.26, 0.28, 0.3, 0.32, 0.4, 0.5, 0.6, 0.8, 1.0],
    [0.12, 0.2, 0.25, 0.32, 0.38, 0.42, 0.46, 0.5, 0.55, 0.7, 0.8, 1.0, 1.3, 1.5],
    [0.15, 0.25, 0.32, 0.45, 0.52, 0.6, 0.65, 0.7, 0.75, 1.0, 1.2, 1.6, 2.0, 2.5],
    [0.18, 0.35, 0.5, 0.7, 0.85, 1.0, 1.1, 1.2, 1.3, 1.8, 2.2, 3.0, 4.0, 5.0],
    [0.22, 0.45, 0.65, 1.0, 1.3, 1.5, 1.6, 1.8, 2.0, 2.8, 3.5, 5.0, 7.0, 8.5],
    [0.25, 0.55, 0.8, 1.3, 1.7, 2.0, 2.2, 2.5, 2.8, 4.0, 5.5, 8.0, 11.0, 14.0],
    [0.3, 0.65, 0.95, 1.6, 2.0, 2.4, 2.7, 3.0, 3.4, 5.0, 7.0, 10, 15.0, 19.0],
    [0.4, 0.85, 1.2, 2.1, 2.6, 3.0, 3.4, 4.0, 4.5, 7.0, 9.0, 15.0, 22.0, 28.0],
    [0.5, 1.0, 1.5, 2.5, 3.2, 3.8, 4.2, 5.0, 5.5, 9.0, 12.0, 22.0, 35.0, 45.0],
    [0.6, 1.3, 1.9, 3.2, 4.2, 5.0, 5.8, 7.0, 8.0, 15.0, 25.0, 40.0, 50.0, 50.0],
    [0.7, 1.5, 2.2, 3.8, 5.0, 6.0, 7.0, 9.0, 11.0, 22.0, 35.0, 50.0, 50.0, 50.0],
    [0.75, 1.7, 2.5, 4.2, 5.5, 6.8, 8.0, 11.0, 13.0, 28.0, 45.0, 50.0, 50.0, 50.0],
    [0.8, 1.8, 2.7, 4.5, 6.0, 7.5, 9.0, 12.0, 15.0, 35.0, 50.0, 50.0, 50.0, 50.0]
  ]
};

// ============================================================
// 九、NSK 高速轴承数据
// 依据：NSK Super Precision Bearings Catalogue
// ============================================================

const NSK_DATA = {
  // 预紧级别
  preload: {
    EL:     { name: 'EL (超轻)', description: 'Extra Light — 最高转速、最低发热',   forceRatio: 0.010 },
    L:      { name: 'L (轻)',    description: 'Light — 高转速应用',                forceRatio: 0.020 },
    M:      { name: 'M (中)',    description: 'Medium — 通用高速主轴',             forceRatio: 0.040 },
    H:      { name: 'H (重)',    description: 'Heavy — 高刚度需求',                forceRatio: 0.080 },
    custom: { name: '自定义',    description: '手动输入预紧力',                      forceRatio: null }
  },

  // 保持架类型对极限转速的影响系数
  cageFactors: {
    pressed_steel:  { factor: 1.00, name: '冲压钢保持架',        note: '标准，成本最低' },
    machined_brass: { factor: 1.10, name: '车制黄铜保持架',      note: '较高转速，引导精度好' },
    polyamide:     { factor: 0.80, name: '聚酰胺保持架',         note: '轻量，但温度限制(≤120°C)' },
    phenolic:       { factor: 1.30, name: '酚醛树脂保持架 (TR)', note: '最高转速，外圈引导，NSK超精密标准' },
    peek:           { factor: 1.20, name: 'PEEK保持架',           note: '耐高温工程塑料，高速用' }
  },

  // 球材料对极限转速的影响
  ballMaterial: {
    steel:   { factor: 1.0, density: 7850, name: '轴承钢 (SUJ2/AISI 52100)',  note: '标准钢球' },
    ceramic: { factor: 1.20, density: 3200, name: '陶瓷球 (Si₃N₄)',           note: '低密度、高刚度、低离心力，极限转速提升20%' }
  },

  // 精度等级对极限转速的影响系数
  precisionFactors: {
    P0: { factor: 1.0, name: 'P0 — 普通级',       note: '标准工业级，非高速场合' },
    P6: { factor: 1.1, name: 'P6 — 高级',           note: '较高精度要求' },
    P5: { factor: 1.3, name: 'P5 — 精密级 (ABEC-5)', note: '高速主轴标准配置' },
    P4: { factor: 1.5, name: 'P4 — 超精密 (ABEC-7)', note: '超高速/高精度主轴' },
    P2: { factor: 1.7, name: 'P2 — 超高精密 (ABEC-9)', note: '最高精度等级，极限应用' }
  },

  // 角接触球轴承排列方式
  arrangements: {
    DB: { name: '背对背 DB (O型排列)',  description: '背对背安装，外圈宽端面相对。承受双向轴向力和力矩载荷，高角刚度。最常用。',    angularStiffness: 'high' },
    DF: { name: '面对面 DF (X型排列)',  description: '面对面安装，外圈窄端面相对。允许较大的角度偏差，角刚度较低。',                 angularStiffness: 'medium' },
    DT: { name: '串联 DT (同向排列)',   description: '同方向串联安装，承受单向大轴向力。不承受力矩载荷。',                         angularStiffness: 'none' },
    TBT:{ name: '三联 TBT (DB/DT组合)', description: '三套轴承组合：一套DT串联+两套DB。单向轴向力+双向力矩。',                     angularStiffness: 'veryHigh' }
  },

  // 典型预紧刚度参考 (30BNR10 系列, d=30mm, D=55mm)
  // 预紧力 → 轴向刚度(N/μm) 的近似公式参数
  stiffnessRef: {
    // 对于 d=30-50mm 轴承：k_axial ≈ 30 × F_pre^0.5 (N/μm, F_pre in N)
    coeffA: 30,
    expA: 0.5,
    // 径向刚度 ≈ 轴向刚度 × 2.0（角接触球轴承，15-25°接触角）
    radialAxialRatio: 2.0
  },

  // 隔圈推荐值
  spacerRule: {
    // 内隔圈比外隔圈长 ΔL = 0.05-0.10 mm（用于产生预紧） — DB排列
    deltaL_min_mm: 0.04,   // 最小长度差 (EL预紧)
    deltaL_max_mm: 0.12,   // 最大长度差 (H预紧)
    deltaL_typical: 0.06   // 典型值 (L预紧)
  }
};

// ============================================================
// 十、轴系力学 — 轴材料数据
// 依据：《机械设计手册》第五版 第1卷 表1-1-2
// ============================================================

const SHAFT_MATERIALS = {
  '45钢':     { E_MPa: 206000, G_MPa: 79000, nu: 0.30, rho_kgm3: 7850, sigma_s: 355, sigma_b: 600,  name: '45钢 — 标准转轴材料',        category: 'carbonSteel' },
  '40Cr':     { E_MPa: 206000, G_MPa: 79000, nu: 0.30, rho_kgm3: 7850, sigma_s: 785, sigma_b: 980,  name: '40Cr — 合金结构钢',              category: 'alloySteel' },
  '42CrMo':   { E_MPa: 206000, G_MPa: 79000, nu: 0.30, rho_kgm3: 7850, sigma_s: 930, sigma_b: 1080, name: '42CrMo — 高强度合金钢(调质)',   category: 'alloySteel' },
  '38CrMoAl': { E_MPa: 206000, G_MPa: 79000, nu: 0.30, rho_kgm3: 7850, sigma_s: 835, sigma_b: 980,  name: '38CrMoAl — 氮化钢',               category: 'nitridingSteel' },
  '20CrMnTi': { E_MPa: 206000, G_MPa: 79000, nu: 0.30, rho_kgm3: 7850, sigma_s: 850, sigma_b: 1080, name: '20CrMnTi — 渗碳钢',               category: 'carburizedSteel' }
};

// ============================================================
// 十一、配合推荐表 (内圈旋转，正常载荷)
// 依据：SKF General Catalogue 配合推荐表
// ============================================================

const BEARING_FIT_RECOMMENDATIONS = {
  // 内圈旋转工况（轴公差）
  shaft: [
    { loadDesc: '轻载 (P/C ≤ 0.06)',     fit: 'j6',  toleranceDesc: 'j6 — 过渡配合，轻微过盈/间隙' },
    { loadDesc: '正常载荷 (0.06 < P/C ≤ 0.12)', fit: 'k6',  toleranceDesc: 'k6 — 轻微过盈，可靠传递扭矩' },
    { loadDesc: '重载 (P/C > 0.12)',     fit: 'm6',  toleranceDesc: 'm6 — 中等过盈，大扭矩传递' },
    { loadDesc: '冲击载荷',               fit: 'n6',  toleranceDesc: 'n6 — 较大过盈，冲击工况' }
  ],
  // 外圈静止工况（座孔公差）
  housing: [
    { loadDesc: '轻载/浮动端',   fit: 'H7', toleranceDesc: 'H7 — 间隙配合，允许轴向浮动' },
    { loadDesc: '正常载荷',       fit: 'J7', toleranceDesc: 'J7 — 过渡配合，多数过盈' },
    { loadDesc: '重载/薄壁座',    fit: 'M7', toleranceDesc: 'M7 — 轻微过盈，防止外圈转动' },
    { loadDesc: '冲击载荷',       fit: 'N7', toleranceDesc: 'N7 — 过盈配合，外圈可靠固定' }
  ]
};

// ============================================================
// 十二、游隙推荐 — 径向内部游隙等级
// 依据：SKF General Catalogue
// ============================================================

const CLEARANCE_RECOMMENDATIONS = [
  { grade: 'C2', name: 'C2 — 比普通小',  condition: '高精度/低噪声，工作温度接近环境温度，轻载荷' },
  { grade: 'CN', name: 'CN — 普通组',   condition: '标准电机工况，正常配合和温度范围' },
  { grade: 'C3', name: 'C3 — 比普通大',  condition: '过盈量较大，或内外圈温差>10°C' },
  { grade: 'C4', name: 'C4 — 比C3大',   condition: '大过盈量，或内外圈温差>20°C，或高速' },
  { grade: 'C5', name: 'C5 — 比C4大',   condition: '极大温差/重载/非常大的过盈量' }
];

// ============================================================
// 十三、API辅助 — 轴承目录检索
// ============================================================

/**
 * 按类型筛选轴承型号
 * @param {string} bearingType - 轴承类型键
 * @returns {Array<{model: string, data: object}>}
 */
function getBearingCatalogByType(bearingType) {
  const result = [];
  for (const [model, data] of Object.entries(BEARING_CATALOG)) {
    if (data.type === bearingType) {
      result.push({ model, ...data });
    }
  }
  return result;
}

/**
 * 获取所有轴承型号
 * @returns {Array<string>}
 */
function getAllBearingModels() {
  return Object.keys(BEARING_CATALOG);
}

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BEARING_TYPES,
    RELIABILITY_FACTORS,
    RATED_VISCOSITY_TABLE,
    CONTAMINATION_FACTORS,
    ISO_VG_VISCOSITY,
    GREASE_BASE_OIL,
    MIN_STATIC_SAFETY,
    BEARING_CATALOG,
    aSKF_TABLE_BALL,
    aSKF_TABLE_ROLLER,
    NSK_DATA,
    SHAFT_MATERIALS,
    BEARING_FIT_RECOMMENDATIONS,
    CLEARANCE_RECOMMENDATIONS,
    getBearingCatalogByType,
    getAllBearingModels
  };
}
