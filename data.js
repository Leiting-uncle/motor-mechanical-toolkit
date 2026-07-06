/**
 * ============================================================
 * data.js — 渐开线花键数据层
 * 依据：GB/T 3478.1-2008《圆柱直齿渐开线花键（米制模数 齿侧配合）》
 * 职责：仅存放标准参数表、材料性能表、系数常量
 * 禁止：任何计算逻辑、DOM 操作
 * ============================================================
 */

// ============================================================
// 一、基本齿廓参数（GB/T 3478.1-2008 第5章 表1）
// ============================================================

/**
 * 30° 标准压力角基本齿廓
 * 来源：GB/T 3478.1-2008 表1 — 基本齿廓参数
 * ha* = 0.5（齿顶高系数）
 * c* = 0.2（顶隙系数，平齿根）；c* = 0.25（圆齿根）
 * ρ_f* 为齿根圆角半径系数
 */
const BASIC_PROFILE_30 = {
  pressureAngleDeg: 30,                    // 标准压力角 α_D (°)
  pressureAngleRad: Math.PI / 6,          // 标准压力角 (rad)
  cosAlpha: Math.cos(Math.PI / 6),        // cos30° ≈ 0.86602540378
  tanAlpha: Math.tan(Math.PI / 6),        // tan30° ≈ 0.57735026919
  invAlpha: Math.tan(Math.PI / 6) - Math.PI / 6, // inv30° ≈ 0.053751493
  addendumCoeff: 0.5,                     // 齿顶高系数 ha*
  flatRoot: {
    name: '平齿根',
    // 基本齿廓：ha* = 0.5, 有效 c* ≈ 0.25
    // D_ie = m(z - 1.5), D_ei = m(z + 1.5) — 见 GB/T 3478.1-2008 表 A.1
    bottomClearanceCoeff: 0.25,           // 有效顶隙系数 c* (由标准表反推)
    rootFilletCoeff: 0.20,                // 齿根圆角半径系数 ρ_f* (GB/T 3478.1 表1)
    externalMinorCoeff: 1.50,             // 外花键小径：D_ie = m(z - 1.5)
    internalMajorCoeff: 1.50,             // 内花键大径：D_ei = m(z + 1.5)
  },
  filletRoot: {
    name: '圆齿根',
    // 圆齿根具有较大圆角半径，齿根更深
    // D_ie = m(z - 1.8), D_ei = m(z + 1.8)
    bottomClearanceCoeff: 0.40,           // 有效顶隙系数 c* (由标准表反推)
    rootFilletCoeff: 0.30,                // 齿根圆角半径系数 ρ_f* (GB/T 3478.1 表1)
    externalMinorCoeff: 1.80,             // 外花键小径：D_ie = m(z - 1.8)
    internalMajorCoeff: 1.80,             // 内花键大径：D_ei = m(z + 1.8)
  }
};

// ============================================================
// 二、标准模数系列（GB/T 3478.1-2008 第4章 表A.1）
// ============================================================

/**
 * 标准模数推荐系列 (mm)
 * 第1优先系列为优先选用，第2优先系列为补充
 */
const MODULE_SERIES = {
  priority1: [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10],
  priority2: [0.6, 0.8, 1.75, 3.5, 4.5, 5.5, 7, 9], // 补充系列（暂不列全）
  getAll: function() {
    return [...this.priority1, ...this.priority2].sort((a, b) => a - b);
  }
};

// ============================================================
// 三、公差等级参数（GB/T 3478.1-2008 第8章）
// ============================================================

/**
 * 公差等级系数
 * 总公差 (T+λ) = K1 × i*(D) + K2 × i**(S)
 * 其中 i*(D) = 0.45∛D + 0.001D (D≤500mm)
 *       i**(S) = 0.45∛S + 0.001S
 *
 * 单项公差公式（GB/T 3478.1-2008 第8.4节 表5-53）：
 *   Fp (齿距累积公差) = fpA × √L_arc + fpB   (L_arc = πD, μm)
 *   ff (齿形公差)     = ffA × m + ffB         (μm)
 *   Fβ (齿向公差)     = fbetaA × √L_eng + fbetaB  (μm)
 *
 * 公差等级 4/5/6/7 对应 ISO 1328 齿轮精度 5/6/7/8 级
 * 来源：GB/T 3478.1-2008 第8.3节（K1/K2 表8）、第8.4节（单项公差表）
 */
const TOLERANCE_GRADES = {
  4: {
    name: '4级',
    description: '精密磨削花键',
    k1: 10,   // (T+λ) 中 i*(D) 系数 — 表8
    k2: 40,   // (T+λ) 中 i**(S) 系数 — 表8
    fpA: 2.5,       // Fp = 2.5√L + 6.3  (L=π·m·z/2, 分度圆周长之半)
    fpB: 6.3,       // GB/T 3478.1-2008 第8.4节 a)
    ffA: 1.6,       // ff = 1.6φ + 10  (φ=m+0.0125·m·z, 公差因数)
    ffB: 10,        // GB/T 3478.1-2008 第8.5节 a)
    fbetaA: 0.8,    // Fβ = 0.8√g + 4  (g=配合长度)
    fbetaB: 4,      // GB/T 3478.1-2008 第8.6节 a)
  },
  5: {
    name: '5级',
    description: '磨削或精密拉削花键',
    k1: 16,
    k2: 64,
    fpA: 3.55,      // Fp = 3.55√L + 9  — 第8.4节 b)
    fpB: 9,
    ffA: 2.5,       // ff = 2.5φ + 16  — 第8.5节 b)
    ffB: 16,
    fbetaA: 1.0,    // Fβ = 1.0√g + 5  — 第8.6节 b)
    fbetaB: 5,
  },
  6: {
    name: '6级',
    description: '拉削或滚齿花键',
    k1: 25,
    k2: 100,
    fpA: 5.0,       // Fp = 5.0√L + 12.5  — 第8.4节 c)
    fpB: 12.5,
    ffA: 4.0,       // ff = 4.0φ + 25  — 第8.5节 c)
    ffB: 25,
    fbetaA: 1.25,   // Fβ = 1.25√g + 6.3  — 第8.6节 c)
    fbetaB: 6.3,
  },
  7: {
    name: '7级',
    description: '一般机械加工花键',
    k1: 40,
    k2: 160,
    fpA: 7.1,       // Fp = 7.1√L + 18  — 第8.4节 d)
    fpB: 18,
    ffA: 6.3,       // ff = 6.3φ + 40  — 第8.5节 d)
    ffB: 40,
    fbetaA: 2.0,    // Fβ = 2.0√g + 10  — 第8.6节 d)
    fbetaB: 10,
  }
};

// ============================================================
// 四、配合类别与基本偏差（GB/T 3478.1-2008 第7章）
// ============================================================

/**
 * 配合类别定义
 * 内花键采用基孔制 H（EI = 0）
 * 外花键基本偏差由配合代号决定
 * es_v（作用齿厚上偏差）由表24查取
 */
const FIT_TYPES = {
  'H/h': {
    name: 'H/h',
    description: '滑动配合',
    type: '间隙配合',
    extDeviationSign: 'h',
    note: '适用于轴向滑动花键联接，齿面有相对运动'
  },
  'H/f': {
    name: 'H/f',
    description: '紧滑动配合',
    type: '间隙配合',
    extDeviationSign: 'f',
    note: '适用于精密定心、小幅轴向滑动场合'
  },
  'H/e': {
    name: 'H/e',
    description: '转动配合',
    type: '间隙配合',
    extDeviationSign: 'e',
    note: '适用于相对转动或较大间隙要求'
  },
  'H/d': {
    name: 'H/d',
    description: '松转动配合',
    type: '间隙配合',
    extDeviationSign: 'd',
    note: '适用于大间隙、较大温度变化场合'
  },
  'H/k': {
    name: 'H/k',
    description: '过渡配合',
    type: '过渡配合',
    extDeviationSign: 'k',
    note: '适用于精密定心、需少量过盈的固定联接'
  },
  'H/js': {
    name: 'H/js',
    description: '过渡配合（对称）',
    type: '过渡配合',
    extDeviationSign: 'js',
    note: '公差带对称分布，适用于精密定位'
  }
};

// ============================================================
// 五、基本偏差 es_v 查表 — GB/T 3478.1-2008 表24
//    外花键作用齿厚上偏差 es_v (μm)
//    按配合类别和分度圆直径 D 分段查取
// ============================================================

/**
 * es_v 基本偏差表 (μm) — GB/T 3478.1-2008 表23
 * 按分度圆直径 D (mm) 分段，配合代号: d/e/f/h/k/js
 *
 * h: es_v = 0
 * k: es_v = +(T+λ)  — 过渡配合（注：非除以2tanα！）
 * js: es_v = +(T+λ)/2 — 对称分布
 * f/e/d: 负偏差，表中给值
 *
 * 数据来源：GB/T 3478.1-2008 表23 — 作用齿槽宽Ev下偏差和作用齿厚Sv上偏差
 */
const ESV_TABLE = {
  // D 分段上限 (mm)
  dRanges: [6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500, 630, 800, 1000],
  // es_v (μm) 按配合代号
  values: {
    // h: es_v = 0  (所有直径段)
    h: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // f: 紧滑动配合 es_v (μm) — 负值
    f: [-10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68, -76, -80, -86],
    // e: 转动配合 es_v (μm) — 负值
    e: [-20, -25, -32, -40, -50, -60, -72, -85, -100, -110, -125, -135, -145, -160, -170],
    // d: 松转动配合 es_v (μm) — 负值
    d: [-30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230, -260, -290, -320],
    // k: 过渡配合 — 由公式计算: es_v = +(T+λ)  （表23注）
    k: null,
    // js: 对称过渡 — es_v = +(T+λ)/2  （表23注）
    js: null
  }
};

/**
 * 根据分度圆直径 D 和配合代号查取 es_v (μm)
 * @param {number} D - 分度圆直径 (mm)
 * @param {string} fitCode - 配合代号 ('h'|'f'|'e'|'d'|'k'|'js')
 * @param {number} totalTol - 总公差 (T+λ) (μm)，k/js 配合时需要
 * @returns {number} es_v (μm)
 */
function lookupEsV(D, fitCode, totalTol) {
  // k 配合: es_v = +(T+λ)  — 表23
  if (fitCode === 'k') {
    return totalTol;
  }
  // js 配合: es_v = +(T+λ) / 2  — 表23
  if (fitCode === 'js') {
    return totalTol / 2;
  }
  // h 配合: es_v = 0
  if (fitCode === 'h') return 0;

  // f/e/d 配合: 查表
  var ranges = ESV_TABLE.dRanges;
  var vals = ESV_TABLE.values[fitCode];
  if (!vals) return 0;

  for (var i = 0; i < ranges.length; i++) {
    if (D <= ranges[i]) return vals[i];
  }
  // D > 500mm 取最后一段外推
  var last = ranges.length - 1;
  return Math.round(vals[last] * (D / ranges[last]));
}

// ============================================================
// 六、外花键大径上偏差表 — GB/T 3478.1-2008 表24
//    es_v / tan(α_D) (μm) — 外花键大径上偏差
//    ============================================================

/**
 * 外花键大径/小径上偏差 = es_v / tan(α_D)
 * 直接从表24查取 (μm)，按分度圆直径 D 分段
 *
 * 数据来源：GB/T 3478.1-2008 表24（30°压力角列）
 * tan(30°) ≈ 0.57735
 */
const ESV_TAN_TABLE = {
  dRanges: [6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500, 630, 800, 1000],
  values: {
    h: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    f: [-17, -23, -28, -35, -43, -52, -62, -74, -87, -97, -107, -118, -132, -139, -149],
    e: [-35, -43, -55, -69, -87, -104, -125, -147, -170, -190, -210, -230, -260, -290, -320],
    d: [-52, -69, -87, -113, -139, -173, -208, -251, -294, -329, -364, -398, -450, -502, -554]
  }
};

/**
 * 根据 D 和配合代号查取外花键大径上偏差 es_v/tan(α_D) (μm)
 */
function lookupExtMajorUpperDev(D, fitCode) {
  if (fitCode === 'k' || fitCode === 'js') {
    // k/js 配合: 上偏差由总公差决定，在 calcFundamentalDeviation 中计算
    return null;
  }
  if (fitCode === 'h') return 0;

  var ranges = ESV_TAN_TABLE.dRanges;
  var vals = ESV_TAN_TABLE.values[fitCode];
  if (!vals) return 0;

  for (var i = 0; i < ranges.length; i++) {
    if (D <= ranges[i]) return vals[i];
  }
  return vals[vals.length - 1];
}

// ============================================================
// 七、大径/小径公差表 — GB/T 3478.1-2008 表25
//    直接查表获取公差值 (μm)，不通过 IT 公式计算
//    ============================================================

/**
 * 表25 — 内花键小径 D_ii 极限偏差和外花键大径 D_ee 公差
 *
 * 数据来源：GB/T 3478.1-2008 表25
 *
 * 结构：
 *   行 = 直径分段 (同表23/24)
 *   列 = 模数分段: 0.25~0.75 / 1~1.75 / 2~10
 *   值 = 公差/极限偏差 (μm)
 *   null = 该组合不在标准范围内
 *
 * 内花键小径 D_ii: H偏差，下偏差=0，上偏差=查表值
 * 外花键大径 D_ee: 公差=查表值
 * （两者数值相同，共用此表）
 */
const TABLE25 = {
  mRanges: [0.75, 1.75, 10],       // 模数分段上限 (mm)
  dRanges: [6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500, 630, 800, 1000],
  // tolerance[moduleRangeIdx][diameterRangeIdx] = 公差值 (μm)
  values: [
    // m = 0.25~0.75
    [48, 58, 70, 84, 100, 120, null, null, null, null, null, null, null, null, null],
    // m = 1~1.75
    [null, 90, 110, 130, 160, 190, 220, 250, null, null, null, null, null, null, null],
    // m = 2~10
    [null, null, 180, 210, 250, 300, 350, 400, 460, 520, 570, 630, 700, 800, 900]
  ]
};

/**
 * 从表25查取直径公差值 (μm)
 * @param {number} diameter - 基本直径 (mm)，如 D_ii 或 D_ee
 * @param {number} m - 模数 (mm)
 * @returns {number|null} 公差值 (μm)，null 表示超出标准范围（需用 IT 公式回退）
 */
function lookupTable25Tolerance(diameter, m) {
  // 确定模数分段
  var mIdx = 0;
  for (var i = 0; i < TABLE25.mRanges.length; i++) {
    if (m <= TABLE25.mRanges[i]) { mIdx = i; break; }
  }
  if (m > TABLE25.mRanges[TABLE25.mRanges.length - 1]) {
    mIdx = TABLE25.mRanges.length - 1;
  }

  // 确定直径分段
  var dIdx = 0;
  for (var i = 0; i < TABLE25.dRanges.length; i++) {
    if (diameter <= TABLE25.dRanges[i]) { dIdx = i; break; }
  }
  if (diameter > TABLE25.dRanges[TABLE25.dRanges.length - 1]) {
    dIdx = TABLE25.dRanges.length - 1;
  }

  return TABLE25.values[mIdx][dIdx];  // μm，null 表示无效组合
}

// ============================================================
// 八、内花键大径 D_ei 公差等级 — GB/T 3478.1-2008
//    D_ei 为非配合直径，公差较宽
//    按模数 m 分段选取 IT12~IT14
//    （注：D_ei 不在表25中，使用 IT 公式回退计算）
//    ============================================================

/**
 * 内花键大径 D_ei 公差等级 — 按模数 m 分段
 * 数据来源：GB/T 3478.1-2008
 */
const INT_MAJOR_TOL_GRADE = [
  { mMax: 0.75, IT: 12 },
  { mMax: 2.0,  IT: 13 },
  { mMax: 6.0,  IT: 13 },
  { mMax: 10,   IT: 14 }
];

/**
 * 根据模数 m 从分段表中获取 IT 等级
 */
function getITgradeFromTable(table, m) {
  for (var i = 0; i < table.length; i++) {
    if (m <= table[i].mMax) return table[i].IT;
  }
  return table[table.length - 1].IT;
}

// ============================================================
// 九、IT 标准公差数值表（GB/T 1800.4-2009）
//    用于 D_ei 等非表25覆盖直径的 IT 公式回退计算
//    IT = 等级乘数 × i，其中 i = 0.45∛D + 0.001D (D≤500mm)
//    ============================================================

/**
 * IT 等级乘数 — ISO 286 标准乘数
 */
const IT_MULTIPLIERS = {
  5: 7, 6: 10, 7: 16, 8: 25, 9: 40, 10: 64,
  11: 100, 12: 160, 13: 250, 14: 400, 15: 640
};

// ============================================================
// 十、量棒直径推荐表（GB/T 3478.5-2008）
// ============================================================

/**
 * 标准量棒直径推荐值
 * 30° 压力角渐开线花键推荐量棒直径约为 D_R ≈ 1.732m
 * 实际选取时优先采用标准量棒尺寸
 */
function getRecommendedPinDiameter(m) {
  // 理论最佳量棒直径：D_R = 1.732m（对于30°压力角）
  const theoretical = 1.732 * m;
  // 可选标准量棒直径 (R40 优先数系)
  const standardPins = [
    0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.5,
    3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5,
    7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
    11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 18.0, 20.0
  ];
  // 选取最接近理论值的标准量棒
  let closest = standardPins[0];
  let minDiff = Math.abs(theoretical - closest);
  for (let i = 1; i < standardPins.length; i++) {
    const diff = Math.abs(theoretical - standardPins[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = standardPins[i];
    }
  }
  return {
    theoretical: parseFloat(theoretical.toFixed(4)),
    recommended: closest,
    standardOptions: standardPins.filter(d => d >= theoretical * 0.5 && d <= theoretical * 2.0)
  };
}

// ============================================================
// 十一、行业安全系数判定标准（依据 CLAUDE.md 规范）
// ============================================================

const SAFETY_STANDARDS = {
  general: {
    name: '通用工业电机',
    standard: '《机械设计手册》第五版',
    contactSafety: { qualified: 1.5, warning: 1.2 },
    bendingSafety: { qualified: 1.3, warning: 1.0 },
    note: '载荷与应力计算一般精度场景'
  },
  newEnergy: {
    name: '新能源汽车驱动电机',
    standard: 'GB/T 18488-2024',
    contactSafety: { qualified: 1.8, warning: 1.5 },
    bendingSafety: { qualified: 1.8, warning: 1.5 },
    note: '关键承力部件安全系数整体提升'
  },
  highSpeed: {
    name: '高速永磁电机 (≥10000rpm)',
    standard: '高速电机设计规范',
    contactSafety: { qualified: 2.0, warning: 1.8 },
    bendingSafety: { qualified: 2.0, warning: 1.8 },
    note: '转子护套、磁钢离心强度合格安全系数≥2.0'
  },
  aviation: {
    name: '低空经济/eVTOL航空级电机',
    standard: '航空级失效概率要求',
    contactSafety: { qualified: 2.5, warning: 2.0 },
    bendingSafety: { qualified: 2.5, warning: 2.0 },
    note: '灾难性失效≤10⁻⁹/飞行小时'
  }
};

// ============================================================
// 十一、常用材料许用应力参考（补充数据）
// ============================================================

/**
 * 常用花键材料许用应力 (MPa) 与磨损参数
 * 来源：《机械设计手册》第五版 第3卷
 *
 * 各字段含义：
 *   allowableCompression  — 许用挤压应力 [σ_H] (MPa)，接触强度校核
 *   allowableShear        — 许用剪切应力 [τ] (MPa)，齿根抗剪及轴扭转校核
 *   allowableBending      — 许用弯曲应力 [σ_F] (MPa)，齿根弯曲及轴弯曲校核
 *   allowableWearPV       — 许用 p·v 值 (MPa·m/s)，10^8 次循环磨损校核
 *                           条件：边界润滑/脂润滑钢对钢摩擦副
 *   allowableWearFreeContact — 长期工作无磨损许用接触应力 [σ_Hw] (MPa)
 *                           条件：σ_H 低于此值则不发生显著微动磨损
 *   hardness              — 硬度范围
 */
const MATERIAL_PROPERTIES = {
  '45钢调质': {
    allowableCompression: 100,
    allowableShear: 60,
    allowableBending: 120,
    allowableWearPV: 2.5,             // MPa·m/s（脂润滑/边界润滑）
    allowableWearFreeContact: 45,     // MPa（低于此值长期工作无明显磨损）
    hardness: 'HB220-250'
  },
  '40Cr调质': {
    allowableCompression: 140,
    allowableShear: 85,
    allowableBending: 170,
    allowableWearPV: 3.5,
    allowableWearFreeContact: 60,
    hardness: 'HB250-280'
  },
  '20CrMnTi渗碳淬火': {
    allowableCompression: 200,
    allowableShear: 120,
    allowableBending: 250,
    allowableWearPV: 8.0,             // 高硬度表面，耐磨性显著提高
    allowableWearFreeContact: 100,
    hardness: 'HRC58-62'
  },
  '42CrMo调质': {
    allowableCompression: 150,
    allowableShear: 90,
    allowableBending: 180,
    allowableWearPV: 4.0,
    allowableWearFreeContact: 70,
    hardness: 'HB260-300'
  },
  '38CrMoAl氮化': {
    allowableCompression: 180,
    allowableShear: 110,
    allowableBending: 220,
    allowableWearPV: 6.0,             // 氮化层硬度极高，耐磨性优越
    allowableWearFreeContact: 90,
    hardness: 'HV900-1100'
  }
};

// ============================================================
// 十二、GB/T 17855-1999 花键承载能力计算 — 系数与许用值
// ============================================================

/**
 * GB/T 17855-1999 应用工况系数表
 * K1 — 使用系数（表1），K2 — 齿侧间隙系数（表2）
 * K3 — 载荷分布系数（表3），K4 — 轴向偏斜系数（表4）
 * S_H — 齿面接触强度安全系数，S_F — 齿根弯曲强度安全系数
 */
var GB17855_APP_TYPES = {
  /** 电动机 → 泵/压缩机（平稳） */
  motor_pump: {
    name: '电动机→泵/压缩机（平稳）',
    K1: 1.0, K2: 1.1, K3: 1.1, K4: 1.2,
    S_H: 1.25, S_F: 1.0
  },
  /** 电动机 → 齿轮箱（中等冲击） */
  motor_gearbox: {
    name: '电动机→齿轮箱（中等冲击）',
    K1: 1.25, K2: 1.1, K3: 1.2, K4: 1.3,
    S_H: 1.25, S_F: 1.0
  },
  /** 燃气轮机 → 螺旋桨（轻微冲击） — GB/T 17855-1999 例1 */
  gasTurbine_propeller: {
    name: '燃气轮机→螺旋桨（轻微冲击）',
    K1: 1.25, K2: 1.1, K3: 1.1, K4: 1.5,
    S_H: 1.25, S_F: 1.0
  },
  /** 发动机 → 传动轴（中等冲击） */
  engine_driveline: {
    name: '发动机→传动轴（中等冲击）',
    K1: 1.5, K2: 1.2, K3: 1.3, K4: 1.5,
    S_H: 1.25, S_F: 1.0
  },
  /** 电动机 → 发电机（平稳） */
  motor_generator: {
    name: '电动机→发电机（平稳）',
    K1: 1.0, K2: 1.0, K3: 1.0, K4: 1.0,
    S_H: 1.25, S_F: 1.0
  }
};

/**
 * GB/T 17855-1999 表4 — 10^6 循环齿面磨损许用压应力 [σ_H1] (MPa)
 * 按材料/热处理状态查取
 */
var GB17855_WEAR_TABLE4 = {
  /** 优质合金钢，调质/表面淬火，HB 280~350 */
  alloySteel_quenched: {
    name: '优质合金钢 调质/表面淬火 HB280-350',
    sigma_H1_MPa: 110
  },
  /** 渗碳淬火钢，HRC 58~62 */
  caseHardened: {
    name: '渗碳淬火钢 HRC58-62',
    sigma_H1_MPa: 185
  },
  /** 氮化钢，HV 900~1100 */
  nitrided: {
    name: '氮化钢 HV900-1100',
    sigma_H1_MPa: 150
  },
  /** 普通碳钢/低合金钢，调质 HB 200~280 */
  carbonSteel_quenched: {
    name: '碳钢/低合金钢 调质 HB200-280',
    sigma_H1_MPa: 80
  }
};

/**
 * GB/T 17855-1999 表5 — 长期工作无磨损许用压应力系数
 * [σ_H2] = coeff × HB (MPa)
 * 其中 coeff 为磨损系数
 */
var GB17855_WEAR_TABLE5 = {
  coeff: 0.032,       // 标准磨损系数
  note: '[σ_H2] = 0.032 × HB (MPa)'
};

/**
 * 根据硬度查取 10^6 循环许用压应力
 * @param {string} wearGrade - 磨损等级键值
 * @returns {number} [σ_H1] (MPa)
 */
function lookupWearAllowable10e6(wearGrade) {
  var entry = GB17855_WEAR_TABLE4[wearGrade];
  return entry ? entry.sigma_H1_MPa : 110;
}

/**
 * 计算长期无磨损许用压应力
 * @param {number} HB - 布氏硬度值
 * @returns {number} [σ_H2] (MPa)
 */
function calcWearAllowableLongTerm(HB) {
  return GB17855_WEAR_TABLE5.coeff * HB;
}

// ============================================================
// 十三、导出（ES Module 兼容浏览器）
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BASIC_PROFILE_30,
    MODULE_SERIES,
    TOLERANCE_GRADES,
    FIT_TYPES,
    ESV_TABLE,
    ESV_TAN_TABLE,
    lookupEsV,
    lookupExtMajorUpperDev,
    TABLE25,
    lookupTable25Tolerance,
    INT_MAJOR_TOL_GRADE,
    getITgradeFromTable,
    IT_MULTIPLIERS,
    getRecommendedPinDiameter,
    SAFETY_STANDARDS,
    MATERIAL_PROPERTIES,
    GB17855_APP_TYPES,
    GB17855_WEAR_TABLE4,
    GB17855_WEAR_TABLE5,
    lookupWearAllowable10e6,
    calcWearAllowableLongTerm
  };
}
// 浏览器环境通过全局变量暴露
