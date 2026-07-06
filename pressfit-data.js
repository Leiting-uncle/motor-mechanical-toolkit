/**
 * ============================================================
 * pressfit-data.js — 过盈配合共用数据层
 * 依据：《机械设计手册》第五版 第2卷 第6章 — 过盈联接
 *       GB/T 5371-2004《极限与配合 过盈配合的计算和选用》
 *
 * 职责：仅存放材料属性表、摩擦系数表、配合推荐表
 * 禁止：任何计算逻辑、DOM 操作
 * ============================================================
 */

// ============================================================
// 一、材料属性表
// ============================================================

/**
 * 常用电机材料机械性能
 *
 * 字段含义：
 *   name            — 材料名称
 *   E_MPa           — 弹性模量 (MPa)
 *   nu              — 泊松比
 *   alpha_perK      — 线膨胀系数 (/°C)，存储为 ×10⁻⁶ 前的数值
 *   rho_kgm3        — 密度 (kg/m³)
 *   sigma_s_MPa     — 屈服强度 (MPa)
 *   sigma_b_tensile — 抗拉强度 (MPa)，用于判定拉裂安全系数
 *   sigma_b_compress— 抗压强度 (MPa)，用于判定压溃安全系数
 *   hardness         — 硬度描述
 *   note             — 备注
 */
const PRESSFIT_MATERIALS = {
  // ========== 轴/铁心类（内件） ==========
  '45钢': {
    name: '45钢',
    category: 'steel_shaft',
    E_MPa: 206000,
    nu: 0.30,
    alpha_perK: 11.5,      // ×10⁻⁶/°C
    rho_kgm3: 7850,
    sigma_s_MPa: 355,
    sigma_b_tensile: 600,
    sigma_b_compress: 600, // 钢材拉压相当
    hardness: 'HB170-217',
    note: '最常用转轴材料，调质处理'
  },
  '40Cr': {
    name: '40Cr',
    category: 'steel_shaft',
    E_MPa: 206000,
    nu: 0.30,
    alpha_perK: 11.5,
    rho_kgm3: 7850,
    sigma_s_MPa: 540,
    sigma_b_tensile: 800,
    sigma_b_compress: 800,
    hardness: 'HB241-286',
    note: '合金结构钢，用于重载转轴'
  },
  '42CrMo': {
    name: '42CrMo',
    category: 'steel_shaft',
    E_MPa: 206000,
    nu: 0.30,
    alpha_perK: 11.5,
    rho_kgm3: 7850,
    sigma_s_MPa: 550,
    sigma_b_tensile: 850,
    sigma_b_compress: 850,
    hardness: 'HB260-300',
    note: '大截面重载轴'
  },
  '38CrMoAl': {
    name: '38CrMoAl',
    category: 'steel_shaft',
    E_MPa: 206000,
    nu: 0.30,
    alpha_perK: 11.5,
    rho_kgm3: 7850,
    sigma_s_MPa: 500,
    sigma_b_tensile: 750,
    sigma_b_compress: 750,
    hardness: 'HV900-1100 (氮化后)',
    note: '氮化钢，高表面硬度'
  },

  // ========== 硅钢片叠层（铁心类） ==========
  '硅钢片叠层_B35AV1900': {
    name: '硅钢片叠层 B35AV1900',
    category: 'lamination',
    E_MPa: 150000,
    nu: 0.27,
    alpha_perK: 12.0,
    rho_kgm3: 7650,
    sigma_s_MPa: 350,          // 叠片方向屈服
    sigma_b_tensile: 300,      // 周向抗拉 — 硅钢片抗拉极弱！
    sigma_b_compress: 450,     // 径向抗压 — 叠片方向抗压很强
    hardness: 'HV150-200',
    note: '无取向硅钢片，注意：周向抗拉强度远低于径向抗压，转子过盈中最易拉裂'
  },
  '硅钢片叠层_B50A470': {
    name: '硅钢片叠层 B50A470',
    category: 'lamination',
    E_MPa: 150000,
    nu: 0.27,
    alpha_perK: 12.0,
    rho_kgm3: 7700,
    sigma_s_MPa: 380,
    sigma_b_tensile: 350,
    sigma_b_compress: 500,
    hardness: 'HV160-210',
    note: '中牌号无取向硅钢片'
  },
  '硅钢片叠层_B35A300': {
    name: '硅钢片叠层 B35A300',
    category: 'lamination',
    E_MPa: 155000,
    nu: 0.27,
    alpha_perK: 12.0,
    rho_kgm3: 7650,
    sigma_s_MPa: 420,
    sigma_b_tensile: 420,
    sigma_b_compress: 550,
    hardness: 'HV180-230',
    note: '高牌号无取向硅钢片，机械性能较优'
  },

  // ========== 机座类（外件） ==========
  '铝合金_6061-T6': {
    name: '铝合金 6061-T6',
    category: 'frame',
    E_MPa: 70000,
    nu: 0.33,
    alpha_perK: 23.0,          // 铝合金热膨胀系数约为钢的2倍！
    rho_kgm3: 2700,
    sigma_s_MPa: 240,
    sigma_b_tensile: 290,
    sigma_b_compress: 290,
    hardness: 'HB95',
    note: '常用电机机座材料，重量轻但热膨胀大，高温下过盈量损失显著'
  },
  '铝合金_A380': {
    name: '铝合金 A380 (压铸)',
    category: 'frame',
    E_MPa: 71000,
    nu: 0.33,
    alpha_perK: 22.0,
    rho_kgm3: 2710,
    sigma_s_MPa: 160,
    sigma_b_tensile: 320,
    sigma_b_compress: 320,
    hardness: 'HB80',
    note: '压铸铝合金机座，中小型电机常用'
  },
  '铸铁_HT200': {
    name: '铸铁 HT200',
    category: 'frame',
    E_MPa: 120000,
    nu: 0.26,
    alpha_perK: 10.5,
    rho_kgm3: 7200,
    sigma_s_MPa: 200,          // 铸铁无明确屈服，取抗拉强度
    sigma_b_tensile: 200,
    sigma_b_compress: 600,     // 铸铁抗压远强于抗拉
    hardness: 'HB170-220',
    note: '传统电机机座材料，热膨胀系数与钢接近，高温稳定性好'
  },
  '铸铁_HT250': {
    name: '铸铁 HT250',
    category: 'frame',
    E_MPa: 130000,
    nu: 0.26,
    alpha_perK: 10.5,
    rho_kgm3: 7250,
    sigma_s_MPa: 250,
    sigma_b_tensile: 250,
    sigma_b_compress: 700,
    hardness: 'HB190-240',
    note: '高强度灰铸铁'
  },
  '结构钢_Q235': {
    name: '结构钢 Q235',
    category: 'frame',
    E_MPa: 206000,
    nu: 0.30,
    alpha_perK: 11.5,
    rho_kgm3: 7850,
    sigma_s_MPa: 235,
    sigma_b_tensile: 400,
    sigma_b_compress: 400,
    hardness: 'HB120-160',
    note: '焊接机座用钢'
  },
  '结构钢_Q345': {
    name: '结构钢 Q345',
    category: 'frame',
    E_MPa: 206000,
    nu: 0.30,
    alpha_perK: 11.5,
    rho_kgm3: 7850,
    sigma_s_MPa: 345,
    sigma_b_tensile: 500,
    sigma_b_compress: 500,
    hardness: 'HB150-190',
    note: '低合金高强度结构钢，大型电机机座'
  }
};

// ============================================================
// 二、摩擦系数表（《机械设计手册》第五版 第2卷 表6-3-4）
// ============================================================

/**
 * 过盈联接摩擦系数 f
 * 取决于材料配对、结合面粗糙度、压入方式
 *
 * key 格式: "内件材料代号_外件材料代号"
 */
const FRICTION_COEFFICIENTS = {
  // 钢-钢
  'steel_steel': {
    pressFit: { value: 0.10, range: '0.08~0.12', note: '钢轴压入钢毂，矿物油润滑' },
    shrinkFit: { value: 0.14, range: '0.12~0.16', note: '加热包容件（热装），结合面无润滑' }
  },
  // 钢-铸铁
  'steel_castIron': {
    pressFit: { value: 0.12, range: '0.10~0.15', note: '钢轴压入铸铁毂' },
    shrinkFit: { value: 0.16, range: '0.14~0.18', note: '铸铁毂热装到钢轴' }
  },
  // 钢-铝合金
  'steel_aluminum': {
    pressFit: { value: 0.08, range: '0.05~0.10', note: '钢轴压入铝合金毂（注意铝表面易刮伤）' },
    shrinkFit: { value: 0.10, range: '0.08~0.12', note: '铝合金毂热装到钢轴' }
  },
  // 硅钢片-钢
  'lamination_steel': {
    pressFit: { value: 0.10, range: '0.08~0.12', note: '硅钢片铁心压入钢轴' },
    shrinkFit: { value: 0.14, range: '0.12~0.16', note: '铁心热装到转轴' }
  },
  // 硅钢片-铸铁
  'lamination_castIron': {
    pressFit: { value: 0.11, range: '0.09~0.14', note: '铁心压入铸铁机座' },
    shrinkFit: { value: 0.15, range: '0.12~0.17', note: '铸铁机座加热套装铁心' }
  },
  // 硅钢片-铝合金
  'lamination_aluminum': {
    pressFit: { value: 0.07, range: '0.05~0.09', note: '铁心压入铝合金机座' },
    shrinkFit: { value: 0.09, range: '0.07~0.11', note: '铝合金机座加热套装铁心' }
  }
};

/**
 * 根据材料类别返回摩擦副键
 * @param {string} innerCategory - 内件材料类别
 * @param {string} outerCategory - 外件材料类别
 * @returns {string} 摩擦副键
 */
function getFrictionPairKey(innerCategory, outerCategory) {
  const inner = innerCategory === 'lamination' ? 'lamination' : 'steel';
  const outer = outerCategory === 'frame' && outerCategory !== 'steel_shaft'
    ? (outerCategory === 'frame' ? 'steel' : outerCategory) : 'steel';

  // 实际上需要根据具体材料判断，这里简化映射
  if (innerCategory === 'lamination') {
    if (outerCategory === 'frame') return 'lamination_steel'; // 默认钢机座
    return 'lamination_steel';
  }
  if (outerCategory === 'frame') return 'steel_steel'; // 默认钢机座
  return 'steel_steel';
}

// ============================================================
// 三、配合推荐与过盈量参考（GB/T 5371-2004）
// ============================================================

/**
 * 电机行业常用过盈配合及对应过盈量范围
 *
 * 过盈量 δ = 孔最小直径 − 轴最大直径（直径方向，单位 μm）
 * 实际过盈量在 δ_min ~ δ_max 之间波动
 */
const FIT_RECOMMENDATIONS = {
  statorFrame: [
    { fit: 'H7/p6',  type: '轻过盈', dMin: 50,  dMax: 120, deltaMin: 10, deltaMax: 45, note: '小型电机，铝机座' },
    { fit: 'H7/r6',  type: '中等过盈', dMin: 80,  dMax: 200, deltaMin: 20, deltaMax: 70, note: '中型电机通用' },
    { fit: 'H7/s6',  type: '重过盈', dMin: 120, dMax: 350, deltaMin: 35, deltaMax: 110, note: '大型电机，铸铁机座' },
    { fit: 'H7/t6',  type: '加重过盈', dMin: 200, dMax: 500, deltaMin: 55, deltaMax: 160, note: '重载大型电机' },
    { fit: 'custom', type: '自定义', dMin: 0,   dMax: 9999, deltaMin: 0,  deltaMax: 0, note: '手动输入过盈量' }
  ],
  rotorShaft: [
    { fit: 'H7/p6',  type: '轻过盈', dMin: 20,  dMax: 80,  deltaMin: 10, deltaMax: 40, note: '小电机，轻载' },
    { fit: 'H7/r6',  type: '中等过盈', dMin: 50,  dMax: 150, deltaMin: 20, deltaMax: 65, note: '通用工业电机' },
    { fit: 'H7/s6',  type: '重过盈', dMin: 100, dMax: 250, deltaMin: 35, deltaMax: 100, note: '牵引电机/伺服电机' },
    { fit: 'H7/u6',  type: '特重过盈', dMin: 150, dMax: 400, deltaMin: 60, deltaMax: 170, note: '大扭矩、高转速' },
    { fit: 'custom', type: '自定义', dMin: 0,   dMax: 9999, deltaMin: 0,  deltaMax: 0, note: '手动输入过盈量' }
  ]
};

// ============================================================
// 四、安全系数标准
// ============================================================

/**
 * 过盈联接安全系数
 * 来源：《机械设计手册》第五版 第2卷 表6-3-5
 */
const PRESSFIT_SAFETY = {
  // 防滑安全系数 K（抵抗周向滑移）
  antiSlip: {
    static:   { value: 1.5, note: '静载荷，无冲击' },
    dynamic:  { value: 2.0, note: '动载荷，轻微冲击' },
    reversing:{ value: 2.5, note: '正反转、频繁启动' },
    highSpeed:{ value: 3.0, note: '高转速(>10000rpm)，需额外考虑离心力' }
  },
  // 强度安全系数 S（抵抗塑性变形/破坏）
  strength: {
    // 对包容件（外件）：S = σ_s / σ_t_max
    outerYield:    { value: 1.5, note: '外件不产生塑性变形' },
    // 对被包容件（内件）：S = σ_s / |σ_t_max|
    innerYield:    { value: 1.5, note: '内件不产生塑性变形' },
    // 硅钢片特别要求：S ≥ 2.0（抗拉强度极低）
    lamination:    { value: 2.0, note: '硅钢片叠层抗拉安全系数，因材料脆性取高值' }
  },
  // 最小接触压力（确保热传导）
  thermalContact: { value: 1.0, note: '保证有效热接触的最小接触压力 (MPa)' }
};

// ============================================================
// 五、配合过盈量计算辅助（GB/T 1800.4-2009 标准公差）
// ============================================================

/**
 * 根据配合代号估算过盈量范围（近似值）
 * 这是 IT 公差配合的简化计算，精确值需查表
 *
 * @param {string} fitCode - 配合代号，如 'H7/r6'
 * @param {number} nominalDia - 公称直径 (mm)
 * @returns {object} { deltaMin_um, deltaMax_um, note }
 */
function estimateInterferenceFromFit(fitCode, nominalDia) {
  // IT 公差单位
  const i = nominalDia <= 500
    ? 0.45 * Math.pow(nominalDia, 1/3) + 0.001 * nominalDia
    : 0.004 * nominalDia + 2.1;

  // IT5~IT8 乘数
  const itMultipliers = { 5: 7, 6: 10, 7: 16, 8: 25 };
  // 轴的基本偏差 (μm)
  // p: +IT5+(0~10), r: +IT6+(5~20), s: +IT7+(10~30), t: +IT7+(20~50), u: +IT7+(40~80)

  const parts = fitCode.split('/');
  if (parts.length !== 2) return { deltaMin_um: 0, deltaMax_um: 0, note: '无效配合代号' };

  const holeGrade = parseInt(parts[0].replace('H', ''));
  const shaftCode = parts[1];

  // H 孔：下偏差=0，上偏差=IT(grade)
  const holeES = itMultipliers[holeGrade] ? itMultipliers[holeGrade] * i : 25 * i;

  // 轴基本偏差（近似）
  let shaftEI; // 轴下偏差 (μm)
  const shaftGrade = parseInt(shaftCode.replace(/[a-z]/gi, ''));
  const shaftIT = itMultipliers[shaftGrade] ? itMultipliers[shaftGrade] * i : 16 * i;

  const shaftLetter = shaftCode.replace(/[0-9]/g, '').toLowerCase();

  // 轴基本偏差估算（GB/T 1800.3）
  const D = nominalDia;
  switch (shaftLetter) {
    case 'p': shaftEI = Math.pow(D, 0.34) * 2.5 + 2; break;
    case 'r': shaftEI = Math.pow(D, 0.34) * 4.5 + 5; break;
    case 's': shaftEI = Math.pow(D, 0.34) * 7 + 10; break;
    case 't': shaftEI = Math.pow(D, 0.34) * 11 + 20; break;
    case 'u': shaftEI = Math.pow(D, 0.34) * 16 + 40; break;
    default: shaftEI = 0;
  }

  // 过盈量范围
  const deltaMin_um = shaftEI - holeES; // 孔最大 - 轴最小 = 最小过盈
  // 实际上应该检查：孔最小(0) - 轴最大(shaftEI + shaftIT) = 最大过盈(绝对值)
  // 最小过盈发生在：孔最大(holeES) - 轴最小(shaftEI)
  // 不对，过盈 = 轴直径 - 孔直径
  // 最大过盈 = 轴最大(基本+shaftEI+shaftIT) - 孔最小(基本)
  // 最小过盈 = 轴最小(基本+shaftEI) - 孔最大(基本+holeES)
  const deltaMax_um = shaftEI + shaftIT;           // 轴最大 - 孔最小
  const deltaMin = shaftEI - holeES;               // 轴最小 - 孔最大

  return {
    deltaMin_um: Math.round(Math.max(0, deltaMin)),
    deltaMax_um: Math.round(deltaMax_um),
    holeGrade,
    shaftGrade,
    shaftIT: Math.round(shaftIT),
    holeES: Math.round(holeES),
    shaftEI: Math.round(shaftEI),
    note: `IT${holeGrade}孔 / IT${shaftGrade}轴 — 过盈量估算值，精确值请查GB/T 1800.4`
  };
}

// ============================================================
// 六、导出
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PRESSFIT_MATERIALS,
    FRICTION_COEFFICIENTS,
    FIT_RECOMMENDATIONS,
    PRESSFIT_SAFETY,
    getFrictionPairKey,
    estimateInterferenceFromFit
  };
}
