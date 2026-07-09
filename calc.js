/**
 * ============================================================
 * calc.js — 渐开线花键核心计算层
 * 依据：GB/T 3478.1-2008《圆柱直齿渐开线花键（米制模数 齿侧配合）》
 *
 * 职责：仅存放纯计算函数、校核逻辑
 * 禁止：任何 DOM 操作、界面交互代码
 *
 * 默认单位：长度 mm，应力 MPa，角度°（内部计算用 rad）
 * 所有函数均为纯函数，相同输入永远得到相同输出
 * ============================================================
 */

// ============================================================
// 一、工具函数
// ============================================================

/**
 * 渐开线函数 inv(α) = tan(α) - α
 * @param {number} alphaRad - 压力角 (rad)
 * @returns {number} inv(α) 值
 */
function involute(alphaRad) {
  return Math.tan(alphaRad) - alphaRad;
}

/**
 * 从 inv(α) 值反求压力角（牛顿迭代法）
 * @param {number} invValue - inv(α) 值
 * @returns {number} 压力角 (rad)
 */
function inverseInvolute(invValue) {
  // 初始估计：α ≈ (3×inv)^(1/3)  （近似公式）
  let alpha = Math.pow(3 * Math.abs(invValue), 1 / 3);
  if (invValue < 0) alpha = -alpha;

  // 牛顿迭代：α_{n+1} = α_n - (tan(α_n) - α_n - inv) / tan²(α_n)
  for (let i = 0; i < 20; i++) {
    const tanA = Math.tan(alpha);
    const f = tanA - alpha - invValue;
    const df = tanA * tanA;  // d/dα[tan(α)-α] = sec²(α)-1 = tan²(α)
    const delta = f / df;
    alpha = alpha - delta;
    if (Math.abs(delta) < 1e-15) break;
  }
  return alpha;
}

/**
 * 保留指定位有效数字（中间计算不提前舍入）
 * @param {number} value - 输入值
 * @param {number} digits - 有效数字位数（默认6）
 * @returns {number}
 */
function toSignificantDigits(value, digits = 6) {
  if (value === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(value)));
  const power = digits - d;
  const magnitude = Math.pow(10, power);
  return Math.round(value * magnitude) / magnitude;
}

// ============================================================
// 二、基本几何参数计算（GB/T 3478.1-2008 第5章）
// ============================================================

/**
 * 计算渐开线花键基本几何参数
 * 依据：GB/T 3478.1-2008 第5章 公式(1)~(4)
 *
 * @param {number} m - 模数 (mm)
 * @param {number} z - 齿数
 * @param {object} profile - 基本齿廓参数对象（来自 BASIC_PROFILE_30）
 * @returns {object} 基本几何参数
 */
function calcBasicGeometry(m, z, profile) {
  const alphaDeg = profile.pressureAngleDeg;      // 压力角 (°)
  const alphaRad = profile.pressureAngleRad;       // 压力角 (rad)
  const cosAlpha = profile.cosAlpha;
  const invAlpha = profile.invAlpha;

  // 公式(1): 分度圆直径 D = m × z
  const D = m * z;                                 // mm

  // 公式(2): 基圆直径 D_b = m × z × cos(α_D)
  const Db = D * cosAlpha;                         // mm

  // 公式(3): 齿距 p = π × m
  const p = Math.PI * m;                           // mm

  // 公式(4): 基本齿厚 S_basic = 基本齿槽宽 E_basic = p / 2 = πm/2
  const S_basic = p / 2;                           // mm
  const E_basic = p / 2;                           // mm

  // 齿顶高 ha = ha* × m
  const ha = profile.addendumCoeff * m;            // mm

  return {
    m, z, alphaDeg, alphaRad, cosAlpha, invAlpha,
    D: toSignificantDigits(D),
    Db: toSignificantDigits(Db),
    p: toSignificantDigits(p),
    S_basic: toSignificantDigits(S_basic),
    E_basic: toSignificantDigits(E_basic),
    ha: toSignificantDigits(ha),
    // 保留原始精度值用于后续计算
    _D: D, _Db: Db, _p: p, _S_basic: S_basic, _E_basic: E_basic, _ha: ha
  };
}

// ============================================================
// 三、外花键（轴）几何参数计算
//    依据：GB/T 3478.1-2008 第6章
// ============================================================

/**
 * 计算外花键大径、小径基本值
 * @param {number} m - 模数
 * @param {number} z - 齿数
 * @param {string} rootType - 齿根形式: 'flatRoot' | 'filletRoot'
 * @param {object} profile - 基本齿廓参数
 * @returns {object} 外花键直径参数
 */
function calcExternalSplineDiameters(m, z, rootType, profile) {
  const rootData = profile[rootType];
  const addCoeff = profile.addendumCoeff;          // ha* = 0.5
  const minorCoeff = rootData.externalMinorCoeff;  // 小径系数

  // 外花键大径（齿顶圆基本值）
  // D_ee = m(z + 2·ha*) = m(z + 1)   (ha*=0.5)
  const D_ee_basic = m * (z + 2 * addCoeff);       // mm

  // 外花键小径（齿根圆基本值）
  // D_ie = m(z - coeff)
  // 平齿根 coeff=1.5, 圆齿根 coeff=1.8
  const D_ie_basic = m * (z - minorCoeff);          // mm

  return {
    D_ee_basic: toSignificantDigits(D_ee_basic),
    D_ie_basic: toSignificantDigits(D_ie_basic),
    _D_ee_basic: D_ee_basic,
    _D_ie_basic: D_ie_basic
  };
}

/**
 * 计算外花键渐开线起始圆直径最大值 D_Fe_max
 * 依据：GB/T 3478.1-2008 第6.4节 公式(6)
 *
 * D_Fe_max 由配对内花键齿顶圆在啮合线上限定，
 * 确保渐开线啮合不产生干涉。
 *
 * D_Fe_max = 2 × √[ (0.5·D_b)² + ( 0.5·D·sinα_D − (h_s − 0.5·es_v/tanα_D)/sinα_D )² ]
 *
 * 其中：
 *   h_s = 0.6m — 配对内花键齿顶高
 *   es_v — 作用齿厚上偏差 (μm)
 *
 * @param {number} m - 模数
 * @param {number} z - 齿数
 * @param {number} D - 分度圆直径 (mm)
 * @param {number} Db - 基圆直径 (mm)
 * @param {number} alphaD_deg - 压力角 (°)，默认30
 * @param {number} es_v_um - 作用齿厚上偏差 (μm)，默认0
 * @returns {number} 渐开线起始圆直径最大值
 */
function calcExternalFormDiameter(m, z, D, Db, alphaD_deg, es_v_um) {
  if (es_v_um === undefined) es_v_um = 0;
  var alphaD_rad = alphaD_deg * Math.PI / 180;
  var h_s = 0.6 * m;  // 配对内花键齿顶高 (mm)

  // 0.5·D_b
  var halfDb = 0.5 * Db;
  // 0.5·D·sinα_D - (h_s - 0.5·es_v/tanα_D)/sinα_D
  var es_v_mm = es_v_um / 1000;
  var innerTerm = 0.5 * D * Math.sin(alphaD_rad)
    - (h_s - 0.5 * es_v_mm / Math.tan(alphaD_rad)) / Math.sin(alphaD_rad);

  var D_Fe_max = 2 * Math.sqrt(halfDb * halfDb + innerTerm * innerTerm);

  // 保守约束：不低于 D_ie + 2c_F（保证齿根完整）
  var D_ie = m * (z - 1.8);  // 圆齿根保守值
  var c_F = 0.1 * m;
  D_Fe_max = Math.max(D_Fe_max, D_ie + 2 * c_F);

  return toSignificantDigits(D_Fe_max);
}

// ============================================================
// 四、内花键（毂）几何参数计算
//    依据：GB/T 3478.1-2008 第6章
// ============================================================

/**
 * 计算内花键大径、小径基本值
 * @param {number} m - 模数
 * @param {number} z - 齿数
 * @param {string} rootType - 齿根形式: 'flatRoot' | 'filletRoot'
 * @param {object} profile - 基本齿廓参数
 * @param {number} D_Fe_max - 外花键渐开线起始圆直径最大值 mm（用于约束 D_ii）
 * @returns {object} 内花键直径参数
 */
function calcInternalSplineDiameters(m, z, rootType, profile, D_Fe_max) {
  const rootData = profile[rootType];
  const addCoeff = profile.addendumCoeff;
  const majorCoeff = rootData.internalMajorCoeff;

  // 内花键大径（齿根圆基本值）
  // D_ei = m(z + coeff)
  // 平齿根 coeff = 1.5, 圆齿根 coeff = 1.8
  const D_ei_basic = m * (z + majorCoeff);

  // 内花键小径（齿顶圆基本值）
  // 理论值：D_ii = m(z - 2·ha*) = m(z - 1)
  // 约束：D_ii ≥ D_Fe_max + 2·c_F（确保与外花键渐开线起始圆有足够间隙）
  const c_F = 0.1 * m;
  const D_ii_theory = m * (z - 2 * addCoeff);
  let D_ii_basic = D_ii_theory;
  if (D_Fe_max !== undefined && D_Fe_max > 0) {
    D_ii_basic = Math.max(D_ii_theory, D_Fe_max + 2 * c_F);
  }

  return {
    D_ei_basic: toSignificantDigits(D_ei_basic),
    D_ii_basic: toSignificantDigits(D_ii_basic),
    _D_ei_basic: D_ei_basic,
    _D_ii_basic: D_ii_basic,
    _D_ii_theory: D_ii_theory  // 保留理论值用于参考
  };
}

/**
 * 计算内花键渐开线终止圆直径最小值 D_Fi_min
 * 依据：GB/T 3478.1-2008 第6.4节
 *
 * D_Fi_min = m(z + 1) + 2·c_F
 *
 * 其中 c_F = 0.1m — 齿形裕度
 *
 * @param {number} m - 模数
 * @param {number} z - 齿数
 * @returns {number} 渐开线终止圆直径最小值
 */
function calcInternalFormDiameter(m, z) {
  const c_F = 0.1 * m;
  const D_Fi_min = m * (z + 1) + 2 * c_F;
  return toSignificantDigits(D_Fi_min);
}

// ============================================================
// 五、公差计算（GB/T 3478.1-2008 第8章）
// ============================================================

/**
 * 计算公差单位 i* (基于分度圆直径 D)
 * 依据：GB/T 3478.1-2008 第8.3节 公式(3)
 *
 * i* = 0.45∛D + 0.001D    (D ≤ 500mm)
 * i* = 0.004D + 2.1        (D > 500mm)
 *
 * @param {number} D - 分度圆直径 (mm)
 * @returns {number} 公差单位 i* (μm)
 */
function calcToleranceUnit_D(D) {
  if (D <= 500) {
    return 0.45 * Math.pow(D, 1 / 3) + 0.001 * D;
  } else {
    return 0.004 * D + 2.1;
  }
}

/**
 * 计算公差单位 i** (基于基本齿厚或齿槽宽)
 * 依据：GB/T 3478.1-2008 第8.3节 公式(4)
 *
 * i** = 0.45∛S + 0.001S
 *
 * @param {number} S_or_E - 基本齿厚或齿槽宽 (mm)
 * @returns {number} 公差单位 i** (μm)
 */
function calcToleranceUnit_S(S_or_E) {
  return 0.45 * Math.pow(S_or_E, 1 / 3) + 0.001 * S_or_E;
}

/**
 * 计算总公差 (T+λ)
 * 依据：GB/T 3478.1-2008 第8.3节 表8
 *
 * (T+λ) = K1 × i*(D) + K2 × i**(S/E)
 *
 * @param {number} D - 分度圆直径 (mm)
 * @param {number} S_or_E - 基本齿厚或齿槽宽 (mm)
 * @param {number} grade - 公差等级 (4|5|6|7)
 * @param {object} gradeData - 公差等级数据
 * @returns {number} 总公差 (T+λ) (μm)
 */
function calcTotalTolerance(D, S_or_E, grade, gradeData) {
  const iStar = calcToleranceUnit_D(D);
  const iStarStar = calcToleranceUnit_S(S_or_E);
  const T_plus_lambda = gradeData.k1 * iStar + gradeData.k2 * iStarStar;
  return T_plus_lambda;  // μm
}

/**
 * 计算综合公差 λ
 * 依据：GB/T 3478.1-2008 第8.4~8.6节
 *
 * λ = 0.6 × √(Fp² + ff² + Fβ²)
 *
 * 单项公差：
 *   Fp = fpA × √L + fpB     L = π·m·z/2 (分度圆周长之半, mm)
 *   ff = ffA × φ + ffB       φ = m + 0.0125·m·z (公差因数, mm)
 *   Fβ = fbetaA × √g + fbetaB  g = L_eng (配合长度, mm)
 *
 * @param {number} m - 模数 (mm)
 * @param {number} z - 齿数
 * @param {number} D - 分度圆直径 (mm)
 * @param {number} L_eng - 配合长度 (mm)
 * @param {object} gradeData - 公差等级数据
 * @returns {object} { lambda, Fp, ff, Fbeta, L_arc, phi, components }
 */
function calcComprehensiveTolerance(m, z, D, L_eng, gradeData) {
  // 齿距累积公差 Fp (μm)
  // GB/T 3478.1-2008 第8.4节: L = π·m·z/2 (分度圆周长之半)
  const L_arc = Math.PI * m * z / 2;
  const Fp = gradeData.fpA * Math.sqrt(L_arc) + gradeData.fpB;

  // 齿形公差 ff (μm)
  // GB/T 3478.1-2008 第8.5节: φ = m + 0.0125·m·z (公差因数)
  const phi = m + 0.0125 * m * z;
  const ff = gradeData.ffA * phi + gradeData.ffB;

  // 齿向公差 Fβ (μm)
  // GB/T 3478.1-2008 第8.6节: g = L_eng (花键配合长度)
  const Fbeta = gradeData.fbetaA * Math.sqrt(L_eng) + gradeData.fbetaB;

  // 综合公差 λ
  const lambda = 0.6 * Math.sqrt(Fp * Fp + ff * ff + Fbeta * Fbeta);

  return {
    lambda: lambda,            // μm
    Fp: Fp,                    // μm
    ff: ff,                    // μm
    Fbeta: Fbeta,              // μm
    L_arc: L_arc,              // mm — 分度圆周长之半（用于验算 Fp）
    phi: phi,                  // mm — 公差因数（用于验算 ff）
    components: { Fp, ff, Fbeta }
  };
}

/**
 * 计算外花键基本偏差 es_v (作用齿厚上偏差)
 * 依据：GB/T 3478.1-2008 第7章 + 表24
 *
 * es_v 按配合代号和分度圆直径 D 从表24查取
 * - h: es_v = 0
 * - f/e/d: 负值，查表
 * - k: es_v = +(T+λ) / (2×tan(30°))
 * - js: es_v = +(T+λ) / 2
 *
 * @param {number} D - 分度圆直径 (mm)
 * @param {string} fitType - 配合类别键值 (如 'H/h', 'H/f' 等)
 * @param {number} totalTol - 总公差 (T+λ) (μm)，k/js 配合需要
 * @returns {number} es_v (μm)
 */
function calcFundamentalDeviation(D, fitType, totalTol) {
  var fitData = FIT_TYPES[fitType];
  if (!fitData) throw new Error('未知配合类别: ' + fitType);

  var fitCode = fitData.extDeviationSign;  // 'h','f','e','d','k','js'
  return lookupEsV(D, fitCode, totalTol);
}

// ============================================================
// 六、齿厚与齿槽宽极限尺寸计算
//    依据：GB/T 3478.1-2008 第8章
// ============================================================

/**
 * 计算外花键齿厚极限尺寸
 *
 * 作用齿厚上偏差: es_v
 * 实际齿厚上偏差: es = es_v - λ  (齿厚需考虑综合误差效应)
 * 实际齿厚下偏差: ei = es_v - (T+λ)
 *
 * 即：
 * S_actual_max = S_basic + es_v - λ
 * S_actual_min = S_basic + es_v - (T+λ)
 *
 * @param {number} S_basic - 基本齿厚 (mm)
 * @param {number} es_v - 作用齿厚上偏差 (μm)
 * @param {number} lambda - 综合公差 (μm)
 * @param {number} totalTol - 总公差 (T+λ) (μm)
 * @returns {object} 齿厚极限尺寸 (mm)
 */
function calcToothThicknessLimits(S_basic, es_v, lambda, totalTol) {
  // 转换为 mm
  const es_v_mm = es_v / 1000;
  const lambda_mm = lambda / 1000;
  const totalTol_mm = totalTol / 1000;

  const S_actual_max = S_basic + es_v_mm - lambda_mm;
  const S_actual_min = S_basic + es_v_mm - totalTol_mm;

  // 作用齿厚极限（用于配合判定）
  const S_v_max = S_basic + es_v_mm;
  const S_v_min = S_basic + es_v_mm - (totalTol_mm - lambda_mm);

  // 加工公差 T
  const T = totalTol_mm - lambda_mm;

  return {
    S_basic: toSignificantDigits(S_basic),
    S_max: toSignificantDigits(Math.max(S_actual_max, S_actual_min)),   // 实际齿厚最大值
    S_min: toSignificantDigits(Math.min(S_actual_max, S_actual_min)),   // 实际齿厚最小值
    S_v_max: toSignificantDigits(S_v_max),    // 作用齿厚最大值
    S_v_min: toSignificantDigits(S_v_min),    // 作用齿厚最小值
    T: toSignificantDigits(T),                // 加工公差 (mm)
    es_v: toSignificantDigits(es_v),          // 作用齿厚上偏差 (μm)
    es: toSignificantDigits(es_v - lambda),   // 实际齿厚上偏差 (μm)
    ei: toSignificantDigits(es_v - totalTol), // 实际齿厚下偏差 (μm)
    // 保留原始精度
    _S_max: Math.max(S_actual_max, S_actual_min),
    _S_min: Math.min(S_actual_max, S_actual_min)
  };
}

/**
 * 计算内花键齿槽宽极限尺寸
 *
 * 内花键采用基孔制 H (EI = 0)
 * 作用齿槽宽下偏差: EI_v = 0
 * 实际齿槽宽下偏差: EI = λ
 * 实际齿槽宽上偏差: ES = (T+λ)
 *
 * 即：
 * E_actual_min = E_basic + λ
 * E_actual_max = E_basic + (T+λ)
 *
 * @param {number} E_basic - 基本齿槽宽 (mm)
 * @param {number} lambda - 综合公差 (μm)
 * @param {number} totalTol - 总公差 (T+λ) (μm)
 * @returns {object} 齿槽宽极限尺寸 (mm)
 */
function calcSpaceWidthLimits(E_basic, lambda, totalTol) {
  const lambda_mm = lambda / 1000;
  const totalTol_mm = totalTol / 1000;

  const E_actual_min = E_basic + lambda_mm;
  const E_actual_max = E_basic + totalTol_mm;

  // 作用齿槽宽极限
  const E_v_min = E_basic;                    // EI_v = 0
  const E_v_max = E_basic + (totalTol_mm - lambda_mm);

  const T = totalTol_mm - lambda_mm;         // 加工公差

  return {
    E_basic: toSignificantDigits(E_basic),
    E_min: toSignificantDigits(E_actual_min),    // 实际齿槽宽最小值
    E_max: toSignificantDigits(E_actual_max),    // 实际齿槽宽最大值
    E_v_min: toSignificantDigits(E_v_min),       // 作用齿槽宽最小值
    E_v_max: toSignificantDigits(E_v_max),       // 作用齿槽宽最大值
    T: toSignificantDigits(T),
    EI: 0,                                       // 作用齿槽宽下偏差 (μm)
    ES_v: toSignificantDigits(totalTol - lambda),// 作用齿槽宽上偏差 (μm)
    es_actual_lower: toSignificantDigits(lambda), // 实际齿槽宽下偏差 (μm)
    es_actual_upper: toSignificantDigits(totalTol), // 实际齿槽宽上偏差 (μm)
    // 保留原始精度
    _E_min: E_actual_min,
    _E_max: E_actual_max
  };
}

// ============================================================
// 七、量棒测量计算（跨棒距/棒间距）
//    依据：GB/T 3478.5-2008
// ============================================================

/**
 * 计算外花键跨棒距 M_Re (Measurement over pins)
 * 依据：GB/T 3478.5-2008
 *
 * 偶齿数：M_Re = D_b / cos(α_e) + D_R
 * 奇齿数：M_Re = D_b / cos(α_e) × cos(90°/z) + D_R
 *
 * 其中 α_e 由以下方程求解：
 * inv(α_e) = S/D + inv(α_D) + D_R/D_b - π/z
 *
 * @param {number} m - 模数
 * @param {number} z - 齿数
 * @param {number} D - 分度圆直径
 * @param {number} Db - 基圆直径
 * @param {number} S - 实际齿厚（取最大值用于计算最大跨棒距，取最小值用于最小跨棒距）
 * @param {number} pinDia - 量棒直径 (mm)
 * @param {number} invAlpha - inv(α_D)
 * @returns {object} 跨棒距 M_Re 及中间变量
 */
function calcMeasurementOverPins(m, z, D, Db, S, pinDia, invAlpha) {
  // 公式：inv(α_e) = S/D + inv(α_D) + D_R/D_b - π/z
  const invAlpha_e = S / D + invAlpha + pinDia / Db - Math.PI / z;

  // 检查量棒是否可用（量棒接触点应在渐开线齿面上）
  if (invAlpha_e <= 0) {
    return {
      error: true,
      message: '量棒直径过小，接触点不在渐开线齿面上，请增大量棒直径',
      invAlpha_e: invAlpha_e
    };
  }

  // 反求压力角 α_e
  const alpha_e = inverseInvolute(invAlpha_e);

  // 跨棒距计算
  let M_Re;
  if (z % 2 === 0) {
    // 偶齿数
    M_Re = Db / Math.cos(alpha_e) + pinDia;
  } else {
    // 奇齿数
    M_Re = Db / Math.cos(alpha_e) * Math.cos(Math.PI / (2 * z)) + pinDia;
  }

  return {
    error: false,
    M_Re: toSignificantDigits(M_Re),
    _M_Re: M_Re,
    invAlpha_e: invAlpha_e,
    alpha_e_deg: toSignificantDigits(alpha_e * 180 / Math.PI),
    alpha_e_rad: alpha_e,
    // 量棒中心所在圆直径
    D_pin_center: toSignificantDigits(Db / Math.cos(alpha_e))
  };
}

/**
 * 计算内花键棒间距 M_Ri (Measurement between pins)
 * 依据：GB/T 3478.5-2008
 *
 * 偶齿数：M_Ri = D_b / cos(α_i) - D_R
 * 奇齿数：M_Ri = D_b / cos(α_i) × cos(90°/z) - D_R
 *
 * 其中 α_i 由以下方程求解：
 * inv(α_i) = E/D + inv(α_D) - D_R/D_b
 *
 * @param {number} m - 模数
 * @param {number} z - 齿数
 * @param {number} D - 分度圆直径
 * @param {number} Db - 基圆直径
 * @param {number} E - 实际齿槽宽
 * @param {number} pinDia - 量棒直径 (mm)
 * @param {number} invAlpha - inv(α_D)
 * @returns {object} 棒间距 M_Ri 及中间变量
 */
function calcMeasurementBetweenPins(m, z, D, Db, E, pinDia, invAlpha) {
  // 公式：inv(α_i) = E/D + inv(α_D) - D_R/D_b
  const invAlpha_i = E / D + invAlpha - pinDia / Db;

  if (invAlpha_i <= 0) {
    return {
      error: true,
      message: '量棒直径过大，接触点不在渐开线齿面上，请减小量棒直径',
      invAlpha_i: invAlpha_i
    };
  }

  const alpha_i = inverseInvolute(invAlpha_i);

  let M_Ri;
  if (z % 2 === 0) {
    M_Ri = Db / Math.cos(alpha_i) - pinDia;
  } else {
    M_Ri = Db / Math.cos(alpha_i) * Math.cos(Math.PI / (2 * z)) - pinDia;
  }

  return {
    error: false,
    M_Ri: toSignificantDigits(M_Ri),
    _M_Ri: M_Ri,
    invAlpha_i: invAlpha_i,
    alpha_i_deg: toSignificantDigits(alpha_i * 180 / Math.PI),
    alpha_i_rad: alpha_i,
    D_pin_center: toSignificantDigits(Db / Math.cos(alpha_i))
  };
}

// ============================================================
// 八、花键强度校核（GB/T 3478.1-2008 + 《机械设计手册》）
// ============================================================

/**
 * 校核花键齿面接触（挤压）强度
 * 依据：《机械设计手册》第五版
 *
 * 挤压应力 σ_H = 2T / (ψ·z·h·l·D_m)  (MPa)
 *
 * @param {number} torque - 传递转矩 (N·m)
 * @param {number} z - 齿数
 * @param {number} h - 齿面接触高度 (mm)，h ≈ (D_ee - D_ii) / 2
 * @param {number} l - 配合长度 (mm)
 * @param {number} D_m - 平均直径 (mm)，D_m ≈ D
 * @param {number} psi - 载荷不均系数（一般 0.7~0.8）
 * @returns {object} 接触强度校核结果
 */
function checkContactStrength(torque, z, h, l, D_m, psi = 0.75) {
  // 挤压应力 (MPa)
  const sigma_H = (2 * torque * 1000) / (psi * z * h * l * D_m);

  return {
    sigma_H_MPa: toSignificantDigits(sigma_H),
    _sigma_H: sigma_H,
    formula: 'σ_H = 2000·T / (ψ·z·h·l·Dm)',
    input: { torque, z, h, l, D_m, psi }
  };
}

/**
 * 校核花键齿根弯曲强度
 * 依据：《机械设计手册》第五版
 *
 * 弯曲应力 σ_F = 2T·h / (ψ·z·W·l·D_m)
 * 其中 W ≈ (1/6)·S_fn²·l （齿根抗弯截面模量）
 *
 * @param {number} torque - 传递转矩 (N·m)
 * @param {number} z - 齿数
 * @param {number} h - 全齿高 (mm)
 * @param {number} l - 配合长度 (mm)
 * @param {number} D_m - 平均直径 (mm)
 * @param {number} S_fn - 齿根弦齿厚 (mm)
 * @param {number} psi - 载荷不均系数
 * @returns {object} 弯曲强度校核结果
 */
function checkBendingStrength(torque, z, h, l, D_m, S_fn, psi = 0.75) {
  const sigma_F = (6 * torque * 1000 * h) / (psi * z * S_fn * S_fn * l * D_m);

  return {
    sigma_F_MPa: toSignificantDigits(sigma_F),
    _sigma_F: sigma_F,
    formula: 'σ_F = 6000·T·h / (ψ·z·S_fn²·l·Dm)',
    input: { torque, z, h, l, D_m, S_fn, psi }
  };
}

/**
 * 综合强度校核
 * @param {object} strengthResult - 强度计算结果
 * @param {number} allowableStress - 许用应力 (MPa)
 * @param {number} safetyQualified - 合格安全系数阈值
 * @param {number} safetyWarning - 警告安全系数阈值
 * @returns {object} 校核判定结果
 */
function evaluateStrength(strengthResult, allowableStress, safetyQualified, safetyWarning) {
  const safetyFactor = allowableStress / strengthResult._sigma_H;
  let status;
  if (safetyFactor >= safetyQualified) {
    status = '合格';
  } else if (safetyFactor >= safetyWarning) {
    status = '警告';
  } else {
    status = '不合格';
  }

  return {
    safetyFactor: toSignificantDigits(safetyFactor),
    _safetyFactor: safetyFactor,
    allowableStress: allowableStress,
    status: status,
    threshold: { qualified: safetyQualified, warning: safetyWarning }
  };
}

// ============================================================
// 九、扩展强度校核（《机械设计手册》第五版）
// ============================================================

/**
 * 从功率和转速计算传递转矩
 * 公式：T = 9550 × P / n
 * 来源：《机械设计手册》第五版 第1卷
 *
 * @param {number} power_kW - 传递功率 (kW)
 * @param {number} speed_rpm - 转速 (rpm)
 * @returns {number} 转矩 (N·m)，若转速≤0返回0
 */
function calcTorqueFromPower(power_kW, speed_rpm) {
  if (speed_rpm <= 0 || power_kW <= 0) return 0;
  return 9550 * power_kW / speed_rpm;
}

/**
 * 校核齿根抗剪强度
 * 依据：《机械设计手册》第五版 第3卷 花键联接强度计算
 *
 * 剪切应力 τ = F_t / A_τ
 *   切向力 F_t = 2000·T / D_m  (N)
 *   剪切面积 A_τ = ψ·z·S_fn·l  (mm²)
 *   得 τ = 2000·T / (ψ·z·S_fn·l·D_m)  (MPa)
 *
 * @param {number} torque - 传递转矩 (N·m)
 * @param {number} z - 齿数
 * @param {number} S_fn - 齿根弦齿厚 (mm)，S_fn ≈ π·m/2
 * @param {number} l - 配合长度 (mm)
 * @param {number} D_m - 平均直径 (mm)，D_m ≈ D
 * @param {number} psi - 载荷不均系数（一般 0.75）
 * @returns {object} 剪切强度校核结果
 */
function checkShearStrength(torque, z, S_fn, l, D_m, psi = 0.75) {
  const tau = (2000 * torque) / (psi * z * S_fn * l * D_m);

  return {
    tau_MPa: toSignificantDigits(tau),
    _tau: tau,
    formula: 'τ = 2000·T / (ψ·z·S_fn·l·D_m)',
    input: { torque, z, S_fn, l, D_m, psi }
  };
}

/**
 * 校核 10^8 次循环下齿面磨损
 * 依据：《机械设计手册》第五版 第3卷 — p·v 值法评估磨损寿命
 *
 * p·v 值 = σ_H × v_s  (MPa·m/s)
 *
 * 平均滑动速度 v_s = π·n·h / 60000  (m/s)
 *   其中 h 为齿面接触高度 (mm)，n 为转速 (rpm)
 *   物理意义：齿面在接触区内每转的相对滑动行程
 *
 * 10^8 次循环对应的总滑动距离 L_s = v_s × (10^8 / n / 60) × 3600 (m)
 * 当 p·v ≤ [p·v] 时，磨损量在允许范围内
 *
 * @param {number} sigma_H - 接触应力 (MPa)
 * @param {number} speed_rpm - 转速 (rpm)
 * @param {number} h_contact - 接触高度 (mm)
 * @param {number} D - 分度圆直径 (mm)，用于计算滑动速度
 * @returns {object} 磨损校核结果
 */
function checkWear10e8(sigma_H, speed_rpm, h_contact, D) {
  // 平均滑动速度 (m/s) — 齿面接触区相对滑动简化计算
  // v_s = π·h·n / 60000（滑动路程/时间，单位为m/s）
  const v_s = (Math.PI * h_contact * speed_rpm) / 60000;

  // p·v 值
  const pv = sigma_H * v_s;

  // 10^8 循环总滑动距离 (m)
  const totalCycles = 1e8;
  const time_hours = totalCycles / (speed_rpm * 60);  // 达到10^8次循环所需小时数
  const totalSlidingDistance = v_s * time_hours * 3600; // 总滑动距离 (m)

  return {
    pv_MPa_ms: toSignificantDigits(pv),
    _pv: pv,
    v_s_ms: toSignificantDigits(v_s),
    _v_s: v_s,
    totalSlidingDistance_m: toSignificantDigits(totalSlidingDistance),
    totalCycles: '1×10⁸',
    timeToReach_hours: toSignificantDigits(time_hours),
    formula: 'p·v = σ_H × (π·h·n/60000)',
    note: 'p·v 值法：p·v ≤ [p·v] 时，10⁸次循环磨损量在许用范围内'
  };
}

/**
 * 校核长期工作无磨损条件
 * 依据：《机械设计手册》第五版 第3卷
 *
 * 条件：σ_H ≤ [σ_Hw]
 *   其中 [σ_Hw] 为无磨损许用接触应力
 *
 * 机理：当接触应力低于材料微动磨损门槛值时，
 * 即使在长期交变载荷下也不会发生显著的材料转移和氧化磨损。
 *
 * 适用工况：长寿命（>10⁹循环）、维护困难、要求零磨损的场合
 *
 * @param {number} sigma_H - 接触应力 (MPa)
 * @param {number} allowableWearFreeContact - 无磨损许用接触应力 (MPa)
 * @returns {object} 无磨损校核结果
 */
function checkWearFreeLongTerm(sigma_H, allowableWearFreeContact) {
  const margin = allowableWearFreeContact / sigma_H;  // >1 表示无磨损

  return {
    sigma_H_MPa: toSignificantDigits(sigma_H),
    allowable_MPa: allowableWearFreeContact,
    margin: toSignificantDigits(margin),
    _margin: margin,
    isWearFree: sigma_H <= allowableWearFreeContact,
    condition: `σ_H ≤ [σ_Hw] → ${sigma_H.toFixed(1)} ≤ ${allowableWearFreeContact}`,
    note: '接触应力低于微动磨损门槛值时，长期工作无明显磨损'
  };
}

/**
 * 校核外花键轴扭转强度
 * 依据：《机械设计手册》第五版 第2卷 轴的设计计算
 *
 * 扭转切应力 τ_max = T / W_t
 *   抗扭截面模量 W_t = π·d³/16（实心轴，d = D_ie_min）
 *   得 τ_max = 16000·T / (π·D_ie³)  (MPa)
 *
 * 判定依据：τ_max ≤ [τ]（许用剪切应力）
 *   电机轴常用[τ] = 40~60 MPa（调质钢）
 *
 * @param {number} torque - 传递转矩 (N·m)
 * @param {number} D_ie_min - 外花键小径最小值 (mm)，即轴最细处
 * @returns {object} 轴扭转校核结果
 */
function checkShaftTorsion(torque, D_ie_min) {
  // 抗扭截面模量 W_t = π·d³/16 (mm³)
  const W_t = Math.PI * Math.pow(D_ie_min, 3) / 16;
  // τ = T × 1000 / W_t (MPa)，T 为 N·m → N·mm 需乘 1000
  const tau_max = (torque * 1000) / W_t;

  return {
    tau_max_MPa: toSignificantDigits(tau_max),
    _tau_max: tau_max,
    W_t_mm3: toSignificantDigits(W_t),
    D_ie_min: D_ie_min,
    formula: 'τ_max = 16000·T / (π·D_ie³)',
    note: '以外花键小径最小值为轴危险截面直径'
  };
}

/**
 * 校核外花键轴弯曲强度
 * 依据：《机械设计手册》第五版 第2卷 轴的设计计算
 *
 * 弯曲应力 σ_b = M / W
 *   抗弯截面模量 W = π·d³/32（实心轴，d = D_ie_min）
 *   得 σ_b = 32000·M / (π·D_ie³)  (MPa)
 *
 * 轴弯扭合成应力 σ_e = √(σ_b² + 3τ²)（第四强度理论）
 *   当 σ_e ≤ [σ] 时，轴强度合格
 *
 * @param {number} torque - 传递转矩 (N·m)
 * @param {number} D_ie_min - 外花键小径最小值 (mm)
 * @param {number} bendingMoment - 轴上弯矩 (N·m)，可选，为0时仅计算弯扭合成参考值
 * @returns {object} 轴弯曲校核结果
 */
function checkShaftBending(torque, D_ie_min, bendingMoment = 0) {
  // 抗弯截面模量 W = π·d³/32 (mm³)
  const W_b = Math.PI * Math.pow(D_ie_min, 3) / 32;

  let sigma_b = 0;
  let sigma_e = 0;

  if (bendingMoment > 0) {
    sigma_b = (bendingMoment * 1000) / W_b;
    // 扭转切应力
    const tau_t = (torque * 1000) / (Math.PI * Math.pow(D_ie_min, 3) / 16);
    // 弯扭合成应力（第四强度理论，α=1 对称循环）
    sigma_e = Math.sqrt(sigma_b * sigma_b + 3 * tau_t * tau_t);
  }

  return {
    sigma_b_MPa: toSignificantDigits(sigma_b),
    _sigma_b: sigma_b,
    sigma_e_MPa: toSignificantDigits(sigma_e),
    _sigma_e: sigma_e,
    W_b_mm3: toSignificantDigits(W_b),
    D_ie_min: D_ie_min,
    bendingMoment_Nm: bendingMoment,
    formula_bending: 'σ_b = 32000·M / (π·D_ie³)',
    formula_combined: 'σ_e = √(σ_b² + 3τ²)',
    note: bendingMoment > 0
      ? '弯扭合成应力按第四强度理论计算'
      : '未提供弯矩值，仅计算截面模量供参考。提供弯矩后可计算弯扭合成应力'
  };
}

/**
 * 通用校核判定函数
 * @param {number} actual - 实际应力值
 * @param {number} allowable - 许用应力值
 * @param {number} safetyQualified - 合格安全系数阈值
 * @param {number} safetyWarning - 警告安全系数阈值
 * @returns {object} { safetyFactor, status, allowable }
 */
function evaluateCheck(actual, allowable, safetyQualified, safetyWarning) {
  if (actual <= 0 || allowable <= 0) {
    return { safetyFactor: Infinity, _safetyFactor: Infinity, status: 'N/A', allowable };
  }
  const sf = allowable / actual;
  let status;
  if (sf >= safetyQualified) status = '合格';
  else if (sf >= safetyWarning) status = '警告';
  else status = '不合格';
  return {
    safetyFactor: toSignificantDigits(sf),
    _safetyFactor: sf,
    allowable,
    status
  };
}

// ============================================================
// 九-B、GB/T 17855-1999 花键承载能力计算
//    依据：GB/T 17855-1999《花键承载能力计算方法》
// ============================================================

/**
 * 从功率和转速计算传递转矩（精确系数 9549）
 * GB/T 17855-1999 公式(1)
 * T = 9549 × P / n
 *
 * @param {number} power_kW - 传递功率 (kW)
 * @param {number} speed_rpm - 转速 (rpm)
 * @returns {number} 转矩 (N·m)
 */
function calcTorqueFromPowerGB(power_kW, speed_rpm) {
  if (speed_rpm <= 0 || power_kW <= 0) return 0;
  return 9549 * power_kW / speed_rpm;
}

/**
 * 计算名义切向力 F_t
 * GB/T 17855-1999 公式(2)
 * F_t = 2000·T / D
 *
 * @param {number} T - 传递转矩 (N·m)
 * @param {number} D - 分度圆直径 (mm)
 * @returns {number} 名义切向力 (N)
 */
function calcNominalTangentialForce(T, D) {
  return 2000 * T / D;
}

/**
 * 计算单位载荷 W
 * GB/T 17855-1999 公式(3)
 * W = F_t / (z·l·cos α_D)
 *
 * @param {number} Ft - 名义切向力 (N)
 * @param {number} z - 齿数
 * @param {number} l - 配合长度 (mm)
 * @param {number} alphaD_deg - 压力角 (°)，标准值30°
 * @returns {number} 单位载荷 (N/mm)
 */
function calcUnitLoad(Ft, z, l, alphaD_deg) {
  var cosAlphaD = Math.cos(alphaD_deg * Math.PI / 180);
  return Ft / (z * l * cosAlphaD);
}

/**
 * 计算齿面接触（挤压）应力 σ_H
 * GB/T 17855-1999 公式(4)
 * σ_H = W / h_w
 *
 * @param {number} W - 单位载荷 (N/mm)
 * @param {number} h_w - 工作齿高 (mm)
 * @returns {number} 齿面压应力 (MPa)
 */
function calcContactStressGB17855(W, h_w) {
  return W / h_w;
}

/**
 * 计算齿根弦齿厚 S_Fn（渐开线几何精确法）
 * GB/T 17855-1999 公式(5)
 *
 * S_Fn = D_Fe × sin{ [S/D + invα_D - inv(arccos(D·cosα_D/D_Fe))] }
 *       (式中角度项为弧度，sin 内部消去 rad→deg→rad 转换)
 *
 * 中间变量：
 *   S_basic — 基本齿厚 (mm) = πm/2
 *   D — 分度圆直径 (mm)
 *   α_D — 压力角 (°)
 *   D_Fe — 渐开线起始圆直径 (mm)
 *
 * @param {number} D - 分度圆直径 (mm)
 * @param {number} D_Fe - 渐开线起始圆直径 (mm)
 * @param {number} S_basic - 基本齿厚 (mm)
 * @param {number} alphaD_deg - 压力角 (°)
 * @returns {object} { S_Fn, D_Fe, S_basic, invAlphaD, invAlphaFe, term_S_D, term_inv, bracket_rad }
 */
function calcToothRootChordThickness(D, D_Fe, S_basic, alphaD_deg) {
  var alphaD_rad = alphaD_deg * Math.PI / 180;
  var cosAlphaD = Math.cos(alphaD_rad);

  // inv(α_D) = tan(α_D) - α_D
  var invAlphaD = Math.tan(alphaD_rad) - alphaD_rad;

  // S / D
  var term_S_D = S_basic / D;

  // arccos(D·cosα_D / D_Fe)
  var insideAcos = D * cosAlphaD / D_Fe;
  // 边界保护：D_Fe 可能略小于 D_b，导致 insideAcos > 1
  if (insideAcos >= 1.0) { insideAcos = 0.9999999999; }
  if (insideAcos <= -1.0) { insideAcos = -0.9999999999; }

  var alphaFe_rad = Math.acos(insideAcos);
  var invAlphaFe = Math.tan(alphaFe_rad) - alphaFe_rad;

  // 方括号内总和 (rad)
  var bracket_rad = term_S_D + invAlphaD - invAlphaFe;

  // S_Fn = D_Fe × sin(bracket_rad)  — rad→deg→rad 在 sin 内抵消
  var S_Fn = D_Fe * Math.sin(bracket_rad);

  return {
    S_Fn: S_Fn,
    _S_Fn: S_Fn,
    D_Fe: D_Fe,
    S_basic: S_basic,
    term_S_D: term_S_D,
    invAlphaD: invAlphaD,
    alphaFe_rad: alphaFe_rad,
    alphaFe_deg: alphaFe_rad * 180 / Math.PI,
    invAlphaFe: invAlphaFe,
    bracket_rad: bracket_rad,
    insideAcos: insideAcos,
    cosAlphaD: cosAlphaD
  };
}

/**
 * 计算齿根弯曲应力 σ_F
 * GB/T 17855-1999 公式(6)
 * σ_F = 6·h·W·cos α_D / S_Fn²
 *
 * @param {number} h - 全齿高 (mm)
 * @param {number} W - 单位载荷 (N/mm)
 * @param {number} alphaD_deg - 压力角 (°)
 * @param {number} S_Fn - 齿根弦齿厚 (mm)
 * @returns {number} 齿根弯曲应力 (MPa)
 */
function calcBendingStressGB17855(h, W, alphaD_deg, S_Fn) {
  var cosAlphaD = Math.cos(alphaD_deg * Math.PI / 180);
  return 6 * h * W * cosAlphaD / (S_Fn * S_Fn);
}

/**
 * 计算当量应力圆直径 d_h
 * GB/T 17855-1999 公式(8)
 * d_h = D_ie + K × D_ie × (D_ee - D_ie) / D_ee
 *
 * K = 0.15（花键标准值）
 *
 * @param {number} D_ie - 外花键小径 (mm)
 * @param {number} D_ee - 外花键大径 (mm)
 * @param {number} K - 系数（默认0.15）
 * @returns {number} 当量直径 (mm)
 */
function calcEquivalentDiameterDh(D_ie, D_ee, K) {
  if (K === undefined) K = 0.15;
  return D_ie + K * D_ie * (D_ee - D_ie) / D_ee;
}

/**
 * 计算名义剪切应力 τ_tn
 * GB/T 17855-1999 公式(7)
 * τ_tn = 16000·T / (π·d_h³)
 *
 * @param {number} T - 传递转矩 (N·m)
 * @param {number} dh - 当量直径 (mm)
 * @returns {number} 名义剪切应力 (MPa)
 */
function calcNominalShearStressTauTn(T, dh) {
  return 16000 * T / (Math.PI * dh * dh * dh);
}

/**
 * 计算齿根应力集中系数 α_tn
 * GB/T 17855-1999 公式(9)
 *
 * α_tn = (D_ie/d_h) × {
 *   1 + 0.17×(h/ρ)×[1 + 3.94/(0.1 + h/ρ)]
 *   + 6.38×(1 + 0.1×h/ρ) / [2.38 + D_ie/(2h)×(h/ρ + 0.04)^(1/3)]²
 * }
 *
 * @param {number} D_ie - 外花键小径 (mm)
 * @param {number} dh - 当量直径 (mm)
 * @param {number} h - 全齿高 (mm)
 * @param {number} rho - 齿根圆角半径 (mm)
 * @returns {object} { alpha_tn, term1, term2, ratio, inner }
 */
function calcStressConcentrationFactor(D_ie, dh, h, rho) {
  var ratio = h / rho; // h/ρ

  // 第一项
  var bracket1 = 1 + 3.94 / (0.1 + ratio);
  var term1 = 1 + 0.17 * ratio * bracket1;

  // 第二项
  var inner = 2.38 + (D_ie / (2 * h)) * Math.pow(ratio + 0.04, 1.0 / 3.0);
  var term2 = 6.38 * (1 + 0.1 * ratio) / (inner * inner);

  var alpha_tn = (D_ie / dh) * (term1 + term2);

  return {
    alpha_tn: alpha_tn,
    _alpha_tn: alpha_tn,
    ratio: ratio,
    term1: term1,
    term2: term2,
    inner: inner,
    D_ie: D_ie,
    dh: dh,
    h: h,
    rho: rho
  };
}

/**
 * 计算许用应力 [σ]
 * GB/T 17855-1999 公式(10)
 * [σ] = σ_ref / (S × K1 × K2 × K3 × K4)
 *
 * @param {number} sigmaRef - 材料参考强度 (MPa)，σ_0.2(接触)/σ_b(弯曲)
 * @param {number} S - 安全系数 S_H 或 S_F
 * @param {number} K1 - 使用系数
 * @param {number} K2 - 齿侧间隙系数
 * @param {number} K3 - 载荷分布系数
 * @param {number} K4 - 轴向偏斜系数
 * @returns {number} 许用应力 (MPa)
 */
function calcAllowableStressGB(sigmaRef, S, K1, K2, K3, K4) {
  return sigmaRef / (S * K1 * K2 * K3 * K4);
}

/**
 * 计算弯扭合成当量应力 σ_v
 * GB/T 17855-1999 公式(13)
 * σ_v = √(σ_Fn² + 3·τ_tn²)
 *
 * 当 M_b = 0 时，σ_Fn = 0，σ_v = √(3)·τ_tn
 *
 * @param {number} sigmaFn - 弯曲正应力 (MPa)，无弯矩时为0
 * @param {number} tauTn - 名义剪切应力 (MPa)
 * @returns {number} 当量应力 (MPa)
 */
function calcCombinedStressGB17855(sigmaFn, tauTn) {
  return Math.sqrt(sigmaFn * sigmaFn + 3 * tauTn * tauTn);
}

/**
 * GB/T 17855-1999 完整承载能力计算
 *
 * 返回完整的中间计算步骤和校核结果，供界面展示和人工逐行验算
 *
 * @param {object} params
 * @param {number} params.m - 模数 (mm)
 * @param {number} params.z - 齿数
 * @param {number} params.D - 分度圆直径 (mm)
 * @param {number} params.S_basic - 基本齿厚 (mm)
 * @param {number} params.D_ee - 外花键大径 (mm)
 * @param {number} params.D_ie - 外花键小径 (mm)
 * @param {number} params.D_Fe - 渐开线起始圆直径 (mm)
 * @param {number} params.L_eng - 配合长度 (mm)
 * @param {number} params.h_w - 工作齿高 (mm)
 * @param {number} params.h - 全齿高 (mm)
 * @param {number} params.rho - 齿根圆角半径 (mm)
 * @param {number} params.torque - 传递转矩 (N·m)
 * @param {number} params.sigma02 - 屈服强度 σ_0.2 (MPa)
 * @param {number} params.sigmaB - 抗拉强度 σ_b (MPa)
 * @param {number} params.HB - 布氏硬度
 * @param {object} params.appFactors - 工况系数 {K1, K2, K3, K4, S_H, S_F}
 * @param {string} params.wearGrade - 磨损等级键值（查表4）
 * @param {number} params.bendingMoment - 轴上弯矩 (N·m)，默认0
 * @returns {object} 完整计算结果
 */
function calcGB17855All(params) {
  var p = params;
  var alphaD_deg = 30; // GB/T 3478.1 标准压力角

  // 默认工况系数
  var af = p.appFactors || { K1: 1.25, K2: 1.1, K3: 1.1, K4: 1.5, S_H: 1.25, S_F: 1.0 };

  // ===== a) 载荷计算 =====
  var Ft = calcNominalTangentialForce(p.torque, p.D);      // 名义切向力 (N)
  var W = calcUnitLoad(Ft, p.z, p.L_eng, alphaD_deg);      // 单位载荷 (N/mm)

  // ===== b) 齿面接触强度 =====
  var sigma_H = calcContactStressGB17855(W, p.h_w);        // 齿面压应力 (MPa)
  var allowable_H = calcAllowableStressGB(p.sigma02, af.S_H, af.K1, af.K2, af.K3, af.K4);
  var contactOK = sigma_H <= allowable_H;

  // ===== c) 齿根弯曲强度 =====
  var sfnResult = calcToothRootChordThickness(p.D, p.D_Fe, p.S_basic, alphaD_deg);
  var S_Fn = sfnResult.S_Fn;
  var sigma_F = calcBendingStressGB17855(p.h, W, alphaD_deg, S_Fn);
  var allowable_F = calcAllowableStressGB(p.sigmaB, af.S_F, af.K1, af.K2, af.K3, af.K4);
  var bendingOK = sigma_F <= allowable_F;

  // ===== d) 齿根剪切强度 =====
  var dh = calcEquivalentDiameterDh(p.D_ie, p.D_ee);
  var tau_tn = calcNominalShearStressTauTn(p.torque, dh);
  var alphaTnResult = calcStressConcentrationFactor(p.D_ie, dh, p.h, p.rho);
  var tau_Fmax = tau_tn * alphaTnResult.alpha_tn;
  var allowable_tau = allowable_F / 2;                     // [τ_F] = [σ_F] / 2
  var shearOK = tau_Fmax <= allowable_tau;

  // ===== e) 齿面耐磨能力 =====
  // 1) 10^6 循环
  var allowable_H1 = lookupWearAllowable10e6(p.wearGrade || 'alloySteel_quenched');
  var wear10e6OK = sigma_H <= allowable_H1;

  // 2) 长期工作无磨损
  var allowable_H2 = calcWearAllowableLongTerm(p.HB || 293, 'quenched_tempered');
  var wearLongTermOK = sigma_H <= allowable_H2;

  // ===== f) 外花键扭转与弯曲合成 =====
  var sigma_v, allowable_v;
  var bendingMoment = p.bendingMoment || 0;
  var sigmaFn = 0;

  if (bendingMoment > 0) {
    // 弯曲正应力 σ_Fn = 32000·M / (π·D_ie³)
    var W_b = Math.PI * Math.pow(p.D_ie, 3) / 32;
    sigmaFn = (bendingMoment * 1000) / W_b;
  }
  sigma_v = calcCombinedStressGB17855(sigmaFn, tau_tn);
  allowable_v = calcAllowableStressGB(p.sigma02, af.S_F, af.K1, af.K2, af.K3, af.K4);
  var combinedOK = sigma_v <= allowable_v;

  // ===== 汇总 =====
  return {
    input: {
      D: p.D, z: p.z, L_eng: p.L_eng,
      h_w: p.h_w, h: p.h, rho: p.rho,
      D_ee: p.D_ee, D_ie: p.D_ie, D_Fe: p.D_Fe,
      torque: p.torque, sigma02: p.sigma02, sigmaB: p.sigmaB, HB: p.HB,
      appFactors: af
    },

    // a) 载荷
    loads: {
      Ft_N: toSignificantDigits(Ft),
      _Ft: Ft,
      W_N_per_mm: toSignificantDigits(W),
      _W: W,
      formula_Ft: 'F_t = 2000·T/D',
      formula_W: 'W = F_t/(z·l·cos α_D)'
    },

    // b) 接触
    contact: {
      sigma_H_MPa: toSignificantDigits(sigma_H),
      _sigma_H: sigma_H,
      allowable_MPa: toSignificantDigits(allowable_H),
      _allowable: allowable_H,
      safetyFactor: toSignificantDigits(allowable_H / sigma_H),
      status: contactOK ? '合格' : '不合格',
      formula_sigmaH: 'σ_H = W/h_w',
      formula_allowable: '[σ_H] = σ_0.2/(S_H·K1·K2·K3·K4)'
    },

    // c) 弯曲
    bending: {
      sigma_F_MPa: toSignificantDigits(sigma_F),
      _sigma_F: sigma_F,
      allowable_MPa: toSignificantDigits(allowable_F),
      _allowable: allowable_F,
      safetyFactor: toSignificantDigits(allowable_F / sigma_F),
      status: bendingOK ? '合格' : '不合格',
      formula_sigmaF: 'σ_F = 6·h·W·cos α_D/S_Fn²',
      formula_allowable: '[σ_F] = σ_b/(S_F·K1·K2·K3·K4)',
      S_Fn_mm: toSignificantDigits(S_Fn),
      _S_Fn: S_Fn,
      sfnDetail: sfnResult
    },

    // d) 剪切
    shear: {
      tau_Fmax_MPa: toSignificantDigits(tau_Fmax),
      _tau_Fmax: tau_Fmax,
      tau_tn_MPa: toSignificantDigits(tau_tn),
      _tau_tn: tau_tn,
      allowable_MPa: toSignificantDigits(allowable_tau),
      _allowable: allowable_tau,
      safetyFactor: toSignificantDigits(allowable_tau / tau_Fmax),
      status: shearOK ? '合格' : '不合格',
      formula_tauFmax: 'τ_Fmax = τ_tn·α_tn',
      formula_tauTn: 'τ_tn = 16000T/(π·d_h³)',
      dh_mm: toSignificantDigits(dh),
      _dh: dh,
      alpha_tn: toSignificantDigits(alphaTnResult.alpha_tn),
      alphaTnDetail: alphaTnResult
    },

    // e) 耐磨
    wear: {
      sigma_H_MPa: toSignificantDigits(sigma_H),
      // 10^6 循环
      wear10e6: {
        allowable_H1_MPa: allowable_H1,
        status: wear10e6OK ? '合格' : '不合格',
        condition: 'σ_H ≤ [σ_H1] (表4)'
      },
      // 长期无磨损
      wearLongTerm: {
        allowable_H2_MPa: toSignificantDigits(allowable_H2),
        _allowable_H2: allowable_H2,
        status: wearLongTermOK ? '无磨损 ✓' : '可能磨损 ⚠',
        isWearFree: wearLongTermOK,
        formula: '[σ_H2] = 0.032 × HB (表5)',
        HB: p.HB || 293
      }
    },

    // f) 扭转与弯曲合成
    combined: {
      sigma_v_MPa: toSignificantDigits(sigma_v),
      _sigma_v: sigma_v,
      sigmaFn_MPa: toSignificantDigits(sigmaFn),
      tau_tn_MPa: toSignificantDigits(tau_tn),
      allowable_MPa: toSignificantDigits(allowable_v),
      _allowable: allowable_v,
      safetyFactor: toSignificantDigits(allowable_v / sigma_v),
      status: combinedOK ? '合格' : '不合格',
      formula: 'σ_v = √(σ_Fn² + 3τ_tn²)',
      bendingMoment_Nm: bendingMoment
    }
  };
}

// ============================================================
// 十、大径小径公差
// ============================================================

/**
 * 计算直径公差（基于 IT 标准公差等级）
 * 依据：GB/T 1800.4-2009 + GB/T 3478.1-2008 表25
 *
 * IT 公差公式: IT = multiplier × i
 *   其中 i = 0.45∛D + 0.001D (D ≤ 500mm)
 *   multiplier 从 IT_MULTIPLIERS 表查取
 *
 * @param {number} basicDiameter - 基本直径 (mm)
 * @param {number} IT_grade - IT 等级 (5~15)
 * @returns {number} 公差值 (mm)
 */
function calcDiameterTolerance(basicDiameter, IT_grade) {
  var i_D;
  if (basicDiameter <= 500) {
    i_D = 0.45 * Math.pow(basicDiameter, 1 / 3) + 0.001 * basicDiameter;
  } else {
    i_D = 0.004 * basicDiameter + 2.1;
  }

  var multiplier = IT_MULTIPLIERS[IT_grade] || 160; // 默认 IT12
  var tol_um = multiplier * i_D;
  return tol_um / 1000; // μm → mm
}

// ============================================================
// 十一、综合计算入口函数
// ============================================================

/**
 * 花键全部参数综合计算
 * 该函数将全部子函数串联，输出完整的花键参数表
 *
 * @param {object} params - 输入参数
 * @param {number} params.m - 模数 (mm)
 * @param {number} params.z - 齿数
 * @param {number} params.toleranceGrade - 公差等级 (4|5|6|7)
 * @param {string} params.fitType - 配合类别 ('H/h'|'H/f'|'H/e'|'H/d'|'H/k'|'H/js')
 * @param {string} params.rootType - 齿根形式 ('flatRoot'|'filletRoot')
 * @param {number} params.pinDiameter - 量棒直径 (mm)，为0时自动推荐
 * @param {number} params.engagementLength - 配合长度 (mm)
 * @param {number} params.torque - 传递转矩 (N·m)，直接输入（与power/speed二选一）
 * @param {number} params.power_kW - 传递功率 (kW)，与转速配合自动计算转矩
 * @param {number} params.speed_rpm - 转速 (rpm)，用于转矩计算与磨损校核
 * @param {string} params.material - 材料牌号，用于强度许用值选取
 * @param {number} params.bendingMoment - 轴上弯矩 (N·m)，可选，用于轴弯曲校核
 * @param {object} [params.customMaterial] - 自定义材料属性，提供时覆盖 material 查表值
 * @param {string} params.industry - 行业场景 ('general'|'newEnergy'|'highSpeed'|'aviation')
 * @returns {object} 完整花键参数计算结果
 */
function calcAll(params) {
  const {
    m, z,
    toleranceGrade = 6,
    fitType = 'H/h',
    rootType = 'flatRoot',
    pinDiameter = 0,
    engagementLength = 0,
    torque = 0,
    power_kW = 0,
    speed_rpm = 0,
    material = '40Cr调质',
    bendingMoment = 0,
    industry = 'general',
    customMaterial = null
  } = params;

  // 获取参数对象
  const profile = BASIC_PROFILE_30;
  const gradeData = TOLERANCE_GRADES[toleranceGrade];
  const fitData = FIT_TYPES[fitType];
  const safetyStd = SAFETY_STANDARDS[industry];

  if (!gradeData) throw new Error('无效公差等级: ' + toleranceGrade);
  if (!fitData) throw new Error('无效配合类别: ' + fitType);
  if (!profile[rootType]) throw new Error('无效齿根形式: ' + rootType);

  // ============ Step 1: 基本几何 ============
  const basicGeo = calcBasicGeometry(m, z, profile);
  const D = basicGeo._D;
  const Db = basicGeo._Db;
  const S_basic = basicGeo._S_basic;
  const E_basic = basicGeo._E_basic;
  const invAlpha = basicGeo.invAlpha;

  // ============ Step 2: 外花键几何 ============
  const extDia = calcExternalSplineDiameters(m, z, rootType, profile);

  // ============ Step 3: 配合长度 ============
  // 若未指定，默认取 1×D
  const L_eng = engagementLength > 0 ? engagementLength : D;

  // ============ Step 4: 公差计算（需在 D_Fe 之前，es_v 为 D_Fe 计算输入）============
  // T+λ 和 λ 四舍五入取整数 (μm)，后续计算均使用取整后的值
  const totalTol = Math.round(calcTotalTolerance(D, S_basic, toleranceGrade, gradeData));  // μm
  const compTol = calcComprehensiveTolerance(m, z, D, L_eng, gradeData);
  const lambda = Math.round(compTol.lambda);        // μm
  const T = totalTol - lambda;          // 加工公差 (μm)

  // 单项公差明细
  const Fp = compTol.Fp;
  const ff = compTol.ff;
  const Fbeta = compTol.Fbeta;

  // ============ Step 5: 基本偏差（需在 D_Fe 之前）============
  const es_v = calcFundamentalDeviation(D, fitType, totalTol);

  // ============ Step 6: 渐开线起始/终止圆 ============
  // D_Fe_max 取决于配对内花键参数与 es_v
  // GB/T 3478.1-2008 第6.4节 公式(6)
  var D_Fe_max = calcExternalFormDiameter(m, z, D, Db, basicGeo.alphaDeg, es_v);
  var D_Fi_min = calcInternalFormDiameter(m, z);

  // ============ Step 7: 内花键几何（D_ii 受 D_Fe_max 约束）============
  const intDia = calcInternalSplineDiameters(m, z, rootType, profile, D_Fe_max);

  // ============ Step 8: 外花键齿厚极限 ============
  const extTooth = calcToothThicknessLimits(S_basic, es_v, lambda, totalTol);

  // ============ Step 9: 内花键齿槽宽极限 ============
  const intSpace = calcSpaceWidthLimits(E_basic, lambda, totalTol);

  // ============ Step 10: 配合侧隙 ============
  // 最大侧隙 = E_max - S_min
  // 最小侧隙 = E_min - S_max
  const backlash_max_mm = intSpace._E_max - extTooth._S_min;
  const backlash_min_mm = intSpace._E_min - extTooth._S_max;

  // ============ Step 11: 量棒测量 ============
  // 量棒直径：若未指定则自动推荐
  let pinDia = pinDiameter;
  let pinRecommendation = null;
  if (pinDia <= 0) {
    pinRecommendation = getRecommendedPinDiameter(m);
    pinDia = pinRecommendation.recommended;
  }

  // 外花键跨棒距（分别用齿厚最大值和最小值计算）
  const extPinMax = calcMeasurementOverPins(m, z, D, Db, extTooth._S_max, pinDia, invAlpha);
  const extPinMin = calcMeasurementOverPins(m, z, D, Db, extTooth._S_min, pinDia, invAlpha);

  // 内花键棒间距（分别用齿槽宽最小值和最大值计算）
  const intPinMin = calcMeasurementBetweenPins(m, z, D, Db, intSpace._E_min, pinDia, invAlpha);
  const intPinMax = calcMeasurementBetweenPins(m, z, D, Db, intSpace._E_max, pinDia, invAlpha);

  // ============ Step 12: 大径/小径公差 — GB/T 3478.1-2008 表24+表25 ============
  //
  // 外花键大径 D_ee：
  //   上偏差 = es_v / tan(α_D) — 从表24查取 (μm)
  //   公差 = 从表25直接查取 (μm)，不通过 IT 公式
  //   下偏差 = 上偏差 − 公差
  //
  // 内花键小径 D_ii：
  //   下偏差 = 0 (H偏差)
  //   上偏差 = 从表25直接查取 (μm)
  //
  // 内花键大径 D_ei（非表25覆盖，使用 IT 公式回退）：
  //   下偏差 = 0 (H偏差)
  //   公差等级 = IT12/IT13/IT14 — 按模数 m 分段
  //
  // 外花键小径 D_ie：
  //   上偏差同大径（表24 es_v/tanα_D）
  //   公差同大径（表25）

  // ---- 外花键大径 D_ee ----
  // 上偏差：表24 es_v/tanα_D
  var extMajorUpperDev_um = lookupExtMajorUpperDev(D, fitData.extDeviationSign);
  // k/js 配合：上偏差由总公差计算（表24注）
  if (extMajorUpperDev_um === null) {
    if (fitData.extDeviationSign === 'k') {
      extMajorUpperDev_um = totalTol / Math.tan(Math.PI / 6);     // +(T+λ)/tanα_D
    } else if (fitData.extDeviationSign === 'js') {
      extMajorUpperDev_um = totalTol / (2 * Math.tan(Math.PI / 6)); // +(T+λ)/(2tanα_D)
    } else {
      extMajorUpperDev_um = 0;
    }
  }
  // 公差：表25直接查表
  var extMajorTol_um = lookupTable25Tolerance(extDia._D_ee_basic, m);
  if (extMajorTol_um === null || extMajorTol_um === undefined) {
    // 表25无覆盖，回退到 IT 公式
    var extMajorIT = getITgradeFromTable([
      { mMax: 0.75, IT: 10 }, { mMax: 2.0, IT: 11 }, { mMax: 6.0, IT: 11 }, { mMax: 10, IT: 12 }
    ], m);
    extMajorTol_um = lookupITTolerance(extDia._D_ee_basic, extMajorIT);
  }
  var extMajorUpperDev_mm = extMajorUpperDev_um / 1000;
  var extMajorTol_mm = extMajorTol_um / 1000;
  var D_ee_max = extDia._D_ee_basic + extMajorUpperDev_mm;
  var D_ee_min = D_ee_max - extMajorTol_mm;

  // ---- 外花键小径 D_ie ----
  // 上偏差同大径原则（表24），公差同大径（表25）
  var extMinorUpperDev_um = lookupExtMajorUpperDev(D, fitData.extDeviationSign);
  if (extMinorUpperDev_um === null) {
    if (fitData.extDeviationSign === 'k') {
      extMinorUpperDev_um = totalTol / Math.tan(Math.PI / 6);
    } else if (fitData.extDeviationSign === 'js') {
      extMinorUpperDev_um = totalTol / (2 * Math.tan(Math.PI / 6));
    } else {
      extMinorUpperDev_um = 0;
    }
  }
  var extMinorTol_um = lookupTable25Tolerance(extDia._D_ie_basic, m);
  if (extMinorTol_um === null || extMinorTol_um === undefined) {
    extMinorTol_um = extMajorTol_um;  // 回退：同大径公差
  }
  var extMinorUpperDev_mm = extMinorUpperDev_um / 1000;
  var extMinorTol_mm = extMinorTol_um / 1000;
  var D_ie_max = extDia._D_ie_basic + extMinorUpperDev_mm;
  var D_ie_min = D_ie_max - extMinorTol_mm;

  // ---- 内花键大径 D_ei (H偏差，下偏差=0，IT标准公差直接查表) ----
  var intMajorIT = getITgradeFromTable(INT_MAJOR_TOL_GRADE, m);
  var intMajorTol_um = lookupITTolerance(intDia._D_ei_basic, intMajorIT);
  var intMajorTol_mm = intMajorTol_um / 1000;
  var D_ei_max = intDia._D_ei_basic + intMajorTol_mm;
  var D_ei_min = intDia._D_ei_basic;

  // ---- 内花键小径 D_ii (H偏差，下偏差=0) ----
  // 上偏差：表25直接查表
  var intMinorTol_um = lookupTable25Tolerance(intDia._D_ii_basic, m);
  if (intMinorTol_um === null || intMinorTol_um === undefined) {
    // 表25无覆盖，回退到 IT 标准公差直接查表
    var intMinorIT = getITgradeFromTable([
      { mMax: 0.75, IT: 10 }, { mMax: 2.0, IT: 11 }, { mMax: 6.0, IT: 11 }, { mMax: 10, IT: 12 }
    ], m);
    intMinorTol_um = lookupITTolerance(intDia._D_ii_basic, intMinorIT);
  }
  var intMinorTol_mm = intMinorTol_um / 1000;
  var D_ii_max = intDia._D_ii_basic + intMinorTol_mm;
  var D_ii_min = intDia._D_ii_basic;

  // ============ Step 13: 转矩确定 ============
  // 优先使用直接输入的转矩；否则从功率+转速推算
  let effectiveTorque = torque;
  let torqueSource = '直接输入';
  if (effectiveTorque <= 0 && power_kW > 0 && speed_rpm > 0) {
    effectiveTorque = calcTorqueFromPower(power_kW, speed_rpm);
    torqueSource = `由 P=${power_kW}kW, n=${speed_rpm}rpm 推算 (T=9550·P/n)`;
  }

  // ============ Step 14: 材料参数 ============
  let matProps;
  if (customMaterial && customMaterial.allowableCompression) {
    // 使用自定义材料属性
    matProps = {
      allowableCompression: customMaterial.allowableCompression || 140,
      allowableShear: customMaterial.allowableShear || 85,
      allowableBending: customMaterial.allowableBending || 170,
      allowableWearPV: customMaterial.allowableWearPV || 3.5,
      allowableWearFreeContact: customMaterial.allowableWearFreeContact || 60,
      hardness: customMaterial.hardness || '自定义'
    };
  } else {
    matProps = MATERIAL_PROPERTIES[material] || MATERIAL_PROPERTIES['40Cr调质'];
  }

  // 自定义材料的显示名称
  const materialDisplayName = customMaterial && customMaterial.allowableCompression
    ? (customMaterial.hardness || '自定义材料')
    : material;

  // ============ Step 15: 强度校核（6项，《机械设计手册》第五版） ============
  let strengthResult = null;
  if (effectiveTorque > 0) {
    // 几何参数准备
    const h_contact = (extDia._D_ee_basic - intDia._D_ii_basic) / 2;   // 齿面接触高度
    const D_mean = D;
    const S_fn = Math.PI * m / 2;                                       // 齿根弦齿厚 (≈πm/2)
    const h_full = (extDia._D_ee_basic - extDia._D_ie_basic) / 2;       // 全齿高
    const D_ie_min_val = D_ie_min;           // 外花键小径最小值（轴危险截面）

    // ----- ① 齿面接触（挤压）强度 -----
    const contactCheck = checkContactStrength(effectiveTorque, z, h_contact, L_eng, D_mean, 0.75);
    const contactEval = evaluateCheck(
      contactCheck._sigma_H, matProps.allowableCompression,
      safetyStd.contactSafety.qualified, safetyStd.contactSafety.warning
    );

    // ----- ② 齿根抗弯强度 -----
    const bendCheck = checkBendingStrength(effectiveTorque, z, h_full, L_eng, D_mean, S_fn, 0.75);
    const bendEval = evaluateCheck(
      bendCheck._sigma_F, matProps.allowableBending,
      safetyStd.bendingSafety.qualified, safetyStd.bendingSafety.warning
    );

    // ----- ③ 齿根抗剪强度 -----
    const shearCheck = checkShearStrength(effectiveTorque, z, S_fn, L_eng, D_mean, 0.75);
    const shearEval = evaluateCheck(
      shearCheck._tau, matProps.allowableShear,
      safetyStd.bendingSafety.qualified, safetyStd.bendingSafety.warning
    );

    // ----- ④ 10⁸ 循环磨损校核（需转速） -----
    let wear10e8Result = null;
    let wear10e8Eval = null;
    if (speed_rpm > 0) {
      wear10e8Result = checkWear10e8(contactCheck._sigma_H, speed_rpm, h_contact, D);
      wear10e8Eval = evaluateCheck(
        wear10e8Result._pv, matProps.allowableWearPV,
        1.5, 1.0  // p·v 值安全系数：合格≥1.5，警告≥1.0
      );
    }

    // ----- ⑤ 长期工作无磨损校核 -----
    const wearFreeResult = checkWearFreeLongTerm(contactCheck._sigma_H, matProps.allowableWearFreeContact);
    const wearFreeEval = {
      margin: wearFreeResult.margin,
      status: wearFreeResult.isWearFree ? '合格' : '警告',
      isWearFree: wearFreeResult.isWearFree
    };

    // ----- ⑥ 外花键轴扭转 + 弯曲 -----
    const torsionCheck = checkShaftTorsion(effectiveTorque, D_ie_min_val);
    const torsionEval = evaluateCheck(
      torsionCheck._tau_max, matProps.allowableShear,
      safetyStd.bendingSafety.qualified, safetyStd.bendingSafety.warning
    );

    const bendingCheck = checkShaftBending(effectiveTorque, D_ie_min_val, bendingMoment);
    let bendingEval = null;
    if (bendingMoment > 0) {
      bendingEval = evaluateCheck(
        bendingCheck._sigma_e, matProps.allowableBending,
        safetyStd.bendingSafety.qualified, safetyStd.bendingSafety.warning
      );
    }

    // 汇总
    strengthResult = {
      torque: toSignificantDigits(effectiveTorque),
      torqueSource: torqueSource,
      material: materialDisplayName,
      materialHardness: matProps.hardness,
      // ① 齿面接触
      contact: {
        stress_MPa: contactCheck.sigma_H_MPa,
        allowable_MPa: contactEval.allowable,
        safetyFactor: contactEval.safetyFactor,
        status: contactEval.status,
        threshold: { qualified: safetyStd.contactSafety.qualified, warning: safetyStd.contactSafety.warning }
      },
      // ② 齿根弯曲
      bending: {
        stress_MPa: bendCheck.sigma_F_MPa,
        allowable_MPa: bendEval.allowable,
        safetyFactor: bendEval.safetyFactor,
        status: bendEval.status,
        threshold: { qualified: safetyStd.bendingSafety.qualified, warning: safetyStd.bendingSafety.warning }
      },
      // ③ 齿根抗剪
      shear: {
        stress_MPa: shearCheck.tau_MPa,
        allowable_MPa: shearEval.allowable,
        safetyFactor: shearEval.safetyFactor,
        status: shearEval.status,
        threshold: { qualified: safetyStd.bendingSafety.qualified, warning: safetyStd.bendingSafety.warning }
      },
      // ④ 10⁸ 循环磨损
      wear10e8: wear10e8Result ? {
        pv_MPa_ms: wear10e8Result.pv_MPa_ms,
        v_s_ms: wear10e8Result.v_s_ms,
        allowable_MPa_ms: matProps.allowableWearPV,
        safetyFactor: wear10e8Eval.safetyFactor,
        status: wear10e8Eval.status,
        totalSlidingDistance_m: wear10e8Result.totalSlidingDistance_m,
        note: wear10e8Result.note
      } : null,
      // ⑤ 长期无磨损
      wearFree: {
        sigma_H_MPa: wearFreeResult.sigma_H_MPa,
        allowable_MPa: wearFreeResult.allowable_MPa,
        margin: wearFreeResult.margin,
        status: wearFreeEval.status,
        isWearFree: wearFreeResult.isWearFree,
        note: wearFreeResult.note
      },
      // ⑥ 轴扭转 + 弯曲
      shaftTorsion: {
        stress_MPa: torsionCheck.tau_max_MPa,
        allowable_MPa: torsionEval.allowable,
        safetyFactor: torsionEval.safetyFactor,
        status: torsionEval.status,
        D_ie_min: D_ie_min_val,
        W_t_mm3: torsionCheck.W_t_mm3
      },
      shaftBending: {
        sigma_b_MPa: bendingCheck.sigma_b_MPa,
        sigma_e_MPa: bendingCheck.sigma_e_MPa,
        allowable_MPa: bendingEval ? bendingEval.allowable : matProps.allowableBending,
        safetyFactor: bendingEval ? bendingEval.safetyFactor : null,
        status: bendingEval ? bendingEval.status : '未校核（未提供弯矩）',
        bendingMoment_Nm: bendingMoment,
        W_b_mm3: bendingCheck.W_b_mm3,
        note: bendingCheck.note
      }
    };
  }

  // ============ 汇总输出 ============
  return {
    // ---- 输入参数 ----
    input: {
      m, z,
      toleranceGrade,
      fitType: fitData.name,
      fitDescription: fitData.description,
      fitType_class: fitData.type,
      rootType: profile[rootType].name,
      pinDiameter: toSignificantDigits(pinDia),
      pinRecommendation: pinRecommendation,
      engagementLength: toSignificantDigits(L_eng),
      industry: safetyStd.name,
      industryStandard: safetyStd.standard
    },

    // ---- 基本几何 ----
    basic: {
      分度圆直径_D: basicGeo.D,
      基圆直径_Db: basicGeo.Db,
      齿距_p: basicGeo.p,
      基本齿厚_S: basicGeo.S_basic,
      基本齿槽宽_E: basicGeo.E_basic,
      压力角_alpha: basicGeo.alphaDeg,
      inv_alpha: toSignificantDigits(invAlpha),
      齿根圆角最小曲率半径_mm: toSignificantDigits(profile[rootType].rootFilletCoeff * m)
    },

    // ---- 外花键 ----
    external: {
      大径_D_ee: {
        basic: extDia.D_ee_basic,
        max: toSignificantDigits(D_ee_max),
        min: toSignificantDigits(D_ee_min),
        tolerance: toSignificantDigits(extMajorTol_mm),
        上偏差_um: extMajorUpperDev_um,
        标注: `${extDia.D_ee_basic} ${extMajorUpperDev_um >= 0 ? '+' : ''}${extMajorUpperDev_um.toFixed(0)}μm / ${(extMajorUpperDev_um - extMajorTol_um).toFixed(0)}μm (表25)`
      },
      小径_D_ie: {
        basic: extDia.D_ie_basic,
        max: toSignificantDigits(D_ie_max),
        min: toSignificantDigits(D_ie_min),
        tolerance: toSignificantDigits(extMinorTol_mm),
        上偏差_um: extMinorUpperDev_um,
        标注: `${extDia.D_ie_basic} ${extMinorUpperDev_um >= 0 ? '+' : ''}${extMinorUpperDev_um.toFixed(0)}μm / ${(extMinorUpperDev_um - extMinorTol_um).toFixed(0)}μm (表25)`
      },
      渐开线起始圆_D_Fe_max: toSignificantDigits(D_Fe_max),
      齿厚: {
        basic: extTooth.S_basic,
        actual_max: extTooth.S_max,
        actual_min: extTooth.S_min,
        action_max: extTooth.S_v_max,
        action_min: extTooth.S_v_min,
        tolerance_T: extTooth.T,
        es_v_um: extTooth.es_v,
        es_um: extTooth.es,
        ei_um: extTooth.ei
      },
      跨棒距_M_Re: {
        pinDiameter: toSignificantDigits(pinDia),
        max: extPinMax.error ? 'N/A' : extPinMax.M_Re,
        min: extPinMin.error ? 'N/A' : extPinMin.M_Re,
        max_detail: extPinMax,
        min_detail: extPinMin
      }
    },

    // ---- 内花键 ----
    internal: {
      大径_D_ei: {
        basic: intDia.D_ei_basic,
        max: toSignificantDigits(D_ei_max),
        min: toSignificantDigits(D_ei_min),
        tolerance: toSignificantDigits(intMajorTol_mm),
        IT等级: intMajorIT,
        标注: `${intDia.D_ei_basic} +${intMajorTol_mm.toFixed(3)}/0 (IT${intMajorIT}回退)`
      },
      小径_D_ii: {
        basic: intDia.D_ii_basic,
        max: toSignificantDigits(D_ii_max),
        min: toSignificantDigits(D_ii_min),
        tolerance: toSignificantDigits(intMinorTol_mm),
        标注: `${intDia.D_ii_basic} +${intMinorTol_um.toFixed(0)}μm/0 (表25)`
      },
      渐开线终止圆_D_Fi_min: toSignificantDigits(D_Fi_min),
      齿槽宽: {
        basic: intSpace.E_basic,
        actual_max: intSpace.E_max,
        actual_min: intSpace.E_min,
        action_max: intSpace.E_v_max,
        action_min: intSpace.E_v_min,
        tolerance_T: intSpace.T,
        EI_v_um: 0,
        ES_v_um: intSpace.ES_v,
        实际下偏差_um: intSpace.es_actual_lower,
        实际上偏差_um: intSpace.es_actual_upper
      },
      棒间距_M_Ri: {
        pinDiameter: toSignificantDigits(pinDia),
        min: intPinMin.error ? 'N/A' : intPinMin.M_Ri,
        max: intPinMax.error ? 'N/A' : intPinMax.M_Ri,
        min_detail: intPinMin,
        max_detail: intPinMax
      }
    },

    // ---- 配合参数 ----
    fit: {
      配合类别: fitData.name,
      配合性质: fitData.type,
      配合说明: fitData.note,
      最大侧隙_mm: toSignificantDigits(Math.max(0, backlash_max_mm)),
      最小侧隙_mm: toSignificantDigits(Math.max(0, backlash_min_mm)),
      实际最小侧隙可能为0: backlash_min_mm < 0 ? '是（过渡/过盈配合）' : '否'
    },

    // ---- 公差明细 ----
    tolerance: {
      公差等级: toleranceGrade,
      等级说明: gradeData.description,
      总公差_T_lambda_um: toSignificantDigits(totalTol),
      综合公差_lambda_um: toSignificantDigits(lambda),
      加工公差_T_um: toSignificantDigits(T),
      齿距累积公差_Fp_um: toSignificantDigits(Fp),
      齿形公差_ff_um: toSignificantDigits(ff),
      齿向公差_Fbeta_um: toSignificantDigits(Fbeta),
      配合长度_L_mm: toSignificantDigits(L_eng)
    },

    // ---- 强度校核（可选） ----
    strength: strengthResult,

    // ---- 判定标准 ----
    safetyStandard: {
      industry: safetyStd.name,
      standard: safetyStd.standard,
      contactQualified: safetyStd.contactSafety.qualified,
      contactWarning: safetyStd.contactSafety.warning,
      bendingQualified: safetyStd.bendingSafety.qualified,
      bendingWarning: safetyStd.bendingSafety.warning
    }
  };
}

// ============================================================
// 十二、计算报告生成
//    生成详细的分步计算过程，每步含公式 → 代入 → 结果
//    供界面展示"中间计算详情"和导出计算报告（PDF/打印）
// ============================================================

/**
 * 格式化数值，保留指定位小数（默认4位），去除尾部多余零
 * @param {number} v - 数值
 * @param {number} decimals - 小数位数（默认4）
 * @returns {string}
 */
function fmtVal(v, decimals) {
  if (decimals === undefined) decimals = 4;
  if (typeof v !== 'number' || isNaN(v)) return String(v);
  return parseFloat(v.toFixed(decimals)).toString();
}

/**
 * 格式化 μm 值（保留1位小数）
 */
function fmtUm(v) {
  if (typeof v !== 'number' || isNaN(v)) return String(v);
  return parseFloat(v.toFixed(1)).toString();
}

/**
 * 生成计算报告 — 分步详细计算过程
 *
 * 每步结构：
 *   { num, title, symbol, formula, substitution, result, unit, standard }
 *
 * @param {object} params - 原始输入参数
 * @param {object} r - calcAll 的返回结果
 * @returns {object} { title, steps, metadata }
 */
function generateCalcReport(params, r) {
  var steps = [];
  var num = 0;
  function step(title, symbol, formula, substitution, result, unit, standard) {
    num++;
    steps.push({
      num: num, title: title, symbol: symbol || '',
      formula: formula || '', substitution: substitution || '',
      result: String(result), unit: unit || '', standard: standard || ''
    });
  }
  function n(v, d) { return fmtVal(v, d); }
  function u(v) { return fmtUm(v); }

  // 提取数据
  var m = r.input.m;
  var z = r.input.z;
  var D = r.basic.分度圆直径_D;
  var Db = r.basic.基圆直径_Db;
  var p_pitch = r.basic.齿距_p;
  var S_basic = r.basic.基本齿厚_S;
  var E_basic = r.basic.基本齿槽宽_E;
  var alphaDeg = r.basic.压力角_alpha;
  var invAlpha = r.basic.inv_alpha;
  var rootType = r.input.rootType;
  // 兼容 key ('filletRoot'/'flatRoot') 和显示名 ('圆齿根'/'平齿根')
  var isFilletRoot = (rootType === 'filletRoot' || rootType.indexOf('圆') >= 0);
  var rootTypeName = isFilletRoot ? '圆齿根' : '平齿根';
  var rootTypeKey = isFilletRoot ? 'filletRoot' : 'flatRoot';
  var rMinorCoeff = isFilletRoot ? 1.8 : 1.5;
  var cF = n(0.1 * m, 3);

  var ext = r.external;
  var int = r.internal;
  var tol = r.tolerance;
  var fit = r.fit;

  // ============ 一、已知条件 ============
  step('模数', 'm', '', '', m, 'mm', 'GB/T 3478.1-2008');
  step('齿数', 'z', '', '', z, '', 'GB/T 3478.1-2008');
  step('标准压力角', 'α_D', '', '', alphaDeg + '°', '', 'GB/T 3478.1-2008 §5');
  step('花键配合长度', 'l', '', '', n(tol.配合长度_L_mm), 'mm', '');
  step('花键类型', '', '', '', rootTypeName, '', '');
  step('公差等级', '', '', '', tol.公差等级 + '级 — ' + tol.等级说明, '', 'GB/T 3478.1-2008 §8');
  step('配合类别', '', '', '', fit.配合类别 + ' — ' + fit.配合性质, '', 'GB/T 3478.1-2008 §7');

  // ============ 二、基本几何参数 ============
  step('分度圆直径', 'D', 'm × z',
    n(m) + ' × ' + z, D, 'mm', 'GB/T 3478.1-2008 公式(1)');

  step('基圆直径', 'D_b', 'm × z × cos(α_D)',
    n(m) + ' × ' + z + ' × cos(' + alphaDeg + '°) = ' + n(m) + ' × ' + z + ' × ' + n(Math.cos(alphaDeg * Math.PI / 180)),
    Db, 'mm', 'GB/T 3478.1-2008 公式(2)');

  step('齿距', 'p', 'π × m',
    'π × ' + n(m), p_pitch, 'mm', 'GB/T 3478.1-2008 公式(3)');

  step('基本齿厚', 'S', 'π × m / 2',
    'π × ' + n(m) + ' / 2', S_basic, 'mm', 'GB/T 3478.1-2008 公式(4)');

  step('基本齿槽宽', 'E', 'π × m / 2',
    'π × ' + n(m) + ' / 2', E_basic, 'mm', 'GB/T 3478.1-2008 公式(4)');

  step('渐开线函数 inv(α_D)', 'inv(α_D)', 'tan(α_D) − α_D',
    'tan(' + alphaDeg + '°) − ' + n(alphaDeg * Math.PI / 180) + ' = ' + n(Math.tan(alphaDeg * Math.PI / 180)) + ' − ' + n(alphaDeg * Math.PI / 180),
    invAlpha, 'rad', 'GB/T 3478.1-2008');

  // ============ 三、外花键直径 ============
  step('外花键大径基本尺寸', 'D_ee', 'm × (z + 2·ha*)',
    n(m) + ' × (' + z + ' + 2×0.5) = ' + n(m) + ' × ' + n(z + 1),
    ext.大径_D_ee.basic, 'mm', 'GB/T 3478.1-2008');

  step('外花键小径基本尺寸', 'D_ie', 'm × (z − coeff)',
    n(m) + ' × (' + z + ' − ' + n(rMinorCoeff) + ')',
    ext.小径_D_ie.basic, 'mm', 'GB/T 3478.1-2008');

  // D_Fe_max 详细计算
  var h_s = n(0.6 * m, 3);
  var es_v_val = ext.齿厚.es_v_um;
  step('配对内花键齿顶高', 'h_s', '0.6 × m',
    '0.6 × ' + n(m), h_s, 'mm', 'GB/T 3478.1-2008 §6.4');

  step('外花键渐开线起始圆直径最大值', 'D_Fe_max',
    '2√[(0.5D_b)² + (0.5D·sinα_D − (h_s−0.5·es_v/tanα_D)/sinα_D)²]',
    '2√[(' + n(0.5 * Db) + ')² + (' + n(0.5 * D) + '×sin(' + alphaDeg + '°) − (' + h_s + '−0.5×(' + u(es_v_val) + '/1000)/tan(' + alphaDeg + '°))/sin(' + alphaDeg + '°))²]',
    ext.渐开线起始圆_D_Fe_max, 'mm', 'GB/T 3478.1-2008 公式(6)');

  // ============ 四、内花键直径 ============
  step('内花键大径基本尺寸', 'D_ei', 'm × (z + coeff)',
    n(m) + ' × (' + z + ' + ' + n(rMinorCoeff) + ')',
    int.大径_D_ei.basic, 'mm', 'GB/T 3478.1-2008');

  step('齿形裕度', 'c_F', '0.1 × m',
    '0.1 × ' + n(m), cF, 'mm', 'GB/T 3478.1-2008');

  step('内花键小径基本尺寸', 'D_ii', 'max[m(z−2·ha*), D_Fe_max + 2·c_F]',
    'max[' + n(m) + '×(' + z + '−1), ' + n(ext.渐开线起始圆_D_Fe_max) + ' + 2×' + cF + '] = max[' + n(m * (z - 1)) + ', ' + n(parseFloat(ext.渐开线起始圆_D_Fe_max) + 2 * 0.1 * m) + ']',
    int.小径_D_ii.basic, 'mm', 'GB/T 3478.1-2008 §6.4');

  step('内花键渐开线终止圆直径最小值', 'D_Fi_min', 'm × (z + 1) + 2·c_F',
    n(m) + ' × (' + z + ' + 1) + 2×' + cF + ' = ' + n(m * (z + 1)) + ' + ' + n(2 * 0.1 * m),
    int.渐开线终止圆_D_Fi_min, 'mm', 'GB/T 3478.1-2008 §6.4');

  // ============ 五、公差计算 ============
  step('公差单位 i*(D)', 'i*', '0.45·∛D + 0.001·D  (D≤500mm)',
    '0.45×∛' + n(D) + ' + 0.001×' + n(D) + ' = 0.45×' + n(Math.pow(D, 1/3)) + ' + ' + n(0.001 * D),
    u(0.45 * Math.pow(D, 1/3) + 0.001 * D), 'μm', 'GB/T 3478.1-2008 公式(3)');

  step('公差单位 i**(S)', 'i**', '0.45·∛S + 0.001·S',
    '0.45×∛' + n(S_basic) + ' + 0.001×' + n(S_basic),
    u(0.45 * Math.pow(S_basic, 1/3) + 0.001 * S_basic), 'μm', 'GB/T 3478.1-2008 公式(4)');

  step('总公差 (T+λ)', 'T+λ', 'K₁·i* + K₂·i**',
    '', n(tol.总公差_T_lambda_um, 1), 'μm', 'GB/T 3478.1-2008 表8');

  // 单项公差
  var L_arc_half = Math.PI * m * z / 2;
  step('分度圆周长之半', 'L', 'π·m·z / 2',
    'π × ' + n(m) + ' × ' + z + ' / 2', n(L_arc_half, 2), 'mm', 'GB/T 3478.1-2008 §8.4');

  step('齿距累积公差', 'F_p', 'fpA·√L + fpB',
    '', n(tol.齿距累积公差_Fp_um, 1), 'μm', 'GB/T 3478.1-2008 §8.4');

  var phi_val = m + 0.0125 * m * z;
  step('公差因数', 'φ', 'm + 0.0125·m·z',
    n(m) + ' + 0.0125×' + n(m) + '×' + z, n(phi_val, 2), 'mm', 'GB/T 3478.1-2008 §8.5');

  step('齿形公差', 'f_f', 'ffA·φ + ffB',
    '', n(tol.齿形公差_ff_um, 1), 'μm', 'GB/T 3478.1-2008 §8.5');

  step('齿向公差', 'F_β', 'fbetaA·√g + fbetaB  (g=配合长度)',
    '', n(tol.齿向公差_Fbeta_um, 1), 'μm', 'GB/T 3478.1-2008 §8.6');

  step('综合公差', 'λ', '0.6·√(F_p² + f_f² + F_β²)',
    '0.6×√(' + n(tol.齿距累积公差_Fp_um) + '² + ' + n(tol.齿形公差_ff_um) + '² + ' + n(tol.齿向公差_Fbeta_um) + '²)',
    n(tol.综合公差_lambda_um, 1), 'μm', 'GB/T 3478.1-2008 §8.4~8.6');

  step('加工公差', 'T', '(T+λ) − λ',
    n(tol.总公差_T_lambda_um, 1) + ' − ' + n(tol.综合公差_lambda_um, 1),
    n(tol.加工公差_T_um, 1), 'μm', 'GB/T 3478.1-2008');

  // ============ 六、基本偏差 ============
  step('作用齿厚上偏差', 'es_v', '按配合类别和D查表24',
    '配合=' + fit.配合类别 + ', D=' + n(D, 1) + 'mm → 查表',
    u(es_v_val), 'μm', 'GB/T 3478.1-2008 表24');

  // ============ 七、外花键齿厚极限 ============
  step('作用齿厚最大值', 'S_v_max', 'S + es_v / 1000',
    n(S_basic) + ' + (' + u(es_v_val) + ')/1000',
    n(ext.齿厚.action_max, 4), 'mm', 'GB/T 3478.1-2008 §8');

  step('实际齿厚最小值', 'S_min', 'S_v_max − (T+λ)/1000',
    n(ext.齿厚.action_max, 4) + ' − ' + n(tol.总公差_T_lambda_um, 1) + '/1000',
    n(ext.齿厚.actual_min, 4), 'mm', 'GB/T 3478.1-2008 §8');

  step('实际齿厚最大值', 'S_max', 'S_v_max − λ/1000',
    n(ext.齿厚.action_max, 4) + ' − ' + n(tol.综合公差_lambda_um, 1) + '/1000',
    n(ext.齿厚.actual_max, 4), 'mm', 'GB/T 3478.1-2008 §8');

  step('作用齿厚最小值', 'S_v_min', 'S_min + λ/1000',
    n(ext.齿厚.actual_min, 4) + ' + ' + n(tol.综合公差_lambda_um, 1) + '/1000',
    n(ext.齿厚.action_min, 4), 'mm', 'GB/T 3478.1-2008 §8');

  // ============ 八、内花键齿槽宽极限 ============
  step('作用齿槽宽最小值', 'E_v_min', 'E  (EI_v=0)',
    n(E_basic), n(E_basic), 'mm', 'GB/T 3478.1-2008 §8 (基孔制H)');

  step('实际齿槽宽最小值', 'E_min', 'E + λ/1000  (EI=λ)',
    n(E_basic) + ' + ' + n(tol.综合公差_lambda_um, 1) + '/1000',
    n(int.齿槽宽.actual_min, 4), 'mm', 'GB/T 3478.1-2008 §8');

  step('实际齿槽宽最大值', 'E_max', 'E + (T+λ)/1000  (ES=T+λ)',
    n(E_basic) + ' + ' + n(tol.总公差_T_lambda_um, 1) + '/1000',
    n(int.齿槽宽.actual_max, 4), 'mm', 'GB/T 3478.1-2008 §8');

  step('作用齿槽宽最大值', 'E_v_max', 'E_max − λ/1000',
    n(int.齿槽宽.actual_max, 4) + ' − ' + n(tol.综合公差_lambda_um, 1) + '/1000',
    n(int.齿槽宽.action_max, 4), 'mm', 'GB/T 3478.1-2008 §8');

  // ============ 九、配合侧隙 ============
  step('最小侧隙', 'C_min', 'E_min − S_max',
    n(int.齿槽宽.actual_min, 4) + ' − ' + n(ext.齿厚.actual_max, 4),
    n(fit.最小侧隙_mm, 4), 'mm', '');
  step('最大侧隙', 'C_max', 'E_max − S_min',
    n(int.齿槽宽.actual_max, 4) + ' − ' + n(ext.齿厚.actual_min, 4),
    n(fit.最大侧隙_mm, 4), 'mm', '');

  // ============ 十、量棒测量 ============
  var pinD = ext.跨棒距_M_Re.pinDiameter;
  if (!ext.跨棒距_M_Re.max_detail.error) {
    var maxDet = ext.跨棒距_M_Re.max_detail;
    step('外花键量棒接触点 inv(α_e)', 'inv(α_e)',
      'S_max/D + inv(α_D) + D_R/D_b − π/z',
      n(ext.齿厚.actual_max, 4) + '/' + n(D) + ' + ' + n(invAlpha) + ' + ' + n(pinD) + '/' + n(Db) + ' − π/' + z,
      n(maxDet.invAlpha_e, 6), '', 'GB/T 3478.5-2008');

    step('外花键量棒中心压力角', 'α_e', 'inv⁻¹(inv(α_e))  牛顿迭代',
      '', maxDet.alpha_e_deg + '°', '', 'GB/T 3478.5-2008');

    var evenOddNote = z % 2 === 0 ? '(偶齿数)' : '×cos(90°/' + z + ') (奇齿数修正)';
    step('外花键跨棒距最大值', 'M_Re_max', 'D_b/cos(α_e) + D_R  ' + evenOddNote,
      n(Db) + '/cos(' + maxDet.alpha_e_deg + '°) + ' + n(pinD),
      n(ext.跨棒距_M_Re.max, 4), 'mm', 'GB/T 3478.5-2008');
  }

  if (!int.棒间距_M_Ri.max_detail.error) {
    var minDet = int.棒间距_M_Ri.min_detail;
    step('内花键量棒接触点 inv(α_i)', 'inv(α_i)',
      'E_min/D + inv(α_D) − D_R/D_b',
      n(int.齿槽宽.actual_min, 4) + '/' + n(D) + ' + ' + n(invAlpha) + ' − ' + n(pinD) + '/' + n(Db),
      n(minDet.invAlpha_i, 6), '', 'GB/T 3478.5-2008');

    step('内花键量棒中心压力角', 'α_i', 'inv⁻¹(inv(α_i))  牛顿迭代',
      '', minDet.alpha_i_deg + '°', '', 'GB/T 3478.5-2008');

    var evenOddNoteI = z % 2 === 0 ? '(偶齿数)' : '×cos(90°/' + z + ') (奇齿数修正)';
    step('内花键棒间距最小值', 'M_Ri_min', 'D_b/cos(α_i) − D_R  ' + evenOddNoteI,
      n(Db) + '/cos(' + minDet.alpha_i_deg + '°) − ' + n(pinD),
      n(int.棒间距_M_Ri.min, 4), 'mm', 'GB/T 3478.5-2008');
  }

  // ============ 十一、大径小径公差 ============
  step('外花键大径上偏差', 'es(D_ee)/tan(α_D)', '查表24',
    'D=' + n(D, 1) + 'mm, 配合=' + fit.配合类别 + ' → 查表',
    u(ext.大径_D_ee.上偏差_um), 'μm', 'GB/T 3478.1-2008 表24');
  step('外花键大径公差', 'T(D_ee)', '查表25',
    '', n(parseFloat(ext.大径_D_ee.tolerance) * 1000, 0), 'μm', 'GB/T 3478.1-2008 表25');
  step('内花键小径上偏差', 'ES(D_ii)', '查表25 (H偏差，下偏差=0)',
    '', u(int.小径_D_ii.标注.indexOf('μm') > -1 ? parseFloat(int.小径_D_ii.标注.replace(/[^+\-\d.]/g, '').split('/')[0]) || 0 : 0), 'μm', 'GB/T 3478.1-2008 表25');

  // ============ 十二、强度校核（如果有） ============
  if (r.strength) {
    var s = r.strength;
    step('传递转矩', 'T', s.torqueSource.indexOf('推算') > -1 ? '9550×P/n' : '直接输入',
      s.torqueSource, n(s.torque, 1), 'N·m', '');

    // 简化公式校核步骤
    if (r._method !== 'gb17855' || !r._gb17855) {
      step('齿面接触应力', 'σ_H', '2000·T / (ψ·z·h_c·l·D_m)',
        '2000×' + n(s.torque, 1) + ' / (0.75×' + z + '×h_c×' + n(tol.配合长度_L_mm) + '×' + n(D) + ')',
        n(s.contact.stress_MPa, 2), 'MPa', '《机械设计手册》第五版');

      step('齿面接触许用应力', '[σ_H]', '按材料查表',
        '材料=' + s.material + ' (' + s.materialHardness + ')',
        n(s.contact.allowable_MPa, 1), 'MPa', '');
      step('接触安全系数', 'n_H', '[σ_H] / σ_H',
        n(s.contact.allowable_MPa, 1) + ' / ' + n(s.contact.stress_MPa, 2),
        n(s.contact.safetyFactor, 2), '', '');

      step('齿根弯曲应力', 'σ_F', '6000·T·h / (ψ·z·S_fn²·l·D_m)',
        '', n(s.bending.stress_MPa, 2), 'MPa', '《机械设计手册》第五版');
      step('齿根弯曲许用应力', '[σ_F]', '按材料查表',
        '', n(s.bending.allowable_MPa, 1), 'MPa', '');

      step('轴扭转应力', 'τ_max', '16000·T / (π·D_ie_min³)',
        '16000×' + n(s.torque, 1) + ' / (π×' + n(s.shaftTorsion.D_ie_min) + '³)',
        n(s.shaftTorsion.stress_MPa, 2), 'MPa', '《机械设计手册》第五版');
    }

    // ============ GB/T 17855-1999 详细步骤 ============
    if (r._gb17855) {
      var gb = r._gb17855;
      var af = r._appFactors;

      step('======= GB/T 17855-1999 承载能力计算 =======', '', '', '', '', '', '');

      // a) 载荷
      step('[a] 名义切向力', 'F_t', '2000·T / D',
        '2000 × ' + n(s.torque, 1) + ' / ' + n(D),
        n(gb.loads.Ft_N, 1), 'N', 'GB/T 17855-1999 公式(2)');

      step('[a] 单位载荷', 'W', 'F_t / (z·l·cos α_D)',
        n(gb.loads._Ft, 1) + ' / (' + z + ' × ' + n(gb.input.L_eng) + ' × cos30°) = ' + n(gb.loads._Ft, 1) + ' / (' + z + ' × ' + n(gb.input.L_eng) + ' × ' + n(Math.cos(Math.PI/6)) + ')',
        n(gb.loads.W_N_per_mm, 1), 'N/mm', 'GB/T 17855-1999 公式(3)');

      // b) 接触
      step('[b] 齿面压应力', 'σ_H', 'W / h_w',
        n(gb.loads._W, 1) + ' / ' + n(gb.input.h_w),
        n(gb.contact.sigma_H_MPa, 1), 'MPa', 'GB/T 17855-1999 公式(4)');

      step('[b] 许用接触应力', '[σ_H]', 'σ_0.2 / (S_H·K1·K2·K3·K4)',
        n(gb.input.sigma02) + ' / (' + n(af.S_H) + ' × ' + n(af.K1) + ' × ' + n(af.K2) + ' × ' + n(af.K3) + ' × ' + n(af.K4) + ') = ' + n(gb.input.sigma02) + ' / ' + n(af.S_H * af.K1 * af.K2 * af.K3 * af.K4),
        n(gb.contact.allowable_MPa, 1), 'MPa', 'GB/T 17855-1999 公式(10)');

      step('[b] 接触校核', '', 'σ_H ≤ [σ_H]',
        n(gb.contact.sigma_H_MPa, 1) + ' ≤ ' + n(gb.contact.allowable_MPa, 1) + ' → ' + gb.contact.status,
        '', '', '');

      // c) 弯曲
      step('[c] 渐开线起始圆压力角', 'α_Fe', 'arccos(D·cosα_D / D_Fe)',
        'arccos(' + n(D) + '×cos30° / ' + n(gb.input.D_Fe) + ') = arccos(' + n(gb.bending.sfnDetail.insideAcos, 6) + ')',
        n(gb.bending.sfnDetail.alphaFe_deg, 4) + '°', '', 'GB/T 17855-1999 公式(5)');

      step('[c] D_Fe处渐开线函数', 'inv(α_Fe)', 'tan(α_Fe) − α_Fe',
        'tan(' + n(gb.bending.sfnDetail.alphaFe_deg, 4) + '°) − ' + n(gb.bending.sfnDetail.alphaFe_rad, 6),
        n(gb.bending.sfnDetail.invAlphaFe, 6), 'rad', '');

      step('[c] 分度圆处渐开线函数', 'inv(α_D)', 'tan(30°) − π/6',
        n(Math.tan(Math.PI/6)) + ' − ' + n(Math.PI/6, 6),
        n(gb.bending.sfnDetail.invAlphaD, 6), 'rad', '');

      step('[c] 齿根弦齿厚（方括号内）', '[...]', 'S/D + invα_D − invα_Fe',
        n(gb.bending.sfnDetail.term_S_D, 6) + ' + ' + n(gb.bending.sfnDetail.invAlphaD, 6) + ' − ' + n(gb.bending.sfnDetail.invAlphaFe, 6),
        n(gb.bending.sfnDetail.bracket_rad, 6), 'rad', '');

      step('[c] 齿根弦齿厚', 'S_Fn', 'D_Fe × sin([...])',
        n(gb.input.D_Fe) + ' × sin(' + n(gb.bending.sfnDetail.bracket_rad, 6) + ')',
        n(gb.bending.S_Fn_mm, 4), 'mm', 'GB/T 17855-1999 公式(5)');

      step('[c] 齿根弯曲应力', 'σ_F', '6·h·W·cosα_D / S_Fn²',
        '6 × ' + n(gb.input.h) + ' × ' + n(gb.loads._W, 1) + ' × cos30° / ' + n(gb.bending._S_Fn, 4) + '²',
        n(gb.bending.sigma_F_MPa, 1), 'MPa', 'GB/T 17855-1999 公式(6)');

      step('[c] 许用弯曲应力', '[σ_F]', 'σ_b / (S_F·K1·K2·K3·K4)',
        n(gb.input.sigmaB) + ' / (' + n(af.S_F) + ' × ' + n(af.K1) + ' × ' + n(af.K2) + ' × ' + n(af.K3) + ' × ' + n(af.K4) + ') = ' + n(gb.input.sigmaB) + ' / ' + n(af.S_F * af.K1 * af.K2 * af.K3 * af.K4),
        n(gb.bending.allowable_MPa, 1), 'MPa', 'GB/T 17855-1999 公式(10)');

      step('[c] 弯曲校核', '', 'σ_F ≤ [σ_F]',
        n(gb.bending.sigma_F_MPa, 1) + ' ≤ ' + n(gb.bending.allowable_MPa, 1) + ' → ' + gb.bending.status,
        '', '', '');

      // d) 剪切
      step('[d] 当量应力圆直径', 'd_h', 'D_ie + K·D_ie·(D_ee−D_ie)/D_ee',
        n(gb.input.D_ie) + ' + 0.15×' + n(gb.input.D_ie) + '×(' + n(gb.input.D_ee) + '−' + n(gb.input.D_ie) + ')/' + n(gb.input.D_ee),
        n(gb.shear.dh_mm, 1), 'mm', 'GB/T 17855-1999 公式(8)');

      step('[d] 名义剪切应力', 'τ_tn', '16000·T / (π·d_h³)',
        '16000 × ' + n(s.torque, 1) + ' / (π × ' + n(gb.shear._dh, 1) + '³)',
        n(gb.shear.tau_tn_MPa, 1), 'MPa', 'GB/T 17855-1999 公式(7)');

      step('[d] 应力集中系数（h/ρ）', 'h/ρ', 'h / ρ',
        n(gb.input.h) + ' / ' + n(gb.input.rho),
        n(gb.shear.alphaTnDetail.ratio, 2), '', 'GB/T 17855-1999 公式(9)');

      step('[d] 应力集中系数', 'α_tn', '(D_ie/d_h)×{1+0.17(h/ρ)[1+3.94/(0.1+h/ρ)] + 6.38(1+0.1h/ρ)/[2.38+D_ie/(2h)×(h/ρ+0.04)^(1/3)]²}',
        '', n(gb.shear.alpha_tn, 3), '', 'GB/T 17855-1999 公式(9)');

      step('[d] 最大剪切应力', 'τ_Fmax', 'τ_tn × α_tn',
        n(gb.shear.tau_tn_MPa, 1) + ' × ' + n(gb.shear.alpha_tn, 3),
        n(gb.shear.tau_Fmax_MPa, 1), 'MPa', 'GB/T 17855-1999');

      step('[d] 许用剪切应力', '[τ_F]', '[σ_F] / 2',
        n(gb.bending.allowable_MPa, 1) + ' / 2',
        n(gb.shear.allowable_MPa, 1), 'MPa', 'GB/T 17855-1999');

      step('[d] 剪切校核', '', 'τ_Fmax ≤ [τ_F]',
        n(gb.shear.tau_Fmax_MPa, 1) + ' ≤ ' + n(gb.shear.allowable_MPa, 1) + ' → ' + gb.shear.status,
        '', '', '');

      // e) 耐磨
      step('[e] 耐磨10⁶循环许用值', '[σ_H1]', '查表4（按材料硬度HRC）',
        '硬度等级=' + (gb.input.sigma02 >= 835 ? '优质合金钢调质' : '碳钢调质'),
        n(gb.wear.wear10e6.allowable_H1_MPa, 1), 'MPa', 'GB/T 17855-1999 表4');
      step('[e] 耐磨10⁶循环校核', '', 'σ_H ≤ [σ_H1]',
        n(gb.wear.sigma_H_MPa, 1) + ' ≤ ' + n(gb.wear.wear10e6.allowable_H1_MPa, 1) + ' → ' + gb.wear.wear10e6.status,
        '', '', '');

      var h2formula = gb.wear.wearLongTerm.formula || '[σ_H2] = 0.032×HB';
      step('[e] 长期无磨损许用值', '[σ_H2]', h2formula,
        '0.032 × ' + n(gb.wear.wearLongTerm.HB),
        n(gb.wear.wearLongTerm.allowable_H2_MPa, 1), 'MPa', 'GB/T 17855-1999 表5');
      step('[e] 长期无磨损校核', '', 'σ_H ≤ [σ_H2]',
        n(gb.wear.sigma_H_MPa, 1) + ' ≤ ' + n(gb.wear.wearLongTerm.allowable_H2_MPa, 1) + ' → ' + gb.wear.wearLongTerm.status,
        '', '', '');

      // f) 弯扭合成
      step('[f] 弯扭合成当量应力', 'σ_v', '√(σ_Fn² + 3×τ_tn²)  [M_b=0时 σ_Fn=0]',
        '√(3 × ' + n(gb.shear.tau_tn_MPa, 1) + '²) = √3 × ' + n(gb.shear.tau_tn_MPa, 1),
        n(gb.combined.sigma_v_MPa, 1), 'MPa', 'GB/T 17855-1999 公式(13)');

      step('[f] 弯扭合成许用值', '[σ_v]', 'σ_0.2 / (S_F·K1·K2·K3·K4)',
        n(gb.input.sigma02) + ' / (' + n(af.S_F) + ' × ' + n(af.K1) + ' × ' + n(af.K2) + ' × ' + n(af.K3) + ' × ' + n(af.K4) + ')',
        n(gb.combined.allowable_MPa, 1), 'MPa', '');

      step('[f] 弯扭合成校核', '', 'σ_v ≤ [σ_v]',
        n(gb.combined.sigma_v_MPa, 1) + ' ≤ ' + n(gb.combined.allowable_MPa, 1) + ' → ' + gb.combined.status,
        '', '', '');
    }
  }

  // 齿根圆角半径
  var profileData = BASIC_PROFILE_30[rootTypeKey];
  var rho_val = profileData.rootFilletCoeff * m;
  step('齿根圆角最小曲率半径', 'R_imin/R_emin', 'ρ_f* × m',
    n(profileData.rootFilletCoeff, 2) + ' × ' + n(m), n(rho_val, 2), 'mm', 'GB/T 3478.1-2008 表1');

  // 跨齿数 + 公法线长度（外花键）
  var k_across = z / 6.0 + 0.5;
  var k_ceil = Math.ceil(k_across);
  step('公法线跨齿数（理论）', "k'", 'z / 6 + 0.5',
    z + ' / 6 + 0.5', n(k_across, 2), '', 'GB/T 3478.5-2008');
  step('公法线跨齿数（圆整）', 'k', 'ceil(z/6 + 0.5)',
    'ceil(' + n(k_across, 2) + ')', String(k_ceil), '', '');

  var cosAlphaD = Math.cos(Math.PI / 6);
  var W_min = cosAlphaD * ((k_ceil - 0.5) * Math.PI * m + D * (Math.tan(Math.PI/6) - Math.PI/6) + es_v_val/1000 - tol.总公差_T_lambda_um/1000);
  step('公法线平均长度最小值', 'W_min', 'cosα_D×[(k−0.5)πm + D·invα_D + es_v − (T+λ)]',
    'cos30°×[(' + k_ceil + '−0.5)×π×' + n(m) + ' + ' + n(D) + '×' + n(invAlpha) + ' + ' + u(es_v_val) + '/1000 − ' + u(tol.总公差_T_lambda_um) + '/1000]',
    n(W_min, 4), 'mm', 'GB/T 3478.5-2008');

  var W_max_val = W_min + (tol.加工公差_T_um / 1000) * cosAlphaD;
  step('公法线平均长度最大值', 'W_max', 'W_min + T×cosα_D',
    n(W_min, 4) + ' + ' + n(tol.加工公差_T_um/1000, 4) + '×' + n(cosAlphaD),
    n(W_max_val, 4), 'mm', 'GB/T 3478.5-2008');

  return {
    title: '圆柱直齿渐开线花键 计算说明书',
    subtitle: 'GB/T 3478.1-2008 圆柱直齿渐开线花键（米制模数 齿侧配合）',
    inputSummary: '模数 m=' + m + 'mm, 齿数 z=' + z + ', 压力角 α_D=' + alphaDeg + '°, 配合长度 l=' + n(tol.配合长度_L_mm) + 'mm',
    splineType: rootTypeName + ' (ρ_f*=' + n(isFilletRoot ? 0.4 : 0.2, 1) + 'm)',
    steps: steps,
    metadata: {
      m: m, z: z, alphaDeg: alphaDeg, D: D, Db: Db,
      toleranceGrade: tol.公差等级, fitType: fit.配合类别,
      rootType: rootType, engagementLength: tol.配合长度_L_mm,
      hasStrength: !!r.strength, method: r._method || 'simplified',
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * 将计算报告渲染为可打印的完整 HTML 文档
 * @param {object} report - generateCalcReport 的返回结果
 * @returns {string} 完整 HTML 字符串
 */
function renderCalcReportToHTML(report) {
  var stepsHTML = '';
  for (var i = 0; i < report.steps.length; i++) {
    var s = report.steps[i];

    // 分隔标题行（如 GB/T 17855 章节标题）
    if (!s.formula && !s.result && s.title.indexOf('===') === 0) {
      stepsHTML += '<tr class="section-divider"><td colspan="5"><strong>' +
        s.title.replace(/=/g, '').trim() + '</strong></td></tr>';
      continue;
    }

    var formulaCell = s.formula;
    if (s.substitution) {
      formulaCell += '<br><span class="substitution">= ' + s.substitution + '</span>';
    }
    var resultCell = s.result + (s.unit ? ' <span class="unit">' + s.unit + '</span>' : '');
    stepsHTML += '<tr>' +
      '<td class="num">(' + s.num + ')</td>' +
      '<td class="title">' + s.title + '</td>' +
      '<td class="formula">' + formulaCell + '</td>' +
      '<td class="result">' + resultCell + '</td>' +
      '<td class="standard">' + (s.standard || '') + '</td>' +
      '</tr>';
  }

  var now = new Date();
  var dateStr = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');

  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<title>花键计算说明书</title>\n' +
    '<style>\n' +
    '  @page { size: A4; margin: 15mm 12mm; }\n' +
    '  * { box-sizing: border-box; margin: 0; padding: 0; }\n' +
    '  body { font-family: "Microsoft YaHei", "SimSun", sans-serif; font-size: 11pt; ' +
    '    color: #222; line-height: 1.7; max-width: 210mm; margin: 0 auto; padding: 5mm; }\n' +
    '  h1 { text-align: center; font-size: 16pt; margin-bottom: 4px; border-bottom: 2px solid #1a3a5c; padding-bottom: 6px; }\n' +
    '  .subtitle { text-align: center; font-size: 10pt; color: #555; margin-bottom: 8px; }\n' +
    '  .info-bar { display: flex; justify-content: space-between; font-size: 9pt; ' +
    '    background: #f0f4f8; padding: 6px 10px; border-radius: 4px; margin-bottom: 12px; }\n' +
    '  .section-title { font-size: 12pt; font-weight: bold; color: #1a3a5c; ' +
    '    border-bottom: 1px solid #ccc; padding-bottom: 2px; margin: 14px 0 6px 0; }\n' +
    '  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }\n' +
    '  th { background: #1a3a5c; color: #fff; padding: 5px 6px; text-align: left; font-size: 9pt; }\n' +
    '  td { padding: 4px 6px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }\n' +
    '  tr:nth-child(even) { background: #fafbfc; }\n' +
    '  .num { width: 36px; text-align: center; color: #1a3a5c; font-weight: bold; font-size: 9pt; }\n' +
    '  .title { width: 170px; font-weight: 600; }\n' +
    '  .formula { font-family: "Consolas", "Courier New", monospace; font-size: 9pt; }\n' +
    '  .substitution { color: #555; font-size: 8.5pt; }\n' +
    '  .result { width: 120px; font-family: "Consolas", "Courier New", monospace; ' +
    '    font-weight: bold; color: #1a3a5c; font-size: 10pt; text-align: right; }\n' +
    '  .standard { width: 130px; font-size: 8pt; color: #777; }\n' +
    '  .unit { font-weight: normal; font-size: 8.5pt; color: #666; }\n' +
    '  .section-divider td { background: #e8edf3 !important; font-size: 10pt; ' +
    '    padding: 6px; font-weight: bold; color: #1a3a5c; }\n' +
    '  .footer { text-align: center; font-size: 8pt; color: #999; margin-top: 16px; ' +
    '    border-top: 1px solid #ddd; padding-top: 8px; }\n' +
    '  @media print { body { padding: 0; } .no-print { display: none; } }\n' +
    '</style>\n</head>\n<body>\n' +
    '<div class="no-print" style="text-align:center;margin-bottom:10px">\n' +
    '  <button onclick="window.print()" style="padding:8px 24px;font-size:13pt;cursor:pointer;' +
    '    background:#1a3a5c;color:#fff;border:none;border-radius:4px">🖨️ 打印 / 导出 PDF</button>\n' +
    '  <button onclick="window.close()" style="padding:8px 24px;font-size:13pt;cursor:pointer;' +
    '    margin-left:8px;border:1px solid #ccc;border-radius:4px;background:#fff">关闭</button>\n' +
    '</div>\n' +
    '<h1>' + report.title + '</h1>\n' +
    '<div class="subtitle">' + report.subtitle + '</div>\n' +
    '<div class="info-bar">' +
    '  <span><strong>已知条件:</strong> ' + report.inputSummary + '</span>' +
    '  <span><strong>花键类型:</strong> ' + report.splineType + '</span>' +
    '  <span>' + dateStr + '</span>' +
    '</div>\n' +
    '<table>\n<thead><tr>' +
    '<th>序号</th><th>项目</th><th>公式 / 代入过程</th><th>结果</th><th>依据</th>' +
    '</tr></thead>\n<tbody>\n' +
    stepsHTML +
    '\n</tbody>\n</table>\n' +
    '<div class="footer">' +
    '本计算说明书由渐开线花键参数计算工具自动生成 | 依据 GB/T 3478.1-2008 & GB/T 17855-1999 | ' + dateStr +
    '</div>\n' +
    '</body>\n</html>';
}

// ============================================================
// 十三、导出
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    involute,
    inverseInvolute,
    toSignificantDigits,
    calcBasicGeometry,
    calcExternalSplineDiameters,
    calcInternalSplineDiameters,
    calcExternalFormDiameter,
    calcInternalFormDiameter,
    calcToleranceUnit_D,
    calcToleranceUnit_S,
    calcTotalTolerance,
    calcComprehensiveTolerance,
    calcFundamentalDeviation,
    calcToothThicknessLimits,
    calcSpaceWidthLimits,
    calcMeasurementOverPins,
    calcMeasurementBetweenPins,
    checkContactStrength,
    checkBendingStrength,
    evaluateStrength,
    calcTorqueFromPower,
    checkShearStrength,
    checkWear10e8,
    checkWearFreeLongTerm,
    checkShaftTorsion,
    checkShaftBending,
    evaluateCheck,
    calcDiameterTolerance,
    calcAll,
    // GB/T 17855-1999
    calcTorqueFromPowerGB,
    calcNominalTangentialForce,
    calcUnitLoad,
    calcContactStressGB17855,
    calcToothRootChordThickness,
    calcBendingStressGB17855,
    calcEquivalentDiameterDh,
    calcNominalShearStressTauTn,
    calcStressConcentrationFactor,
    calcAllowableStressGB,
    calcCombinedStressGB17855,
    calcGB17855All,
    // 计算报告
    generateCalcReport,
    renderCalcReportToHTML
  };
}
