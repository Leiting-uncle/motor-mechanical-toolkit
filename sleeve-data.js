// ================================================================
// sleeve-data.js — 屏蔽套失效计算 数据层
// 依据：Vasiliev "Mechanics of Composite Structures" (1993)
//       Tsai-Wu "Journal of Composite Materials" (1971)
//       CLT Classical Lamination Theory
// 职责：仅存放复合材料性能数据、铺层模板、工况常量
// 禁止在数据层编写任何计算逻辑
// ================================================================

// ================================================================
// 一、复合材料预设数据库
// ================================================================
/**
 * 复合材料单层板性能数据
 * 字段说明：
 *   E1_GPa, E2_GPa  — 纵向/横向弹性模量 (GPa → 使用时需×1000转MPa)
 *   G12_GPa          — 面内剪切模量 (GPa)
 *   nu12             — 主泊松比
 *   X_t, X_c         — 纵向拉伸/压缩强度 (MPa)
 *   Y_t, Y_c         — 横向拉伸/压缩强度 (MPa)
 *   S                — 面内剪切强度 (MPa)
 *   rho_gcm3         — 密度 (g/cm³)
 *   数据来源：复合材料手册 (CMH-17)、厂商数据手册
 */
var COMPOSITE_PRESETS = {
  'CFRP_T700': {
    name: '碳纤维 T700/环氧',
    category: 'carbon',
    E1_GPa: 135,
    E2_GPa: 8.5,
    G12_GPa: 4.5,
    nu12: 0.30,
    X_t_MPa: 2100,
    X_c_MPa: 1300,
    Y_t_MPa: 50,
    Y_c_MPa: 170,
    S_MPa: 80,
    rho_gcm3: 1.55,
    description: '标准模量碳纤维，综合性能优异，电机屏蔽套首选'
  },
  'CFRP_M40J': {
    name: '碳纤维 M40J/环氧',
    category: 'carbon',
    E1_GPa: 230,
    E2_GPa: 7.0,
    G12_GPa: 4.0,
    nu12: 0.28,
    X_t_MPa: 2100,
    X_c_MPa: 1100,
    Y_t_MPa: 35,
    Y_c_MPa: 140,
    S_MPa: 65,
    rho_gcm3: 1.55,
    description: '高模量碳纤维，轴向刚度极高'
  },
  'CFRP_T800': {
    name: '碳纤维 T800/环氧',
    category: 'carbon',
    E1_GPa: 160,
    E2_GPa: 9.0,
    G12_GPa: 5.0,
    nu12: 0.30,
    X_t_MPa: 2700,
    X_c_MPa: 1600,
    Y_t_MPa: 55,
    Y_c_MPa: 190,
    S_MPa: 90,
    rho_gcm3: 1.58,
    description: '中模高强碳纤维，拉伸强度最高'
  },
  'GFRP_Eglass': {
    name: '玻璃纤维 E-Glass/环氧',
    category: 'glass',
    E1_GPa: 45,
    E2_GPa: 10,
    G12_GPa: 4.5,
    nu12: 0.28,
    X_t_MPa: 1100,
    X_c_MPa: 600,
    Y_t_MPa: 40,
    Y_c_MPa: 120,
    S_MPa: 70,
    rho_gcm3: 1.85,
    description: 'E-玻璃纤维，成本低，绝缘性好'
  },
  'GFRP_Sglass': {
    name: '玻璃纤维 S2-Glass/环氧',
    category: 'glass',
    E1_GPa: 55,
    E2_GPa: 13,
    G12_GPa: 5.5,
    nu12: 0.27,
    X_t_MPa: 1600,
    X_c_MPa: 800,
    Y_t_MPa: 50,
    Y_c_MPa: 150,
    S_MPa: 85,
    rho_gcm3: 1.95,
    description: '高强度玻璃纤维，耐冲击性能好'
  },
  'AFRP_Kevlar49': {
    name: '芳纶纤维 Kevlar49/环氧',
    category: 'aramid',
    E1_GPa: 76,
    E2_GPa: 5.5,
    G12_GPa: 2.3,
    nu12: 0.34,
    X_t_MPa: 1380,
    X_c_MPa: 280,
    Y_t_MPa: 30,
    Y_c_MPa: 140,
    S_MPa: 50,
    rho_gcm3: 1.38,
    description: '芳纶纤维，比重最轻，耐冲击，纵向压缩强度低'
  }
};

// ================================================================
// 二、铺层模板
// ================================================================
/**
 * 铺层角度约定：
 *   0°  = 纤维沿圆柱轴向（x方向）
 *   90° = 纤维沿圆周方向（θ方向/环向）
 *   正角度 = 逆时针（右旋螺旋）
 *
 * 所有模板为基本重复单元，通过铺层数 n_layers 控制总层数。
 * 对称铺层 [±θ] 自动处理：n_layers 保证为偶数。
 */
var LAYUP_TEMPLATES = {
  'AP45': {
    name: '[±45°] 角度铺层',
    angles: [45, -45],
    description: '±45°交替铺层，抗剪切/抗扭，最常用屏蔽套铺层',
    isRepeating: true,
    repeatPair: [45, -45]
  },
  'CROSS': {
    name: '[0°/90°] 正交铺层',
    angles: [0, 90],
    description: '0°/90°正交铺层，兼顾轴向和环向强度',
    isRepeating: true,
    repeatPair: [0, 90]
  },
  'HOOP': {
    name: '[90°] 环向增强',
    angles: [90],
    description: '纯环向缠绕，最大化抗外压能力，各向异性最显著',
    isRepeating: false,
    singleAngle: 90
  },
  'QUASI': {
    name: '[0°/90°/±45°] 准各向同性',
    angles: [0, 90, 45, -45],
    description: '准各向同性铺层，面内刚度接近各向同性',
    isRepeating: true,
    repeatGroup: [0, 90, 45, -45],
    groupSize: 4
  },
  'AXIAL': {
    name: '[0°] 轴向增强',
    angles: [0],
    description: '纯轴向铺层，最大化轴向刚度',
    isRepeating: false,
    singleAngle: 0
  },
  'CUSTOM': {
    name: '自定义铺层',
    angles: [],
    description: '手动输入任意铺层角度序列（逗号分隔）',
    isRepeating: false
  }
};

// ================================================================
// 三、端部条件定义
// ================================================================
var END_CONDITIONS = {
  'simplySupported': {
    name: '简支',
    description: '两端简支（可自由转动），轴向半波数 m 可为 1,2,3...',
    m_default: 1,
    m_search: true
  },
  'clamped': {
    name: '固支',
    description: '两端固支（转角为零），m=1 基频模态通常最低',
    m_default: 1,
    m_search: false
  }
};

// ================================================================
// 四、承压方向
// ================================================================
var PRESSURE_DIRECTIONS = {
  'external': {
    name: '外部压力（油在外侧）',
    pressureSign: -1,    // 外压为负
    hoopSign: -1,        // 环向受压
    note: '冷却油在绕组侧，屏蔽套外部承受油压 → 环向受压'
  },
  'internal': {
    name: '内部压力（油在内侧）',
    pressureSign: 1,
    hoopSign: 1,         // 环向受拉
    note: '冷却油在转子腔，屏蔽套内部承受油压 → 环向受拉'
  }
};

// ================================================================
// 五、轴向端盖类型
// ================================================================
var AXIAL_END_TYPES = {
  'capped': {
    name: '带端盖（封闭）',
    description: '两端有刚性端盖，油压同时作用在端盖和筒壁上',
    axialForceFactor: 0.5     // Nx = pressureSign * p * R / 2
  },
  'free': {
    name: '无端盖（开放）',
    description: '油压仅作用在筒壁，无轴向力分量',
    axialForceFactor: 0       // Nx = 0
  }
};

// ================================================================
// 六、安全系数阈值
// ================================================================
var SLEEVE_SAFETY_THRESHOLDS = {
  buckling: {
    qualified: 2.0,    // 屈曲安全系数 ≥2.0 合格（含 0.75 屈曲折减因子效应）
    warning: 1.5,
    knockdown: 0.75,   // 屈曲折减因子（制造缺陷、边界不完全等）
    note: '屈曲安全系数 SF_buckle = p_cr × 0.75 / p_design'
  },
  material: {
    qualified: 2.0,    // 材料失效安全系数 ≥2.0 合格
    warning: 1.5,
    note: '材料安全系数 SF_strength = p_fail / p_design'
  }
};
