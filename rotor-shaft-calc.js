/**
 * ============================================================
 * rotor-shaft-calc.js — 转子铁心-转轴过盈配合计算层
 * 依据：《机械设计手册》第五版 第2卷 第6章 — 过盈联接
 *       GB/T 5371-2004《极限与配合 过盈配合的计算和选用》
 *
 * 职责：仅存放纯计算函数、校核逻辑
 * 禁止：任何 DOM 操作、界面交互代码
 *
 * 物理模型：
 *   内件 = 转轴（钢，实心或空心）
 *   外件 = 转子铁心（硅钢片叠层，有空心—配合面到转子外圆）
 *   通过过盈配合传递电机全部电磁转矩
 *   离心力使铁心外胀，高温运行下过盈量减小
 *
 * 关键风险：硅钢片叠层周向抗拉强度极低，是转子过盈设计的第一限制因素
 *
 * 默认单位：长度 mm，应力/压强 MPa，过盈量 μm，转速 rpm
 * ============================================================
 */

// ============================================================
// 一、厚壁圆筒刚度系数（与 stator-frame-calc 共用公式）
// ============================================================

/**
 * 计算内圆筒（转轴）刚度系数 C₁
 * 实心轴（d_i = 0）：C₁ = 1 − ν₁
 *
 * @param {number} d - 配合面直径 (mm)，即轴外径
 * @param {number} d_i - 轴内径 (mm)，实心轴=0
 * @param {number} nu - 轴材料泊松比
 * @returns {number} C₁
 */
function shaftStiffness(d, d_i, nu) {
  if (d_i <= 0 || d_i >= d * 0.999) {
    return 1 - nu;
  }
  const ratio = d_i / d;
  return (1 + ratio * ratio) / (1 - ratio * ratio) - nu;
}

/**
 * 计算外圆筒（转子铁心）刚度系数 C₂
 *
 * @param {number} d - 配合面直径 (mm)，即铁心内径
 * @param {number} d_o - 铁心外径 (mm)
 * @param {number} nu - 铁心泊松比
 * @returns {number} C₂
 */
function coreStiffness(d, d_o, nu) {
  if (d_o <= d) return Infinity;
  const ratio = d / d_o;
  return (1 + ratio * ratio) / (1 - ratio * ratio) + nu;
}

// ============================================================
// 二、过盈-压力换算
// ============================================================

/**
 * 从过盈量计算接触压力
 * @param {number} delta_um - 直径过盈量 (μm)
 * @param {number} d - 配合面直径 (mm)
 * @param {number} C1 - 轴刚度系数
 * @param {number} C2 - 铁心刚度系数
 * @param {number} E1 - 轴弹性模量 (MPa)
 * @param {number} E2 - 铁心弹性模量 (MPa)
 * @returns {number} 接触压力 (MPa)
 */
function calcContactPressureRS(delta_um, d, C1, C2, E1, E2) {
  if (delta_um <= 0 || d <= 0) return 0;
  return (delta_um / 1000) / (d * (C1 / E1 + C2 / E2));
}

/**
 * 从压力反算过盈量
 * @param {number} p - 所需接触压力 (MPa)
 * @param {number} d - 配合面直径 (mm)
 * @param {number} C1 - 轴刚度系数
 * @param {number} C2 - 铁心刚度系数
 * @param {number} E1 - 轴弹性模量 (MPa)
 * @param {number} E2 - 铁心弹性模量 (MPa)
 * @returns {number} 所需过盈量 (μm)
 */
function calcRequiredInterferenceRS(p, d, C1, C2, E1, E2) {
  if (p <= 0 || d <= 0) return 0;
  return p * d * (C1 / E1 + C2 / E2) * 1000;
}

// ============================================================
// 三、应力计算
// ============================================================

/**
 * 外件（铁心）配合面周向拉应力 — 这是最关键的失效判据！
 * σ_t_core = p × (d_o² + d²)/(d_o² − d²)
 *
 * @param {number} p - 接触压力 (MPa)
 * @param {number} d - 配合面直径 (mm)
 * @param {number} d_o - 铁心外径 (mm)
 * @returns {number} 周向拉应力 (MPa)
 */
function coreTangentialStress(p, d, d_o) {
  const ratio = d / d_o;
  if (ratio >= 1) return Infinity;
  return p * (1 + ratio * ratio) / (1 - ratio * ratio);
}

/**
 * 内件（轴）配合面周向压应力
 * 实心轴：σ_t_shaft = −p
 * 空心轴：σ_t_shaft = −p × (d² + d_i²)/(d² − d_i²)
 *
 * @param {number} p - 接触压力 (MPa)
 * @param {number} d - 配合面直径 (mm)
 * @param {number} d_i - 轴内径 (mm)，实心=0
 * @returns {number} 周向应力 (MPa)，负值=压缩
 */
function shaftTangentialStress(p, d, d_i) {
  if (d_i <= 0) return -p;
  const ratio = d_i / d;
  return -p * (1 + ratio * ratio) / (1 - ratio * ratio);
}

/**
 * 铁心外圆处周向应力
 * σ_t_outer = p × 2d²/(d_o² − d²)
 *
 * @param {number} p - 接触压力 (MPa)
 * @param {number} d - 配合面直径 (mm)
 * @param {number} d_o - 铁心外径 (mm)
 * @returns {number} 外圆处周向应力 (MPa)
 */
function coreOuterTangentialStress(p, d, d_o) {
  const ratio = d / d_o;
  if (ratio >= 1) return Infinity;
  return 2 * p / (1 - ratio * ratio) * ratio * ratio;
}

// ============================================================
// 四、离心力效应
// ============================================================

/**
 * 计算转子铁心因离心力产生的配合面径向位移
 * 简化公式：u_ω = ρ·ω²·d³·(3+ν)/(32·E) × 10³  (μm)
 *
 * 机理：铁心在离心力作用下胀开，配合面径向向外位移，
 * 相当于过盈量减小。这是高速电机转子过盈设计的核心问题。
 *
 * 更精确的厚壁筒离心位移公式：
 * u_ω = ρ·ω²·d / (4E) × [ (1−ν)·d² + (3+ν)·d_o² ] / 4  × 10³ μm
 * (取配合面处径向位移的贡献)
 *
 * @param {number} d - 配合面直径 (mm)
 * @param {number} d_o - 铁心外径 (mm)
 * @param {number} rho - 铁心材料密度 (kg/m³)
 * @param {number} E - 铁心弹性模量 (MPa)
 * @param {number} nu - 铁心泊松比
 * @param {number} speed_rpm - 转速 (rpm)
 * @returns {object} 离心位移结果
 */
function calcCentrifugalEffect(d, d_o, rho, E, nu, speed_rpm) {
  if (speed_rpm <= 0) {
    return {
      delta_centrifugal_um: 0,
      omega_rad_s: 0,
      tipSpeed_ms: 0,
      note: '转速为零，无离心力效应'
    };
  }

  const omega = speed_rpm * Math.PI / 30;  // rad/s
  const tipSpeed = omega * (d_o / 2000);    // 铁心外圆线速度 (m/s)

  // 旋转厚壁筒在配合面处的径向位移 (mm)
  // u_ω = ρω²/(8E) × { (1-ν)(3+ν)(r_o²+r_i²) + (1+ν)(3+ν)r_i² − (1-ν²)r_o² } × r
  // 简化处理：取配合面处在自由旋转条件下的径向位移
  // u_ω ≈ ρ·ω²·d³ / (8E) × [ (3+ν)/4 × (1 + (d/d_o)²) ]  (mm)
  const ratio = d / d_o;
  const factor = (3 + nu) * (1 + ratio * ratio) / 4;
  // 单位转换：ρ[kg/m³]→需×1e-12 配合 d[mm], ω[rad/s], E[MPa] → 位移[mm]
  // 推导：u[μm] = ρ·ω²·d³·factor / (8·E·1e9)
  //       u[mm] = u[μm] / 1000
  //       代码中先算 mm 再转 μm
  // 修正：ρ_eff = ρ / 1e12 (使量纲正确)
  const u_omega_mm = (rho * 1e-12) * omega * omega * Math.pow(d, 3) * factor / (8 * E);

  // 转换为 μm
  const delta_centrifugal_um = u_omega_mm * 1000;

  // 铁心外圆处的离心拉应力（参考值）
  // σ[MPa] = ρ·ω²·d_o²·(3+ν) / (8·1e12) — 量纲修正同位移
  const sigma_centrifugal = (rho * 1e-12) * omega * omega * d_o * d_o * (3 + nu) / 8;

  return {
    delta_centrifugal_um: parseFloat(delta_centrifugal_um.toPrecision(3)),
    _delta_centrifugal: delta_centrifugal_um,
    omega_rad_s: parseFloat(omega.toPrecision(3)),
    tipSpeed_ms: parseFloat(tipSpeed.toPrecision(3)),
    sigma_centrifugal_outer_MPa: parseFloat(sigma_centrifugal.toPrecision(3)),
    note: `ω=${omega.toFixed(1)} rad/s, 外圆线速度 ${tipSpeed.toFixed(1)} m/s, 离心力使铁心外胀释放过盈 ${delta_centrifugal_um.toFixed(2)} μm`
  };
}

// ============================================================
// 五、温度效应
// ============================================================

/**
 * 计算温度引起的过盈量变化
 * 钢轴与硅钢片的热膨胀系数接近，温度效应相对较小
 * 但铁心因涡流损耗温度通常比轴高
 *
 * @param {number} d - 配合面直径 (mm)
 * @param {number} alpha_shaft - 轴热膨胀系数 (×10⁻⁶/°C)
 * @param {number} alpha_core - 铁心热膨胀系数 (×10⁻⁶/°C)
 * @param {number} T_core - 铁心工作温度 (°C)
 * @param {number} T_shaft - 轴工作温度 (°C)
 * @param {number} T_amb - 装配温度 (°C)
 * @returns {number} 过盈变化 (μm)
 */
function calcThermalDeltaRS(d, alpha_shaft, alpha_core, T_core, T_shaft, T_amb) {
  // 铁心内孔热胀→过盈减小(−), 轴外径热胀→过盈增加(+)
  // 综合：Δδ = [α_shaft×(T_shaft−T_amb) − α_core×(T_core−T_amb)] × d × 1000  (μm)
  const delta_shaft = alpha_shaft * 1e-6 * (T_shaft - T_amb) * d * 1000;  // 轴胀→过盈增加 (μm)
  const delta_core = alpha_core * 1e-6 * (T_core - T_amb) * d * 1000;     // 铁心胀→过盈减小 (μm)
  // 铁心内孔胀大 > 轴胀大 → 过盈减小
  const delta_thermal = delta_shaft - delta_core;

  return delta_thermal;
}

// ============================================================
// 六、扭矩传递校核
// ============================================================

/**
 * 计算传递转矩所需最小接触压力
 * p_min = 2T·K / (π·d²·L·f)  (MPa)
 *
 * @param {number} torque - 传递转矩 (N·m)
 * @param {number} K - 防滑安全系数
 * @param {number} d - 配合面直径 (mm)
 * @param {number} L - 配合长度 (mm)
 * @param {number} f - 摩擦系数
 * @returns {number} 所需最小接触压力 (MPa)
 */
function calcRequiredPressureRS(torque, K, d, L, f) {
  if (torque <= 0 || d <= 0 || L <= 0 || f <= 0) return 0;
  return (2 * torque * K * 1000) / (Math.PI * d * d * L * f);
}

// ============================================================
// 七、综合计算入口 — 转子铁心-转轴
// ============================================================

/**
 * 转子铁心-转轴过盈配合综合校核
 *
 * @param {object} params
 * @param {number} params.d - 配合面直径 = 轴外径 = 铁心内径 (mm)
 * @param {number} params.d_i - 转轴内径 (mm)，实心轴=0
 * @param {number} params.d_o - 转子铁心外径 (mm)
 * @param {number} params.L - 配合长度 = 铁心长度 (mm)
 * @param {number} params.delta_um - 直径过盈量 (μm)
 * @param {string} params.shaftMaterial - 轴材料键
 * @param {string} params.coreMaterial - 铁心材料键
 * @param {number} params.torque - 传递转矩 (N·m)
 * @param {number} params.speed_rpm - 转速 (rpm)
 * @param {number} params.T_core - 铁心工作温度 (°C)
 * @param {number} params.T_shaft - 轴工作温度 (°C)
 * @param {number} params.T_amb - 装配温度 (°C)
 * @param {string} params.assemblyMethod - 装配方式 ('pressFit'|'shrinkFit')
 * @param {string} params.loadType - 载荷类型
 * @param {object} manualAllow - 手动设定许用应力 { sigma_t_core?, sigma_c_shaft? }
 * @param {object} [params.customMaterials] - 自定义材料属性
 * @param {object} [params.customMaterials.shaft] - 自定义轴材料 { E_MPa, nu, alpha_perK, sigma_s_MPa, sigma_b_compress, name? }
 * @param {object} [params.customMaterials.core] - 自定义铁心材料 { E_MPa, nu, alpha_perK, sigma_b_tensile, rho_kgm3, name? }
 * @returns {object}
 */
function calcRotorShaft(params) {
  const {
    d, d_i = 0, d_o, L,
    delta_um,
    shaftMaterial = '45钢',
    coreMaterial = '硅钢片叠层_B50A470',
    torque = 0,
    speed_rpm = 0,
    T_core = 100,
    T_shaft = 80,
    T_amb = 20,
    assemblyMethod = 'shrinkFit',
    loadType = 'dynamic',
    manualAllow = {},
    customMaterials = null
  } = params;

  // ===== 输入校验 =====
  if (!d || d <= 0) return { error: true, message: '配合面直径 d 必须大于0' };
  if (!d_o || d_o <= d) return { error: true, message: '铁心外径 D_o 必须大于配合面直径 d' };
  if (!L || L <= 0) return { error: true, message: '配合长度 L 必须大于0' };
  if (delta_um <= 0) return { error: true, message: '过盈量 δ 必须大于0' };

  // ===== 材料属性 =====
  let matShaft, matCore;

  if (customMaterials && customMaterials.shaft) {
    const cm = customMaterials.shaft;
    matShaft = {
      name: cm.name || '自定义轴材料',
      category: 'steel_shaft',
      E_MPa: cm.E_MPa || 206000,
      nu: cm.nu != null ? cm.nu : 0.30,
      alpha_perK: cm.alpha_perK != null ? cm.alpha_perK : 11.5,
      rho_kgm3: cm.rho_kgm3 || 7850,
      sigma_s_MPa: cm.sigma_s_MPa || cm.sigma_b_compress || 355,
      sigma_b_tensile: cm.sigma_b_tensile || 600,
      sigma_b_compress: cm.sigma_b_compress || cm.sigma_s_MPa || 600,
      note: '自定义材料'
    };
  } else {
    matShaft = PRESSFIT_MATERIALS[shaftMaterial];
    if (!matShaft) return { error: true, message: `未知轴材料: ${shaftMaterial}` };
  }

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

  const E1 = matShaft.E_MPa;           // 轴
  const nu1 = matShaft.nu;
  const alpha1 = matShaft.alpha_perK;
  const E2 = matCore.E_MPa;            // 铁心
  const nu2 = matCore.nu;
  const alpha2 = matCore.alpha_perK;
  const rho2 = matCore.rho_kgm3;

  // ===== 安全系数 =====
  const antiSlip = PRESSFIT_SAFETY.antiSlip;
  const K_slip = (antiSlip[loadType] || antiSlip.dynamic).value;
  if (speed_rpm > 10000) {
    // 高速工况自动上调防滑系数
    // K_slip 已在 data 中定义，此处不再修改，在校核结果中提示
  }
  const S_core = PRESSFIT_SAFETY.strength.lamination.value;
  const S_shaft = PRESSFIT_SAFETY.strength.innerYield.value;

  // ===== 摩擦系数 =====
  const frictionPairKey = 'lamination_steel';
  const fricData = FRICTION_COEFFICIENTS[frictionPairKey];
  const f = assemblyMethod === 'pressFit'
    ? fricData.pressFit.value
    : fricData.shrinkFit.value;

  // ===== Step 1: 刚度系数 =====
  const d_i_eff = d_i > 0 ? d_i : 0;
  const C1 = shaftStiffness(d, d_i_eff, nu1);   // 轴
  const C2 = coreStiffness(d, d_o, nu2);         // 铁心

  // ===== Step 2: 接触压力 =====
  const p_nominal = calcContactPressureRS(delta_um, d, C1, C2, E1, E2);

  // ===== Step 3: 离心效应 =====
  const centrifugal = calcCentrifugalEffect(d, d_o, rho2, E2, nu2, speed_rpm);

  // ===== Step 4: 温度效应 =====
  const delta_thermal = calcThermalDeltaRS(d, alpha1, alpha2, T_core, T_shaft, T_amb);

  // ===== Step 5: 有效过盈量 =====
  // 离心力使铁心内孔胀大 → 过盈减小
  // 温度：铁心温度通常高于轴 → 铁心内孔胀大 > 轴胀大 → 过盈减小
  const delta_effective = delta_um - centrifugal.delta_centrifugal_um + delta_thermal;
  const p_effective = delta_effective > 0
    ? calcContactPressureRS(delta_effective, d, C1, C2, E1, E2)
    : 0;

  // ===== Step 6: 应力分析 =====
  // 铁心配合面周向拉应力（最关键！）
  const sigma_t_core = coreTangentialStress(p_nominal, d, d_o);
  const sigma_t_core_outer = coreOuterTangentialStress(p_nominal, d, d_o);

  // 轴配合面周向应力
  const sigma_t_shaft = shaftTangentialStress(p_nominal, d, d_i_eff);
  const sigma_r_shaft = -p_nominal;

  // 叠加离心应力（铁心外圆处）
  const sigma_t_core_outer_total = sigma_t_core_outer + centrifugal.sigma_centrifugal_outer_MPa;

  // ===== Step 7: 强度校核 =====
  const allowCoreTensile = manualAllow.sigma_t_core || matCore.sigma_b_tensile;
  const allowShaftCompress = manualAllow.sigma_c_shaft || matShaft.sigma_b_compress;

  // 铁心拉应力校核
  const sfCore = allowCoreTensile / sigma_t_core;
  const coreEval = {
    stress_MPa: parseFloat(sigma_t_core.toPrecision(3)),
    stressOuter_MPa: parseFloat(sigma_t_core_outer_total.toPrecision(3)),
    allowable_MPa: allowCoreTensile,
    safetyFactor: parseFloat(sfCore.toPrecision(3)),
    threshold: S_core,
    status: sfCore >= S_core ? '合格' : (sfCore >= 1.3 ? '警告' : '不合格'),
    note: sfCore < S_core
      ? '⚠️ 铁心周向拉应力安全系数不足！硅钢片抗拉强度极低，是转子过盈的第一限制因素。建议减小过盈量或选用高牌号硅钢片'
      : '铁心拉应力在安全范围内'
  };

  // 轴压应力校核
  const sfShaft = allowShaftCompress / Math.abs(sigma_t_shaft);
  const shaftEval = {
    stress_MPa: parseFloat(Math.abs(sigma_t_shaft).toPrecision(3)),
    allowable_MPa: allowShaftCompress,
    safetyFactor: parseFloat(sfShaft.toPrecision(3)),
    threshold: S_shaft,
    status: sfShaft >= S_shaft ? '合格' : (sfShaft >= 1.0 ? '警告' : '不合格'),
    note: '轴表面受压，一般裕度充足'
  };

  // ===== Step 8: 扭矩传递校核 =====
  let torqueCheck = null;
  if (torque > 0) {
    const p_required = calcRequiredPressureRS(torque, K_slip, d, L, f);
    const delta_required = calcRequiredInterferenceRS(p_required, d, C1, C2, E1, E2);
    torqueCheck = {
      p_required_MPa: parseFloat(p_required.toPrecision(3)),
      delta_required_um: parseFloat(delta_required.toPrecision(3)),
      delta_effective_um: parseFloat(delta_effective.toPrecision(3)),
      margin: delta_effective > 0 && delta_required > 0
        ? parseFloat((delta_effective / delta_required).toPrecision(3))
        : 0,
      status: delta_effective >= delta_required * 1.3
        ? '合格 — 过盈充足'
        : (delta_effective >= delta_required ? '警告 — 余量不足' : '不合格 — 过盈量不足以传递转矩'),
      frictionCoeff: f,
      K_slip: K_slip
    };
    torqueCheck.p_effective_MPa = parseFloat(p_effective.toPrecision(3));
  }

  // ===== Step 9: 装配参数 =====
  let heatingTemp = null;
  if (assemblyMethod === 'shrinkFit') {
    const delta_clearance = delta_um * 0.25;
    // α₂×1e-3×d 得到 μm/°C（因 α₂ 以 ×10⁻⁶/°C 存储）
    const deltaT_heating = (delta_um + delta_clearance) / (alpha2 * 1e-3 * d);
    heatingTemp = T_amb + deltaT_heating;
  }

  // ===== 汇总 =====
  function sig(v, n) {
    if (v === 0 || !isFinite(v)) return 0;
    const dg = Math.ceil(Math.log10(Math.abs(v)));
    const power = n - dg;
    const magnitude = Math.pow(10, power);
    return Math.round(v * magnitude) / magnitude;
  }

  return {
    error: false,

    input: {
      d, d_i: d_i_eff, d_o, L,
      delta_um,
      shaftMaterial: matShaft.name,
      coreMaterial: matCore.name,
      torque, speed_rpm,
      T_core, T_shaft, T_amb,
      assemblyMethod: assemblyMethod === 'shrinkFit' ? '热装法' : '压入法',
      loadType, K_slip
    },

    materials: {
      shaft: { name: matShaft.name, E_MPa: E1, nu: nu1, alpha_perK: alpha1,
               sigma_s: matShaft.sigma_s_MPa, sigma_b_tensile: matShaft.sigma_b_tensile,
               sigma_b_compress: matShaft.sigma_b_compress, note: matShaft.note },
      core: { name: matCore.name, E_MPa: E2, nu: nu2, alpha_perK: alpha2,
              rho_kgm3: rho2, sigma_b_tensile: matCore.sigma_b_tensile,
              note: matCore.note },
      friction: { pair: frictionPairKey, f: sig(f, 3), f_range: assemblyMethod === 'pressFit' ? fricData.pressFit.range : fricData.shrinkFit.range }
    },

    stiffness: {
      C1: sig(C1, 4), C2: sig(C2, 4),
      formula: 'C₁(轴) = (d²+d_i²)/(d²−d_i²) − ν₁, C₂(铁心) = (d_o²+d²)/(d_o²−d²) + ν₂'
    },

    pressure: {
      p_nominal_MPa: sig(p_nominal, 4),
      p_effective_MPa: sig(p_effective, 4),
      delta_nominal_um: delta_um,
      delta_centrifugal_um: centrifugal.delta_centrifugal_um,
      delta_thermal_um: sig(delta_thermal, 3),
      delta_effective_um: sig(delta_effective, 3)
    },

    centrifugal: {
      delta_loss_um: centrifugal.delta_centrifugal_um,
      omega_rad_s: centrifugal.omega_rad_s,
      tipSpeed_ms: centrifugal.tipSpeed_ms,
      sigma_outer_MPa: centrifugal.sigma_centrifugal_outer_MPa,
      note: centrifugal.note + (centrifugal.delta_centrifugal_um > 1.0
        ? ' ⚠️ 离心力导致的过盈损失显著（>1μm），高速电机需重点考虑'
        : '')
    },

    stress: {
      core: {
        sigma_t_inner_MPa: sig(sigma_t_core, 3),
        sigma_t_outer_MPa: sig(sigma_t_core_outer_total, 3),
        sigma_r_MPa: sig(-p_nominal, 3),
        eval: coreEval
      },
      shaft: {
        sigma_t_MPa: sig(sigma_t_shaft, 3),
        sigma_r_MPa: sig(sigma_r_shaft, 3),
        eval: shaftEval
      }
    },

    torqueCheck: torqueCheck,

    assembly: {
      heatingTemp_degC: heatingTemp ? sig(heatingTemp, 3) : null,
      heatingNote: heatingTemp
        ? `建议加热转子铁心至 ${sig(heatingTemp, 3)}°C 以上（热装法），注意硅钢片叠层温度不宜超过350°C`
        : null,
      pressForceNote: assemblyMethod === 'pressFit'
        ? `压入力参考：F ≈ π·d·L·p·f × 10³ ≈ ${sig(Math.PI * d * L * p_nominal * f, 2)} N`
        : null
    },

    allowables: {
      coreTensile_MPa: allowCoreTensile,
      shaftCompress_MPa: allowShaftCompress,
      coreTensileSource: manualAllow.sigma_t_core ? '手动设定' : '材料默认',
      shaftCompressSource: manualAllow.sigma_c_shaft ? '手动设定' : '材料默认'
    },

    warnings: []
  };
}

// ============================================================
// 八、导出
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    shaftStiffness,
    coreStiffness,
    calcContactPressureRS,
    calcRequiredInterferenceRS,
    coreTangentialStress,
    shaftTangentialStress,
    coreOuterTangentialStress,
    calcCentrifugalEffect,
    calcThermalDeltaRS,
    calcRequiredPressureRS,
    calcRotorShaft
  };
}
