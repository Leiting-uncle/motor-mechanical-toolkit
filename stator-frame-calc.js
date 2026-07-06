/**
 * ============================================================
 * stator-frame-calc.js — 定子铁心-机座过盈配合计算层
 * 依据：《机械设计手册》第五版 第2卷 第6章 — 过盈联接
 *       GB/T 5371-2004《极限与配合 过盈配合的计算和选用》
 *
 * 职责：仅存放纯计算函数、校核逻辑
 * 禁止：任何 DOM 操作、界面交互代码
 *
 * 物理模型：
 *   内件 = 定子铁心（硅钢片叠层，有空心——定子内孔）
 *   外件 = 机座（铝合金/铸铁/结构钢）
 *   通过过盈配合传递电磁转矩反力，并保证有效热接触
 *
 * 默认单位：长度 mm，应力/压强 MPa，过盈量 μm，温度 ℃
 * ============================================================
 */

// ============================================================
// 一、厚壁圆筒刚度系数（Lame 公式）
// ============================================================

/**
 * 计算内圆筒刚度系数 C₁
 * 公式：C₁ = (d² + d_i²)/(d² − d_i²) − ν₁
 *
 * 实心轴（d_i = 0）：C₁ = 1 − ν₁
 *
 * @param {number} d - 配合面直径 (mm)
 * @param {number} d_i - 内件内径 (mm)，实心取0
 * @param {number} nu - 内件泊松比
 * @returns {number} 刚度系数 C₁
 */
function stiffnessInner(d, d_i, nu) {
  if (d_i <= 0 || d_i >= d * 0.999) {
    // 实心内件
    return 1 - nu;
  }
  const ratio = d_i / d;
  return (1 + ratio * ratio) / (1 - ratio * ratio) - nu;
}

/**
 * 计算外圆筒刚度系数 C₂
 * 公式：C₂ = (d_o² + d²)/(d_o² − d²) + ν₂
 *
 * @param {number} d - 配合面直径 (mm)
 * @param {number} d_o - 外件外径 (mm)
 * @param {number} nu - 外件泊松比
 * @returns {number} 刚度系数 C₂
 */
function stiffnessOuter(d, d_o, nu) {
  if (d_o <= d) {
    // 无效：外径必须大于配合面直径
    return Infinity;
  }
  const ratio = d / d_o;
  return (1 + ratio * ratio) / (1 - ratio * ratio) + nu;
}

// ============================================================
// 二、接触压力与过盈量换算
// ============================================================

/**
 * 从过盈量计算接触压力
 * 公式：p = δ × 10³ / [d × (C₁/E₁ + C₂/E₂)]  (MPa)
 *
 * @param {number} delta_um - 直径过盈量 (μm)
 * @param {number} d - 配合面公称直径 (mm)
 * @param {number} C1 - 内件刚度系数
 * @param {number} C2 - 外件刚度系数
 * @param {number} E1 - 内件弹性模量 (MPa)
 * @param {number} E2 - 外件弹性模量 (MPa)
 * @returns {number} 接触压力 (MPa)
 */
function calcContactPressure(delta_um, d, C1, C2, E1, E2) {
  if (delta_um <= 0 || d <= 0) return 0;
  const denominator = d * (C1 / E1 + C2 / E2);
  if (denominator <= 0) return 0;
  return (delta_um / 1000) / denominator;  // δ 从 μm 转 mm
}

/**
 * 从所需接触压力反算最小过盈量
 * 公式：δ_min = p_req × d × (C₁/E₁ + C₂/E₂) × 10³  (μm)
 *
 * @param {number} p_req - 所需接触压力 (MPa)
 * @param {number} d - 配合面直径 (mm)
 * @param {number} C1 - 内件刚度系数
 * @param {number} C2 - 外件刚度系数
 * @param {number} E1 - 内件弹性模量 (MPa)
 * @param {number} E2 - 外件弹性模量 (MPa)
 * @returns {number} 所需最小过盈量 (μm)
 */
function calcMinInterference(p_req, d, C1, C2, E1, E2) {
  if (p_req <= 0 || d <= 0) return 0;
  return p_req * d * (C1 / E1 + C2 / E2) * 1000;  // μm
}

// ============================================================
// 三、应力计算
// ============================================================

/**
 * 计算外件（机座）最大周向拉应力
 * 发生在配合面内侧：σ_t₂ = p × (d_o² + d²)/(d_o² − d²)  (MPa)
 *
 * @param {number} p - 接触压力 (MPa)
 * @param {number} d - 配合面直径 (mm)
 * @param {number} d_o - 外件外径 (mm)
 * @returns {number} 最大周向应力 (MPa)
 */
function calcOuterTangentialStress(p, d, d_o) {
  const ratio = d / d_o;
  if (ratio >= 1) return Infinity;
  return p * (1 + ratio * ratio) / (1 - ratio * ratio);
}

/**
 * 计算外件（机座）内壁径向应力
 * σ_r₂ = −p（配合面处径向受压）
 *
 * @param {number} p - 接触压力 (MPa)
 * @returns {number} 径向应力 (MPa)，负值表示压缩
 */
function calcOuterRadialStress(p) {
  return -p;
}

/**
 * 计算内件（铁心）最大周向压应力
 * 发生在配合面外侧：σ_t₁ = −p × (d² + d_i²)/(d² − d_i²)  (MPa)
 *
 * @param {number} p - 接触压力 (MPa)
 * @param {number} d - 配合面直径 (mm)
 * @param {number} d_i - 内件内径 (mm)，实心=0
 * @returns {number} 最大周向应力 (MPa)，负值表示压缩
 */
function calcInnerTangentialStress(p, d, d_i) {
  if (d_i <= 0) return -p;  // 实心内件均匀受压
  const ratio = d_i / d;
  return -p * (1 + ratio * ratio) / (1 - ratio * ratio);
}

/**
 * 计算内件（铁心）内壁周向应力
 * σ_t₁_inner = −2p·d²/(d² − d_i²)  (MPa)
 *
 * @param {number} p - 接触压力 (MPa)
 * @param {number} d - 配合面直径 (mm)
 * @param {number} d_i - 内件内径 (mm)
 * @returns {number} 内壁周向应力 (MPa)
 */
function calcInnerBoreTangentialStress(p, d, d_i) {
  if (d_i <= 0) return -p;
  const ratio = d_i / d;
  return -2 * p / (1 - ratio * ratio);
}

// ============================================================
// 四、温度效应
// ============================================================

/**
 * 计算温度变化引起的过盈量变化
 * Δδ_T = d × (α₂ − α₁) × (T_op − T_amb)  (μm)
 *
 * α₂ > α₁（如铝机座+硅钢铁心）且升温 → 过盈量减小
 * α₂ < α₁（如钢机座+硅钢铁心）且升温 → 过盈量增大
 *
 * @param {number} d - 配合面直径 (mm)
 * @param {number} alpha1_perK - 内件线膨胀系数 (×10⁻⁶/°C)
 * @param {number} alpha2_perK - 外件线膨胀系数 (×10⁻⁶/°C)
 * @param {number} T_op - 工作温度 (°C)
 * @param {number} T_amb - 装配/环境温度 (°C)
 * @returns {number} 过盈量变化 (μm)，正值表示过盈增加
 */
function calcThermalDelta(d, alpha1_perK, alpha2_perK, T_op, T_amb) {
  const deltaT = T_op - T_amb;
  // 内件(铁心)外径胀大→过盈增加(+), 外件(机座)内径胀大→过盈减小(−)
  // Δδ = d × (α₁ − α₂) × ΔT  (μm)
  // α 存储为 ×10⁻⁶ 前的数值
  return d * (alpha1_perK - alpha2_perK) * 1e-6 * deltaT * 1000;  // μm
}

// ============================================================
// 五、扭矩传递校核
// ============================================================

/**
 * 计算传递扭矩所需的最小接触压力
 * p_min = 2T × K / (π × d² × l × f)  (MPa)
 *
 * @param {number} torque - 传递转矩 (N·m)
 * @param {number} K - 防滑安全系数
 * @param {number} d - 配合面直径 (mm)
 * @param {number} l - 配合长度 (mm)
 * @param {number} f - 摩擦系数
 * @returns {number} 所需最小接触压力 (MPa)
 */
function calcRequiredPressure(torque, K, d, l, f) {
  if (torque <= 0 || d <= 0 || l <= 0 || f <= 0) return 0;
  // T·1000: N·m → N·mm
  // 摩擦力矩 = p × (π·d·l) × f × d/2 = p × π·d²·l·f/2
  // 需要 ≥ T×K×1000
  // p = 2·T·K·1000 / (π·d²·l·f)
  return (2 * torque * K * 1000) / (Math.PI * d * d * l * f);
}

/**
 * 校核过盈量是否足以传递扭矩
 * @param {number} delta_actual - 实际最小过盈量 (μm)
 * @param {number} delta_thermal - 温度引起的过盈变化 (μm)
 * @param {number} delta_required - 所需最小过盈量 (μm)
 * @returns {object} 校核结果
 */
function checkTorqueCapacity(delta_actual, delta_thermal, delta_required) {
  const delta_effective = delta_actual + delta_thermal;  // 有效过盈（含温度影响）

  const margin = delta_required > 0
    ? delta_effective / delta_required
    : Infinity;

  let status;
  if (margin >= 1.3) status = '合格 — 过盈充足';
  else if (margin >= 1.0) status = '警告 — 过盈量余量不足';
  else status = '不合格 — 过盈量不足以传递转矩';

  return {
    delta_effective_um: parseFloat(delta_effective.toPrecision(4)),
    delta_required_um: parseFloat(delta_required.toPrecision(4)),
    margin: parseFloat(margin.toPrecision(3)),
    status: status
  };
}

// ============================================================
// 六、综合计算入口 — 定子铁心-机座
// ============================================================

/**
 * 定子铁心-机座过盈配合综合校核
 *
 * @param {object} params
 * @param {number} params.d - 配合面公称直径 = 铁心外径 (mm)
 * @param {number} params.d_i - 铁心内径 (mm)，即定子内孔直径
 * @param {number} params.d_o - 机座外径 (mm)
 * @param {number} params.L - 配合长度 = 铁心长度 (mm)
 * @param {number} params.delta_um - 直径过盈量 (μm)，输入名义过盈量
 * @param {string} params.coreMaterial - 铁心材料键（来自 PRESSFIT_MATERIALS）
 * @param {string} params.frameMaterial - 机座材料键
 * @param {number} params.torque - 传递转矩 (N·m)，电磁转矩反力
 * @param {number} params.speed_rpm - 转速 (rpm)，定子不转，此参数备用
 * @param {number} params.T_op - 工作温度 (°C)
 * @param {number} params.T_amb - 装配温度 (°C)，默认20
 * @param {string} params.assemblyMethod - 装配方式 ('pressFit'|'shrinkFit')
 * @param {string} params.loadType - 载荷类型 ('static'|'dynamic'|'reversing')
 * @param {object} manualAllow - 手动设定的许用应力 { sigma_t_core?, sigma_t_frame? }
 * @param {object} [params.customMaterials] - 自定义材料属性，提供时替代 PRESSFIT_MATERIALS 查表
 * @param {object} [params.customMaterials.core] - 自定义铁心材料 { E_MPa, nu, alpha_perK, sigma_b_tensile, name? }
 * @param {object} [params.customMaterials.frame] - 自定义机座材料 { E_MPa, nu, alpha_perK, sigma_s_MPa, sigma_b_tensile, name? }
 * @returns {object} 完整校核结果
 */
function calcStatorFrame(params) {
  const {
    d, d_i = 0, d_o, L,
    delta_um,
    coreMaterial = '硅钢片叠层_B50A470',
    frameMaterial = '铝合金_6061-T6',
    torque = 0,
    speed_rpm = 0,
    T_op = 120,
    T_amb = 20,
    assemblyMethod = 'shrinkFit',
    loadType = 'dynamic',
    manualAllow = {},
    customMaterials = null
  } = params;

  // ===== 输入校验 =====
  if (!d || d <= 0) return { error: true, message: '配合面直径 d 必须大于0' };
  if (!d_o || d_o <= d) return { error: true, message: '机座外径 D_o 必须大于配合面直径 d' };
  if (!L || L <= 0) return { error: true, message: '配合长度 L 必须大于0' };
  if (delta_um <= 0) return { error: true, message: '过盈量 δ 必须大于0' };

  // ===== 获取材料属性 =====
  let matCore, matFrame;

  if (customMaterials && customMaterials.core) {
    const cm = customMaterials.core;
    matCore = {
      name: cm.name || '自定义铁心材料',
      category: 'lamination',
      E_MPa: cm.E_MPa || 150000,
      nu: cm.nu != null ? cm.nu : 0.27,
      alpha_perK: cm.alpha_perK != null ? cm.alpha_perK : 12.0,
      rho_kgm3: cm.rho_kgm3 || 7650,
      sigma_s_MPa: cm.sigma_s_MPa || cm.sigma_b_tensile || 350,
      sigma_b_tensile: cm.sigma_b_tensile || 300,
      sigma_b_compress: cm.sigma_b_compress || 450,
      note: '自定义材料'
    };
  } else {
    matCore = PRESSFIT_MATERIALS[coreMaterial];
    if (!matCore) return { error: true, message: `未知铁心材料: ${coreMaterial}` };
  }

  if (customMaterials && customMaterials.frame) {
    const cm = customMaterials.frame;
    matFrame = {
      name: cm.name || '自定义机座材料',
      category: 'frame',
      E_MPa: cm.E_MPa || 70000,
      nu: cm.nu != null ? cm.nu : 0.33,
      alpha_perK: cm.alpha_perK != null ? cm.alpha_perK : 23.0,
      rho_kgm3: cm.rho_kgm3 || 2700,
      sigma_s_MPa: cm.sigma_s_MPa || cm.sigma_b_tensile || 240,
      sigma_b_tensile: cm.sigma_b_tensile || 290,
      sigma_b_compress: cm.sigma_b_compress || 290,
      note: '自定义材料'
    };
  } else {
    matFrame = PRESSFIT_MATERIALS[frameMaterial];
    if (!matFrame) return { error: true, message: `未知机座材料: ${frameMaterial}` };
  }

  const E1 = matCore.E_MPa;        // 铁心弹性模量
  const nu1 = matCore.nu;           // 铁心泊松比
  const alpha1 = matCore.alpha_perK;
  const E2 = matFrame.E_MPa;
  const nu2 = matFrame.nu;
  const alpha2 = matFrame.alpha_perK;

  // ===== 安全系数 =====
  const antiSlip = PRESSFIT_SAFETY.antiSlip;
  const K_slip = (antiSlip[loadType] || antiSlip.dynamic).value;
  const S_outer = PRESSFIT_SAFETY.strength.outerYield.value;
  const S_inner = PRESSFIT_SAFETY.strength.innerYield.value;

  // ===== 摩擦系数 =====
  let frictionPairKey;
  if (customMaterials && customMaterials.frictionPair) {
    frictionPairKey = customMaterials.frictionPair;
  } else {
    // 判断机座材料类型
    const frameName = matFrame.name;
    if (frameName.includes('铝合金') || frameName.includes('铝')) {
      frictionPairKey = 'lamination_aluminum';
    } else if (frameName.includes('铸铁') || frameName.includes('HT')) {
      frictionPairKey = 'lamination_castIron';
    } else {
      frictionPairKey = 'lamination_steel';
    }
  }

  const fricData = FRICTION_COEFFICIENTS[frictionPairKey] || FRICTION_COEFFICIENTS['lamination_steel'];
  if (!fricData) return { error: true, message: `未找到摩擦副: ${frictionPairKey}` };

  const f = assemblyMethod === 'pressFit'
    ? fricData.pressFit.value
    : fricData.shrinkFit.value;

  // ===== Step 1: 刚度系数 =====
  const d_i_eff = d_i > 0 ? d_i : 0;  // 铁心内孔
  const C1 = stiffnessInner(d, d_i_eff, nu1);  // 铁心（内件）
  const C2 = stiffnessOuter(d, d_o, nu2);       // 机座（外件）

  // ===== Step 2: 接触压力（名义过盈量下） =====
  const p_nominal = calcContactPressure(delta_um, d, C1, C2, E1, E2);

  // ===== Step 3: 温度效应 =====
  const delta_thermal = calcThermalDelta(d, alpha1, alpha2, T_op, T_amb);
  const delta_effective = delta_um + delta_thermal;
  const p_effective = delta_effective > 0
    ? calcContactPressure(delta_effective, d, C1, C2, E1, E2)
    : 0;

  // ===== Step 4: 应力分析 =====
  // 机座（外件）最大拉应力
  const sigma_t_frame = calcOuterTangentialStress(p_nominal, d, d_o);
  const sigma_r_frame = calcOuterRadialStress(p_nominal);

  // 铁心（内件）配合面压应力 + 内孔周向应力
  const sigma_t_core_outer = calcInnerTangentialStress(p_nominal, d, d_i_eff);  // 铁心配合面处
  const sigma_t_core_bore = d_i_eff > 0
    ? calcInnerBoreTangentialStress(p_nominal, d, d_i_eff)
    : sigma_t_core_outer;

  // 铁心径向压应力
  const sigma_r_core = -p_nominal;

  // ===== Step 5: 强度校核 =====
  // 用户可手写铁心许用拉应力，未填则用材料默认值
  const allowCoreTensile = manualAllow.sigma_t_core || matCore.sigma_b_tensile;
  const allowFrameTensile = manualAllow.sigma_t_frame || matFrame.sigma_b_tensile;

  // 铁心内孔周向拉应力（危险点 — 硅钢片受拉时最易破坏）
  let coreBoreEval = null;
  if (sigma_t_core_bore > 0 && d_i_eff > 0) {
    const sfCoreBore = allowCoreTensile / sigma_t_core_bore;
    const thresholdCore = PRESSFIT_SAFETY.strength.lamination.value;
    coreBoreEval = {
      stress_MPa: parseFloat(sigma_t_core_bore.toPrecision(3)),
      allowable_MPa: allowCoreTensile,
      safetyFactor: parseFloat(sfCoreBore.toPrecision(3)),
      threshold: thresholdCore,
      status: sfCoreBore >= thresholdCore ? '合格' : (sfCoreBore >= 1.0 ? '警告' : '不合格'),
      note: '铁心内孔周向拉应力 — 硅钢片抗拉能力极弱，是最危险失效点'
    };
  }

  // 机座周向拉应力
  const sfFrame = matFrame.sigma_s_MPa / sigma_t_frame;
  const frameEval = {
    stress_MPa: parseFloat(sigma_t_frame.toPrecision(3)),
    allowable_MPa: matFrame.sigma_s_MPa,
    safetyFactor: parseFloat(sfFrame.toPrecision(3)),
    threshold: S_outer,
    status: sfFrame >= S_outer ? '合格' : (sfFrame >= 1.0 ? '警告' : '不合格'),
    note: '机座内壁周向拉应力 — 超出屈服极限将导致塑性变形'
  };

  // ===== Step 6: 扭矩传递校核 =====
  let torqueCheck = null;
  if (torque > 0) {
    const p_required = calcRequiredPressure(torque, K_slip, d, L, f);
    const delta_required = calcMinInterference(p_required, d, C1, C2, E1, E2);
    torqueCheck = checkTorqueCapacity(delta_um, delta_thermal, delta_required);
    torqueCheck.p_required_MPa = parseFloat(p_required.toPrecision(3));
    torqueCheck.frictionCoeff = f;
    torqueCheck.K_slip = K_slip;
  }

  // ===== Step 7: 装配应力 =====
  // 最大过盈发生在装配时（无温度补偿），用于检查装配是否可行
  const sigma_t_frame_assembly = sigma_t_frame;  // 名义过盈量下
  const p_assembly = p_nominal;

  // ===== Step 8: 装配温差（热装法加热温度） =====
  let heatingTemp = null;
  if (assemblyMethod === 'shrinkFit') {
    // 加热机座所需温升：ΔT = (δ_max + δ_clearance) / (α₂ × d)
    // δ_clearance 为装配间隙，取 δ/4
    const delta_clearance = delta_um * 0.25;
    // α₂×1e-3×d 得到 μm/°C（因 α₂ 以 ×10⁻⁶/°C 存储）
    const deltaT_heating = (delta_um + delta_clearance) / (alpha2 * 1e-3 * d);
    heatingTemp = T_amb + deltaT_heating;
  }

  // ===== 汇总输出 =====
  function sig(v, n) {
    if (v === 0 || !isFinite(v)) return 0;
    const dg = Math.ceil(Math.log10(Math.abs(v)));
    const power = n - dg;
    const magnitude = Math.pow(10, power);
    return Math.round(v * magnitude) / magnitude;
  }

  return {
    error: false,

    // 输入回显
    input: {
      d, d_i: d_i_eff, d_o, L,
      delta_um,
      coreMaterial: matCore.name,
      frameMaterial: matFrame.name,
      torque, speed_rpm,
      T_op, T_amb,
      assemblyMethod: assemblyMethod === 'shrinkFit' ? '热装法（加热机座）' : '压入法',
      loadType,
      K_slip
    },

    // 材料参数
    materials: {
      inner: { name: matCore.name, E_MPa: E1, nu: nu1, alpha_perK: alpha1,
               sigma_b_tensile: matCore.sigma_b_tensile, sigma_s: matCore.sigma_s_MPa,
               note: matCore.note },
      outer: { name: matFrame.name, E_MPa: E2, nu: nu2, alpha_perK: alpha2,
               sigma_b_tensile: matFrame.sigma_b_tensile, sigma_s: matFrame.sigma_s_MPa,
               note: matFrame.note },
      friction: { pair: frictionPairKey, f: sig(f, 3), f_range: assemblyMethod === 'pressFit' ? fricData.pressFit.range : fricData.shrinkFit.range,
                  method: assemblyMethod === 'shrinkFit' ? '热装' : '压入' }
    },

    // 刚度系数
    stiffness: {
      C1: sig(C1, 4), C2: sig(C2, 4),
      C1_E1_ratio: sig(C1 / E1, 6), C2_E2_ratio: sig(C2 / E2, 6),
      formula: 'C₁ = (d²+d_i²)/(d²−d_i²) − ν₁, C₂ = (d_o²+d²)/(d_o²−d²) + ν₂'
    },

    // 接触压力
    pressure: {
      p_nominal_MPa: sig(p_nominal, 4),
      delta_thermal_um: sig(delta_thermal, 3),
      delta_effective_um: sig(delta_effective, 3),
      p_effective_MPa: sig(p_effective, 4),
      note: delta_thermal < 0
        ? `升温使有效过盈减少 ${sig(Math.abs(delta_thermal), 3)} μm（外件热膨胀大于内件）`
        : `升温使有效过盈增加 ${sig(delta_thermal, 3)} μm（外件热膨胀小于内件）`
    },

    // 应力分析
    stress: {
      // 铁心
      core: {
        sigma_t_outer_MPa: sig(sigma_t_core_outer, 3),    // 配合面处周向（通常为压应力）
        sigma_t_bore_MPa: sig(sigma_t_core_bore, 3),       // 内孔处周向（可能为拉应力！）
        sigma_r_MPa: sig(sigma_r_core, 3),                 // 径向压应力
        note: sigma_t_core_bore > 0
          ? '⚠️ 铁心内孔处受周向拉应力 — 硅钢片抗拉极弱，需重点检查！'
          : '铁心整体受压，状态安全'
      },
      // 机座
      frame: {
        sigma_t_max_MPa: sig(sigma_t_frame, 3),
        sigma_r_inner_MPa: sig(sigma_r_frame, 3),
        eval: frameEval
      },
      // 铁心内孔拉应力评估
      coreBoreEval: coreBoreEval,
      // 装配应力
      assembly: {
        p_assembly_MPa: sig(p_assembly, 4),
        sigma_t_frame_assembly_MPa: sig(sigma_t_frame_assembly, 3),
        heatingTemp_degC: heatingTemp ? sig(heatingTemp, 3) : null,
        heatingNote: heatingTemp
          ? `建议加热机座至 ${sig(heatingTemp, 3)}°C 以上（${assemblyMethod === 'shrinkFit' ? '热装法' : ''}）`
          : null
      }
    },

    // 扭矩传递
    torqueCheck: torqueCheck,

    // 许用值（供手动调整参考）
    allowables: {
      coreTensile_MPa: allowCoreTensile,
      frameYield_MPa: matFrame.sigma_s_MPa,
      coreTensileSource: manualAllow.sigma_t_core ? '手动设定' : '材料默认'
    }
  };
}

// ============================================================
// 七、导出
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    stiffnessInner,
    stiffnessOuter,
    calcContactPressure,
    calcMinInterference,
    calcOuterTangentialStress,
    calcOuterRadialStress,
    calcInnerTangentialStress,
    calcInnerBoreTangentialStress,
    calcThermalDelta,
    calcRequiredPressure,
    checkTorqueCapacity,
    calcStatorFrame
  };
}
